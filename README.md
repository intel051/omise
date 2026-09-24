# ひとくち · 일본 맛집 AI 검색

GitHub + Vercel용 완성형 소스 프로젝트입니다. 별도 DB, 유료 UI 라이브러리, 프런트 빌드 프레임워크 없이 HTML/CSS/JavaScript + Node.js 서버 함수로 실행합니다. API 이용료는 별도입니다.

## 1. GitHub 업로드

ZIP을 풀고 **package.json, vercel.json, api, lib, public 등이 저장소 최상위에 오도록** 업로드하세요. ZIP 자체만 업로드하면 배포되지 않습니다. 실제 API 키가 들어 있는 `.env.local`은 업로드하지 마세요. `.gitignore`와 `.env.example`도 포함하세요.

## 2. Google API 준비

- Google Cloud 프로젝트에서 결제를 연결하고 **Places API (New)** 를 활성화합니다.
- 서버용 API 키를 발급하고 API 제한을 Places API (New)로 설정합니다.
- 이 키는 브라우저용 HTTP referrer 제한 키가 아닙니다. Vercel 함수가 서버에서 호출하므로 브라우저 도메인 제한을 붙이면 호출이 실패할 수 있습니다.
- Google AI Studio에서 Gemini API 키를 발급합니다. 선택한 프로젝트/모델에서 Google Search grounding을 사용할 수 있어야 합니다.
- 현재 지도는 Google Maps 링크로 연결됩니다. 사이트 내부 지도 캔버스를 사용하지 않으므로 Maps JavaScript API나 공개 브라우저 키가 필요하지 않습니다.

## 3. Vercel 설정

1. Add New → Project → 해당 GitHub 저장소 Import.
2. Framework Preset: **Other**. Root Directory: package.json이 있는 디렉터리.
3. Build Command: `npm run build`, Output Directory: `dist` (vercel.json에도 설정됨).
4. Node.js 버전 **22.x** 사용.
5. Environment Variables에 아래 값 등록 후 Deploy.

| 변수 | 값 | 필수 |
| --- | --- | --- |
| GOOGLE_MAPS_API_KEY | Places API (New) 서버용 키 | 필수 |
| GEMINI_API_KEY | Google AI Studio 키 | 필수 |
| GEMINI_MODEL | `gemini-2.5-flash` | 생략 가능 |
| APP_PASSWORD | 길고 무작위인 사이트 비밀번호 | 외부 공개 시 권장 |

환경변수를 나중에 추가/변경하면 Redeploy 하세요. Production/Preview에 필요한 범위를 각각 지정하세요. 검색 패널의 ‘사이트 비밀번호’를 열어 APP_PASSWORD 값을 입력합니다. 비밀번호는 메모리에만 두며 localStorage에 저장하지 않습니다. 비밀번호 미설정 시 누구나 API를 호출할 수 있습니다.

## 4. 검색 흐름

1. 일본 영역으로 제한한 Places Text Search (New)에서 최대 6개 식당을 가져옵니다.
2. 영구/임시 폐업 표시 후보를 제외합니다.
3. Gemini의 `google_search` 도구로 해당 지점의 타베로그 자료를 검색합니다.
4. 검색 출처와 groundingSupports를 보존합니다. Google 검색의 출처 리디렉션만 제한적으로 해석하며 타베로그 페이지 자체를 스크래핑하지 않습니다.
5. 별도 Gemini 호출로 후보 순서, 추천 이유, 근거 인덱스를 JSON으로 추출합니다. 검색 도구와 구조화 출력 조합의 모델별 차이를 피하기 위해 두 호출을 분리했습니다.
6. 서버가 후보 ID를 대조해 새로운 식당을 만들어 넣지 못하게 합니다. 타베로그 점수는 **같은 인용 문장 안의 정확한 ID·이름·주소·숫자와 타베로그 식당 URL**이 모두 확인된 경우에만 카드에 표시합니다. 기준이 엄격해 미확인이 자주 나올 수 있습니다.
7. AI 실패 시 Google 검색 결과를 그대로 보여주고 점수나 추천을 꾸며내지 않습니다.

## 타베로그에 관한 중요한 범위

이 프로젝트는 타베로그 공식 API 연동이 아닙니다. 검색 grounding은 실시간 공식 점수 피드가 아니며 지점 일치나 원문 내용을 독립적으로 검증한 것도 아닙니다. 카드에는 ‘검색 근거 기반 · 원문 재확인 필요’라고 표시합니다. 검색 시각은 타베로그 점수의 갱신 시각이 아닙니다.

