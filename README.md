# ひとくち · 여행의 한 끼

사진 중심의 일본 식당 탐색, 여행별 보관함, 저장 지도와 길찾기, 방문 표시·메모를 제공하는 GitHub + Vercel 프로젝트입니다. 모바일은 하단 탐색과 지도/목록 전환, 데스크톱은 식당 목록과 Google 지도를 함께 보여줍니다.

## Vercel 설정

Framework: Other / Node.js: 22.x / Build: `npm run build` / Output: `dist`

| 환경변수 | 설명 |
| --- | --- |
| GOOGLE_MAPS_API_KEY | 서버용 Places API (New) 키. 결제 및 Places API (New) 활성화 필요 |
| GOOGLE_MAPS_BROWSER_KEY | **추가 설정 필요**: 사이트 내부 지도를 위한 공개 브라우저용 키. Maps JavaScript API 활성화, HTTP referrer 제한으로 실제 Vercel 도메인과 로컬 테스트 도메인만 허용 |
| GOOGLE_MAPS_MAP_ID | 선택: 운영용 Google 지도 ID. 생략 시 Google 제공 DEMO_MAP_ID 사용. 실제 운영에는 프로젝트의 지도 ID 권장 |
| GEMINI_API_KEY | 선택: 'AI로 후보 정리'용 Gemini 키. 없어도 검색·사진·저장 기능 사용 가능 |
| GEMINI_MODEL | 선택: 기본 `gemini-3.5-flash-lite` |
| APP_PASSWORD | 선택: 검색·상세·사진·AI API 공통 비밀번호 |

서버용 키를 브라우저 키로 재사용하지 마세요. `/api/config`는 의도적으로 공개된 브라우저용 키만 반환합니다. 서버 키와 Gemini 키는 전달하지 않습니다. 지도 키가 없거나 Google 지도 인증이 실패하면 지도 영역에 안내를 표시하며 검색·저장·길찾기는 계속 사용할 수 있습니다. 설정 변경 후 재배포하세요.

Places API 및 Maps JavaScript API에는 이용료가 발생할 수 있습니다. 사진·저장 식당 재조회가 API 요청을 추가합니다. 사진은 지연 로딩하며 동시에 최대 3개 요청합니다. 첫 번째 Google 사진이 음식 사진이라는 보장은 없으며 카드에는 식당 사진으로 표시합니다.

## 기능

- 최대 12곳 검색, 식당 사진과 제공자, 별점·리뷰 수·현재 영업 여부·대략적인 가격대 표시
- 사진이 없거나 로딩 실패 시 일정한 크기의 대체 화면 표시
- 여행별 저장, 식당 메모, 방문 표시. 모바일·PC 같은 브라우저에서는 유지되나 다른 기기로 자동 동기화하지 않음
- 현재 선택한 여행의 저장 식당을 Google 지도에 표시, 카드와 핀 선택 연결
- 길찾기는 Google Maps 앱/웹으로 연결. 별도 경로 API 호출 없이 이용
- AI는 사용자가 버튼을 눌렀을 때 한 번만 호출. 검색 결과와 취향만 참고하며 후보 ID를 검증
- 사진·별점·영업 정보는 로컬 저장하지 않고 식당 ID로 재조회. 저장되는 것은 여행 이름·식당 ID·사용자 메모·방문/저장 시각뿐

## 로컬 실행

Node.js 22.9 이상. `.env.local`에 환경변수를 입력하세요. 의존성 설치 없이 실행할 수 있습니다.

```bash
npm run dev
npm test
npm run build
```

http://localhost:3000 에서 접속합니다. `.env.local`은 GitHub에 업로드하지 마세요. GitHub Pages만으로는 서버 API를 실행할 수 없습니다.

## API

- `POST /api/search`: JSON 검색 결과와 짧은 유효기간의 서명된 AI 요청 토큰
- `POST /api/places`: 최대 20개 식당 ID의 최신 정보. 보관함은 자동으로 나누어 조회
- `POST /api/photo`: 서명된 사진 토큰 검증 후 Google 이미지 주소 반환
- `POST /api/recommend`: 검색 때 발급한 서명 토큰을 검증한 뒤 Gemini 한 번 호출
- `GET /api/config`: 브라우저 지도 키, 지도 ID, AI 사용 가능 여부

사진·AI 토큰은 서버에서 서명하고 유효기간을 확인합니다. 서명 원문에 서버 비밀키는 포함하지 않습니다. API 응답은 no-store입니다. APP_PASSWORD는 소규모 개인 공유용이며, 대규모 공개 운영 전 계정·분산 요청 제한·문의처를 추가해야 합니다.

## UI 및 호환성

밝은 블루·흰색·남색, Pretendard JP, CSS cascade layers·반응형 그리드·aspect-ratio·safe-area·모션 줄이기 대응을 사용합니다. 모바일에서 폼·카드·모달이 화면 너비를 넘지 않도록 구성했습니다. 지도 인증/스크립트 실패, 저장공간 실패, 손상된 저장 데이터와 빈 검색 결과를 처리합니다.

기존 v2와 검색 API 형식이 다릅니다. api/lib/public 전체를 함께 배포하세요. Gemini 진단 로그는 `gemini_request`, `gemini_response`, `gemini_error`, `ai_ranking`으로 확인합니다.

## 검증 범위

- 서버·저장소 모의 테스트 13개와 프로덕션 정적 빌드를 통과했습니다.
- Chromium에서 데스크톱·모바일 검색, AI 정렬, 여행 생성, 저장/해제, 방문 표시, 메모, 새로고침 후 복원을 확인했습니다.
- 320, 360, 390, 430, 760, 1024, 1440px에서 가로 넘침이 없고 화면 동작 중 JavaScript 오류가 없음을 확인했습니다. 한글·일본어 폰트를 로딩한 화면도 점검했습니다.
- 사진 로딩 성공 시 제공자 표시, 사진 실패 대체 화면, 지도 키 미설정 대체 화면, 지도 핀·카드 선택 어댑터를 모의 Google 응답으로 검증했습니다.
- 실제 Google/Gemini 유료 호출과 실제 지도 타일·운영 도메인 키 인증은 키에 접근할 수 없어 확인하지 못했습니다. 배포 후 운영 키의 API 활성화·도메인 제한을 확인하세요.
