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

## 테스트 방법
- 서버 모드: `MEMO_MOCK=1 MEMO_DATA_DIR=<임시폴더> npx next dev -p <포트>` 후 Playwright 로 흐름 확인
- 브라우저 모드: `npm run build:demo` 결과를 정적 서버로 띄우고, Playwright `page.route("https://api.anthropic.com/**")` 로 SSE 응답을 흉내내 확인 (실제 키 없이 요청 형태 검증). messages 요청 URL 은 `/v1/messages?beta=true` 다.

## 규칙
- 화면에 보이는 글자는 반드시 `lib/i18n.ts` 에 세 언어로 넣고 `t()` 로 쓴다. 하드코딩 금지.
- 서체는 시스템 폰트 스택(아이폰 SF Pro / Apple SD Gothic Neo / Hiragino)만 쓴다. 웹폰트·명조체를 새로 넣지 않는다.
- 진행 단계는 서버가 stage `id` 만 의미 있게 보내고 클라이언트가 `stage.<id>` 키로 번역한다.
- 요약 본문의 강조는 `**...**` 하나만 쓴다. 다른 마크다운은 렌더러가 지원하지 않는다.
- 모바일(≤900px)에서 가로 넘침이 생기면 안 된다. 검증은 스크린샷이 아니라 `document.documentElement.scrollWidth === innerWidth` 로.
- 새 API 라우트는 정적 데모 빌드에서 자동으로 제외되지만, 새 동적 페이지를 만들면 `scripts/build-demo.mjs` 의 목록에 추가해야 한다.