식당별 점수가 검색에 노출되지 않거나 groundingSupports가 없거나 리디렉션을 해석할 수 없으면 **미확인**으로 처리하고 원문 검색 링크를 제공합니다. 미확인 값을 0점으로 환산하지 않습니다. Google 별점을 타베로그 점수로 대체하거나 두 서비스 점수를 평균 내지 않습니다.

검색 자료에 잘못된 정보가 있을 수 있으므로 방문 전 원문 확인이 필요합니다. 영업시간·메뉴·가격도 보장하지 않습니다. 예산은 자유 입력 선호이며 API에서 보장하는 가격 필터가 아닙니다. 정확하고 안정적인 타베로그 점수가 사업상 필수라면 허가받은 데이터 제공 방식과 이용 조건부터 확보하고 이 증거 수집 부분을 교체해야 합니다. 타베로그 이용약관은 영리 목적 이용과 후기 무단 이용 등을 제한하므로 공개 상용 서비스 운영 전 적용 조건을 확인하세요.

## 파일 구성

- `public/index.html`: 검색 화면
- `public/style.css`: Pretendard 기반 반응형 UI
- `public/app.js`: 검색 요청·결과·출처·오류 표시
- `public/privacy.html`: 기본 개인정보 및 이용 안내
- `api/search.js`: Vercel 서버 함수, 인증과 검색 파이프라인
- `lib/core.js`: Google API, Gemini, 출처/입력 검증
- `vercel.json`: 배포와 실행 시간 설정
- `.env.example`: 환경변수 예시
- `build.mjs`: 정적 파일만 dist로 복사. 서버 소스·키는 공개 폴더에 넣지 않음
- `dev.mjs`: 로컬 서버
- `test/core.test.js`: 출처 검증과 모의 API 통합 테스트

## 로컬 실행

Node.js 22.9 이상 권장. 외부 npm 런타임 의존성은 없습니다.

```bash
cp .env.example .env.local
# .env.local에 실제 키와 사이트 비밀번호 입력
npm run dev
```

브라우저에서 http://localhost:3000 접속. HTML 파일을 더블클릭하거나 GitHub Pages에 올리는 방식으로는 서버 API가 실행되지 않습니다.

```bash
npm run build
npm test
```

## 운영 및 한계

- 한 검색은 Places 1회 + Gemini 최대 2회 + grounding 검색을 사용합니다. API 콘솔에서 쿼터 및 비용 알림을 설정하세요. 알림 자체는 하드 지출 한도가 아닙니다.
- APP_PASSWORD는 소규모 개인용 공유 비밀번호 방식입니다. 분산 rate limiting이나 사용자 계정 기능은 포함하지 않았습니다. 공개 서비스에는 Vercel 방화벽/요청 제한 등 추가 보호가 필요합니다.
- API 응답은 `no-store`이며 식당 정보는 DB 또는 브라우저 저장소에 영구 저장하지 않습니다.
- API 키는 서버 환경변수로만 사용합니다. `public/` 또는 GitHub에 넣지 마세요.
- Google Maps 데이터와 AI/Tabelog 자료를 구분해 표시하며, grounding 검색 제안 HTML은 스크립트 실행 권한 없는 sandbox iframe 안에 표시합니다.
- 개인정보 안내의 운영자/문의처는 실제 공개 운영 전에 편집하세요.
- 401: 사이트 비밀번호 / 503: 환경변수 누락 / 429: API 쿼터 / 502: 외부 API·모델·시간 초과 확인.
- `GEMINI_MODEL`을 바꾸면 해당 모델이 Google Search와 generationConfig의 thinkingConfig를 지원하는지 확인하세요.
- 테스트: 빌드, 문법 검사, 모의 API 검증을 수행했습니다. 실제 유료 API 호출과 Vercel 원격 배포는 키/계정 연결이 없어 수행하지 않았습니다.

## 공식 문서

- https://developers.google.com/maps/documentation/places/web-service/text-search
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://ai.google.dev/gemini-api/docs/generate-content/google-search
- https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash
- https://vercel.com/docs/functions/runtimes/node-js
- https://tabelog.com/help/rules/
- 브라우저 실행 파일이 없는 환경이라 실제 화면 렌더링 검사는 완료하지 못했습니다. CSS에 모바일 반응형 규칙을 포함했으며 배포 후 휴대폰 화면도 확인하세요.
