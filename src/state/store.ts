import { create } from "zustand";
import { api } from "@/lib/api";
import type {
  Block, Folder, Link, Note, Tag, Task, TaskStatus,
} from "@/lib/types";
import { parseBlocks } from "@/lib/types";

export type ViewKind = "notes" | "tasks" | "graph";
export type SpecialFilter = "all" | "favorites" | "archived" | "trash" | null;

interface UIState {
  view: ViewKind;
  sidebarCollapsed: boolean;
  paletteOpen: boolean;
  noteSearchOpen: boolean;
  cloudOpen: boolean;
  contextPanelOpen: boolean;
  activeFolderId: string | null;
  activeTagId: string | null;
  specialFilter: SpecialFilter;
}

interface StoreState extends UIState {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  tasks: Task[];
  links: Link[];
  currentNoteId: string | null;
  loaded: boolean;

  // carga
  bootstrap: () => Promise<void>;
  refreshNotes: () => Promise<void>;
  refreshTasks: () => Promise<void>;
  refreshLinks: () => Promise<void>;
  refreshFolders: () => Promise<void>;
  refreshTags: () => Promise<void>;

  // navegación / UI
  setView: (v: ViewKind) => void;
  toggleSidebar: () => void;
  openPalette: () => void;
  closePalette: () => void;
  openNoteSearch: () => void;
  closeNoteSearch: () => void;
  openCloud: () => void;
  closeCloud: () => void;
  toggleContextPanel: () => void;
  selectFolder: (id: string | null) => void;
  selectTag: (id: string | null) => void;
  selectSpecial: (f: SpecialFilter) => void;
  openNote: (id: string) => void;

