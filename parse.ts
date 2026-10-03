// import { LlamaCloud } from "@llamaindex/llama-cloud";
// import fs from "fs";

// async function main() {
//   try {
//     const client = new LlamaCloud();

//     // Беремо той файл, який точно лежить у вас у корені (видно на панелі ліворуч)
//     const file = await client.files.create({
//       file: fs.createReadStream("./parser_test_nested_structures-v2.pdf"),
//       purpose: "parse",
//     });

//     const result = (await client.parsing.parse({
//       file_id: file.id,
//       tier: "fast",
//       version: "latest",
//       expand: ["markdown"],
//     })) as any;

//     if (result?.markdown?.pages) {
//       console.log(result.markdown.pages.markdown || result.markdown.pages);
//     } else {
//       console.log("Відповідь отримана, але структура інша:", result);
//     }
//   } catch (error) {
//     console.error("Сталася помилка під час виконання:", error);
//   }
// }

// main();
