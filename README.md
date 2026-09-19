# Gist

유튜브 링크, 책 제목, 사진을 넣으면 Claude 가 읽고 **핵심이 강조된 요약 메모**를 만들어 분야별로 정리해 주는 개인 메모장입니다. 화면은 한국어 · English · 日本語 중에서 고를 수 있고, 요약도 고른 언어로 작성됩니다.

| 넣는 것 | 받는 것 |
| --- | --- |
| 유튜브 주소 | 자막을 읽고 내용 요약 + 인상적인 말 |
| 책 제목 | 웹 검색으로 책을 특정한 뒤 핵심 내용 요약 + 명대사·명문장 발췌 |
| 사진 (드래그·붙여넣기·파일 선택) | 사진 속 글이나 장면을 읽고 요약 |

모든 메모는 **한 줄 정리 → 핵심 요약 → 주요 포인트 → 명문장 → 태그** 구조로 저장되고, 요약 속 가장 중요한 구절은 굵게 + 밑줄 + Claude 색으로 강조됩니다. 분야(업무, 경제·경영, 자기계발, 인문·철학, 과학·기술, 역사, 문학·예술, 건강·라이프, 사회·정치, 교육·학습, 기타)는 자동으로 분류되며 나중에 바꿀 수 있습니다.

카드를 꾹 누르면(PC 는 우클릭) 열기·분야 변경·다시 요약·복사·삭제 메뉴가 뜹니다. 요약은 다른 화면으로 옮겨도 계속 돌고, 화면 아래 진행 표시를 누르면 돌아옵니다. 상세 화면 맨 아래 **내 생각** 칸은 자동 저장됩니다. 메모 상세 화면에서 제목·태그·분야를 고칠 수 있고, 요약이 마음에 들지 않으면 **다시 요약** 으로 같은 원본에서 새로 만들 수 있습니다. 홈 화면 아래의 **백업** 으로 모든 메모를 사진까지 포함한 JSON 하나로 내보내고, 다른 곳에서 다시 가져올 수 있습니다 (같은 메모는 건너뜁니다). 폰 브라우저의 "홈 화면에 추가"로 앱처럼 쓸 수 있습니다.

## 시작하기

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY 를 채워 넣습니다
npm run dev                  # http://localhost:3000
```

API 키는 [console.anthropic.com](https://console.anthropic.com) 에서 발급합니다. 키 없이 화면만 보고 싶으면 `MEMO_MOCK=1 npm run dev` 로 예시 요약을 돌려주는 모드로 띄울 수 있습니다.

## 어떻게 동작하나

- **유튜브**: 영상 ID 를 추출해 oEmbed 로 제목·채널을 얻고, 페이지의 플레이어 응답 또는 InnerTube API 에서 자막(한국어 → 영어 → 나머지, 수동 자막 우선)을 받아 Claude 에게 넘깁니다. 자막이 없으면 Claude 가 웹 검색·페이지 읽기로 영상 내용을 조사해 요약하고, 메모에 "자막 없음"이 표시됩니다.
- **책**: Claude 가 `web_search` / `web_fetch` 도구로 책을 특정하고 명문장을 확인한 뒤 요약합니다. 확신이 없는 인용은 넣지 않도록 지시되어 있습니다.
- **사진**: 브라우저에서 긴 변 1600px 로 줄여 JPEG 로 올리고, Claude 비전으로 읽습니다.
- 요약은 구조화 출력(JSON 스키마)으로 받아 화면 구조가 항상 같습니다. 모델은 기본 `claude-opus-5`, 적응형 사고 + 서버 측 refusal 폴백(`fallbacks: "default"`)을 켜 둡니다.
- 저장은 `data/memos.json` + `data/uploads/` (로컬 파일). 별도 DB 가 필요 없고, `data/` 폴더만 백업하면 됩니다.

## 환경 변수

| 이름 | 설명 |
| --- | --- |
| `ANTHROPIC_API_KEY` | 필수. Claude API 키 |
| `CLAUDE_MODEL` | 선택. 기본 `claude-opus-5` |
| `CLAUDE_EFFORT` | 선택. `low`·`medium`·`high`·`xhigh`·`max`. 비우면 API 기본값(high) |
| `MEMO_DATA_DIR` | 선택. 저장 폴더 (기본 `./data`) |
| `MEMO_MOCK` | 선택. `1` 이면 Claude 를 부르지 않고 예시 요약을 돌려줌 |

## 구조

```
app/            Next.js App Router (페이지 · API 라우트)
  api/capture   입력을 받아 요약을 만들고 NDJSON 으로 진행 상황을 흘려보냄
  api/memos     목록 / 조회 / 분야 수정 / 삭제
  api/files     업로드한 사진 서빙
