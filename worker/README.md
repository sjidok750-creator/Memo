# Gist 동기화 서버

Claude 커넥터(MCP)로 **"이 책 요약해서 Gist에 저장해"** 가 되게 하고, 여러 기기에서 같은 메모를 보게 해 주는 작은 서버입니다. Cloudflare Workers + D1 (둘 다 무료 등급으로 충분). `gist-worker.js` **한 파일뿐이고 설치할 것이 없습니다.**

## 폰에서 설치하기 (약 5분, PC 불필요)

1. **워커 만들기** — [dash.cloudflare.com](https://dash.cloudflare.com) → 왼쪽 메뉴 **Compute (Workers)** → **Create** → **Start with Hello World** → 이름을 `gist-sync` 로 두고 **Deploy**.
2. **코드 붙여넣기** — 방금 만든 워커 → **Edit code** → 편집기의 내용을 모두 지우고, [`gist-worker.js`](gist-worker.js) 전체를 복사해 붙여넣기 → **Deploy**.
3. **데이터베이스 붙이기** — 같은 워커 → **Settings** → **Bindings** → **Add binding** → **D1 database** → Variable name 에 `DB` (대문자) → D1 database 는 **Create new** 로 `gist-memos` → 저장.
4. **주소 받기** — 워커 주소(`https://gist-sync.<계정>.workers.dev`)를 브라우저로 엽니다. **이때 한 번만** 두 주소가 보입니다.
   - **Claude 커넥터 주소** → claude.ai → 설정 → 커넥터 → **커스텀 커넥터 추가** → 이름 `Gist`, 주소 붙여넣기. 아이폰 Claude 앱에도 같이 나타납니다.
   - **Gist 앱 동기화 주소** → 같은 페이지의 **지금 Gist 앱에 연결하기** 버튼을 누르면 끝. (또는 Gist 상단 상태 표시 → 동기화 서버 연결에 붙여넣기)

이후 Claude 어디서든: *"어린 왕자 요약해서 Gist에 저장해"* → 저장 → Gist 앱을 열면 보입니다.

## 명령어로 설치하기 (PC)

```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create gist-memos     # 나온 database_id 를 wrangler.jsonc 에 넣기
npx wrangler deploy
```

## 주소 구조

| 주소 | 용도 |
| --- | --- |
| `POST /mcp/<token>` | Claude 커넥터 (MCP, JSON-RPC over HTTP) |
| `GET /api/<token>/memos` · `POST` | 목록 / 저장 (여러 개, 백업 가져오기) |
| `GET·PATCH·DELETE /api/<token>/memos/:id` | 하나 조회 / 수정 / 삭제 |
| `POST /api/<token>/images` · `GET /api/<token>/images/:id` | 사진 저장 / 보기 |
| `GET /api/<token>/ping` | 연결 확인 |
| `POST /rotate` | 토큰 재발급 (`Authorization: Bearer <현재 토큰>`) |

MCP 도구: `save_memo`, `list_memos`, `get_memo`, `update_memo`, `delete_memo`. 요약 작성 규칙(강조 표시, 분야 선택, 인용 정확성, 사용자의 언어)은 서버가 커넥터 안내문으로 Claude 에게 전달합니다.

## 알아둘 것

- 토큰은 D1 의 `settings` 표에 있습니다. 주소를 잃어버리면 그 표의 `token` 행을 지우고 서버 주소를 다시 열면 새로 만들어집니다 (커넥터·앱은 다시 연결).
- 토큰이 주소에 들어 있으니 링크를 남에게 공유하지 마세요. 유출됐으면 위 방법으로 재발급하면 됩니다.
- 사진은 D1 에 저장되며 한 장당 약 900KB 까지입니다. 무료 등급은 5GB.
- `APP_URL` 변수(Settings → Variables)를 바꾸면 Claude 가 알려주는 링크와 "앱에 연결" 버튼의 주소가 바뀝니다.
