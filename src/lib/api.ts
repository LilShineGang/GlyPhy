import type {
  Folder, Link, Note, NoteUpdate, Tag, Task, TaskUpdate, Version,
} from "./types";
import { mockInvoke } from "./mockBackend";

// Detecta si corremos dentro de Tauri (binario nativo) o en un navegador
// normal (modo previsualización). En navegador usamos un backend simulado
// persistido en localStorage para que la app sea plenamente funcional.
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args);
}

export const api = {
  // Notas
  notesList: () => invoke<Note[]>("notes_list"),
  notesQuery: (filter: string) => invoke<Note[]>("notes_query", { filter }),
  notesGet: (id: string) => invoke<Note | null>("notes_get", { id }),
  notesCreate: (title: string, folderId: string | null = null) =>
    invoke<Note>("notes_create", { title, folderId }),
  notesUpdate: (id: string, patch: NoteUpdate) => invoke<Note>("notes_update", { id, patch }),
  notesDelete: (id: string) => invoke<void>("notes_delete", { id }),
  notesSnapshot: (id: string) => invoke<void>("notes_snapshot", { id }),
  notesVersions: (id: string) => invoke<Version[]>("notes_versions", { id }),
  notesBacklinks: (id: string) => invoke<Note[]>("notes_backlinks", { id }),

  // Carpetas
  foldersList: () => invoke<Folder[]>("folders_list"),
  foldersCreate: (name: string, parentId: string | null = null, color: string | null = null) =>
    invoke<Folder>("folders_create", { name, parentId, color }),
  foldersRename: (id: string, name: string) => invoke<void>("folders_rename", { id, name }),
  foldersDelete: (id: string) => invoke<void>("folders_delete", { id }),

  // Etiquetas
  tagsList: () => invoke<Tag[]>("tags_list"),
  tagsCreate: (name: string, color: string) => invoke<Tag>("tags_create", { name, color }),
  tagsDelete: (id: string) => invoke<void>("tags_delete", { id }),
  noteTagsSet: (noteId: string, tagIds: string[]) =>
    invoke<void>("note_tags_set", { noteId, tagIds }),
  noteTagsGet: (noteId: string) => invoke<Tag[]>("note_tags_get", { noteId }),

  // Tareas
  tasksList: () => invoke<Task[]>("tasks_list"),
  tasksCreate: (title: string, noteId: string | null = null) =>
    invoke<Task>("tasks_create", { title, noteId }),
  tasksUpdate: (id: string, patch: TaskUpdate) => invoke<Task>("tasks_update", { id, patch }),
  tasksDelete: (id: string) => invoke<void>("tasks_delete", { id }),

  // Enlaces
  linksSet: (source: string, targets: string[]) => invoke<void>("links_set", { source, targets }),
  linksList: () => invoke<Link[]>("links_list"),

  // Sincronización (lectura completa + upsert de filas remotas)
  syncAllNotes: () => invoke<Note[]>("sync_all_notes"),
  syncNoteTagPairs: () => invoke<[string, string][]>("sync_note_tag_pairs"),
  syncUpsertNote: (note: Note) => invoke<void>("sync_upsert_note", { note }),
  syncUpsertFolder: (folder: Folder) => invoke<void>("sync_upsert_folder", { folder }),
  syncUpsertTag: (tag: Tag) => invoke<void>("sync_upsert_tag", { tag }),
  syncUpsertTask: (task: Task) => invoke<void>("sync_upsert_task", { task }),
  syncUpsertLink: (link: Link) => invoke<void>("sync_upsert_link", { link }),
  syncLinkNoteTag: (noteId: string, tagId: string) => invoke<void>("sync_link_note_tag", { noteId, tagId }),

  // Vacía la base local (aislamiento de datos al cambiar de cuenta).
  clearLocal: () => invoke<void>("clear_local"),
};

// Abre una URL externa en el navegador del sistema.
export async function openExternal(url: string) {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  if (isTauri) {
    try {
      await invoke("open_external", { url: href });
      return;
    } catch (e) {
      console.error("open_external falló", e);
    }
  }
  window.open(href, "_blank", "noopener");
}

export { isTauri };
