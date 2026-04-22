import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ai_engine/venv symlink'leri Turbopack'ı bozuyor — hariç tut
  outputFileTracingExcludes: {
    "*": ["ai_engine/venv/**", "ai_engine/catboost_info/**", "ai_engine/logs_v2/**", "ai_engine/models_v2/**"],
  },
};

export default nextConfig;
