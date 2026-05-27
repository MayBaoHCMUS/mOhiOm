export interface FormData {
  [key: string]: unknown;
  projectId: string;
  mainCharacters: number;
  chapters: number;
  targetPages: number;
  maxPanelsPerPage: number;
  genreTone: string;
  artStyleReference: string;
  storyFile?: File;
  storyText?: string;
}

export interface ValidationErrors {
  [key: string]: string | undefined;
}

export interface FieldConfig {
  name: keyof FormData;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'file';
  required: boolean;
  validation: (value: unknown) => string | undefined;
  helperText?: string;
  tooltip?: string;
}

export interface UploadState {
  file: File | null;
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  autosave?: boolean;
  autoExpand?: boolean;
}

export interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved?: Date;
  error?: string;
}

export interface DraftPayload {
  content: string;
  savedAt: string;
}

