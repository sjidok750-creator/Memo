# 나만의 메모장 — 작업 메모

유튜브 링크·책 제목·사진을 Claude 로 요약해 저장하는 개인 메모장. Next.js App Router + TypeScript, 외부 UI 라이브러리 없음 (app/globals.css 에 디자인 토큰).

## 명령
- `npm run dev` 개발 서버 (`MEMO_MOCK=1` 이면 Claude 를 부르지 않고 예시 요약)
- `npm run build` / `npm run typecheck`
- `npm run build:demo` GitHub Pages 용 정적 데모 (`DEMO_BASE_PATH=/Memo`) — app/api 와 app/memo/[id] 를 빌드 중 잠시 치운다

## 구조
- `lib/claude.ts` Claude 호출과 프롬프트. 모델 `claude-opus-5`, 구조화 출력(`lib/schema.ts`), `fallbacks: "default"`
- `lib/capture.ts` 입력 종류별 파이프라인 (`replace` 로 기존 메모 다시 요약)
- `lib/youtube.ts` 영상 ID 파싱, 자막 수집 (watch 페이지 → InnerTube)
- `lib/store.ts` `data/memos.json` + `data/uploads/` 파일 저장소
- `lib/demo.ts` 서버 없는 정적 모드 (localStorage 저장소, 예시 메모), `memoHref`/`imageSrc` 로 경로 분기
- `lib/browser-key.ts` + `lib/capture-browser.ts` 브라우저 모드: 사용자 키로 Claude 를 직접 호출 (`dangerouslyAllowBrowser`), 유튜브는 자막 없이 웹 도구로 조사
- `components/Connect.tsx` 키 연결 패널 (정적 빌드에서만 렌더)
- `lib/richtext.tsx` `**강조**` → 굵게+밑줄+Claude 색 (`.hl`)
- `app/api/capture` NDJSON 진행 스트림, `app/api/backup` 내보내기/가져오기

## 테스트 방법
- 서버 모드: `MEMO_MOCK=1 MEMO_DATA_DIR=<임시폴더> npx next dev -p <포트>` 후 Playwright 로 흐름 확인
- 브라우저 모드: `npm run build:demo` 결과를 정적 서버로 띄우고, Playwright `page.route("https://api.anthropic.com/**")` 로 SSE 응답을 흉내내 확인 (실제 키 없이 요청 형태 검증). messages 요청 URL 은 `/v1/messages?beta=true` 다.

## 규칙
- 요약 본문의 강조는 `**...**` 하나만 쓴다. 다른 마크다운은 렌더러가 지원하지 않는다.
- 모바일(≤900px)에서 가로 넘침이 생기면 안 된다. 검증은 스크린샷이 아니라 `document.documentElement.scrollWidth === innerWidth` 로.
- 새 API 라우트는 정적 데모 빌드에서 자동으로 제외되지만, 새 동적 페이지를 만들면 `scripts/build-demo.mjs` 의 목록에 추가해야 한다.
