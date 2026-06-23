import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getClient, getConfig, isConfigured, saveConfig, clearConfig } from "@/lib/supabase";
import { api } from "@/lib/api";
import { useStore } from "@/state/store";
import type { Folder, Link, Note, Tag, Task } from "@/lib/types";

export type SyncStatus = "off" | "idle" | "syncing" | "synced" | "error";

interface SyncState {
  configured: boolean;
  email: string | null;
  status: SyncStatus;
  lastSync: string | null;
  error: string | null;

  init: () => Promise<void>;
  configure: (url: string, anonKey: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  disconnect: () => void;
  syncNow: () => Promise<void>;
}

let channel: RealtimeChannel | null = null;
let pullTimer: number | null = null;

function userId(): string | null {
  return (useSync as any)._uid ?? null;
}
function setUid(id: string | null) {
  (useSync as any)._uid = id;
}

// Dueño de los datos en la base local. Permite detectar el cambio de cuenta
// y evitar que las notas de un usuario se contaminen con las de otro.
const OWNER_KEY = "glyphy.local.owner";
function localOwner(): string | null {
  return localStorage.getItem(OWNER_KEY);
}
function setLocalOwner(uid: string | null) {
  if (uid) localStorage.setItem(OWNER_KEY, uid);
  else localStorage.removeItem(OWNER_KEY);
}

// Primera sincronización tras iniciar sesión, con aislamiento por usuario:
// - Distinto dueño (o cuenta nueva sobre datos ajenos) → vaciar local y SOLO bajar.
// - Mismo dueño, o datos local-first sin sincronizar (owner null) → subir primero
//   (preserva el trabajo offline) y luego bajar.
async function initialSync(uid: string) {
  const owner = localOwner();
  if (owner && owner !== uid) {
    await api.clearLocal();
    await pullRemote(uid);
  } else {
    await pushLocal(uid);
    await pullRemote(uid);
  }
  setLocalOwner(uid);
  await useStore.getState().bootstrap();
}

export const useSync = create<SyncState>((set, get) => ({
  configured: isConfigured(),
  email: null,
  status: isConfigured() ? "idle" : "off",
  lastSync: null,
  error: null,

  init: async () => {
    if (!isConfigured()) { set({ configured: false, status: "off" }); return; }
    set({ configured: true });
    const sb = getClient();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    if (data.session?.user) {
      setUid(data.session.user.id);
      set({ email: data.session.user.email ?? null, status: "syncing" });
      subscribeRealtime();
      try {
        await initialSync(data.session.user.id);
        set({ status: "synced", lastSync: new Date().toISOString() });
      } catch (e: any) {
        console.error("sync error", e);
        set({ status: "error", error: e?.message ?? String(e) });
      }
    }
  },

  configure: async (url, anonKey) => {
    saveConfig({ url: url.trim().replace(/\/$/, ""), anonKey: anonKey.trim() });
    const sb = getClient();
    if (!sb) { set({ error: "Configuración inválida" }); return false; }
    set({ configured: true, status: "idle", error: null });
    return true;
  },

  signUp: async (email, password) => {
    const sb = getClient();
    if (!sb) throw new Error("Configura primero Supabase");
    set({ status: "syncing", error: null });
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { set({ status: "error", error: error.message }); throw error; }
    if (data.user) setUid(data.user.id);
    set({ email: data.user?.email ?? email, status: "idle" });
    if (data.session && data.user) {
      subscribeRealtime();
      set({ status: "syncing" });
      try {
        await initialSync(data.user.id);
        set({ status: "synced", lastSync: new Date().toISOString() });
      } catch (e: any) {
        set({ status: "error", error: e?.message ?? String(e) });
      }
      return true;
    }
    // Sin sesión: el proyecto exige confirmación de email.
    return false;
  },

  signIn: async (email, password) => {
    const sb = getClient();
    if (!sb) throw new Error("Configura primero Supabase");
    set({ status: "syncing", error: null });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { set({ status: "error", error: error.message }); throw error; }
    setUid(data.user.id);
    set({ email: data.user.email ?? email, status: "syncing" });
    subscribeRealtime();
    try {
      await initialSync(data.user.id);
      set({ status: "synced", lastSync: new Date().toISOString() });
    } catch (e: any) {
      set({ status: "error", error: e?.message ?? String(e) });
    }
  },

  signOut: async () => {
    const sb = getClient();
    await sb?.auth.signOut();
    unsubscribe();
    setUid(null);
    // El dispositivo no debe mostrar nada del usuario anterior; sus datos
    // siguen a salvo en la nube. Vaciamos y reconstruimos la base local.
    setLocalOwner(null);
    await api.clearLocal();
    await useStore.getState().bootstrap();
    set({ email: null, status: "idle", lastSync: null });
  },

  disconnect: () => {
    unsubscribe();
    setUid(null);
    clearConfig();
    set({ configured: false, email: null, status: "off" });
  },

  syncNow: async () => {
    const sb = getClient();
    const uid = userId();
    if (!sb || !uid) return;
    set({ status: "syncing", error: null });
    try {
      await pullRemote(uid);
      await pushLocal(uid);
      await useStore.getState().bootstrap();
      set({ status: "synced", lastSync: new Date().toISOString() });
    } catch (e: any) {
      console.error("sync error", e);
      set({ status: "error", error: e?.message ?? String(e) });
    }
  },
}));

// ---------- Tiempo real ----------

function subscribeRealtime() {
  const sb = getClient();
  if (!sb || channel) return;
  channel = sb
    .channel("glyphy-sync")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      // Debounce: agrupa ráfagas de cambios remotos en un solo pull.
      if (pullTimer) clearTimeout(pullTimer);
      pullTimer = window.setTimeout(() => {
        const uid = userId();
        if (uid) pullRemote(uid).then(() => useStore.getState().bootstrap());
      }, 600);
    })
    .subscribe();
}

