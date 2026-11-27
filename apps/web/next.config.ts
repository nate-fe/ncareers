import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // 모노레포의 공용 패키지는 TS 소스를 그대로 들고 있다. Next 가 직접 컴파일한다.
  transpilePackages: ["@ncareers/shared"],

  // 모노레포 루트의 node_modules 까지 standalone 번들에 담기게 한다.
  // fileURLToPath 를 거치지 않으면 윈도우에서 "/C:/..." 가 되어 추적이 조용히 깨진다.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),

  // 어느 Node 호스팅에서든 그대로 돌아가는 번들을 같이 뽑는다.
  //   node .next/standalone/apps/web/server.js
  // Vercel 은 자체 빌더를 쓰므로 이 설정을 무시한다. 나중에 Vercel 을 떠날 때
  // 빌드 설정을 다시 손볼 필요가 없게 미리 켜 둔다.
  output: "standalone",
};

export default nextConfig;
