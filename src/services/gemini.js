import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 엄격한 규칙에 따라 JSON 포맷으로 응답해야 합니다.

**[분석 원칙 - 무삭제 & 연속성 필수]**
1. **완전 무삭제 (Verbatim) 및 반복 포함**:
   - **절대로** 내용을 생략하거나 요약하지 마세요.
   - **반복되는 가사나 대사도 반드시 모두 개별적으로 기록**해야 합니다. (예: "사랑해"를 3번 말하면, 타임라인을 나눠 3개의 항목으로 만들어야 함. "사랑해 (x3)" 금지)
   - **중요**: [웃음소리], [숨소리], [배경음악] 제외. 오직 말소리만 기록.
2. **누락 없는 타임라인 (No Gaps)**:
   - 파일의 시작(00:00)부터 끝까지 모든 발화 구간을 커버해야 합니다.
   - **특히 1분 이상의 긴 공백이 있다면 의심하십시오.** 노래의 간주 부분이 아니라면 대사가 누락되었을 확률이 높습니다.
3. **초정밀 타임라인**: 0.1초 단위로 문장 시작/종료 시간을 기록합니다.
4. **언어 및 발음**: 모든 설명은 **한국어**로 합니다.

**[★★★ 중요: 출력 절차 (Output Step-by-Step) ★★★]**
모든 생각과 검증을 "내부적으로"만 하지 말고, **반드시 결과물 앞에 [검토 보고서]를 작성**하십시오.

**Step 1: [검토 보고서] 작성**
JSON을 출력하기 전에, 다음 항목을 스스로 확인하고 텍스트로 작성하세요.
1. **싱크 확인**: "오디오 타임라인과 대본이 0.1초 오차 없이 일치하는가?" (예/아니오)
2. **누락/공백 확인**: "3초 이상 대본이 없는 구간이 있는가? 있다면 그 구간에 정말 아무 소리도 없는가?" (상세 확인 요망)
3. **반복 구문 확인**: "반복되는 후렴구나 대사를 'x2' 등으로 퉁치지 않고 전부 풀어서 썼는가?" (예/아니오)
4. **재생 테스트**: "이 타임라인대로 재생했을 때 끊김 없이 자연스러운가?" (예/아니오)

**Step 2: 최종 JSON 출력**
검토가 끝난 후, 완벽한 JSON Array만 출력하세요.

**[출력 예시]**
[검토 보고서]
1. 싱크 확인: 예.
2. 누락/공백 확인: 아니오, 모든 구간 채워짐. (또는: 01:20~01:40은 간주 구간이라 비움)
3. 반복 구문 확인: 예, 후렴구 4번 반복 모두 기록함.
4. 재생 테스트: 예.

\`\`\`json
[
  {
    "timestamp": "[00:00.0]",
    "seconds": 0.0,
    "text": "반복되는 가사라도",
    "translation": "번역",
    "patterns": [],
    "words": []
  },
  {
    "timestamp": "[00:05.0]",
    "seconds": 5.0,
    "text": "반복되는 가사라도 (반드시 따로 기록)",
    "translation": "번역",
    "patterns": [],
    "words": []
  }
]
\`\`\`

**[세부 요구사항]**
- **translation**: '분석 보기'용 상세 번역.
- **text**: 들리는 대로 100% 받아쓰기.
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
