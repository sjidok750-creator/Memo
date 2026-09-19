/** 설정 페이지. 처음 열 때 한 번만 토큰을 보여준다. */
export function setupPage(o: { origin: string; token: string | null; count: number; appUrl: string }): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const t = o.token;
  const body = t
    ? `
<p class="ok">서버가 준비됐어요. 아래 두 주소는 <b>지금 한 번만</b> 보입니다. 어딘가에 적어 두세요.</p>
<h2>1. Claude 커넥터 주소 (MCP)</h2>
<div class="box"><code id="mcp">${esc(o.origin)}/mcp/${esc(t)}</code><button onclick="copy('mcp')">복사</button></div>
<p class="how">claude.ai → 설정 → 커넥터 → <b>커스텀 커넥터 추가</b> → 이름 <b>Gist</b>, 위 주소 입력. 추가하면 웹·데스크톱·아이폰 앱 어디서나 "이 책 요약해서 Gist에 저장해"가 됩니다.</p>
<h2>2. Gist 앱 동기화 주소</h2>
<div class="box"><code id="sync">${esc(o.origin)}/s/${esc(t)}</code><button onclick="copy('sync')">복사</button></div>
<p class="how">Gist 앱 상단 상태 표시 → <b>동기화 서버 연결</b>에 붙여넣거나, 폰에서 이 주소를 그냥 열면 Gist 가 열리며 연결됩니다.</p>
${o.appUrl ? `<p><a class="btn" href="${esc(o.appUrl)}/#sync=${encodeURIComponent(`${o.origin}/s/${t}`)}">지금 Gist 앱에 연결하기</a></p>` : ""}`
    : `
<p>이미 설정된 서버예요. 저장된 메모 ${o.count}개.</p>
<p class="how">주소를 잃어버렸으면 Cloudflare 대시보드에서 D1 의 <code>settings</code> 표를 비우고 다시 여세요 (토큰이 새로 만들어집니다). 이전 커넥터·앱 연결은 다시 해야 합니다.</p>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gist 동기화 서버</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",Pretendard,sans-serif;background:#f7f5f0;color:#1c1b18;margin:0;padding:32px 20px;line-height:1.6}main{max-width:640px;margin:0 auto}h1{font-size:26px;letter-spacing:-.02em;margin:0 0 6px}h2{font-size:16px;margin:26px 0 8px}.ok{background:#e6f4ea;color:#2f7d4f;padding:12px 14px;border-radius:12px}.box{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid #e5e1d7;border-radius:12px;padding:10px 12px}code{flex:1;min-width:0;word-break:break-all;font-size:13px}button,.btn{background:#d97757;color:#fff;border:0;border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}.how{font-size:14px;color:#5a564f}.mark{width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#f5a27c,#d2603a);display:inline-block;vertical-align:middle;margin-right:10px}</style></head>
<body><main><h1><span class="mark"></span>Gist 동기화 서버</h1><p class="how">Claude 커넥터와 Gist 앱이 함께 쓰는 메모 저장소예요.</p>${body}</main>
<script>function copy(id){navigator.clipboard.writeText(document.getElementById(id).textContent).then(()=>alert('복사했어요'))}</script></body></html>`;
}
