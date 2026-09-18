import { S3Client } from "@aws-sdk/client-s3";

// Залізне правило архітектури: перевірка ключів на сервері
if (
  !process.env.R2_ACCOUNT_ID ||
  !process.env.R2_ACCESS_KEY_ID ||
  !process.env.R2_SECRET_ACCESS_KEY
) {
  throw new Error(
    "Критична помилка: Відсутні обов'язкові змінні оточення Cloudflare R2 у .env.local",
  );
}

/**
 * Ініціалізація синглтон-клієнта Cloudflare R2
 * Використовує сумісний S3 API протокол для швидкої роботи з текстами книг та адаптацій
 */
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET_NAME =
  process.env.R2_BUCKET_NAME || "included-assistant-storage";
