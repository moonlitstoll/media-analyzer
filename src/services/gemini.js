import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 외국어 미디어를 분석하여 **'MS:SS 포인트 기반 전수 발화 기록 및 무삭제 단어 분석'**을 수행하는 전문 AI입니다.

**[0. 미디어 분석 엔진 (Mandatory Engine)]**
- **이산적 포인트 매칭 (Discrete Point Matching)**: 각 문장 시작 시점에만 타임라인을 기록하십시오. 범위(Range) 표기는 절대 금지입니다.
- **Strict MM:SS Standard**: 모든 타임라인은 반드시 **[MM:SS]** 형식으로 출력하십시오. 60초 초과 시 반드시 분 단위로 환산하십시오. (예: 61 -> 01:01)
- **Batch Context**: 특정 구간(예: 05:00 ~ 10:00)을 요청받으면 해당 구간의 모든 발화를 전수 분석하십시오.

**[1. 제로 메모리 및 중복 제거 비활성화 (Zero-Memory Protocol)]**
- **독립 분석 강제**: 미디어 전체에서 동일 가사/문장이 100번 반복되더라도, 100번 모두 **'완전한 분석'**을 새롭게 제공하십시오.
- **기억 소거**: 사용자가 이전 내용을 보지 않고 해당 시점으로 바로 점프해서 본다고 가정하십시오. "위와 같음", "이전 설명 참조" 등 어떤 형태의 요약이나 생략도 엄격히 금지합니다.
- **전수 전개**: 모든 문장은 타임라인, 원문, 번역, 단어 분석(6대 원칙)이 포함된 완전한 데이터 구조를 갖춰야 합니다.

**[2. 리스트 전수 분해 및 카드 분할 (Card Splitting)]**
- **나열형 문장 처리**: 쉼표(,)로 연결된 긴 단어 목록이나 관용구 나열은 토큰 소모와 상관없이 모든 항목을 개별 분석하십시오.
- **0.5초 단위 분할**: 한 카드에 담기 너무 긴 리스트는 타임라인을 0.5초 단위로 쪼개어 여러 개의 JSON 객체(카드)로 나누어 생성하십시오. 모든 단어의 뜻이 출력되어야 합니다.

**[3. Word Analysis 6대 분석 원칙 (Absolute Engine)]**
1. **순차 분석**: 문장 내 단어가 등장하는 순서대로 빠짐없이 분석하십시오.
2. **중복 설명 강제**: 앞서 나온 단어라도 반복되면 무조건 다시 설명하십시오. "위와 같음" 식의 생략은 금지입니다.
3. **복합어/한자어 상세 풀이**: 베트남어 등 복합어는 각 음절의 뜻을 반드시 병기하십시오.
   - 형식: **단어: [품사] 뜻 | 음절1 (한자 - 뜻) + 음절2 (뜻)**
4. **역할 명시**: 품사, 문법적 기능(수동태, 진행형 등), 문장 내 역할을 명확히 기록하십시오.
5. **전수 분석 (No Omission)**: 전치사, 조사, 어미 등 문장의 모든 요소를 누락 없이 독립된 항목으로 처리하십시오.
6. **Chunk(의미 덩어리) 분석**: 기계적 분절 대신 의미가 연결되는 덩어리(예: được ký, is waiting for) 단위로 묶어 직관적으로 설명하십시오.

**[4. 데이터 밀도 및 JSON 무결성 (Structural Integrity)]**
- **강제 종료 방지**: 출력 제한(Token Limit)에 도달하기 직전이라면, 반드시 진행 중인 객체를 버리고 배열(`]`)과 모든 괄호를 안전하게 닫고 출력을 종료하십시오.
- **구문 검사**: 모든 키(Key)와 값(Value)은 반드시 이중 따옴표(`"`)를 엄격히 준수하십시오. 불필요한 공백과 줄바꿈은 최소화하여 데이터 밀도를 높이십시오.
    - ** 절대 원칙 **: "s", "o", "t", "w" 키는 반드시 존재해야 하며, "w" 배열은 절대 비워두지 마십시오.

** [5. JSON 응답 규격] **
        - 모든 부연 설명은 ** 한국어(Korean) ** 로 작성하십시오.
- JSON: "s": "MM:SS", "o": 원문, "t": 번역, "w": [{ "w": "단어/덩어리", "m": "[품사] 뜻", "f": "상세 분석/어원" }]

