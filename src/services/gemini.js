import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 외국어 학습을 위한 최고의 AI 언어학자이자 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **[출력 규칙]**에 따라 JSON 포맷으로 응답하세요.

**[1. 분석 원칙 - 대본 추출 및 상세 분석]**

1. **무손실 추출 및 비언어적 요소 제거**:
   - 모든 실제 발화를 누락 없이 포착하되, (음악), (박수) 등의 비언어적 묘사는 완전히 제거하고 오직 사람의 발화만 남기세요.
   - 후렴구 등 반복되는 가사도 절대로 생략하거나 그룹화하지 말고 각 시간대별로 개별 추출하세요.

2. **순차 전수 분석 (Word Analysis)**:
   - 문장 내 모든 단어/뭉치(Chunk)를 등장 순서대로 분석합니다. 누락은 절대 금지입니다.
   - **중복 설명 허용**: 이전 문장에서 나온 단어라도 현재 문장에서 쓰였다면 반드시 다시 설명하세요.
   - **의미 단위 덩어리(Chunk) 분석**: 기계적인 단어 쪼개기보다 'Hợp đồng này', 'được ký rồi'와 같이 의미가 연결되는 덩어리로 묶어서 맥락과 뉘앙스를 직관적으로 설명하세요.
   - **베트남어 특화 (Hán tự)**: 복합어는 음절별로 떼지 말고 한 항목에서 각 음절의 뜻(한자어 포함)을 함께 설명하세요. 
     * 예시: tiền cọc -> tiền (錢 전 - 돈) + cọc (보증)

3. **문장 패턴화 (Sentence Patterns)**:
   - 문장의 뼈대가 되는 공식을 추출하세요. (예: [A] càng [B] càng [C] -> "A가 B할수록 더 C하다")
   - 해당 패턴의 의미와 응용 예시(Application)를 1개 이상 포함하세요.

**[2. JSON 출력 규격 (Byte Saving)]**

데이터 전송 효율을 위해 아래의 단축 키를 반드시 사용하세요:
- "s": timestamp (예: "[00:10.5]")
- "v": seconds (Float 시작 시간)
- "e": endSeconds (Float 종료 시간)
- "o": text (원본 문장)
- "t": translation (번역)
- "p": patterns (배열): "t" (패턴 공식/설명), "d" (의미 및 응용 예시)
- "w": words (배열): "w" (단어/뭉치), "m" (뜻/Hán tự 포함 상세 설명), "f" (품사/역할/문법)

