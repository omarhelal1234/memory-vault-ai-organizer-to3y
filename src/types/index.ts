export type Memory = {
  id: string;
  user_id: string;
  type: 'screenshot' | 'voice_memo' | 'photo' | 'video' | 'link' | 'note';
  storage_path?: string;
  content_text?: string;
  url?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ai_metadata?: {
    summary?: string;
    suggested_categories?: string[];
    suggested_tags?: string[];
    confidence_scores?: Record<string, number>;
  };
  title?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  captured_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  color?: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

export type UserPreferences = {
  user_id: string;
  preferences: Record<string, any>;
};