  // notas
  createNote: (folderId?: string | null) => Promise<Note>;
  updateNoteContent: (id: string, blocks: Block[]) => Promise<void>;
  updateNoteTitle: (id: string, title: string) => Promise<void>;
  setNoteIcon: (id: string, icon: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  trashNote: (id: string) => Promise<void>;
  restoreNote: (id: string) => Promise<void>;
  archiveNote: (id: string) => Promise<void>;
  deleteNotePermanently: (id: string) => Promise<void>;
  syncLinksFromContent: (note: Note) => Promise<void>;

  // drag & drop
  moveNoteToFolder: (noteId: string, folderId: string | null) => Promise<void>;
  addTagToNote: (noteId: string, tagId: string) => Promise<void>;

  // carpetas / etiquetas
  createFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createTag: (name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;

  // tareas
  createTask: (title: string, noteId?: string | null) => Promise<void>;
  setTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  view: "notes",
  sidebarCollapsed: false,
  paletteOpen: false,
  noteSearchOpen: false,
  cloudOpen: false,
  contextPanelOpen: true,
  activeFolderId: null,
  activeTagId: null,
  specialFilter: "all",

  notes: [],
  folders: [],
  tags: [],
  tasks: [],
  links: [],
  currentNoteId: null,
  loaded: false,

  bootstrap: async () => {
    await Promise.all([
      get().refreshNotes(),
      get().refreshFolders(),
      get().refreshTags(),
      get().refreshTasks(),
      get().refreshLinks(),
    ]);
    const first = get().notes[0];
    set({ loaded: true, currentNoteId: get().currentNoteId ?? first?.id ?? null });
  },

  refreshNotes: async () => set({ notes: await api.notesList() }),
  refreshTasks: async () => set({ tasks: await api.tasksList() }),
  refreshLinks: async () => set({ links: await api.linksList() }),
  refreshFolders: async () => set({ folders: await api.foldersList() }),
  refreshTags: async () => set({ tags: await api.tagsList() }),

  setView: (v) => set({ view: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  openNoteSearch: () => set({ noteSearchOpen: true }),
  closeNoteSearch: () => set({ noteSearchOpen: false }),
  openCloud: () => set({ cloudOpen: true }),
  closeCloud: () => set({ cloudOpen: false }),
  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
  selectFolder: (id) => set({ activeFolderId: id, activeTagId: null, specialFilter: id ? null : "all", view: "notes" }),
  selectTag: (id) => set({ activeTagId: id, activeFolderId: null, specialFilter: null, view: "notes" }),
  selectSpecial: (f) => set({ specialFilter: f, activeFolderId: null, activeTagId: null, view: "notes" }),
  openNote: (id) => set({ currentNoteId: id, view: "notes" }),

  createNote: async (folderId = null) => {
    const note = await api.notesCreate("Nota sin título", folderId ?? get().activeFolderId);
    await get().refreshNotes();
    set({ currentNoteId: note.id, view: "notes" });
    return note;
  },

  updateNoteContent: async (id, blocks) => {
    await api.notesUpdate(id, { content: JSON.stringify(blocks) });
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, content: JSON.stringify(blocks), updated_at: new Date().toISOString() } : n)),
    }));
  },

  updateNoteTitle: async (id, title) => {
    await api.notesUpdate(id, { title });
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, title } : n)) }));
  },

  setNoteIcon: async (id, icon) => {
    await api.notesUpdate(id, { icon });
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, icon } : n)) }));
  },

  toggleFavorite: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    await api.notesUpdate(id, { is_favorite: !note.is_favorite });
    await get().refreshNotes();
  },

  trashNote: async (id) => {
    await api.notesSnapshot(id);
    await api.notesUpdate(id, { is_trashed: true });
    await get().refreshNotes();
    if (get().currentNoteId === id) set({ currentNoteId: get().notes[0]?.id ?? null });
  },

  restoreNote: async (id) => {
    await api.notesUpdate(id, { is_trashed: false, is_archived: false });
    await get().refreshNotes();
  },

  archiveNote: async (id) => {
    await api.notesUpdate(id, { is_archived: true });
    await get().refreshNotes();
    if (get().currentNoteId === id) set({ currentNoteId: get().notes[0]?.id ?? null });
  },

  deleteNotePermanently: async (id) => {
    await api.notesDelete(id);
    await get().refreshNotes();
  },

  syncLinksFromContent: async (note) => {
    const blocks = parseBlocks(note.content);
    const text = blocks.map((b) => b.text).join("\n");
    const titles = [...text.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1].trim().toLowerCase());
    if (titles.length === 0) {
      await api.linksSet(note.id, []);
    } else {
      const targets = get().notes
        .filter((n) => n.id !== note.id && titles.includes(n.title.trim().toLowerCase()))
        .map((n) => n.id);
      await api.linksSet(note.id, targets);
    }
    await get().refreshLinks();
  },

  moveNoteToFolder: async (noteId, folderId) => {
    await api.notesUpdate(noteId, { folder_id: folderId });
    await get().refreshNotes();
  },
  addTagToNote: async (noteId, tagId) => {
    const current = await api.noteTagsGet(noteId);
    if (current.some((t) => t.id === tagId)) return;
    await api.noteTagsSet(noteId, [...current.map((t) => t.id), tagId]);
    await get().refreshNotes();
  },

  createFolder: async (name) => { await api.foldersCreate(name); await get().refreshFolders(); },
  deleteFolder: async (id) => { await api.foldersDelete(id); await Promise.all([get().refreshFolders(), get().refreshNotes()]); },
  createTag: async (name, color) => { await api.tagsCreate(name, color); await get().refreshTags(); },
  deleteTag: async (id) => { await api.tagsDelete(id); await Promise.all([get().refreshTags(), get().refreshNotes()]); },

  createTask: async (title, noteId = null) => { await api.tasksCreate(title, noteId); await get().refreshTasks(); },
  setTaskStatus: async (id, status) => { await api.tasksUpdate(id, { status }); await get().refreshTasks(); },
  updateTask: async (id, patch) => { await api.tasksUpdate(id, patch); await get().refreshTasks(); },
  deleteTask: async (id) => { await api.tasksDelete(id); await get().refreshTasks(); },
}));
