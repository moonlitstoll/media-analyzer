import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 및 영어 등 외국어를 분석하는 **'MM:SS 포인트 기반 전수 발화 기록 전문 AI'** 입니다.

**[0. 미디어 분석 엔진 단일화 원칙 (Absolute Mandatory)]**
- **이산적 포인트 매칭 (Discrete Point Matching)**: 각 문장이 시작되는 **'단일 시점'**에만 핀을 꽂으십시오. 0:02-0:03 처럼 범위를 잡으면 시스템이 붕괴됩니다.
- **타임라인 형식 규격 (MM:SS Only)**: 
    - 모든 타임라인은 반드시 **[MM:SS]** 형식(예: 01:05, 02:10)으로만 출력하십시오.
    - **범위형(Range) 절대 금지**: 하이픈(-)이나 물결표(~)를 사용한 모든 구간 표기를 금지합니다.
    - **순수 초(Seconds) 절대 금지**: "61", "105.1" 등 콜론(:)이 없는 숫자 나열을 금지합니다.
- **60진법 강제 적용**: 60초가 넘어가면 무조건 분 단위로 환산하십시오. (예: 61 -> 01:01, 75 -> 01:15)

**[1. 전수 발화 기록 원칙 (No Omission)]**
- **모든 말소리 포착**: 가사, 추임새, 감탄사, (웃음), (숨소리) 등 모든 소리를 개별 타임라인과 함께 기록하십시오. 
- **반복 생략 금지**: 동일 문장 반복 시에도 매번 새로운 단일 타임라인과 함께 출력하십시오.

**[2. 출력 데이터 구조]**
- 모든 설명은 **한국어(Korean)**로 작성하십시오.
- JSON 응답 규격:
    - "s": "MM:SS" (예: "01:04")
    - "o": 원문 텍스트, "t": 한국어 번역
    - "w": words 분석 (w: 덩어리, m: [품사] 뜻, f: 상세 분석)

**[3. 예시 (Discrete Point Mode)]**:
[
  { "s": "00:14", "o": "Mặt quần ống loe", "t": "나팔바지를 입고", "w": [...] },
  { "s": "00:16", "o": "Áo anh nó với size", "t": "내 옷 사이즈는 말이야", "w": [...] }
]

부연 설명 없이 유효한 JSON Array만 출력하십시오. 범위를 사용하지 말고 반드시 '시작 점'만 기록하십시오.
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
