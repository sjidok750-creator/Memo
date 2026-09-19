# Gist — 작업 메모

유튜브 링크·책 제목·사진을 Claude 로 요약해 저장하는 개인 메모장. Next.js App Router + TypeScript, 외부 UI 라이브러리 없음 (app/globals.css 에 디자인 토큰).

## 명령
- `npm run dev` 개발 서버 (`MEMO_MOCK=1` 이면 Claude 를 부르지 않고 예시 요약)
- `npm run build` / `npm run typecheck`
- `npm run build:demo` GitHub Pages 용 정적 데모 (`DEMO_BASE_PATH=/Memo`) — app/api 와 app/memo/[id] 를 빌드 중 잠시 치운다

## 구조
- `lib/claude.ts` Claude 호출과 프롬프트. 모델 `claude-opus-5`, effort 기본 medium, `fallbacks: "default"`. 웹 도구가 필요한 흐름(책, 자막 없는 유튜브)은 **조사(runResearch, 도구+텍스트) → 구조화(runSummary, 도구 없음+JSON 스키마)** 두 요청으로 나눈다. 웹 검색 결과의 인용은 구조화 출력과 같이 쓰면 400 이라 한 요청에 못 넣는다. runSummary 는 400 이면 fallbacks 제거 → 형식 제거(JSON 텍스트) 순으로 낮춰 재시도한다.
- `lib/capture.ts` 입력 종류별 파이프라인 (`replace` 로 기존 메모 다시 요약)
- `lib/youtube.ts` 영상 ID 파싱, 자막 수집 (watch 페이지 → InnerTube)
- `lib/store.ts` `data/memos.json` + `data/uploads/` 파일 저장소
- `lib/demo.ts` 서버 없는 정적 모드 (localStorage 저장소, 예시 메모), `memoHref`/`imageSrc` 로 경로 분기
- `lib/browser-key.ts` + `lib/capture-browser.ts` 브라우저 모드: 사용자 키로 Claude 를 직접 호출 (`dangerouslyAllowBrowser`), 유튜브는 자막 없이 웹 도구로 조사
- `components/Connect.tsx` 키 연결 패널 (정적 빌드에서만 렌더)
- `lib/claude-app.ts` API 키 없는 경로: 요청문을 만들어 `claude.ai/new?q=` 로 열고, 사용자가 붙여넣은 Claude 답(JSON)을 `parseClaudeReply` 로 검증해 `importMemo` 로 저장. 붙여넣기 감지는 `detectInput` 의 `import` 종류(사진이 붙어 있으면 메모 칸을 본다). 열 때의 입력(URL·사진)은 `memo-pending-import` 에 두었다가 저장 시 합친다. 저장 로직은 `components/useReplyImport.ts` 하나이며 입력창 붙여넣기, "클립보드에서 가져오기" 버튼, 공유 주소 `#import=<답>`(iOS 단축어용, Home 에서 처리)가 함께 쓴다.
- 요약 작업은 `MemoProvider` 의 `startJob/cancelJob/job` 이 전역으로 돌린다. 화면을 옮겨도 살아 있고, 홈 밖에서는 `JobPill` 이 뜬다. 진행 중 요청은 localStorage `memo-pending-job` 에 저장해 두었다가 다음 실행 때 `interrupted` 로 복구를 제안한다. 요약 중에는 화면 wake lock 을 잡는다.
- 카드(`MemoCard`)는 `<a>` 가 아니라 div 다 (iOS 링크 미리보기 회피). 꾹 누르기·우클릭·⋯ 으로 `ActionSheet` 가 열린다.
- 메모의 `thoughts` 는 상세 화면 맨 아래 "내 생각" 칸, 700ms 디바운스 자동 저장.
- `lib/richtext.tsx` `**강조**` → 굵게+밑줄+Claude 색 (`.hl`)
- `lib/i18n.ts` UI 문자열 사전 (ko/en/ja). 컴포넌트는 `useMemos().t("key")` 로 읽는다. 분야 이름은 `CATEGORIES[].label[lang]`
- `app/api/capture` NDJSON 진행 스트림, `app/api/backup` 내보내기/가져오기
- `worker/gist-worker.js` 동기화 서버 **단일 파일, 의존성 없음** (Cloudflare Workers + D1). MCP 는 SDK 없이 JSON-RPC 로 직접 처리한다 (`initialize`/`tools/list`/`tools/call`, 알림은 202, GET 은 405, protocolVersion 은 클라이언트 것을 그대로 돌려준다). `/mcp/<token>` 커넥터, `/api/<token>/...` 앱 API, `/s/<token>` 은 앱으로 보내는 링크. 토큰은 D1 `settings` 에 있고 첫 방문 때 한 번만 보여준다. D1 이 없으면 설정 안내 HTML 을 주되 커넥터는 붙을 수 있게 둔다. 폰에서 대시보드에 붙여넣어 배포하는 것이 기본 경로이므로 **의존성·빌드 단계를 추가하지 말 것**. 검증: `npx wrangler dev --port 8788` 후 공식 MCP 클라이언트(`@modelcontextprotocol/sdk` 의 Client + StreamableHTTPClientTransport)로 연결해 도구를 호출해 본다.
- 정적 모드의 저장소는 `lib/store-client.ts` 하나만 쓴다: 동기화 서버가 연결돼 있으면(`lib/sync.ts`, localStorage `memo-sync`) 서버, 아니면 `demoStore`. 사진은 서버 모드에서 `img:<id>` 참조이고 `imageSrc` 가 주소로 바꾼다. 앱으로 돌아올 때(visibilitychange/focus) 서버 목록을 다시 읽는다.

