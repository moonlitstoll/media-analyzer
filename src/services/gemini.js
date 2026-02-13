import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **엄격한 규칙**에 따라 JSON 포맷으로 응답해야 합니다.

**[분석 원칙 - 언어 학습 최적화 및 초정밀 싱크]**

1. **학습 불필요 요소 제거 (Clean Script)**:
   - **절대 기록 금지**:
     - 화면 설명: (화면에 'ABC' 텍스트 등장), [자막: 안녕] 등 시각적 요소
     - 배경음/효과음: (음악), (박수 소리), (쾅), (휘파람) 등
     - 비언어적 소리: (흐음), (한숨), (신음), (비명), (울음소리) 등 언어적 의미가 없는 소리
   - **기록 대상**:
     - 오직 **사람의 입에서 나온 말(Spoken Words)**만 기록하세요.
     - 대화 중 자연스러운 추임새("음...", "아...", "어...")는 **말의 일부라면** 포함하되, 단순히 혼자 내는 소리라면 제외합니다.

2. **초정밀 타임라인 '스냅(Snap)' (0.1s Precision)**:
   - **음성 파형 시작점 기준**: 문장의 첫 음절이 실제로 시작되는 정확한 시점("Waveform Start")에 타임스탬프를 찍으세요.
   - **유격 제거**: 자막이 미리 나오거나 늦게 나오지 않도록 타임라인을 음성에 0.1초 단위로 '스냅(Snap)' 시킵니다.
   - 포맷: "timestamp": "[MM:SS.s]", "seconds": 0.0 (실수)

3. **반복 구간 분석**:
   - 쉐도잉 학습을 위해, 영상에서 같은 문장이 반복되거나 구간 반복이 일어난다면 **생략하지 말고 똑같이 반복해서** 분석 결과를 출력하세요.

**[출력 포맷 - JSON Array]**
응답은 반드시 아래와 같은 포맷의 JSON Array여야 합니다.

\`\`\`json
[
  {
    "timestamp": "[00:01.2]",
    "seconds": 1.2,
    "text": "실제 발화된 베트남어 문장 (배경음/화면설명 제외)",
    "translation": "한국어 번역 (뉘앙스 포함)",
    "patterns": [
       {
         "term": "thì lại",
         "definition": "'그런데 또', 예상 밖의 상황 설명."
       }
    ],
    "words": [
       { "word": "trong tầm tay", "meaning": "손이 닿는 범위 (숙어: 가까운)", "func": "전치사구" },
       { "word": "nắm bằng một đôi", "meaning": "한 쌍으로 잡다 (문맥: 둘이서 함께)", "func": "동사구" }
    ]
  }
]
\`\`\`

**[단어/구문 분석 지침 - Chunk 단위 분석]**
1. **의미 단위 묶기 (Chunking)**:
   - 기계적으로 단어 하나씩 쪼개지 말고, **의미가 연결되는 덩어리(Chunk)**로 묶어서 분석하세요.
   - 예: "đi"와 "học"을 따로 분석하지 말고, "đi học" (학교에 가다)으로 묶어서 분석.
   - 예: "không"과 "thể"를 따로 분석하지 말고, "không thể" (할 수 없다)로 묶어서 분석.
   - 숙어, 관용구, 연어(Collocation)는 반드시 한 덩어리로 묶으세요.

2. **문맥적 의미 부여**:
   - 사전적 정의보다 **이 문장에서 쓰인 구체적인 뉘앙스**를 설명하세요.
   - 필요한 경우 괄호()를 사용하여 문맥을 보충 설명하세요. 예: "밥을 먹다 (저녁 식사)"

**[최종 검토 (Self-Correction)]**
출력 전 다음을 반드시 시뮬레이션 하세요:
1. **필터링 확인**: "(화면에...)", "(음악)", "(흐음)" 같은 게 남아았진 않은가? -> 발견 즉시 삭제하세요.
2. **싱크 확인**: 타임스탬프가 음성 시작점과 0.1초 오차 범위 내로 정확히 일치하는가? -> 밀리거나 빠르면 시간값을 수정하세요.
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
