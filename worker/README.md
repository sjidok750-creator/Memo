# Gist 동기화 서버

Claude 커넥터(MCP)로 "이 책 요약해서 Gist에 저장해"가 되게 하고, 여러 기기에서 같은 메모를 보게 해 주는 작은 서버입니다. Cloudflare Workers + D1 (둘 다 무료 등급으로 충분).

## 배포 (한 번만)

**방법 A · 버튼**
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sjidok750-creator/Memo/tree/claude/memo-app-ui-design-idfxu4/worker)

Cloudflare 계정으로 로그인 → 이름 확인 → Deploy. D1 데이터베이스는 자동으로 만들어집니다.

**방법 B · 명령어**
```bash
cd worker
npm install
npx wrangler login
npx wrangler d1 create gist-memos      # 나온 database_id 를 wrangler.jsonc 에 넣기
npx wrangler deploy
```

## 배포 후

1. 배포된 주소(`https://gist-sync.<계정>.workers.dev`)를 **바로** 엽니다. 처음 열 때 한 번만 토큰이 만들어져 두 주소가 보입니다.
2. **Claude 커넥터 주소**: claude.ai → 설정 → 커넥터 → 커스텀 커넥터 추가 → 이름 Gist, 주소 붙여넣기. 아이폰 Claude 앱에서도 같은 커넥터가 보입니다.
3. **Gist 동기화 주소**: Gist 앱 상단 상태 표시 → 동기화 서버 연결에 붙여넣기 (또는 폰에서 그 주소를 열면 자동 연결). 이미 폰에 있던 메모는 서버로 올라갑니다.

이후 Claude 어디서든: "어린 왕자 요약해서 Gist에 저장해" → 저장 → Gist 앱을 열면 보입니다.

## 주소 구조
- `POST /mcp/<token>` Claude 커넥터 (Streamable HTTP, 무상태)
- `GET /api/<token>/memos`, `POST /api/<token>/memos`, `GET|PATCH|DELETE /api/<token>/memos/:id`, `POST /api/<token>/images`, `GET /api/<token>/images/:id`, `GET /api/<token>/ping`
- `POST /rotate` (Authorization: Bearer 현재 토큰) 토큰 재발급

토큰은 D1 `settings` 표에 있습니다. 잃어버리면 그 표를 비우고 서버 주소를 다시 열면 새로 만들어집니다.