function unsubscribe() {
  if (channel) { getClient()?.removeChannel(channel); channel = null; }
  if (pullTimer) { clearTimeout(pullTimer); pullTimer = null; }
}

// ---------- Pull: remoto -> local (last-write-wins) ----------

async function pullRemote(_uid: string) {
  const sb = getClient()!;
  const [notes, folders, tags, tasks, links, noteTags] = await Promise.all([
    sb.from("notes").select("*"),
    sb.from("folders").select("*"),
    sb.from("tags").select("*"),
    sb.from("tasks").select("*"),
    sb.from("links").select("*"),
    sb.from("note_tags").select("*"),
  ]);
  if (notes.error) throw notes.error;

  const localNotes = byId(await api.syncAllNotes());
  for (const r of notes.data ?? []) {
    const local = localNotes.get(r.id);
    if (!local || r.updated_at > local.updated_at) await api.syncUpsertNote(toNote(r));
  }

  const localFolders = byId(await api.foldersList());
  for (const r of folders.data ?? []) {
    if (!localFolders.has(r.id)) await api.syncUpsertFolder(toFolder(r));
  }

  const localTags = byId(await api.tagsList());
  for (const r of tags.data ?? []) {
    if (!localTags.has(r.id)) await api.syncUpsertTag(toTag(r));
  }

  const localTasks = byId(await api.tasksList());
  for (const r of tasks.data ?? []) {
    const local = localTasks.get(r.id);
    if (!local || r.updated_at > local.updated_at) await api.syncUpsertTask(toTask(r));
  }

  const localLinks = byId(await api.linksList());
  for (const r of links.data ?? []) {
    if (!localLinks.has(r.id)) await api.syncUpsertLink(toLink(r));
  }

  const localPairs = new Set((await api.syncNoteTagPairs()).map(([n, t]) => `${n}:${t}`));
  for (const r of noteTags.data ?? []) {
    if (!localPairs.has(`${r.note_id}:${r.tag_id}`)) await api.syncLinkNoteTag(r.note_id, r.tag_id);
  }
}

// ---------- Push: local -> remoto ----------

async function pushLocal(uid: string) {
  const sb = getClient()!;
  const stamp = (o: object) => ({ ...o, user_id: uid });

  const notes = await api.syncAllNotes();
  if (notes.length) await sb.from("notes").upsert(notes.map(stamp));

  const folders = await api.foldersList();
  if (folders.length) await sb.from("folders").upsert(folders.map(stamp));

  const tags = await api.tagsList();
  if (tags.length) await sb.from("tags").upsert(tags.map((t) => ({ ...t, user_id: uid })));

  const tasks = await api.tasksList();
  if (tasks.length) await sb.from("tasks").upsert(tasks.map(stamp));

  const links = await api.linksList();
  if (links.length) await sb.from("links").upsert(links.map(stamp));

  const pairs = await api.syncNoteTagPairs();
  if (pairs.length) await sb.from("note_tags").upsert(pairs.map(([note_id, tag_id]) => ({ note_id, tag_id, user_id: uid })));
}

// ---------- Mapeo de filas remotas a modelos locales ----------

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));

const toNote = (r: any): Note => ({
  id: r.id, title: r.title ?? "", content: r.content ?? "[]", folder_id: r.folder_id ?? null,
  icon: r.icon ?? null, is_favorite: !!r.is_favorite, is_trashed: !!r.is_trashed, is_archived: !!r.is_archived,
  created_at: r.created_at, updated_at: r.updated_at,
});
const toFolder = (r: any): Folder => ({ id: r.id, name: r.name, parent_id: r.parent_id ?? null, color: r.color ?? null, position: r.position ?? 0, created_at: r.created_at });
const toTag = (r: any): Tag => ({ id: r.id, name: r.name, color: r.color ?? "#8b5cf6" });
const toTask = (r: any): Task => ({ id: r.id, title: r.title, note_id: r.note_id ?? null, status: r.status, priority: r.priority, due_date: r.due_date ?? null, position: r.position ?? 0, created_at: r.created_at, updated_at: r.updated_at });
const toLink = (r: any): Link => ({ id: r.id, source_note_id: r.source_note_id, target_note_id: r.target_note_id });

export { getConfig };
