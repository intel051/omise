# ひとくち · 일본 식당 AI 추천

Google Maps에서 식당을 찾고 Gemini가 **추천 순서와 이유**를 정리하는 GitHub + Vercel용 프로젝트입니다. 밝은 블루·남색 중심의 반응형 화면을 사용합니다.

## 검색 흐름

1. Google Places API (New)에서 일본 내 식당을 최대 6곳 검색합니다.
2. 검색 결과와 지도 링크를 먼저 표시합니다.
3. Gemini를 1회 호출해 검색 결과를 정렬하고 한국어 추천 이유를 생성합니다.
4. AI 정렬 실패 시 받은 결과를 유지하고 Google 검색 순서로 표시합니다.

식당명·주소·구글 별점·리뷰 수 및 입력한 취향만 추천 근거로 사용합니다. 가격·메뉴 세부 내용·혼밥 편의·영업시간은 별도 확인해야 합니다. AI가 반환한 식당 ID는 원래 후보와 대조합니다.

## Vercel 배포

- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: 22.x

| 환경변수 | 설정 |
| --- | --- |
| GOOGLE_MAPS_API_KEY | Places API (New)를 활성화한 서버용 키 |
| GEMINI_API_KEY | Gemini API 키 |
| GEMINI_MODEL | 생략 시 `gemini-3.5-flash-lite` |
| APP_PASSWORD | 개인용 공유 비밀번호. 설정 시 검색 패널에 입력 |

API 프로젝트의 결제·할당량·모델 이용 권한을 확인하세요. 키는 Vercel 서버 환경변수에만 등록하고 GitHub에 업로드하지 마세요. 환경변수 변경 후 재배포해야 합니다. 공개 서비스에서는 요청 제한과 운영자·개인정보 문의처를 추가하세요.

모든 파일을 저장소 최상위에 맞춰 업로드한 후 Vercel에 연결합니다. 브라우저와 서버 코드를 함께 배포해야 합니다. 서버 함수가 필요하므로 GitHub Pages만으로는 검색 API가 실행되지 않습니다.

## 실행

Node.js 22.9 이상에서 `.env.local`에 환경변수를 설정하고 실행하세요. 별도 npm 런타임 의존성은 없습니다.

```bash
npm run dev
npm run build
npm test
```

로컬 접속: http://localhost:3000

## 파일

- `lib/core.js`: Gemini 요청, 입력 검증, 오류 진단
- `lib/pipeline.js`: Places 검색과 AI 추천 1회
- `api/search.js`: 비밀번호 확인, NDJSON 스트림, 취소와 시간 제한
- `public/index.html`, `public/style.css`, `public/app.js`: 검색 화면과 추천 순서·이유
- `public/stream.js`: 스트림 수신
- `public/privacy.html`: 기본 이용 안내
- `test/`: 모의 API와 스트림 테스트

## 오류 확인

- `gemini_request`: 실제 요청 model과 환경변수/기본값 출처
- `gemini_response`: 성공 응답 modelVersion과 소요 시간
- `gemini_error`, `ai_ranking`: Google HTTP 상태, providerStatus, message, finishReason

API 키는 로그에서 마스킹하고 프롬프트는 기록하지 않습니다. 400은 요청 설정, 401/403은 인증·권한, 404는 모델, 429는 할당량·결제 설정을 우선 확인하세요. 실패 원인은 실제 Google 오류 메시지로 판단해야 합니다.

응답은 no-store이며 검색 데이터를 DB나 브라우저 저장소에 영구 저장하지 않습니다. 초기 검색 최대 10초, Gemini 정렬 최대 16초, 전체 서버 35초 및 클라이언트 45초 제한을 적용했습니다. 실제 속도는 API 상태에 따라 달라집니다.
