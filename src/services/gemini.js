import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 외국어 미디어를 분석하여 **'MS:SS 포인트 기반 전수 발화 기록 및 무삭제 단어 분석'**을 수행하는 전문 AI입니다.

**[0. 데이터 압축 및 문법 가드레일 (Critical Minification)]**
- **Minified JSON**: 불필요한 공백/줄바꿈을 절대 생성하지 마십시오. 오직 유효한 JSON만 출력하십시오.
- **키 이름 축약**: "s"(timestamp), "o"(original), "t"(translation), "w"(words), "m"(meaning), "f"(func/detail)
- **완결성 보장**: 출력 제한 임박 시 미완성 객체는 버리고 배열(\`]\`)과 괄호를 즉시 닫으십시오.
- **문법 엄격**: 모든 속성 이름 뒤 콜론(:) 필수, 모든 값 이중 따옴표(") 필수.

**[1. 미디어 분석 엔진]**
- **포인트 매칭**: 문장 시작 시점만 **[MM:SS]** 형식 기록. 구간 분석 요청 시 해당 구간 전수 분석.
- **제로 메모리**: 모든 발화는 반복 여부 상관없이 항상 완전한 구조로 개별 분석.

**[2. Word Analysis 6대 원칙 (고밀도 압축)]**
1.순차분석 2.중복설명강제 3.복합어상세풀이 4.역할명시 5.전수분석 6.Chunk단위.
핵심 정보 위주로 압축 작성. (예: [명사]뜻|어원)

**[3. JSON 응답 규격]**
JSON Array만 출력. 예: [{"s":"MM:SS","o":"원문","t":"번역","w":[{"w":"단어","m":"뜻","f":"분석"}]}]
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

    // Ultra-precision: 60 seconds chunks (1 minute) for maximum stability
    const CHUNK_SIZE_SECONDS = 60;
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

        // Invincible JSON Repair & Extraction Logic
        const extractValidObjects = (str) => {
            str = str.trim();
            const results = [];

            // 1. Try standard parse first
            try {
                const parsed = JSON.parse(str);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                console.warn("[Repair] System-wide parse failed. Falling back to individual object extraction...");
            }

            // 2. High-Precision Regex Extraction: Look for valid { "s": "...", ... } objects
            // This regex captures objects that have at least "s" and "o" keys, which are mandatory.
            const objectRegex = /\{"s":"[^"]*","o":"[^"]*",.*?"w":\[.*?\]\}/g;
            let match;
            while ((match = objectRegex.exec(str)) !== null) {
                try {
                    results.push(JSON.parse(match[0]));
                } catch (err) {
                    // Fallback to even simpler regex or partial repair if needed
                }
            }

            // 3. Last Resort: Partial balance repair for the last chunk
            if (results.length === 0) {
                let repaired = str;
                // Fix trailing commas like ...},] or ...}, }
                repaired = repaired.replace(/,\s*[\]\}]/g, (m) => m.slice(1));

                // Extremely simple repair for truncated JSON
                const openB = (repaired.match(/{/g) || []).length;
                const closeB = (repaired.match(/}/g) || []).length;
                const openA = (repaired.match(/\[/g) || []).length;
                const closeA = (repaired.match(/\]/g) || []).length;

                if ((repaired.match(/"/g) || []).length % 2 !== 0) repaired += '"';
                for (let b = 0; b < (openB - closeB); b++) repaired += '}';
                for (let a = 0; a < (openA - closeA); a++) repaired += ']';

                try {
                    const parsed = JSON.parse(repaired);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch (err) {
                    // Try one more regex if all else fails
                    const lastDitchRegex = /\{"s":"[^"]*","o":"[^"]*".*?\}/g;
                    let m;
                    while ((m = lastDitchRegex.exec(repaired)) !== null) {
                        try {
                            const obj = JSON.parse(m[0]);
                            if (obj.s && obj.o) results.push(obj);
                        } catch (e) { }
                    }
                }
            }

            return results;
        };

        const chunkData = extractValidObjects(text);
        if (chunkData.length > 0) {
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
        } else {
            console.error(`[Repair] Failed to extract any valid objects from Chunk ${i + 1}`);
        }
    }

    if (allProcessedData.length === 0) throw new Error("No data extracted. Media might be too noisy or analysis failed.");

    const seen = new Set();
    return allProcessedData.filter(item => {
        const key = `${item.s}_${item.o?.substring(0, 5)}`;
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
