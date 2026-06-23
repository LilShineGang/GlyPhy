// Backend simulado para previsualización en navegador (sin Tauri).
// Replica la superficie de comandos del backend Rust persistiendo en
// localStorage. En el binario nativo este módulo no se usa.

import type { Folder, Link, Note, Tag, Task, Version } from "./types";

interface DB {
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  noteTags: { note_id: string; tag_id: string }[];
  tasks: Task[];
  links: Link[];
  versions: Version[];
}

const KEY = "glyphy.mockdb.v1";
const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function seed(): DB {
  const ts = now();
  const work: Folder = { id: uid(), name: "Trabajo", parent_id: null, color: "#8b5cf6", position: 0, created_at: ts };
  const personal: Folder = { id: uid(), name: "Personal", parent_id: null, color: "#6366f1", position: 1, created_at: ts };

  const welcome: Note = {
    id: uid(), title: "Bienvenido a GlyPhy",
    content: JSON.stringify([
      { id: uid(), type: "heading", text: "Bienvenido a GlyPhy ✨" },
      { id: uid(), type: "paragraph", text: "Tu espacio para notas y tareas con conocimiento conectado. Escribe en Markdown, enlaza notas con [[corchetes dobles]] y visualiza tus ideas en el grafo." },
      { id: uid(), type: "subheading", text: "Atajos rápidos" },
      { id: uid(), type: "bullet", text: "Ctrl+P — paleta de comandos y búsqueda global" },
      { id: uid(), type: "bullet", text: "Ctrl+F — buscar dentro de la nota actual" },
      { id: uid(), type: "bullet", text: "Ctrl+N — nueva nota" },
      { id: uid(), type: "todo", text: "Crear mi primera tarea", checked: false },
      { id: uid(), type: "quote", text: "El conocimiento conectado es más que la suma de sus notas." },
    ]),
    folder_id: null, icon: "✨", is_favorite: true, is_trashed: false, is_archived: false,
    created_at: ts, updated_at: ts,
  };

  const project: Note = {
    id: uid(), title: "Proyecto GlyPhy",
    content: JSON.stringify([
      { id: uid(), type: "heading", text: "Proyecto GlyPhy" },
      { id: uid(), type: "paragraph", text: "Notas del proyecto. Relacionada con [[Bienvenido a GlyPhy]]." },
      { id: uid(), type: "todo", text: "Definir arquitectura", checked: true },
      { id: uid(), type: "todo", text: "Diseñar knowledge graph", checked: false },
    ]),
    folder_id: work.id, icon: "🚀", is_favorite: false, is_trashed: false, is_archived: false,
    created_at: ts, updated_at: ts,
  };

  const ideas: Note = {
    id: uid(), title: "Ideas sueltas",
    content: JSON.stringify([
      { id: uid(), type: "heading", text: "Ideas" },
      { id: uid(), type: "bullet", text: "Modo enfoque sin distracciones" },
      { id: uid(), type: "bullet", text: "Plantillas reutilizables" },
    ]),
    folder_id: personal.id, icon: "💡", is_favorite: false, is_trashed: false, is_archived: false,
    created_at: ts, updated_at: ts,
  };

  const tagIdea: Tag = { id: uid(), name: "idea", color: "#8b5cf6" };
  const tagUrgent: Tag = { id: uid(), name: "urgente", color: "#f43f5e" };

  const t1: Task = { id: uid(), title: "Revisar diseño de la app", note_id: project.id, status: "in_progress", priority: "high", due_date: now(), position: 0, created_at: ts, updated_at: ts };
  const t2: Task = { id: uid(), title: "Escribir documentación", note_id: null, status: "pending", priority: "medium", due_date: null, position: 1, created_at: ts, updated_at: ts };
  const t3: Task = { id: uid(), title: "Publicar primera versión", note_id: null, status: "pending", priority: "urgent", due_date: null, position: 2, created_at: ts, updated_at: ts };
  const t4: Task = { id: uid(), title: "Definir arquitectura", note_id: project.id, status: "done", priority: "low", due_date: null, position: 3, created_at: ts, updated_at: ts };

  return {
    notes: [welcome, project, ideas],
    folders: [work, personal],
    tags: [tagIdea, tagUrgent],
    noteTags: [
      { note_id: welcome.id, tag_id: tagIdea.id },
      { note_id: project.id, tag_id: tagIdea.id },
      { note_id: project.id, tag_id: tagUrgent.id },
    ],
    tasks: [t1, t2, t3, t4],
    links: [{ id: uid(), source_note_id: project.id, target_note_id: welcome.id }],
    versions: [],
  };
}

