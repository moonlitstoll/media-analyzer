import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 외국어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **엄격한 규칙**에 따라 JSON 포맷으로 응답해야 합니다.

**[1. 분석 원칙 - 출력 용량 극대화 및 고밀도 압축]**

1. **JSON 키 이름 축소 (Byte Saving)**:
   - 데이터 전송량을 줄이기 위해 반드시 아래의 단축 키를 사용하세요:
     - "s": timestamp (예: "[00:10.5]")
     - "v": seconds (Float 값, 예: 10.5)
     - "o": text (원본 문장)
     - "t": translation (번역)
     - "p": patterns (문장 패턴 배열)
     - "w": words (단어 분석 배열)
   - 내부 객체 키 단축:
     - patterns 내: "t" (term), "d" (definition)
     - words 내: "w" (word), "m" (meaning), "f" (func)

2. **공백 및 서식 제거 (Minify)**:
   - 응답 시 줄바꿈이나 불필요한 공백을 모두 제거한 한 줄의 긴 문자열(Minified JSON)로 출력하세요.

3. **분석 내용 압축 (Content Compression)**:
   - 설명은 장황한 서술형 대신 "핵심 의미: 용법" 형태로 극도로 간결하게 작성하세요.
   - 중복되는 단어 설명은 (참조: 이전 설명) 형태로 축약하여 토큰을 보존하세요.

4. **무손실 추출**: 모든 발화를 누락 없이 포착하되, 위의 압축 규칙을 철저히 준수하세요.

**[2. JSON 규격]**
응답은 반드시 유효한 JSON Array여야 하며, 어떤 설명이나 추가 텍스트도 포함하지 마세요.

응답 예시(실제는 공백 없이 출력):
[{"s":"[00:10.5]","v":10.5,"o":"Xin chào!","t":"안녕하세요!","p":[],"w":[]}]
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
