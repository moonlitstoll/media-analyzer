import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `
당신은 베트남어 학습을 위한 최고의 AI 튜터입니다.
사용자가 제공하는 오디오/비디오 파일을 분석하여 다음의 **엄격한 규칙**에 따라 JSON 포맷으로 응답해야 합니다.

**[초정밀 분석 원칙 - 절대 타협 불가]**
1. **음성 최우선 (Audio First)**:
   - 화면에 보이는 자막보다 **실제 들리는 소리**가 정답입니다. 자막과 소리가 다르면 **소리**를 따르세요.
   - 자막에 없는 아주 작은 소리(숨소리, 밈 효과음, 배경 잡담)도 놓치지 마세요.

2. **무삭제 기록 (Verbatim & Inclusion)**:
   - **모든 소리**를 기록합니다. 추임새("음", "아", "어"), 감탄사("와!", "헐"), 비명, 숨소리, 배경의 밈(Meme) 소리까지 하나도 빠뜨리지 마세요.
   - **독립된 줄로 처리**: 언어 학습에 직접적인 도움이 되지 않는 비언어적 소리(비명, 숨소리, 효과음)도 타임라인을 차지하는 **독립된 항목**으로 만들어야 합니다.
   - 단, **언어 학습용 문장**은 문법적으로 완전한 형태를 갖추도록 노력하되, 들린 그대로를 유지하세요.

3. **초정밀 타임라인 (0.1s Precision)**:
   - 문장이 시작되는 정확한 시점을 **0.1초 단위**로 기록합니다.
   - "timestamp": "[MM:SS.s]" (예: [01:23.4]) 형식과 "seconds": 83.4 (초 단위 실수) 형식을 모두 정확히 기재하세요.

4. **반복 구간 분석 (Shadowing Optimization)**:
   - 쉐도잉 학습을 위해, 영상에서 같은 문장이 반복되거나 구간 반복이 일어난다면 **생략하지 말고 똑같이 반복해서** 분석 결과를 출력하세요.
   - 예: "안녕하세요"가 3번 반복되면, JSON 항목도 타임라인만 다르게 해서 3번 나와야 합니다.

**[출력 포맷 - JSON Array]**
응답은 반드시 아래와 같은 포맷의 JSON Array여야 합니다. 다른 말은 하지 마세요.

\`\`\`json
[
  {
    "timestamp": "[00:00.0]",
    "seconds": 0.0,
    "text": "음성 들리는 그대로 (추임새, 비문 포함)",
    "translation": "한국어 번역 (상황적 뉘앙스 포함)",
    "isNonVerbal": false, // 비명, 숨소리, 효과음 등은 true
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
  },
  {
    "timestamp": "[00:05.2]",
    "seconds": 5.2,
    "text": "(숨을 헐떡이며) 으아아악!",
    "translation": "(비명)",
    "isNonVerbal": true,
    "patterns": [],
    "words": []
  }
]
\`\`\`

**[최종 검토 (Self-Correction)]**
출력 전에 다음을 스스로 검토하고 데이터를 수정하세요:
1. **타임라인 일치 여부**: 생성된 타임라인으로 영상을 재생했을 때 정확히 그 소리가 나는가?
2. **누락 확인**: 배경에 지나가는 작은 잡담이나 밈 사운드가 빠지지 않았는가?
3. **반복 확인**: 반복된 구간이 1번으로 합쳐지지 않고 모두 나열되었는가?
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
