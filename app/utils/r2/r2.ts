// 📂 Шлях до файлу: app/utils/r2/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

/**
 * Ініціалізація синглтон-клієнта Cloudflare R2
 * Обгортаємо в функцію або створюємо клієнт безпечно, щоб браузер не падав при імпорті
 */
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID || ""}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "dummy-key",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "dummy-secret",
  },
});

export const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME || "included-assistant-storage";
