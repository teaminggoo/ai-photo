# AI Photo Mood & Style Analyzer (AI 이미지 분위기 & 스타일 분석)

Cloudinary에 업로드된 사진을 Google Gemini API에 전달하여 색상, 배경, 구도, 의상, 표정을 바탕으로 전체적인 분위기와 스타일을 분석해주는 웹 애플리케이션입니다.

---

## 🚀 주요 기능
1. **Cloudinary 클라이언트 직접 업로드**:
   - 이미지를 클라우드에 안전하게 업로드하고 고유 URL을 획득합니다.
2. **보안 서버리스 아키텍처 (Vercel Serverless Function)**:
   - 클라이언트(HTML/JS)에 Gemini API Key가 일절 노출되지 않습니다.
   - `/api/analyze` 엔드포인트를 통해 서버 환경 변수(`GEMINI_API_KEY`)로 Google Gemini API와 안전하게 통신합니다.
3. **Google Gemini 멀티모달 무드 분석**:
   - 사람의 신원이나 개인정보를 추측하지 않고, 순수 시각적 요소(색상, 배경, 구도, 의상, 표정)를 토대로 분석합니다.
   - **분위기 키워드 3개 & 퍼센트** (시각적 게이지 그래프)
   - **AI 감성 한줄평**
   - **스타일 추천 해시태그 4개** (클릭 시 원클릭 클립보드 복사)
4. **사용자 경험(UX)**:
   - 분석 진행 중 **'AI가 사진을 분석하고 있습니다.'** 안내 메시지와 로딩 애니메이션 노출
   - 분석 완료 시 인터랙티브한 결과 화면으로 부드럽게 전환

---

## 🔑 환경 변수 설정 (Vercel 배포)

1. **Google Gemini API Key 발급**:
   - [Google AI Studio](https://aistudio.google.com/)에서 API Key를 발급받습니다.

2. **Vercel 대시보드에 환경 변수 등록**:
   - Vercel 프로젝트 대시보드 접속 -> **Settings** -> **Environment Variables**
   - **Key**: `GEMINI_API_KEY`
   - **Value**: 발급받은 Gemini API Key 입력
   - **Environment**: Production, Preview, Development 모두 체크 후 **Save**

---

## 💻 로컬 개발 환경에서 실행하는 방법

1. 프로젝트 루트에 `.env` 파일을 생성하고 발급받은 API 키를 입력합니다:
   ```bash
   GEMINI_API_KEY=발급받은_실제_API키
   ```
2. 개발 서버 실행 (별도 패키지 설치 없이 Node.js 내장 모듈로 바로 구동됩니다):
   ```bash
   npm start
   # 또는
   node dev-server.js
   ```
3. 브라우저에서 `http://localhost:3000` 접속 후 테스트합니다.
