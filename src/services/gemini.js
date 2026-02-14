import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 영어 등 외국어 학습을 위한 최고의 AI 언어학자이자 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **[출력 규칙]**에 따라 JSON 포맷으로 응답하세요.

**[0. 중요 원칙 - 언어 설정]**
- **모든 설명은 반드시 한국어(Korean)로 작성하세요.** 원본 문장 언어와 무관하게 모든 분석 결과는 한글이어야 합니다.

**[1. 분석 원칙 - 대본 추출 및 상세 분석]**

1. **무손실 추출 및 비언어적 요소 제거**: 모든 발화를 누락 없이 포착하되, (음악) 등 비언어적 묘사는 제거하세요.
2. **순차적 덩어리(Chunk) 분석 (Word Analysis)**:
   - 문장 내 모든 의미 단위를 등장 순서대로 분석합니다.
   - **출력 양식**: "w" 에는 덩어리를, "m" 에는 "[품사] 뜻"을, "f" 에는 상세 설명(한자어 breakdown, 구성 단어 뜻 등)을 작성하세요.
   - 예시: "w": "Hợp đồng", "m": "[명사] 계약", "f": "Hợp (合 합 - 합하다) + đồng (同 동 - 한가지)가 합쳐져 '계약'을 의미."

3. **문장 패턴화 (Sentence Patterns)**:
   - 문장의 뼈대가 되는 패턴을 추출하고, 의미와 반드시 "응용:" 형태의 예시를 포함하세요.
   - **출력 양식**: "t" 에는 패턴 공식을, "d" 에는 "(의미) \\n\\n응용: [예시]"를 작성하세요.

**[2. JSON 출력 규격 (Byte Saving)]**
- "s": timestamp, "v": startSeconds, "e": endSeconds, "o": text, "t": translation
- "p": patterns (t: 패턴공식, d: 의미 및 응용)
- "w": words (w: 덩어리, m: [품사] 뜻, f: 상세 설명)

**[3. 분석 스타일 가이드 (Style Reference - 반드시 이 양식을 따를 것)]**

**예시 1 (베트남어)**:
- 원문: "Hợp đồng này được ký rồi, mà mình còn chưa nhận được tiền cọc nhỉ?"
- 번역: "이 계약서는 이미 체결되었는데, 우리 아직 계약금을 못 받았지?"
- 패턴: [A] được [동사] rồi, mà [B] còn chưa [동사] nhỉ? (A는 이미 ~되었는데, B는 아직 ~하지 않았지? \\n\\n응용: Lô hàng được giao rồi, mà khách còn chưa thanh toán nhỉ?)
- 단어분석:
  ["Hợp đồng", "[명사] 계약", "Hợp (合 합 - 합하다) + đồng (同 동 - 한가지)가 합쳐져 '계약'을 의미."],
  ["này", "[지시사] 이", "명사 뒤에서 해당 대상을 지칭."],
  ["được ký", "[수동태 동사구] 체결되다", "được (~되다/긍정 수동) + ký (사인하다)."]

**예시 2 (베트남어)**:
- 원문: "Tiếng Việt càng học càng thấy thú vị."
- 번역: "베트남어는 공부하면 할수록 더 재미있게 느껴져요."
- 패턴: [A] càng [B] càng [C] (A는 B할수록 더 C하다 \\n\\n응용: Trời càng tối càng lạnh nhỉ?)
- 단어분석:
  ["Tiếng Việt", "[명사] 베트남어", "Tiếng (소리/말) + Việt (越 월 - 베트남)."],
  ["càng học", "[부사+동사] 배울수록", "càng (더욱) + học (學 학 - 배우다)."]

**예시 3 (영어)**:
- 원문: "Please double-check the container number, as the client is waiting for the update."
- 번역: "클라이언트가 업데이트를 기다리고 있으니 컨테이너 번호를 다시 확인해 주세요."
- 패턴: Please [동사], as [주어] is waiting for [목적어] (~가 기다리고 있으니, ~를 해주세요 \\n\\n응용: Please send the invoice, as the accounting team is waiting for payment.)
- 단어분석:
  ["double-check", "[동사] 재확인하다", "double (두 번) + check (확인)."],
  ["the container number", "[명사구] 컨테이너 번호", "정관사 the와 결합한 고유 식별 번호."]

**[4. 응답 형식]**
- 부연 설명 없이 오직 유효한 JSON Array만 출력하세요. 모든 설명은 한국어여야 하며 공백을 최소화하세요.
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
