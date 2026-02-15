import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 외국어 미디어를 분석하여 **'MS:SS 포인트 기반 전수 발화 기록 및 무삭제 단어 분석'**을 수행하는 전문 AI입니다.

**[0. 데이터 압축 및 문법 가드레일 (Critical Minification)]**
- **Minified JSON**: 출력되는 JSON 내의 모든 불필요한 공백과 줄바꿈을 제거하십시오.
- **키 이름 축약**: "s"(timestamp), "o"(original), "t"(translation), "w"(words), "m"(meaning), "f"(func/detail)
- **완결성 보장**: 출력 제한(Token Limit) 임박 시 진행 중인 미완성 객체는 과감히 버리고 배열(\`]\`)과 괄호를 즉시 닫으십시오.
- **문법 엄격**: 모든 속성 이름 뒤에는 반드시 콜론(:)이 있어야 하며, 모든 값은 이중 따옴표(")를 엄격히 준수하십시오.

**[1. 미디어 분석 엔진]**
- **포인트 매칭**: 문장 시작 시점만 **[MM:SS]** 형식으로 기록하십시오.
- **Batch Context**: 요청받은 특정 구간(예: 02:00 ~ 04:00)을 전수 분석하십시오.
- **제로 메모리**: 모든 발화는 반복 여부와 상관없이 항상 완전한 구조로 개별 분석하십시오.

**[2. Word Analysis 6대 원칙 (고밀도 압축)]**
1. 순차 분석 2. 중복 설명 강제 3. 복합어 상세 풀이 4. 역할 명시 5. 전수 분석 6. Chunk(덩어리) 단위.
부차적인 미사여구는 빼고 핵심 정보 위주로 압축하여 작성하십시오. (예: [명사] 뜻 | 핵심어원)

**[3. JSON 응답 규격]**
JSON Array 형식만 출력하십시오.
예: [{"s":"MM:SS","o":"원문","t":"번역","w":[{"w":"단어","m":"뜻","f":"분석"}]}]
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
            resolve(0);
        };
    });
}

export async function analyzeMedia(file, apiKey) {
    if (!apiKey) throw new Error("API Key required");
    if (!file) throw new Error("No file");

    const duration = await getMediaDuration(file);
    console.log(`[Batch] Analyzing ${file.name} | Duration: ${duration}s`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const MODELS_TO_TRY = ["gemini-2.0-flash", "gemini-1.5-pro"];

    // Ultra-precision: 2 minutes chunks as requested
    const CHUNK_SIZE_SECONDS = 120;
    const chunks = [];
    for (let start = 0; start < duration; start += CHUNK_SIZE_SECONDS) {
        chunks.push({ start, end: Math.min(start + CHUNK_SIZE_SECONDS, duration) });
    }

    const base64Data = await fileToGenerativePart(file);
    let allProcessedData = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`[Batch] Chunk ${i + 1}/${chunks.length} (${Math.floor(chunk.start)}s~${Math.floor(chunk.end)}s)`);

        const chunkPrompt = `${SYSTEM_PROMPT}\n**RANGE**: ${chunk.start}s to ${chunk.end}s`;

        let result;
        for (let modelName of MODELS_TO_TRY) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { responseMimeType: "application/json" }
                }, { apiVersion: "v1beta" });

                result = await model.generateContent([
                    chunkPrompt,
                    { inlineData: { data: base64Data, mimeType: file.type || 'audio/mpeg' } },
                ]);
                break;
            } catch (err) {
                console.warn(`[Batch] Model ${modelName} failed, trying next...`);
            }
        }

        if (!result) throw new Error(`Chunk ${i + 1} analysis failed.`);

        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

        // High-Precision JSON Repair Logic
        const repairJson = (str) => {
            str = str.trim();
            if (str.endsWith(']')) return str;

            console.warn("[Repair] Truncated JSON detected. Fixing...");

            // 1. Remove dangling comma at the end if any
            str = str.replace(/,\s*$/, "");

            // 2. Colon Guard: Find if the last key is missing a colon or value
            const lastQuote = str.lastIndexOf('"');
            if (lastQuote !== -1) {
                const beforeLastQuote = str.substring(0, lastQuote);
                const afterLastQuote = str.substring(lastQuote + 1);
                // If it ends like "key" or "key":, it's broken
                if (!afterLastQuote.includes(':')) {
                    str = beforeLastQuote.substring(0, beforeLastQuote.lastIndexOf('"'));
                }
            }

            // 3. Close objects and arrays
            const openBraces = (str.match(/{/g) || []).length;
            const closeBraces = (str.match(/}/g) || []).length;
            const openBrackets = (str.match(/\[/g) || []).length;
            const closeBrackets = (str.match(/]/g) || []).length;

            if ((str.match(/"/g) || []).length % 2 !== 0) str += '"';
            for (let b = 0; b < (openBraces - closeBraces); b++) str += '}';
            for (let b = 0; b < (openBrackets - closeBrackets); b++) str += ']';

            return str;
        };

        const processedText = repairJson(text);

        try {
            const chunkData = JSON.parse(processedText);
            if (Array.isArray(chunkData)) {
                const normalized = chunkData.map(item => {
                    let s = String(item.s || "").replace(/[\[\]\s]/g, '').split(/[-~]/)[0];
                    if (s.includes(':')) {
                        const p = s.split(':');
                        const m = p[0].padStart(2, '0');
                        const sec = p[1].split('.')[0].padStart(2, '0');
                        s = `${m}:${sec}`;
                    } else if (s !== "" && !isNaN(parseFloat(s))) {
                        const t = parseFloat(s);
                        s = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
                    }
                    return { ...item, s: s || "00:00" };
                });
                allProcessedData = [...allProcessedData, ...normalized];
            }
        } catch (parseErr) {
            console.error(`[Repair] Failed to parse Chunk ${i + 1}`, parseErr.message);
            // Fallback: Semantic recovery
            const matches = processedText.match(/{[^{]*"s"[^{]*}/g);
            if (matches) matches.forEach(m => { try { allProcessedData.push(JSON.parse(m)); } catch (e) { } });
        }
    }

    if (allProcessedData.length === 0) throw new Error("No data extracted.");

    const seen = new Set();
    return allProcessedData.filter(item => {
        const key = \`\${item.s}_\${item.o?.substring(0, 5)}\`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).sort((a, b) => {
        const p = (ts) => { const [m, s] = ts.split(':').map(Number); return (m * 60) + s; };
        return p(a.s) - p(b.s);
    });
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