- 글귀 메모(`kind: "note"`)는 사용자가 직접 적어 그대로 보관하는 명언·문장이다. `lib/note.ts` 가 만들고 `MemoProvider` 의 `saveMemo` 가 저장한다 — **Claude 도 네트워크도 거치지 않는다.** 입력창은 `detect.ts` 의 `looksLikePassage` 로 요약/보관을 스스로 고르고, 사용자가 `.mode` 토글로 언제든 바꾼다 (주소는 요약뿐이라 토글을 감춘다). 마지막 줄이 `— 출처` 꼴이면 떼어 `source.from`·`oneLiner` 로 보낸다. 글이 곧 제목이므로 카드는 제목 줄 대신 글을 그림 칸에 보여 주고, 상세 화면은 제목과 본문이 같으면 한 번만 보여 준다. 다시 요약할 원본이 없으므로 "다시 요약" 은 감춘다.
- 대표 이미지는 `lib/thumbnail.ts` + `components/useMemoThumb.ts` 가 화면에서 찾는다 (kind `book` 만 — 영상·사진은 이미 제 그림이 있다). `book` 은 사실 "입력창에 글로 적은 것" 전부라 책·인물·개념이 다 여기 들어온다. 서지 정보(`isbn`/`publisher`/`저자+연도`)가 있으면 **책 표지**(Open Library ISBN → Google Books → Open Library 검색)를, 없으면 **위키백과**(UI 언어판 → 영어판, 제목으로 안 되면 첫 태그로)를 먼저 본다. 먼저 본 쪽에서 나오면 나머지는 부르지 않는다.
  - **주소가 실제로 열리는지는 `<img>` 의 onError/onLoad 가 판정한다** (fetch 로 확인하면 CORS 에 막힌다).
  - 엉뚱한 그림이 붙지 않게 검색 결과의 제목이 맞는 것만 쓴다 (동음이의·목록 문서 제외). 못 찾으면 글자 표지로 돌아간다 — 틀린 그림보다 낫다.
  - 저장된 메모는 건드리지 않고 기기별로 localStorage `memo-thumbs` 에 기억한다 (MCP 로 들어온 메모·예전 메모도 똑같이 뜬다).
  - 닿지 못한 경우(네트워크·429·오프라인)를 "이미지 없음" 으로 기억하면 안 된다 — 한 번 잘못 기억하면 일주일 동안 안 뜬다. 찾는 일은 카드가 사라져도 중간에 끊지 않는다.
  - 세로로 긴 표지와 가로로 긴 도표가 같은 칸에 들어가야 하므로 `.thumb-img` 는 높이를 기준으로 키우고 너비로 잘라 준다 (`height: 86%; max-width: 92%`).
- `public/sw.js` 는 `scripts/build-sw.mjs` 가 빌드 시각을 박아 생성한다 (빌드에 연결됨). 화면(navigate)은 항상 network-first + `cache: "no-store"`, `/_next/static/` 만 캐시 우선, 외부 출처(동기화 서버·썸네일)는 가로채지 않는다. 아이폰 홈 화면 앱이 옛 화면에 갇히는 것을 막는 것이 목적이므로 이 성질을 깨지 말 것. `components/ServiceWorker.tsx` 는 업데이트일 때만 한 번 새로고침한다 (첫 claim 은 무시, 반복 금지).
- 아이폰은 사파리와 홈 화면 앱의 저장소가 분리된다. 동기화 연결·API 키·언어는 기기(브라우저 컨텍스트)마다 따로 저장되므로, 연결 안내는 항상 "이 기기에서 한 번" 이라는 점을 드러낼 것.

