/**
 * 정적 데모 빌드.
 * 정적 내보내기(output: "export")는 요청에 의존하는 API 라우트와 동적 경로를 허용하지 않으므로,
 * 빌드하는 동안만 app/api 와 app/memo/[id] 를 잠시 치워 두었다가 되돌린다.
 * 사용: node scripts/build-demo.mjs   (DEMO_BASE_PATH=/Memo 처럼 basePath 지정 가능)
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const hidden = path.join(root, ".demo-hidden");
const targets = ["app/api", "app/memo/[id]"];

mkdirSync(hidden, { recursive: true });
const moved = [];
for (const rel of targets) {
  const from = path.join(root, rel);
  if (!existsSync(from)) continue;
  const to = path.join(hidden, rel.replace(/[\\/]/g, "__"));
  renameSync(from, to);
  moved.push([from, to]);
}

let code = 1;
try {
  rmSync(path.join(root, ".next"), { recursive: true, force: true });
  const r = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, DEMO: "1", DEMO_BASE_PATH: process.env.DEMO_BASE_PATH ?? "" },
  });
  code = r.status ?? 1;
} finally {
  for (const [from, to] of moved) renameSync(to, from);
  rmSync(hidden, { recursive: true, force: true });
}
if (code === 0) {
  // GitHub Pages 가 _next 폴더를 Jekyll 로 무시하지 않도록
  const fs = await import("node:fs");
  fs.writeFileSync(path.join(root, "out", ".nojekyll"), "");
  console.log("\n데모 사이트가 out/ 에 만들어졌습니다.");
}
process.exit(code);
