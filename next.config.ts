import type { NextConfig } from "next";

// Identifica cada deploy: o app aberto compara a sua versão com a do servidor para se atualizar sozinho
const buildTime = new Date();
const APP_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? buildTime.getTime().toString(36);

const nextConfig: NextConfig = {
  env: {
    APP_VERSION,
    APP_BUILT_AT: buildTime.toISOString(),
  },
};

export default nextConfig;
