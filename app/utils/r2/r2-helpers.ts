import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/app/utils/r2/r2";

/**
 * Допоміжний метод для конвертації сирого байтового стріму R2 у людський текст
 */
export async function streamToString(stream: any): Promise<string> {
  const bytes = await stream.transformToByteArray();
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Низькорівневий хелпер для завантаження будь-якого тексту в Cloudflare R2
 */
export async function uploadTextToR2(
  key: string,
  content: string,
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: "text/plain; charset=utf-8",
    }),
  );
}

/**
 * Низькорівневий хелпер для зчитування чистого тексту з Cloudflare R2
 */
export async function downloadTextFromR2(key: string): Promise<string> {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(
      `Файл порожній або відсутній у сховищі R2 за ключем: ${key}`,
    );
  }

  return await streamToString(response.Body);
}
