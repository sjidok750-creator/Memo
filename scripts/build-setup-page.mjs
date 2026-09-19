/**
 * worker/gist-worker.js 를 통째로 담은 설치 안내 페이지(public/setup.html)를 만든다.
 * 코드는 base64 로 박아 두어 네트워크 없이도 "전체 복사" 가 동작한다.
 * build:demo 와 build 에서 자동으로 실행되므로 워커를 고치면 페이지도 따라 바뀐다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const code = readFileSync(path.join(root, "worker", "gist-worker.js"), "utf8");
const b64 = Buffer.from(code, "utf8").toString("base64");
const kb = Math.round(Buffer.byteLength(code, "utf8") / 1024);

const T = {
  ko: {
    lang: "한국어",
    title: "Gist 동기화 서버 설치",
    lede: "Claude 앱에서 “Gist에 저장해” 한 마디로 메모가 쌓이게 만드는 설치 안내예요. Cloudflare 무료 계정이면 충분하고, 5분쯤 걸려요.",
    s1t: "1. 워커 만들기",
    s1: "<a href=\"https://dash.cloudflare.com\" target=\"_blank\" rel=\"noreferrer\">dash.cloudflare.com</a> → <b>Compute (Workers)</b> → <b>Workers &amp; Pages</b> → <b>Create</b> → <b>Start with Hello World</b> → 이름은 <code>gist</code> → <b>Deploy</b>.",
    s2t: "2. 데이터베이스 붙이기",
    s2: "만든 워커 → <b>Bindings</b> → <b>Add binding</b> → <b>D1 database</b> → <b>Add Binding</b>.<br>Variable name 은 <b>DB</b> (대문자), D1 database 칸에 <code>gist-memos</code> 를 입력해 새로 만들고 저장하세요.",
    s3t: "3. 코드 붙여넣기",
    s3: "아래 버튼으로 코드를 통째로 복사한 뒤, 워커의 <b>Edit code</b> 에서 기존 코드를 전부 지우고 붙여넣고 <b>Deploy</b> 하세요. (PC 는 Cmd/Ctrl+A → Cmd/Ctrl+V)",
    copy: "코드 전체 복사",
    copied: "복사했어요",
    copyFail: "복사가 막혔어요. 아래 상자를 길게 눌러 전체 선택 후 복사하세요.",
    show: "코드 보기",
    hide: "코드 접기",
    s4t: "4. 주소 받기",
    s4: "워커 주소(<code>https://&lt;이름&gt;.&lt;계정&gt;.workers.dev</code>)를 엽니다. <b>이때 한 번만</b> 두 주소가 나와요.<br>· <b>Claude 커넥터 주소</b> → claude.ai → 설정 → 커넥터 → 커스텀 커넥터 추가 (이름 <code>Gist</code>)<br>· <b>지금 Gist 앱에 연결하기</b> 버튼 → 앱 연결 끝",
    done: "이제 Claude 어디서든 “어린 왕자 요약해서 Gist에 저장해” 라고 하면 됩니다.",
    app: "Gist 앱 열기",
    note: `단일 파일 ${kb}KB · 설치할 것 없음`,
  },
  en: {
    lang: "English",
    title: "Set up the Gist sync server",
    lede: "This makes “save it to Gist” work from the Claude app. A free Cloudflare account is enough; it takes about five minutes.",
    s1t: "1. Create the Worker",
    s1: "<a href=\"https://dash.cloudflare.com\" target=\"_blank\" rel=\"noreferrer\">dash.cloudflare.com</a> → <b>Compute (Workers)</b> → <b>Workers &amp; Pages</b> → <b>Create</b> → <b>Start with Hello World</b> → name it <code>gist</code> → <b>Deploy</b>.",
    s2t: "2. Attach the database",
    s2: "Your Worker → <b>Bindings</b> → <b>Add binding</b> → <b>D1 database</b> → <b>Add Binding</b>.<br>Variable name must be <b>DB</b> (uppercase); in the D1 database field type <code>gist-memos</code> to create it, then save.",
    s3t: "3. Paste the code",
    s3: "Copy the whole file with the button below, then in the Worker's <b>Edit code</b> select everything, paste over it, and hit <b>Deploy</b>. (Cmd/Ctrl+A → Cmd/Ctrl+V)",
    copy: "Copy the whole file",
    copied: "Copied",
    copyFail: "Copying was blocked. Select all in the box below and copy manually.",
    show: "Show code",
    hide: "Hide code",
    s4t: "4. Get your addresses",
    s4: "Open the Worker URL (<code>https://&lt;name&gt;.&lt;account&gt;.workers.dev</code>). It shows two addresses <b>once, only the first time</b>.<br>· <b>Claude connector URL</b> → claude.ai → Settings → Connectors → Add custom connector (name it <code>Gist</code>)<br>· <b>Connect the Gist app now</b> button → done",
    done: "Now, anywhere in Claude: “Summarize The Little Prince and save it to Gist.”",
    app: "Open the Gist app",
    note: `One file, ${kb}KB · nothing to install`,
  },
  ja: {
    lang: "日本語",
    title: "Gist 同期サーバーの設置",
    lede: "Claudeアプリで「Gistに保存して」と言うだけでメモが貯まるようにする手順です。無料のCloudflareアカウントで足り、5分ほどで終わります。",
    s1t: "1. Worker を作る",
    s1: "<a href=\"https://dash.cloudflare.com\" target=\"_blank\" rel=\"noreferrer\">dash.cloudflare.com</a> → <b>Compute (Workers)</b> → <b>Workers &amp; Pages</b> → <b>Create</b> → <b>Start with Hello World</b> → 名前は <code>gist</code> → <b>Deploy</b>。",
    s2t: "2. データベースをつなぐ",
    s2: "作成したWorker → <b>Bindings</b> → <b>Add binding</b> → <b>D1 database</b> → <b>Add Binding</b>。<br>Variable name は <b>DB</b>（大文字）、D1 database 欄に <code>gist-memos</code> と入力して新規作成し保存します。",
    s3t: "3. コードを貼り付ける",
    s3: "下のボタンでコード全体をコピーし、Workerの <b>Edit code</b> で既存のコードをすべて消して貼り付け、<b>Deploy</b> を押します。（Cmd/Ctrl+A → Cmd/Ctrl+V）",
    copy: "コード全体をコピー",
    copied: "コピーしました",
    copyFail: "コピーがブロックされました。下のボックスを全選択してコピーしてください。",
    show: "コードを表示",
    hide: "コードを隠す",
    s4t: "4. アドレスを受け取る",
    s4: "Workerのアドレス（<code>https://&lt;名前&gt;.&lt;アカウント&gt;.workers.dev</code>）を開きます。<b>最初の一度だけ</b>2つのアドレスが表示されます。<br>· <b>Claudeコネクタのアドレス</b> → claude.ai → 設定 → コネクタ → カスタムコネクタを追加（名前 <code>Gist</code>）<br>· <b>今すぐGistアプリに接続</b> ボタン → 接続完了",
    done: "これでClaudeのどこでも「星の王子さまを要約してGistに保存して」で済みます。",
    app: "Gist アプリを開く",
    note: `単一ファイル ${kb}KB・インストール不要`,
  },
};

const section = (t) => `
  <section class="step"><h2>${t.s1t}</h2><p>${t.s1}</p></section>
  <section class="step"><h2>${t.s2t}</h2><p>${t.s2}</p></section>
  <section class="step"><h2>${t.s3t}</h2><p>${t.s3}</p>
    <div class="actions">
      <button class="btn" data-copy>${t.copy}</button>
      <button class="btn ghost" data-toggle>${t.show}</button>
    </div>
    <p class="err" data-err hidden>${t.copyFail}</p>
    <textarea class="code" data-code readonly spellcheck="false" hidden></textarea>
  </section>
  <section class="step"><h2>${t.s4t}</h2><p>${t.s4}</p></section>
  <p class="done">${t.done}</p>
  <p><a class="btn" href="../">${t.app}</a></p>`;

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gist — 동기화 서버 설치</title>
<meta name="robots" content="noindex">
<style>
:root{color-scheme:light dark;--bg:#f7f5f0;--elev:#fff;--ink:#1c1b18;--ink2:#45423c;--muted:#7d786f;--line:#e5e1d7;--line2:#d3cdc0;--accent:#d97757;--accent-ink:#b95f41;--soft:#fbeae2;--danger:#b3261e}
@media (prefers-color-scheme:dark){:root{--bg:#191816;--elev:#22201d;--ink:#ece8e0;--ink2:#c9c4ba;--muted:#918c82;--line:#34312c;--line2:#47433c;--accent:#e38a69;--accent-ink:#ec9a7b;--soft:#3a2a23;--danger:#f08a8a}}
*{box-sizing:border-box}
body{margin:0;padding:30px 18px 70px;background:var(--bg);color:var(--ink);line-height:1.68;word-break:keep-all;
font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Apple SD Gothic Neo","Hiragino Sans","Pretendard Variable",Pretendard,"Noto Sans KR",Roboto,system-ui,sans-serif}
:lang(ja),:lang(ja) *{word-break:normal;line-break:strict}
main{max-width:640px;margin:0 auto}
header{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.mark{width:40px;height:40px;border-radius:13px;flex:none;background:linear-gradient(135deg,#f5a27c,#d2603a);box-shadow:0 6px 16px -7px rgba(217,119,87,.8)}
h1{font-size:25px;font-weight:800;letter-spacing:-.03em;margin:0}
.note{font-size:12.5px;color:var(--muted);margin:2px 0 0}
.lede{color:var(--ink2);font-size:15.5px;margin:14px 0 26px}
.langs{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--elev);border:1px solid var(--line);margin-bottom:22px}
.langs button{border:0;background:none;padding:6px 13px;border-radius:999px;font:inherit;font-size:13.5px;font-weight:600;color:var(--muted);cursor:pointer}
.langs button[aria-pressed=true]{background:var(--soft);color:var(--accent-ink)}
.step{background:var(--elev);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:12px}
h2{font-size:16.5px;font-weight:700;letter-spacing:-.02em;margin:0 0 6px}
.step p{margin:0;font-size:15px;color:var(--ink2)}
code{background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 6px;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
b{color:var(--ink)}
a{color:var(--accent-ink)}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.btn{display:inline-block;border:0;border-radius:11px;padding:12px 18px;font:inherit;font-size:15px;font-weight:700;background:var(--accent);color:#fff;cursor:pointer;text-decoration:none;box-shadow:0 6px 16px -9px var(--accent)}
.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--ink2);border:1px solid var(--line2);box-shadow:none;font-weight:600}
.btn.ok{background:#2f7d4f;box-shadow:none}
.err{margin-top:10px!important;color:var(--danger);font-size:13.5px}
.code{width:100%;height:220px;margin-top:12px;padding:12px;border:1px solid var(--line2);border-radius:12px;background:var(--bg);color:var(--ink2);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.5;white-space:pre;overflow:auto}
.done{margin:22px 0 16px;padding:14px 16px;border-radius:14px;background:var(--soft);color:var(--accent-ink);font-size:15px;font-weight:600}
</style></head>
<body><main>
<header><span class="mark"></span><span><h1 data-t="title"></h1><p class="note" data-t="note"></p></span></header>
<p class="lede" data-t="lede"></p>
<div class="langs" role="group">
  <button data-lang="ko">한국어</button><button data-lang="en">English</button><button data-lang="ja">日本語</button>
</div>
<div id="body"></div>
</main>
<script>
const CODE_B64="${b64}";
const T=${JSON.stringify(T)};
const code=new TextDecoder().decode(Uint8Array.from(atob(CODE_B64),c=>c.charCodeAt(0)));
const tpl=${JSON.stringify({ ko: section(T.ko), en: section(T.en), ja: section(T.ja) })};
function render(l){
  document.documentElement.lang=l;
  const t=T[l];
  document.querySelector('[data-t=title]').textContent=t.title;
  document.querySelector('[data-t=note]').textContent=t.note;
  document.querySelector('[data-t=lede]').textContent=t.lede;
  document.title=t.title+" — Gist";
  document.getElementById('body').innerHTML=tpl[l];
  for(const b of document.querySelectorAll('[data-lang]'))b.setAttribute('aria-pressed',String(b.dataset.lang===l));
  const box=document.querySelector('[data-code]');
  box.value=code;
  const err=document.querySelector('[data-err]');
  const btn=document.querySelector('[data-copy]');
  btn.onclick=async()=>{
    try{
      await navigator.clipboard.writeText(code);
      btn.textContent=t.copied;btn.classList.add('ok');err.hidden=true;
      setTimeout(()=>{btn.textContent=t.copy;btn.classList.remove('ok')},2000);
    }catch(e){
      box.hidden=false;err.hidden=false;box.focus();box.select();
    }
  };
  const tg=document.querySelector('[data-toggle]');
  tg.onclick=()=>{box.hidden=!box.hidden;tg.textContent=box.hidden?t.show:t.hide};
  try{localStorage.setItem('memo-lang',l)}catch(e){}
}
let init='ko';
try{const s=localStorage.getItem('memo-lang');if(s&&T[s])init=s;else{const n=(navigator.language||'ko').toLowerCase();init=n.startsWith('ja')?'ja':n.startsWith('en')?'en':'ko'}}catch(e){}
for(const b of document.querySelectorAll('[data-lang]'))b.onclick=()=>render(b.dataset.lang);
render(init);
</script></body></html>`;

writeFileSync(path.join(root, "public", "setup.html"), html);
console.log(`public/setup.html 생성 (워커 ${kb}KB 포함)`);