**[3. 응답 형식]**
- 어떤 부연 설명 없이 오직 유효한 JSON Array([ {...}, {...} ])만 출력하세요.
- 줄바꿈이나 공백을 최소화하여 압축된 포맷으로 응답하세요.
`;

export async function analyzeMedia(file, apiKey) {
    if (!apiKey) throw new Error("API Key is required");

    // Basic validation
    if (!file) throw new Error("No file provided");

    // Size limit check removed to allow larger files as requested. 
    // Browser base64 limit might still apply, but we allow the attempt.
    console.log(`Analyzing file: ${file.name} (${file.type}, ${file.size} bytes)`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Prioritize 2.5 Flash for maximum token capacity
    const MODELS_TO_TRY = [
        "gemini-2.5-flash",
        "gemini-2.0-flash"
    ];

    try {
        // Determine MIME type with fallback
        let mimeType = file.type;
        if (!mimeType) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'mp3') mimeType = 'audio/mp3';
            else if (ext === 'wav') mimeType = 'audio/wav';
            else if (ext === 'm4a') mimeType = 'audio/mp4';
            else if (ext === 'mp4') mimeType = 'video/mp4';
            else mimeType = 'audio/mpeg'; // Generic fallback
        }

        // Convert file to base64
        const base64Data = await fileToGenerativePart(file);

        let result;
        let lastError;

        // Try each model until one succeeds
        for (let rawName of MODELS_TO_TRY) {
            // Clean model ID to prevent redundant 'models/' prefix
            const modelName = rawName.startsWith('models/') ? rawName.replace('models/', '') : rawName;

            console.log(`Diagnostic: Expected URL: https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.substring(0, 4)}...`);
            console.log(`Attempting analysis with model: ${modelName} (JSON Mode)`);

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: {
                    responseMimeType: "application/json",
                }
            }, { apiVersion: "v1beta" });


            let retryCount = 0;
            const maxRetries = 2;
            let modelSuccess = false;

            while (retryCount <= maxRetries) {
                try {
                    result = await model.generateContent([
                        SYSTEM_PROMPT,
                        {
                            inlineData: {
                                data: base64Data,
                                mimeType: mimeType,
                            },
                        },
                    ]);
                    modelSuccess = true;
                    break;
                } catch (err) {
                    const errorMsg = err.message.toLowerCase();

                    // 1. Check for 503/Overloaded (Retry same model)
                    if (errorMsg.includes("503") || errorMsg.includes("overloaded")) {
                        retryCount++;
                        if (retryCount <= maxRetries) {
                            console.warn(`Model ${modelName} overloaded. Retrying (${retryCount}/${maxRetries})...`);
                            await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount - 1)));
                            continue;
                        }
                    }

                    // 2. Check for 404/NotFound (Try next model immediately)
                    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
                        console.warn(`Model ${modelName} not found (404). Checking next fallback...`);
                        lastError = err;
                        break;
                    }

                    // 3. Other errors
                    lastError = err;
                    console.error(`Error with model ${modelName}:`, err);
                    break;
                }
            }

            if (modelSuccess) break;
        }

        if (!result) {
            throw lastError || new Error("All fallback models failed to respond. Check API Key and Model availability.");
        }

        const response = await result.response;
        let text = response.text();
        console.log("Gemini Raw (Start):", text.substring(0, 100));

        // 1. Markdown/Text Cleaning
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // 2. Truncation Repair Logic
        const tryRepairJson = (str) => {
            str = str.trim();
            if (str.endsWith(']')) return str;

            console.warn("JSON might be truncated. Attempting repair...");

            let repaired = str;
            const openBraces = (repaired.match(/{/g) || []).length;
            const closeBraces = (repaired.match(/}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/]/g) || []).length;

            const quoteCount = (repaired.match(/"/g) || []).length;
            if (quoteCount % 2 !== 0) repaired += '"';

            if (openBraces > closeBraces) repaired += ' }';
            if (openBrackets > closeBrackets) repaired += ' ]';

            return repaired;
        };

        const processedText = tryRepairJson(text);

        try {
            return JSON.parse(processedText);
        } catch (parseErr) {
            console.error("JSON Parse Error:", parseErr);
            // Fallback attempt: find the last valid object in the array
            const lastValidIndex = processedText.lastIndexOf('},');
            if (lastValidIndex !== -1) {
                try {
                    return JSON.parse(processedText.substring(0, lastValidIndex + 1) + ']');
                } catch (e) { }
            }
            throw new Error(`AI Analysis Failed (JSON Syntax Error): ${parseErr.message}`);
        }

    } catch (e) {
        console.error("Gemini Analysis Error:", e);
        // Enhance error message for user
        let msg = "AI Analysis Failed: " + e.message;
        if (e.message.includes("400")) msg = "Invalid Request (400). File might be too large for browser preview. Please try a smaller snippet if this continues.";
        if (e.message.includes("401") || e.message.includes("API key")) msg = "Invalid API Key. Please check your settings.";
        if (e.message.includes("503") || e.message.includes("overloaded")) msg = "Server Overloaded (503). The AI model is currently busy. Please wait a moment and try again.";
        if (e.message.includes("500")) msg = "Gemini Server Error. Please try again later.";
        throw new Error(msg);
    }
}

async function fileToGenerativePart(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                const base64String = reader.result.split(",")[1];
                resolve(base64String);
            } else {
                reject(new Error("Failed to read file"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
