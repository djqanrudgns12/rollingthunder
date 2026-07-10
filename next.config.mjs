import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // SPA식 내비게이션(back/forward 포함) 시에도 캐시를 적극 활용해 재방문 로드를 매끄럽게
  cacheOnFrontEndNav: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {},
  eslint: {
    // TODO: 잔여 no-explicit-any 정리 완료 후 제거 (typecheck는 이미 빌드 게이트로 복원됨)
    ignoreDuringBuilds: true,
  }
};

export default withPWA(nextConfig);