components/     화면 (캡처 박스, 카드 그리드, 상세 보기, 사이드바, 언어 선택)
lib/
  claude.ts     Claude 호출 · 프롬프트 · 구조화 출력
  youtube.ts    영상 ID 파싱 · 자막 수집
  schema.ts     요약 JSON 스키마 (zod)
  richtext.tsx  `**강조**` 를 굵게+밑줄+강조색으로 렌더링
  i18n.ts       한국어 · 영어 · 일본어 UI 문자열
  store.ts      JSON 파일 저장소
```

## 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run start      # 빌드 결과 실행
npm run typecheck  # 타입 검사
```

## API 키 없이 Claude 앱으로 쓰기

입력창에 책 제목이나 유튜브 링크를 넣고 **Claude 앱으로 요약** 을 누르면 요청문이 채워진 claude.ai 가 열립니다(구독으로 사용 가능). 답의 JSON 코드 블록을 복사해 Gist 입력창에 붙여넣으면 자동으로 메모가 됩니다. 사진은 요청문이 복사되니 Claude 앱에 사진과 함께 붙여넣고, 답을 Gist 에 붙여넣을 때 같은 사진이 메모에 붙습니다.

**더 편하게 (아이폰 단축어)**: 단축어 앱에서 새 단축어를 만들고 ① "공유 시트에서 텍스트 받기" ② "URL 인코딩" ③ "URL 열기" 에 `https://sjidok750-creator.github.io/Memo/#import=[인코딩된 텍스트]` 를 넣으세요. Claude 앱에서 답을 **공유 → 그 단축어** 로 보내면 Gist 가 열리며 바로 저장됩니다. 복사해 왔다면 입력창 위의 **클립보드에서 가져오기** 버튼 한 번이면 됩니다.

## 완전 자동: Claude 커넥터(MCP) + 동기화 서버

`worker/` 의 작은 서버를 Cloudflare 에 올리면 (무료, [worker/README.md](worker/README.md)) Claude 웹·데스크톱·아이폰 앱 어디서든 "어린 왕자 요약해서 Gist에 저장해"로 끝나고, 메모는 모든 기기에서 같이 보입니다. Gist 상단 상태 표시 → **동기화 서버 연결**에 서버가 알려준 주소를 붙여넣으면 됩니다.

## GitHub Pages 에서 바로 쓰기 (브라우저 모드)

서버 없이 정적 사이트로도 올릴 수 있습니다. 처음에는 예시 메모로 흐름만 보여주는 데모이고, 상단 배너의 **Claude 연결** 에 본인의 API 키를 넣으면 그 기기의 브라우저가 Claude API 를 직접 불러 실제로 요약합니다.

- 키는 그 기기의 브라우저(localStorage)에만 저장되고 `api.anthropic.com` 으로만 전송됩니다. 공용 기기에서는 다 쓴 뒤 **연결 해제** 하세요.
- 책·사진은 로컬 실행과 같게 동작합니다. 유튜브는 브라우저에서 자막을 가져올 수 없어(CORS) Claude 의 웹 검색·페이지 읽기로 영상 내용을 조사해 요약하고, 메모에 "자막 없음"이 표시됩니다. 자막까지 읽으려면 로컬 실행을 쓰세요.
- 메모와 사진은 브라우저 저장소에 들어가므로 용량(대략 5MB)이 제한됩니다. 홈 화면 아래의 백업으로 JSON 을 내려받아 두세요.

```bash
DEMO_BASE_PATH=/Memo npm run build:demo   # out/ 에 정적 사이트 생성
```

`.github/workflows/pages.yml` 이 푸시할 때마다 이 데모를 빌드해 `gh-pages` 브랜치에 올립니다. 저장소 Settings → Pages 에서 Source 가 **Deploy from a branch / gh-pages** 인지 확인하세요 (처음 한 번은 자동으로 잡히는 경우가 많습니다). 주소는 `https://<계정>.github.io/<저장소 이름>/` 입니다.
