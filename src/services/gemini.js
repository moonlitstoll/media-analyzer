import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **엄격한 규칙**에 따라 JSON 포맷으로 응답해야 합니다.

**[분석 원칙 - 무손실 전수 추출 및 초정밀 싱크 (Zero-Omission)]**

1. **무손실 전수 추출 (Zero-Omission Policy)**:
   - **음성 우선 분석**: 화면 자막이나 시각 정보에 의존하지 말고, 실제 오디오 소스를 0.5초 단위로 정밀하게 분석하여 소리를 찾아내세요.
   - **반복 문구 완전 보존**: 동일한 단어나 문장이 수백 번 반복되더라도 절대 생략, 요약, 또는 "...(반복)" 등으로 처리하지 마세요. 모든 발화는 들리는 횟수만큼 각각 독립된 타임라인으로 기록해야 합니다.
   - **순수 발화 집중**: 사람의 입에서 나온 모든 말, 가사, 추임새(Oh, Yeah, Hey 등)는 하나도 빠짐없이 대본에 포함하세요. (음악), (웃음소리) 등 비언어적/시각적 묘사는 '텍스트'에서 제외합니다.

2. **전구간 절대 시간(Absolute Seconds) 엔진**:
   - 모든 타임라인은 0초부터 곡 종료 시점까지 단일 실수형 '초(Seconds)' 단위로 계산하고 관리하세요.
   - 60초(1분) 이후에도 [01:05.2] -> 65.2s 와 같이 누적된 총 초를 기준으로 오차 없이 타임스탬프를 찍으세요.

3. **의미 단위 구조화 (Semantic Chunking)**:
   - 위 '전수 기록' 원칙을 지키면서도, 학습자가 문장 구조를 파악할 수 있도록 주어+동사+목적어 관계가 유지되는 의미 덩어리(Chunk)로 묶어주세요.
   - 단어 파편화보다는 문맥이 통하는 구절(Phrase) 단위로 정렬하되, 단어 누락은 절대 금지입니다.

4. **초정밀 타임라인 '스냅(Snap)' (0.1s Precision)**:
   - 음성 파형의 시작점("Waveform Start")에 0.1초 단위로 정확히 타임스탬프를 찍으세요.
   - 유격(Gap) 없이 음성과 텍스트가 완벽히 일치하도록 대조 검토 프로세스를 거치세요.

**[출력 포맷 - JSON Array]**
응답은 반드시 아래와 같은 포맷의 JSON Array여야 합니다.

\`\`\`json
[
  {
    "timestamp": "[00:01.2]",
    "seconds": 1.2,
    "text": "실제 발화된 텍스트 (누락/생략 절대 금지)",
    "translation": "한국어 번역 (문맥 포함)",
    "patterns": [
       { "term": "구문/숙어", "definition": "문맥적 의미" }
    ],
    "words": [
       { "word": "의미단위구", "meaning": "의미 (문맥반영)", "func": "품사/역할" }
    ]
  }
]
\`\`\`

**[최종 검토 (Completeness Check)]**
출력 전 다음을 스스로 대조하세요:
1. **누락 확인**: 0.5초 간격으로 소외된 '말'이 없는가? 반복 구를 생략하지 않았는가?
2. **필터링 확인**: 비언어적 소리(음악 등)가 텍스트에 포함되지 않도록 철저히 배제했는가?
3. **싱크 확인**: 1분 이후에도 절대 초(Seconds) 값이 정확하게 계산되었는가?
`;

export async function analyzeMedia(file, apiKey) {
    if (!apiKey) throw new Error("API Key is required");

    // Basic validation
    if (!file) throw new Error("No file provided");

    // Size limit check removed to allow larger files as requested. 
    // Browser base64 limit might still apply, but we allow the attempt.
    console.log(`Analyzing file: ${file.name} (${file.type}, ${file.size} bytes)`);

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
