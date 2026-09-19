import type { NextConfig } from "next";

// DEMO=1 이면 서버 없이 GitHub Pages 같은 곳에 올릴 수 있는 정적 사이트로 내보낸다 (scripts/build-demo.mjs 참고)
const DEMO = process.env.DEMO === "1";
const BASE_PATH = DEMO ? process.env.DEMO_BASE_PATH ?? "" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  agentRules: false,
  ...(DEMO
    ? {
        output: "export",
        basePath: BASE_PATH,
        trailingSlash: true,
        env: { NEXT_PUBLIC_DEMO: "1", NEXT_PUBLIC_BASE_PATH: BASE_PATH },
      }
    : {}),
};

export default nextConfig;
