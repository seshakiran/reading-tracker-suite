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
  learning_score: number;
  category: string;
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
  averageLearningScore: number;
  readingDays: number;
  categories: CategoryStats[];
}

export interface CategoryStats {
  category: string;
  count: number;
  total_time: number;
  avg_score: number;
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