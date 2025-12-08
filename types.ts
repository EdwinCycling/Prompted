export interface Prompt {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      prompts: {
        Row: Prompt;
        Insert: Omit<Prompt, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Prompt, 'id' | 'created_at' | 'updated_at'>>;
      };
      tags: {
        Row: Tag;
        Insert: Omit<Tag, 'id' | 'created_at'>;
        Update: Partial<Omit<Tag, 'id' | 'created_at'>>;
      };
      prompt_tags: {
        Row: PromptTag;
        Insert: Omit<PromptTag, 'created_at'>;
        Update: Partial<Omit<PromptTag, 'created_at'>>;
      };
      prompt_images: {
        Row: PromptImage;
        Insert: Omit<PromptImage, 'id' | 'created_at'>;
        Update: Partial<Omit<PromptImage, 'id' | 'created_at'>>;
      };
    };
  };
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface PromptTag {
  prompt_id: string;
  tag_id: string;
  user_id: string;
  created_at: string;
}

export interface PromptImage {
  id: string;
  prompt_id: string;
  user_id: string;
  path: string;
  image_url: string;
  created_at: string;
}
