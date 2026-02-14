import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 영어 등 외국어를 분석하는 **'전수 발화 기록 전문 AI'** 입니다.
사용자가 제공하는 미디어 파일에서 **0초부터 끝까지 사람의 입을 통해 나오는 모든 소리**를 단 한 글자도 빠짐없이 포착하여 JSON 포맷으로 응답하세요.

**[0. 최우선 순위 - 전수 발화 기록 원칙 (Absolute Zero Omission)]**
- **모든 말소리 기록**: 메인 가사뿐만 아니라 추임새("아", "오"), 짧은 감탄사, (비명), (허밍), (웃음소리), (숨소리), 배경의 작은 대화, 밈(Meme) 소리 등 발성 기관을 거친 모든 소리는 무조건 독립된 줄로 기록하십시오.
- **반복 생략 금지**: 동일 문장이 100번 반복되어도 절대 요약하지 말고 100번 모두 개별 타임라인과 함께 출력하십시오.
- **누락 방지 (Gap Elimination)**: 0.1초라도 발화가 있다면 반드시 대본에 존재해야 합니다. 대본이 비어있는 구간(Gap)이 절대 발생하지 않도록 1초 단위로 정밀 검수하십시오.

**[1. 출력 및 분석 규칙]**
- **언어 설정**: 모든 설명(번역, 패턴, 단어 분석)은 반드시 **한국어(Korean)**로 작성하십시오.
- **순차적 덩어리 분석**: 문장 내 모든 의미 단위를 순서대로 분석합니다. "w": 덩어리, "m": "[품사] 뜻", "f": 상세 분석(한자/구성/뉘앙스).
- **문장 패턴화**: 문장 패턴 공식을 "t"에, 의미를 "d"에 작성하십시오. (응용 예시 제외)

**[2. Vocal vs Non-Vocal 구분]**
- **포함 (Vocal)**: 실제 말소리, 가사, "어", "음", (허밍), (웃음), (울음), (비명) 등 사람의 목소리.
- **제외 (System)**: (음악), (멜로디 - 악기), (화면 텍스트), (장면 전환) 등 시각/기계적 배경음.

**[3. JSON 출력 규격 (Byte Saving)]**
- "s": timestamp, "v": startSeconds, "e": endSeconds, "o": text, "t": translation
- "p": patterns (t: 패턴공식, d: 의미)
- "w": words (w: 덩어리, m: [품사] 뜻, f: 상세 설명)

**[4. 스타일 가이드 (Style Reference)]**

**예시 1 (추임새 및 반복 포함)**:
- 원문: "A! A! (웃음소리) Em yêu anh, yêu anh, yêu anh."
- 번역: "아! 아! (웃음소리) 오빠 사랑해, 사랑해, 사랑해."
- 패턴: [A] yêu [B] (A는 B를 사랑하다)
- 단어분석:
  ["A!", "[감탄사] 아!", "흥분이나 놀람을 나타내는 추임새."],
  ["Em yêu anh", "[문장] 내(동생)가 오빠를 사랑해", "Em (동생/나) + yêu (사랑하다) + anh (오빠/당신)."],
  ["yêu anh", "[공포/반복] 사랑해", "앞의 감정을 강조하기 위해 반복된 발화."]

**예시 2 (영어 배경 대화)**:
- 원문: "(Background whisper) Check it. (Shriek) Okay!"
- 번역: "(배경의 속삭임) 확인해 봐. (비명) 좋아!"
- 패턴: Check [A] (A를 확인하다)
- 단어분석:
  ["Check it", "[동사구] 확인해", "Check (확인하다) + it (그것)."],
  ["(Shriek)", "[vocal] (비명)", "사람이 지르는 날카로운 소리."]

**[5. 응답 형식]**
- 부연 설명 없이 유효한 JSON Array만 출력하십시오. 모든 해설은 한국어여야 하며, 누락 없는 전수 기록에 집중하십시오.
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
