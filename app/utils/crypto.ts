/**
 * Клієнтська утиліта для обчислення криптографічного SHA-256 відбитку файлу.
 * Працює в пам'яті браузера через Web Crypto API до відправки на сервер.
 */
export async function calculateFileSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
