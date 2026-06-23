export type BlockType =
  | "paragraph"
  | "heading"
  | "subheading"
  | "bullet"
  | "numbered"
  | "todo"
  | "quote"
  | "code"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string; // JSON serializado de Block[]
  folder_id: string | null;
  icon: string | null;
  is_favorite: boolean;
  is_trashed: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  position: number;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export type TaskStatus = "pending" | "in_progress" | "done" | "archived";
export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  note_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Link {
  id: string;
  source_note_id: string;
  target_note_id: string;
}

export interface Version {
  id: string;
  note_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  folder_id?: string | null;
  icon?: string | null;
  is_favorite?: boolean;
  is_trashed?: boolean;
  is_archived?: boolean;
}

export interface TaskUpdate {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  position?: number;
  note_id?: string | null;
}

export function parseBlocks(content: string): Block[] {
  try {
    const v = JSON.parse(content);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