function load(): DB {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw) as DB; } catch { /* re-seed */ }
  }
  const db = seed();
  save(db);
  return db;
}

function save(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export async function mockInvoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const db = load();
  const out = handle(db, cmd, args);
  save(db);
  return out as T;
}

function handle(db: DB, cmd: string, a: Record<string, any>): unknown {
  switch (cmd) {
    case "notes_list":
      return db.notes.filter((n) => !n.is_trashed && !n.is_archived)
        .sort((x, y) => y.updated_at.localeCompare(x.updated_at));
    case "notes_query": {
      const f = a.filter as string;
      let r = db.notes;
      if (f === "trash") r = db.notes.filter((n) => n.is_trashed);
      else if (f === "archived") r = db.notes.filter((n) => n.is_archived && !n.is_trashed);
      else if (f === "favorites") r = db.notes.filter((n) => n.is_favorite && !n.is_trashed);
      else r = db.notes.filter((n) => !n.is_trashed && !n.is_archived);
      return r.sort((x, y) => y.updated_at.localeCompare(x.updated_at));
    }
    case "notes_get":
      return db.notes.find((n) => n.id === a.id) ?? null;
    case "notes_create": {
      const ts = now();
      const note: Note = { id: uid(), title: a.title, content: "[]", folder_id: a.folderId ?? null, icon: null, is_favorite: false, is_trashed: false, is_archived: false, created_at: ts, updated_at: ts };
      db.notes.push(note);
      return note;
    }
    case "notes_update": {
      const n = db.notes.find((x) => x.id === a.id);
      if (!n) throw new Error("Nota no encontrada");
      Object.assign(n, a.patch);
      n.updated_at = now();
      return n;
    }
    case "notes_delete":
      db.notes = db.notes.filter((n) => n.id !== a.id);
      return null;
    case "notes_snapshot": {
      const n = db.notes.find((x) => x.id === a.id);
      if (n) {
        db.versions.push({ id: uid(), note_id: n.id, title: n.title, content: n.content, created_at: now() });
        db.versions = db.versions.filter((v) => v.note_id === n.id).slice(-50)
          .concat(db.versions.filter((v) => v.note_id !== n.id));
      }
      return null;
    }
    case "notes_versions":
      return db.versions.filter((v) => v.note_id === a.id).sort((x, y) => y.created_at.localeCompare(x.created_at));
    case "notes_backlinks": {
      const srcIds = db.links.filter((l) => l.target_note_id === a.id).map((l) => l.source_note_id);
      return db.notes.filter((n) => srcIds.includes(n.id) && !n.is_trashed);
    }

    case "folders_list":
      return [...db.folders].sort((x, y) => x.position - y.position);
    case "folders_create": {
      const folder: Folder = { id: uid(), name: a.name, parent_id: a.parentId ?? null, color: a.color ?? null, position: db.folders.length, created_at: now() };
      db.folders.push(folder);
      return folder;
    }
    case "folders_rename": {
      const f = db.folders.find((x) => x.id === a.id);
      if (f) f.name = a.name;
      return null;
    }
    case "folders_delete":
      db.folders = db.folders.filter((f) => f.id !== a.id);
      db.notes.forEach((n) => { if (n.folder_id === a.id) n.folder_id = null; });
      return null;

    case "tags_list":
      return [...db.tags].sort((x, y) => x.name.localeCompare(y.name));
    case "tags_create": {
      const ex = db.tags.find((t) => t.name === a.name);
      if (ex) { ex.color = a.color; return ex; }
      const tag: Tag = { id: uid(), name: a.name, color: a.color };
      db.tags.push(tag);
      return tag;
    }
    case "tags_delete":
      db.tags = db.tags.filter((t) => t.id !== a.id);
      db.noteTags = db.noteTags.filter((nt) => nt.tag_id !== a.id);
      return null;
    case "note_tags_set":
      db.noteTags = db.noteTags.filter((nt) => nt.note_id !== a.noteId);
      (a.tagIds as string[]).forEach((tid) => db.noteTags.push({ note_id: a.noteId, tag_id: tid }));
      return null;
    case "note_tags_get": {
      const ids = db.noteTags.filter((nt) => nt.note_id === a.noteId).map((nt) => nt.tag_id);
      return db.tags.filter((t) => ids.includes(t.id));
    }

    case "tasks_list":
      return [...db.tasks].sort((x, y) => x.position - y.position);
    case "tasks_create": {
      const ts = now();
      const task: Task = { id: uid(), title: a.title, note_id: a.noteId ?? null, status: "pending", priority: "none", due_date: null, position: db.tasks.length, created_at: ts, updated_at: ts };
      db.tasks.push(task);
      return task;
    }
    case "tasks_update": {
      const t = db.tasks.find((x) => x.id === a.id);
      if (!t) throw new Error("Tarea no encontrada");
      Object.assign(t, a.patch);
      t.updated_at = now();
      return t;
    }
    case "tasks_delete":
      db.tasks = db.tasks.filter((t) => t.id !== a.id);
      return null;

    case "links_set":
      db.links = db.links.filter((l) => l.source_note_id !== a.source);
      (a.targets as string[]).forEach((t) => {
        if (t !== a.source) db.links.push({ id: uid(), source_note_id: a.source, target_note_id: t });
      });
      return null;
    case "links_list":
      return db.links;

    // --- sincronización ---
    case "sync_all_notes":
      return db.notes;
    case "sync_note_tag_pairs":
      return db.noteTags.map((nt) => [nt.note_id, nt.tag_id]);
    case "sync_upsert_note": {
      const n = a.note as Note;
      const i = db.notes.findIndex((x) => x.id === n.id);
      if (i >= 0) db.notes[i] = n; else db.notes.push(n);
      return null;
    }
    case "sync_upsert_folder": {
      const f = a.folder as Folder;
      const i = db.folders.findIndex((x) => x.id === f.id);
      if (i >= 0) db.folders[i] = f; else db.folders.push(f);
      return null;
    }
    case "sync_upsert_tag": {
      const t = a.tag as Tag;
      const i = db.tags.findIndex((x) => x.id === t.id);
      if (i >= 0) db.tags[i] = t; else db.tags.push(t);
      return null;
    }
    case "sync_upsert_task": {
      const t = a.task as Task;
      const i = db.tasks.findIndex((x) => x.id === t.id);
      if (i >= 0) db.tasks[i] = t; else db.tasks.push(t);
      return null;
    }
    case "sync_upsert_link": {
      const l = a.link as Link;
      if (!db.links.some((x) => x.id === l.id)) db.links.push(l);
      return null;
    }
    case "sync_link_note_tag": {
      if (!db.noteTags.some((nt) => nt.note_id === a.noteId && nt.tag_id === a.tagId))
        db.noteTags.push({ note_id: a.noteId, tag_id: a.tagId });
      return null;
    }

    case "clear_local":
      db.notes = []; db.folders = []; db.tags = []; db.noteTags = [];
      db.tasks = []; db.links = []; db.versions = [];
      return null;

    default:
      throw new Error(`Comando no soportado en mock: ${cmd}`);
  }
}
