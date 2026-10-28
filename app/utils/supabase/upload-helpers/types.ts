// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/types.ts

export interface ParagraphStructure {
  number: string;
  title: string;
  markdown_content?: string; // Робимо опціональним, бо в базі контенту не буде (тільки в генераторі)
  r2_path?: string; // А це поле з'явиться після заливки в R2
}

export interface ChapterStructure {
  chapter: string;
  paragraphs: ParagraphStructure[];
}

export interface BookData {
  id: string;
  title: string;
  publishing_year: number | null;
  publisher: string | null;
  school_class: number;
  program_id: string | null;
  subject_id: string | null;
  file_hash: string | null;
  parent_book_id?: string | null;
  cover_url?: string | null;
  book_structure?: ChapterStructure[] | null; // ✨ Наш JSON-акордеон тепер офіційно тут
}

export interface ExtractedTitleMetadata {
  title: string;
  detectedYear: number;
  detectedClass: number | null;
  detectedSubject: string | null;
  coverKey: string | null;
}
