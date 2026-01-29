# Media Analyzer (AI Shadowing Helper)

Google Gemini AI를 활용하여 오디오 및 비디오 파일을 분석하고, 외국어 학습(쉐도잉)을 도와주는 웹 애플리케이션입니다.

## ✨ 주요 기능

- **📁 미디어 파일 분석**: 오디오(mp3, wav, m4a) 및 비디오(mp4) 파일을 업로드하여 분석합니다.
- **🤖 AI 기반 심층 분석**: Google Gemini 2.5 Flash 모델을 사용하여 음성을 텍스트로 변환하고, 문장 단위로 정밀하게 분석합니다.
  - **무삭제 기록 (Verbatim)**: 추임새, 더듬는 소리까지 정확하게 기록합니다.
  - **패턴 & 뉘앙스**: 문법적 의미와 회화적 뉘앙스를 한국어로 자세히 설명합니다.
  - **단어 분석**: 주요 단어의 의미와 문장 내 역할을 분석합니다.
- **⏱️ 정밀 타임라인**: 0.1초 단위의 타임스탬프로 문장 구간을 정확하게 제어합니다.
- **🔄 구간 반복 학습**: 문장 단위 무한 반복(Loop) 기능을 제공합니다.
- **👁️ 분석 내용 토글**: 학습 효과를 높이기 위해 분석 내용(번역, 패턴 등)을 숨기거나 볼 수 있습니다.
- **💾 HTML 내보내기**: 분석된 결과를 대화형 HTML 파일로 저장하여 언제 어디서든 학습할 수 있습니다.

## 🛠️ 기술 스택

- **Frontend**: React, Vite
- **Styling**: Tailwind CSS
- **AI**: Google Generative AI SDK (Gemini 2.5 Flash)
- **Icons**: Lucide React

## 🚀 실행 방법

1. **프로젝트 클론**
   ```bash
   git clone https://github.com/<USERNAME>/media-analyzer.git
   cd media-analyzer
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

4. **API Key 설정**
   - 앱 실행 후 우측 상단 설정 아이콘을 클릭하여 Google Gemini API Key를 입력하세요.
   - API Key는 브라우저의 LocalStorage에 안전하게 저장됩니다.

## 📦 배포

이 프로젝트는 GitHub Pages 배포를 지원합니다.

```bash
npm run deploy
```

---
Made with ❤️ for Language Learners
