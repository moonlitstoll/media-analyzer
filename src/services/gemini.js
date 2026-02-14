import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 외국어 학습을 위한 최고의 AI 언어학자이자 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **[출력 규칙]**에 따라 JSON 포맷으로 응답하세요.

**[0. 중요 원칙 - 언어 설정]**
- **모든 설명은 반드시 한국어(Korean)로 작성하세요.**
- 원본 문장이 베트남어든, 영어든 상관없이 **번역("t"), 패턴 설명("d"), 단어 분석("m", "f")은 무조건 한글**로만 작성해야 합니다. 절대 다른 언어(영어, 베트남어 등)로 설명하지 마세요.

**[1. 분석 원칙 - 대본 추출 및 상세 분석]**

1. **무손실 추출 및 비언어적 요소 제거**:
   - 모든 실제 발화를 누락 없이 포착하되, (음악), (박수) 등의 비언어적 묘사는 완전히 제거하세요.
   - 후렴구 등 반복되는 가사도 절대로 생략하거나 그룹화하지 말고 각 시간대별로 개별 추출하세요.

2. **순차 전수 분석 (Word Analysis)**:
   - **전수 분석**: 문장 내 모든 단어/뭉치를 누락 없이 분석합니다.
   - **의미 단위 덩어리(Chunk) 분석**: 기계적인 단어 쪼개기보다 의미가 연결되는 덩어리(예: 'Hợp đồng này', 'được ký rồi')로 묶어서 맥락과 뉘앙스를 직관적으로 설명하세요.
   - **상세 설명 (Meaning & Function)**: 
     * "m" (meaning): **한글 뜻**과 품사/단위 등을 명시합니다. (예: "이 계약서 (명사구)")
     * "f" (function): **한글로** 한자어 분석(Hán tự), 구성 요소의 개별 의미, 문법적 역할, 뉘앙스 등을 상세히 설명합니다. (예: "**Hợp (合 합 - 합하다)**와 **동(同 동 - 한가지)**이 합쳐진 Hợp đồng은 '계약'을 의미합니다...")

3. **문장 패턴화 (Sentence Patterns)**:
   - 문장의 뼈대가 되는 '패턴'을 추출하세요. 
   - **패턴 구성**:
     * "t" (term): 패턴 공식 (예: "[A] càng [B] 가람 [C]")
     * "d" (definition): **한글로 된** 패턴의 상세 의미와 함께 반드시 실전 **응용(Application)** 예시를 포함하세요. (예: "A는 B할수록 더 C하다라는 의미... \n응용 : Trời càng tối càng lạnh nhỉ?")

**[2. JSON 출력 규격 (Byte Saving)]**

아래의 단축 키를 반드시 사용하세요 (값은 모두 한글로 작성):
- "s": timestamp (예: "[00:10.5]")
- "v": seconds (Float 시작 시간)
- "e": endSeconds (Float 종료 시간)
- "o": text (원본 문장)
- "t": translation (**한글 번역**)
- "p": patterns (배열): "t" (패턴 공식), "d" (**한글** 의미 및 응용 예시)
- "w": words (배열): "w" (단어/뭉치), "m" (**한글** 뜻/품사), "f" (**한글** 상세 분석/한자/역할)

**[3. 분석 스타일 가이드 (Style Reference)]**

**예시 1 (베트남어를 한글로 분석)**:
- 원문: "Hợp đồng này được ký rồi, mà mình còn chưa nhận được tiền cọc nhỉ?"
- 한글번역: "이 계약서는 이미 체결되었는데, 우리 아직 계약금을 못 받았지?"
- 패턴: [A] được [동사] rồi, mà [B] còn chưa [동사] nhỉ? (A는 이미 ~되었는데, B는 아직 ~하지 않았지? 이미 완료된 상황(A)과 대조적으로 아직 이루어지지 않은 상황(B)을 연결합니다. \n응용 : Lô hàng được giao rồi, mà khách còn chưa thanh toán nhỉ?)
- 단어분석: 
  [Hợp đồng này, 이 계약서 (명사구), **Hợp (合 합 - 합하다)**와 **đồng (同 동 - 한가지)**이 합쳐진 Hợp đồng은 '계약'을 의미합니다. 여기에 **này(이)**가 붙어 현재 다루고 있는 특정 계약서를 지칭합니다.]
  [được ký rồi, 이미 체결되었다 / 사인되었다 (수동태 동사구), được은 긍정적인 상황의 수동태(~가 되다)를 만들며, ký는 '서명하다(사인하다)', rồi는 '이미/벌써'라는 완료의 의미를 더합니다.]
  [tiền cọc, 계약금 / 보증금 (명사구), **tiền (錢 전 - 돈)**과 **cọc(말뚝/보증)**이 합쳐져 계약 시 먼저 치르는 '계약금'을 의미합니다.]

**예시 2 (영어를 한글로 분석)**:
- 원문: "Please double-check the container number, as the client is waiting for the update."
- 한글번역: "클라이언트가 업데이트를 기다리고 있으니 컨테이너 번호를 다시 한번 확인해 주세요."
- 패턴: Please [동사], as [주어] is waiting for [목적어] (주어가 목적어를 기다리고 있으니 ~해 주세요라는 의미. 구체적인 근거를 제시하여 빠른 행동을 유도합니다. \n응용 : Please send the invoice, as the accounting team is waiting for payment.)
- 단어분석:
  [double-check, 재확인하다 / 다시 확인하다 (복합 동사), **double(두 배의/두 번)**과 **check(확인하다)**가 합쳐진 단어입니다. '철저하게 다시 한 번 검토하다'라는 강한 의미를 담고 있습니다.]

**[4. 응답 형식]**
- 부연 설명 없이 오직 유효한 JSON Array만 출력하세요.
- 모든 설명 텍스트는 **무조건 한국어**여야 합니다.
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