부연 설명 없이 유효한 JSON Array만 출력하십시오.
`;

/**
 * Helper to get media duration using HTML5 Video element
 */
async function getMediaDuration(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const media = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
        media.src = url;
        media.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(media.duration);
        };
        media.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(0); // Fallback to 0
        };
    });
}

export async function analyzeMedia(file, apiKey) {
    if (!apiKey) throw new Error("API Key is required");
    if (!file) throw new Error("No file provided");

    const duration = await getMediaDuration(file);
    console.log(`Analyzing file: ${ file.name } (${ file.type }, ${ file.size } bytes, Duration: ${ duration }s)`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-1.5-pro"]; // Prioritize available flash version

    // 5 minutes break point as requested
    const CHUNK_SIZE_SECONDS = 300; 
    const chunks = [];
    
    if (duration > CHUNK_SIZE_SECONDS + 60) { // Small buffer (60s) before splitting
        for (let start = 0; start < duration; start += CHUNK_SIZE_SECONDS) {
            chunks.push({
                start,
                end: Math.min(start + CHUNK_SIZE_SECONDS, duration)
            });
        }
        console.log(`File duration ${ duration } s > ${ CHUNK_SIZE_SECONDS } s.Splitting into ${ chunks.length } chunks.`);
    } else {
        chunks.push({ start: 0, end: duration });
    }

    const base64Data = await fileToGenerativePart(file);
    let allProcessedData = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing Chunk ${ i + 1 } /${chunks.length}: ${Math.floor(chunk.start/60)}:${ String(Math.floor(chunk.start % 60)).padStart(2, '0') } ~${ Math.floor(chunk.end / 60) }:${ String(Math.floor(chunk.end % 60)).padStart(2, '0') } `);
        
        const chunkPrompt = `${ SYSTEM_PROMPT } \n\n ** IMPORTANT **: Analyze strictly the segment from ${ chunk.start } seconds to ${ chunk.end } seconds.`;
        
        let result;
        let lastError;

        for (let modelName of MODELS_TO_TRY) {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: "application/json" }
            }, { apiVersion: "v1beta" });

            try {
                result = await model.generateContent([
                    chunkPrompt,
                    { inlineData: { data: base64Data, mimeType: file.type || 'audio/mpeg' } },
                ]);
                lastError = null;
                break;
            } catch (err) {
                lastError = err;
                console.warn(`Model ${ modelName } failed for chunk ${ i+ 1}, trying next...`, err.message);
            }
        }

        if (!result) throw lastError || new Error("All models failed to process chunk " + (i+1));

        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json / g, '').replace(/```/g, '').trim();

// Enhanced Repair Logic
const repairJson = (str) => {
    str = str.trim();
    // 1. Basic Balance
    const openBraces = (str.match(/{/g) || []).length;
    const closeBraces = (str.match(/}/g) || []).length;
    const openBrackets = (str.match(/\[/g) || []).length;
    const closeBrackets = (str.match(/]/g) || []).length;

    if (str.endsWith(']')) return str;

    // 2. Quote Balance (Strict)
    const quotes = (str.match(/"/g) || []).length;
    if (quotes % 2 !== 0) str += '"';

    // 3. Object Closure
    if (openBraces > closeBraces) {
        // If it looks like we're inside an object but it's truncated
        const lastPropertyStart = str.lastIndexOf('":');
        if (lastPropertyStart !== -1) {
            // Try to go back to the last complete key-value pair if possible
            // But for now, just close the braces
        }
        for (let b = 0; b < (openBraces - closeBraces); b++) str += '}';
    }

    // 4. Array Closure
    if (openBrackets > closeBrackets) str += ']';

    return str;
};

const processedText = repairJson(text);

try {
    const chunkData = JSON.parse(processedText);
    if (Array.isArray(chunkData)) {
        // Normalize each item in chunk
        const normalized = chunkData.map(item => {
            let s = String(item.s || "").replace(/[\[\]\s]/g, '').split(/[-~]/)[0];
            if (s.includes(':')) {
                const parts = s.split(':');
                const m = parts[0].padStart(2, '0');
                const secPart = parts[1].split('.')[0].padStart(2, '0');
                s = `${m}:${secPart}`;
            } else if (s !== "" && !isNaN(parseFloat(s))) {
                const total = parseFloat(s);
                const m = Math.floor(total / 60);
                const sec = Math.floor(total % 60);
                s = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
            } else if (s === "") {
                s = "00:00";
            }
            return { ...item, s };
        });
        allProcessedData = [...allProcessedData, ...normalized];
    } else {
        console.warn("Chunk returned non-array JSON", chunkData);
    }
} catch (parseErr) {
    console.error(`Chunk ${i + 1} Parse Error:`, parseErr);
    // Fallback: try to match valid objects
    try {
        const matches = processedText.match(/{[^{]*"s"[^{]*}/g);
        if (matches) {
            const recovered = matches.map(m => JSON.parse(m));
            allProcessedData = [...allProcessedData, ...recovered];
        }
    } catch (e) {
        console.error("Failed to recover any objects from chunk", i + 1);
    }
}
    }

if (allProcessedData.length === 0) {
    throw new Error("AI Analysis Failed: Could not extract any valid data from media chunks.");
}

// De-duplicate if same timestamp appears in different chunks (e.g. boundary overlap)
const seen = new Set();
return allProcessedData.filter(item => {
    const key = `${item.s}_${item.o?.substring(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
}).sort((a, b) => {
    const parse = (ts) => {
        const [m, s] = ts.split(':').map(Number);
        return (m * 60) + s;
    };
    return parse(a.s) - parse(b.s);
});
}
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
