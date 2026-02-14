import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 외국어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **엄격한 규칙**에 따라 JSON 포맷으로 응답해야 합니다.

**[1. 분석 원칙 - 무손실 전수 추출 및 초정밀 싱크 (Zero-Omission)]**

1. **무손실 전수 추출 (Zero-Omission Policy)**:
   - **음성 우선 분석**: 실제 오디오 소스를 0.5초 단위로 정밀 분석하여 모든 발화를 포착하세요.
   - **반복 문구 완전 보존**: 동일한 문장/단어가 반복되더라도 절대 생략하지 말고 들리는 횟수만큼 각각 기록하세요.
   - **순수 발화 집중**: 사람의 입에서 나온 모든 말, 가사, 추임새를 포함하되 비언어적 소리는 제외합니다.

2. **전구간 절대 시간(Absolute Seconds) 엔진**:
   - 모든 타임라인은 0초부터 종료 시점까지 누적 초(Float)로 계산합니다. (예: [01:05.2] -> 65.2)

**[2. 교육적 상세 분석 지침 (Educational Analysis)]**

1. **순차 및 전수 분석 (Sequential & Exhaustive)**:
   - 문장 내 단어가 등장하는 **순서대로** 누락 없이 모든 단어/구문을 분석하세요.
2. **중복 설명 허용 (Duplication Allowed)**:
   - 이전 문장에서 나왔던 단어라도 현재 문장에서 쓰였다면 다시 상세히 설명합니다.
3. **의미 단위 구조화 (Semantic Chunking)**:
   - 단어를 기계적으로 쪼개기보다, 의미가 연결되는 **덩어리(Chunk)**로 묶어 문맥과 뉘앙스를 직관적으로 이해하게 하세요.
4. **베트남어 특화 (Hanja/Chinese-Vietnamese Roots)**:
   - 1음절이 모여 만든 복합어는 따로 떼지 않고 한 항목에서 설명하되, 각 음절의 **한자 뜻과 음**을 명확히 명시하세요.
   - 예: "tiền cọc" -> "tiền (錢 전 - 돈) + cọc (보증)"
5. **문장 패턴화 (Sentence Patterns)**:
   - 문장의 뼈대가 되는 **공식/패턴**을 추출하세요. (예: "Mà [A] còn [B] nhỉ?")
   - 해당 패턴의 설명과 함께, 다른 단어를 사용한 **응용 예시(문장 + 번역)**를 반드시 포함하세요.
6. **역할 명시**:
   - 품사, 문법적 기능, 방언 여부 등을 상세히 기록하세요.

**[3. 출력 포맷 - JSON Array]**

응답은 반드시 아래 포맷의 JSON Array여야 합니다:

\`\`\`json
[
  {
    "timestamp": "[MM:SS.s]",
    "seconds": 0.0,
    "text": "실제 발화된 원문",
    "translation": "한국어 번역",
    "patterns": [
       { 
         "term": "패턴 공식 (예: [A] được [동사] rồi)", 
         "definition": "패턴 설명 + 응용 예시 (예: 응용 1: 문장 - 번역)" 
       }
    ],
    "words": [
       { 
         "word": "의미 단위 (단어/구)", 
         "meaning": "의미 + 한자 풀이(베트남어일 경우) + 문맥적 뉘앙스", 
         "func": "품사, 문법적 기능, 방언 등 상세 역할" 
       }
    ]
  }
]
\`\`\`

**[최종 검토 (Completeness Check)]**
1. 문장 내 모든 요소가 순서대로 분석되었는가?
2. 베트남어 복합어에 한자 풀이가 포함되었는가?
3. 문장 패턴 공식과 응용 예시가 포함되었는가?
4. 무손실 전수 기록 원칙이 지켜졌는가?
`;

export async function analyzeMedia(file, apiKey) {
    if (!apiKey) throw new Error("API Key is required");

    // Basic validation
    if (!file) throw new Error("No file provided");

    // Size limit check removed to allow larger files as requested. 
    // Browser base64 limit might still apply, but we allow the attempt.
    console.log(`Analyzing file: ${file.name} (${file.type}, ${file.size} bytes)`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Model fallback list
    const MODELS_TO_TRY = [
        "gemini-1.5-flash",
        "models/gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash-exp"
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
        for (const modelName of MODELS_TO_TRY) {
            console.log(`Attempting analysis with model: ${modelName} (v1beta)`);
            const model = genAI.getGenerativeModel({ model: modelName }, { apiVersion: "v1beta" });

            let retryCount = 0;
            const maxRetries = 2;
            let delay = 2000;
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
                    break; // Success with this model
                } catch (err) {
                    const errorMsg = err.message.toLowerCase();

                    // 1. Check for 503/Overloaded (Retry same model)
                    if (errorMsg.includes("503") || errorMsg.includes("overloaded")) {
                        retryCount++;
                        if (retryCount <= maxRetries) {
                            console.warn(`Model ${modelName} overloaded. Retrying (${retryCount}/${maxRetries})...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            delay *= 2;
                            continue;
                        }
                    }

                    // 2. Check for 404/NotFound (Try next model immediately)
                    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
                        console.warn(`Model ${modelName} not found (404). Trying fallback...`);
                        lastError = err;
                        break; // Exit while, try next model in for loop
                    }

                    // 3. Other errors
                    lastError = err;
                    console.error(`Error with model ${modelName}:`, err);
                    break; // Try next model or throw if last
                }
            }

            if (modelSuccess) break; // We found a working model
        }

        if (!result) {
            throw lastError || new Error("All fallback models failed to respond.");
        }

        const response = await result.response;
        const text = response.text();
        console.log("Gemini Raw Response (First 100 chars):", text.substring(0, 100));

        // Clean up markdown
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // Find array start/end if there's extra text
        const startIdx = jsonStr.indexOf('[');
        const endIdx = jsonStr.lastIndexOf(']');

        if (startIdx === -1 || endIdx === -1) {
            throw new Error("AI response did not contain valid JSON array");
        }

        const cleanJson = jsonStr.substring(startIdx, endIdx + 1);
        return JSON.parse(cleanJson);

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
