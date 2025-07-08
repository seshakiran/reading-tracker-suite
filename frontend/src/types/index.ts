export interface ReadingSession {
  id: number;
  title: string;
  url?: string;
  content_type: 'web' | 'pdf' | 'epub' | 'manual';
  reading_time: number;
  word_count: number;
  excerpt?: string;
  notes?: string;
  tags: string[];
  tag_colors: string[];
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface ReadingStats {
  totalSessions: number;
  totalReadingTime: number;
  totalWords: number;
  averageReadingTime: number;
  readingDays: number;
}

export interface NewSession {
  title: string;
  url?: string;
  content_type?: 'web' | 'pdf' | 'epub' | 'manual';
  reading_time?: number;
  word_count?: number;
  excerpt?: string;
  notes?: string;
  tags?: string[];
}