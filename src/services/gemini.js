import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 엄격한 규칙에 따라 JSON 포맷으로 응답해야 합니다.

**[분석 원칙 - 무삭제 기록 필수]**
1. **완전 무삭제 (Verbatim)**:
   - **절대로** 자막처럼 내용을 다듬거나 생략하지 마세요.
   - **중요**: [웃음소리], [숨소리], [배경음악] 같은 **비언어적 상황 설명은 제외**하세요.
   - 오직 **입으로 발음된 소리(단어, 감탄사, 추임새, 더듬는 소리)**만 기록하세요.
   - 예시: "음... 아... 그게..." (O) / "[당황하며] 그게..." (X, [당황하며] 삭제)
2. **초정밀 타임라인**: 0.1초 단위로 문장 시작/종료 시간을 기록합니다.
3. **언어 및 발음**: 모든 설명은 **한국어**로 합니다.
4. **학습 중심**: 단순 번역을 넘어 "회화 패턴"과 "단어별 분석"에 집중합니다.

**[출력 포맷 - JSON Array]**
응답은 반드시 아래와 같은 포맷의 JSON Array여야 합니다:

\`\`\`json
[
  {
    "timestamp": "[00:00.0]",
    "seconds": 0.0,
    "text": "음성 들리는 그대로 (상황설명 태그 제외)",
    "translation": "문장별 한국어 번역 (분석/해설 파트에 숨겨짐)",
    "patterns": [
       {
         "term": "thì lại",
         "definition": "'그런데 또', 예상 밖의 상황을 나타냄. 문법적 의미와 회화적 뉘앙스를 함께 설명."
       }
    ],
    "words": [
       { "word": "tuy nhiên", "meaning": "하지만 (접속사)", "func": "문장 연결" },
       { "word": "rất", "meaning": "매우 (부사)", "func": "형용사 강조" }
    ]
  }
]
\`\`\`

**[세부 요구사항 - 매우 중요]**
1. **translation (한국어 번역)**:
   - 사용자가 '분석 보기'를 켰을 때만 보이는 부분입니다.
   - 이 문장의 의미, 상황적 뉘앙스를 포함하여 꼼꼼하게 번역/설명해주세요.
2. **patterns & words**:
   - 기존과 동일하게 상세히 분석해주세요.
`;

export async function analyzeMedia(file, apiKey) {
    if (!apiKey) throw new Error("API Key is required");

    // Basic validation
    if (!file) throw new Error("No file provided");
    if (file.size > 20 * 1024 * 1024) throw new Error("File size too large. Please use a file under 20MB.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

        console.log(`Analyzing file: ${file.name} (${mimeType}, ${file.size} bytes)`);

        // Convert file to base64
        const base64Data = await fileToGenerativePart(file);

        // Retry logic for 503 Overloaded errors
        let result;
        let retryCount = 0;
        const maxRetries = 3;
        let delay = 2000;

        while (true) {
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
                break; // Success, exit loop
            } catch (err) {
                if ((err.message.includes("503") || err.message.includes("overloaded")) && retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`Model overloaded (503). Retrying attempt ${retryCount}/${maxRetries} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                throw err; // Re-throw other errors or if max retries reached
            }
        }

        const response = await result.response;
        const text = response.text();
        console.log("Gemini Raw Response:", text.substring(0, 200) + "..."); // Log start of response

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
        if (e.message.includes("400")) msg = "Invalid Request (400). File format may not be supported or is too large.";
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
