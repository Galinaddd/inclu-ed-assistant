// 📂 Шлях до файлу: app/utils/supabase/upload-helpers/types.ts
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
}

export interface ExtractedTitleMetadata {
  title: string;
  detectedYear: number;
  detectedClass: number | null;
  detectedSubject: string | null;
  coverKey: string | null;
}