## 테스트 방법
- 서버 모드: `MEMO_MOCK=1 MEMO_DATA_DIR=<임시폴더> npx next dev -p <포트>` 후 Playwright 로 흐름 확인
- 브라우저 모드: `npm run build:demo` 결과를 정적 서버로 띄우고, Playwright `page.route("https://api.anthropic.com/**")` 로 SSE 응답을 흉내내 확인 (실제 키 없이 요청 형태 검증). messages 요청 URL 은 `/v1/messages?beta=true` 다.

## 규칙
- 화면에 보이는 글자는 반드시 `lib/i18n.ts` 에 세 언어로 넣고 `t()` 로 쓴다. 하드코딩 금지.
- 서체는 시스템 폰트 스택(아이폰 SF Pro / Apple SD Gothic Neo / Hiragino)만 쓴다. 웹폰트·명조체를 새로 넣지 않는다.
- 진행 단계는 서버가 stage `id` 만 의미 있게 보내고 클라이언트가 `stage.<id>` 키로 번역한다.
- 요약 본문의 강조는 `**...**` 하나만 쓴다. 다른 마크다운은 렌더러가 지원하지 않는다.
- 모바일(≤900px)에서 가로 넘침이 생기면 안 된다. 검증은 스크린샷이 아니라 `document.documentElement.scrollWidth === innerWidth` 로.
- **가로 넘침이 없어도 글자는 잘릴 수 있다.** 낱말 길이가 언어마다 달라(영어 "Summarize" 는 한국어 "요약" 의 두 배) 한국어로만 보면 못 찾는다. 세 언어 × 320·390·430px 에서 `scrollWidth > clientWidth` / `scrollHeight > clientHeight` 로 확인할 것 (밀어 보는 줄과 줄 수 제한을 건 곳은 뺀다). 빈 입력칸의 **안내 문구**는 이 방법으로 안 잡히므로 값에 넣어 보고 재야 한다.
- 입력칸 높이는 `Capture` 의 `autoSize` 가 내용과 안내 문구에 맞춰 잡는다. 고정 높이로 되돌리지 말 것 — 언어마다 줄 수가 달라진다.
- **UI 언어와 메모 언어는 다르다.** UI 를 영어로 바꾸면 `<html lang>` 이 en 이 되지만 메모는 그대로 한국어다. 메모 내용을 보여 주는 곳(`.cover`, `.card-title`, `.prose`, `.article h1` …)에는 `word-break: keep-all` + `overflow-wrap: break-word` 를 건다. body 의 `overflow-wrap: anywhere` 를 그대로 두면 keep-all 이 있어도 한글이 낱말 중간에서 끊긴다 ("히가시노 게 / 이고 일대기"). 검증은 한국어·일본어 메모를 넣고 UI 를 세 언어로 돌려 가며 줄바꿈 자리를 본다.
- 버튼에 글자를 넣을 때는 좁은 화면(≤600px)에서 `.wide-only` 로 글자를 빼고 `.narrow-only` 아이콘만 남긴다. 긴 낱말이 입력칸 폭을 다 먹는다 (입력창·상세 화면 위쪽 버튼이 이 방식이다).
- 손가락으로 누르는 것은 **30px 보다 작아지면 안 된다**. 보이는 크기를 키우기 싫으면 여백을 주고 음수 마진으로 자리를 되돌린다 (`.link-btn`), 인라인 링크는 위아래 여백만 줘도 된다 (`.source-line a`).
- 화면·상태를 한꺼번에 훑는 검사가 `scratchpad/sweep.mjs` 와 `sweep2.mjs` 다 (세 언어 × 폭 × 홈·검색없음·연결메뉴·카드메뉴·각 종류 상세·보관모드·빈화면·답기다림·끊김복구·사진붙임, 라이트/다크). 화면을 고치면 이걸 돌려 볼 것.
- `MemoContentSchema.meta` 에 항목을 더할 때는 `EMPTY_META`(schema.ts)만 늘리면 된다. 받아들이는 쪽(백업 가져오기, Claude 답 파싱, 글귀)은 모두 이걸 깔고 덮어쓰므로 예전 백업이 검증에 걸리지 않는다. **직접 meta 를 적어 넣지 말 것.**
- 새 `MemoKind` 를 더하면 `app/api/backup` 의 허용 목록도 같이 고쳐야 한다 (안 그러면 서버 모드에서 조용히 버려진다). 동기화 서버는 kind 를 검사하지 않으므로 워커 재배포는 필요 없다.
- `.card-media img` 는 (클래스+요소라) 클래스 하나짜리 선택자보다 세다. 카드 안 이미지 규칙은 `.card-book .cover-img` 처럼 앞에 하나 더 붙일 것.
- 새 API 라우트는 정적 데모 빌드에서 자동으로 제외되지만, 새 동적 페이지를 만들면 `scripts/build-demo.mjs` 의 목록에 추가해야 한다.
