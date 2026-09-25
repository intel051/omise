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

## 4. v2 검색 흐름: 먼저 표시하고 병렬 분석

1. Places 검색 완료 직후 최대 6개 식당을 NDJSON 스트림으로 먼저 전송합니다.
2. **Google 검색 순서의 첫 3곳**을 병렬 분석합니다. 아직 AI가 뽑은 상위 3곳은 아닙니다.
3. 각 식당의 Tabelog URL을 Search grounding으로 찾고 출처 URL을 제한적으로 해석합니다.
4. URL Context를 별도 호출해 해당 페이지의 이름·주소·종합점수를 읽습니다.
5. URL 읽기 성공 메타데이터, 식당 URL, 추출한 이름과 주소를 검증합니다. 확인이 어려운 경우 미확인으로 표시합니다. Google 주소와 페이지 주소 표기가 다르면 보수적으로 미확인이 될 수 있습니다.
6. 각 식당 분석이 끝날 때마다 카드만 갱신합니다. 나머지 3곳은 ‘이번 검색 미조회’로 구분합니다.
7. 검증을 통과한 점수만 최종 Gemini 추천 입력에 전달합니다. 추천 정렬에 실패하면 기존 Google 검색 순서와 부분 결과를 유지합니다.
8. 분석 중단 버튼, 연결 종료 시 취소, 65초 서버 제한, 75초 클라이언트 제한을 적용했습니다. 취소해도 이미 발생한 API 이용료는 취소되지 않습니다.

첫 목록은 Places 응답이 오는 즉시 표시되지만 몇 초 이내 응답을 보장하지 않습니다. 실제 속도는 API 계정/모델/네트워크로 측정해야 합니다. URL Context의 검색/페이지 확인을 위해 요청 수가 늘어 총 비용은 이전 버전보다 증가할 수 있습니다.

### UI 변경

- 짙은 검색 패널, 밝은 결과 카드, 반투명 진행 표시와 Pretendard
- CSS cascade layers, container queries, color-mix 및 backdrop-filter의 기능 감지 폴백
- 스켈레톤, 카드 등장, 점수 갱신 강조, 버튼 상호작용
- 지원 브라우저의 View Transitions로 최종 정렬 전환; 미지원 시 즉시 갱신
- prefers-reduced-motion 대응, 키보드 포커스, 한국어 진행 상태, 경과 시간
- 일부 분석 실패/중단/연결 끊김에도 받은 결과 유지

## 타베로그에 관한 중요한 범위

이 프로젝트는 타베로그 공식 API 연동이 아닙니다. 검색 grounding 및 URL Context는 실시간 공식 점수 피드가 아니며 지점 일치나 원문 내용을 독립적으로 검증한 것도 아닙니다. 카드에는 ‘페이지 읽기 기반 · 원문 재확인 필요’라고 표시합니다. 검색 시각은 타베로그 점수의 갱신 시각이 아닙니다.

식당별 점수가 페이지 읽기에 실패하거나 URL 읽기 성공 메타데이터가 없거나 리디렉션을 해석할 수 없으면 **미확인**으로 처리하고 원문 검색 링크를 제공합니다. 미확인 값을 0점으로 환산하지 않습니다. Google 별점을 타베로그 점수로 대체하거나 두 서비스 점수를 평균 내지 않습니다.

검색 자료에 잘못된 정보가 있을 수 있으므로 방문 전 원문 확인이 필요합니다. 영업시간·메뉴·가격도 보장하지 않습니다. 예산은 자유 입력 선호이며 API에서 보장하는 가격 필터가 아닙니다. 정확하고 안정적인 타베로그 점수가 사업상 필수라면 허가받은 데이터 제공 방식과 이용 조건부터 확보하고 이 증거 수집 부분을 교체해야 합니다. 타베로그 이용약관은 영리 목적 이용과 후기 무단 이용 등을 제한하므로 공개 상용 서비스 운영 전 적용 조건을 확인하세요.

## 파일 구성

- `public/index.html`: 검색 화면
- `public/style.css`: Pretendard 기반 반응형 UI
- `public/app.js`: 검색 요청·결과·출처·오류 표시
- `public/privacy.html`: 기본 개인정보 및 이용 안내
- `api/search.js`: Vercel 서버 함수, 인증과 검색 파이프라인
- `lib/core.js`: Google API, Gemini, 출처/입력 검증
- `lib/pipeline.js`: 후보 즉시 전송, 3곳 병렬 조회와 추천
- `public/stream.js`: UTF-8 분할 청크 및 NDJSON 스트림 처리
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

- 한 검색은 Places 1회 + Gemini 최대 7회(3곳 검색 + 3곳 URL 읽기 + 최종 정렬) 및 grounding 검색을 사용합니다. 병렬 실행은 시간을 줄이지만 호출 수를 줄이지 않습니다. API 콘솔에서 쿼터 및 비용 알림을 설정하세요. 알림 자체는 하드 지출 한도가 아닙니다.
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


## 검증 범위

빌드와 핵심 테스트 7개(출처 검증, 분할 한글 스트림, 목록 선표시, 3곳 동시 처리, 실패 유지, 취소, 인증)를 통과했습니다. 실제 API 키가 없어 실제 유료 호출·검색 속도·타베로그 조회 성공률·Vercel 배포는 검증하지 못했습니다. 브라우저 실행 파일 다운로드가 실패해 실제 화면 렌더링 검증도 완료하지 못했습니다.

## 기존 버전에서 업데이트

ZIP 내용으로 GitHub 프로젝트 파일을 교체하고 Vercel에서 재배포하세요. 기존 API 키와 APP_PASSWORD는 그대로 사용할 수 있습니다. api/search.js 응답이 JSON에서 NDJSON 스트림으로 변경되었으므로 public/app.js, public/stream.js 및 서버 파일을 함께 교체해야 합니다. 프런트 파일만 교체하면 동작하지 않습니다.
