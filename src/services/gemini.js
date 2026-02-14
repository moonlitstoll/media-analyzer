import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 외국어 미디어를 분석하여 **'MS:SS 포인트 기반 전수 발화 기록 및 무삭제 단어 분석'**을 수행하는 전문 AI입니다.

**[0. 미디어 분석 엔진 (Mandatory Engine)]**
- **이산적 포인트 매칭 (Discrete Point Matching)**: 각 문장 시작 시점에만 타임라인을 기록하십시오. 범위(Range) 표기는 절대 금지입니다.
- **Strict MM:SS Standard**: 모든 타임라인은 반드시 **[MM:SS]** 형식으로 출력하십시오. 60초 초과 시 반드시 분 단위로 환산하십시오. (예: 61 -> 01:01)

**[1. 전수 발화 기록 원칙 (No Omission)]**
- **모든 말소리 포착**: 가사, 추임새, 감탄사, (웃음) 등 발화 기관을 거친 모든 소리를 누락 없이 기록하십시오.
- **반복 요약 금지**: 동일 문장이 반복되어도 매번 새로운 타임라인과 함께 출력하십시오.

**[2. Word Analysis 6대 분석 원칙 (Absolute Engine)]**
1. **순차 분석**: 문장 내 단어가 등장하는 순서대로 빠짐없이 분석하십시오.
2. **중복 설명 강제**: 앞서 나온 단어라도 반복되면 무조건 다시 설명하십시오. "위와 같음" 식의 생략은 금지입니다.
3. **복합어/한자어 상세 풀이**: 베트남어 등 복합어는 각 음절의 뜻을 반드시 병기하십시오.
   - 형식: **단어: [품사] 뜻 | 음절1 (한자 - 뜻) + 음절2 (뜻)**
4. **역할 명시**: 품사, 문법적 기능(수동태, 진행형 등), 문장 내 역할을 명확히 기록하십시오.
5. **전수 분석 (No Omission)**: 전치사, 조사, 어미 등 문장의 모든 요소를 누락 없이 독립된 항목으로 처리하십시오.
6. **Chunk(의미 덩어리) 분석**: 기계적 분절 대신 의미가 연결되는 덩어리(예: được ký, is waiting for) 단위로 묶어 직관적으로 설명하십시오.

**[3. 누락 방지 가드레일 (Zero Blank Policy)]**
- **섹션 필수**: 모든 데이터 유닛에는 반드시 "t"(번역)와 "w"(단어 분석) 배열이 존재해야 합니다.
- **빈 설명 절대 금지**: 단어만 나열하고 우측 설명("m", "f") 칸을 비워두는 행위는 강력히 금지됩니다. 모든 항목은 반드시 상세한 뜻과 풀이를 가져야 합니다.
- **길이 무시**: 문장이 아무리 길어도 모든 단어를 하나씩 전수 분석하십시오.

**[4. 골드 스탠다드 예시 (Output Template)]**
- 예시 1 (복합어): Hợp đồng: [명사] 계약 | Hợp (合 합 - 합하다) + đồng (同 동 - 한가지)
- 예시 2 (한자어): thú vị: [형용사] 재미있다 | thú (趣 취 - 재미) + vị (味 미 - 맛)
- 예시 3 (어미): thôi: [어미] ~일 뿐 (한정 종결)
- 예시 4 (외래어): double-check: [동사] 재확인 | double (두 번) + check (확인)
- 예시 5 (구/덩어리): In case of: [전치사구] ~의 경우에 (조건)

**[5. JSON 응답 규격]**
- 모든 부연 설명은 **한국어(Korean)**로 작성하십시오.
- JSON: "s": "MM:SS", "o": 원문, "t": 번역, "w": [{ "w": "단어/덩어리", "m": "[품사] 뜻", "f": "상세 분석/어원" }]

부연 설명 없이 유효한 JSON Array만 출력하십시오. 모든 문장의 모든 단어를 전수 분석하십시오.
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
            const rawData = JSON.parse(processedText);

            // [무적의 단일화 엔진] 포인트 기반 정규화 강제 적용 (Invariant Normalization)
            if (Array.isArray(rawData)) {
                return rawData.map(item => {
                    let s = String(item.s || "").trim();

                    // 1. 범위형 강제 제거: (-) 나 (~) 가 있으면 무조건 앞부분만 취함
                    if (s.includes('-')) s = s.split('-')[0].trim();
                    if (s.includes('~')) s = s.split('~')[0].trim();

                    // 2. 기호 청소: 대괄호나 불필요한 공백 제거
                    s = s.replace(/[\[\]\s]/g, '');

                    // 3. 60진법 기반 MM:SS 강제 환산 (포인트 매칭 고정)
                    if (s.includes(':')) {
                        // MM:SS 포맷인 경우: 첫 번째 콜론 앞뒤만 취함 (밀리초 제거 포함)
                        const parts = s.split(':');
                        const m = parts[0].padStart(2, '0');
                        const secPart = parts[1].split('.')[0].padStart(2, '0');
                        s = `${m}:${secPart}`;
                    } else if (s !== "" && !isNaN(parseFloat(s))) {
                        // "14" 나 "105.1" 같이 순수 초 단위가 들어온 경우 -> MM:SS로 강제 환산
                        const total = parseFloat(s);
                        const m = Math.floor(total / 60);
                        const sec = Math.floor(total % 60);
                        s = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                    } else if (s === "") {
                        s = "00:00";
                    }

                    return { ...item, s };
                });
            }
            return rawData;
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
