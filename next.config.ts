import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 🌟 Розширюємо ліміт для Server Actions (на випадок, якщо десь використаємо)
    serverActions: {
      bodySizeLimit: "100mb",
    },
    // 🌟 Головний ліміт мережевого шару для бінарних API-роутів (наш випадок)
    proxyClientMaxBodySize: 104857600, // 100 МБ у сучасних версіях Next.js (замість застарілого middlewareClientMaxBodySize)
  },
};

export default nextConfig;
