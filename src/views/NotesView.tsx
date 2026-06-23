import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/state/store";
import { api } from "@/lib/api";
import { parseBlocks } from "@/lib/types";
import { stripInline } from "@/lib/markdown";
import type { Block, Note, Tag } from "@/lib/types";
import BlockEditor from "@/components/BlockEditor";
import ContextPanel from "@/components/ContextPanel";
import { useDraggable, useDrop } from "@/lib/dnd";
import { I } from "@/components/Icons";

const EMOJIS = ["📝", "✨", "🚀", "💡", "📌", "🎯", "📚", "🧠", "🔥", "⭐", "🗂️", "🏷️", "🌙", "🔮", "💜", "🪐"];

export default function NotesView() {
  const {
    notes, folders, tags, currentNoteId, contextPanelOpen,
    activeFolderId, activeTagId, specialFilter,
    openNote, createNote, updateNoteContent, updateNoteTitle, setNoteIcon,
    toggleFavorite, trashNote, restoreNote, archiveNote, deleteNotePermanently,
    syncLinksFromContent,
  } = useStore();

  const [filtered, setFiltered] = useState<Note[]>([]);
  const [noteTagMap, setNoteTagMap] = useState<Record<string, Tag[]>>({});

  // Determina qué notas mostrar según el filtro activo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list: Note[];
      if (specialFilter === "trash") list = await api.notesQuery("trash");
      else if (specialFilter === "archived") list = await api.notesQuery("archived");
      else if (specialFilter === "favorites") list = await api.notesQuery("favorites");
      else list = notes;

      if (activeFolderId) list = list.filter((n) => n.folder_id === activeFolderId);
      if (activeTagId) {
        const tagged: Note[] = [];
        for (const n of list) {
          const t = await api.noteTagsGet(n.id);
          if (t.some((x) => x.id === activeTagId)) tagged.push(n);
        }
        list = tagged;
      }
      if (!cancelled) setFiltered(list);

      // precarga etiquetas para las tarjetas
      const map: Record<string, Tag[]> = {};
      await Promise.all(list.slice(0, 50).map(async (n) => { map[n.id] = await api.noteTagsGet(n.id); }));
      if (!cancelled) setNoteTagMap(map);
    })();
    return () => { cancelled = true; };
  }, [notes, activeFolderId, activeTagId, specialFilter]);

  const current = notes.find((n) => n.id === currentNoteId) ?? filtered.find((n) => n.id === currentNoteId);
  const inTrash = specialFilter === "trash";

  const listTitle =
    activeFolderId ? folders.find((f) => f.id === activeFolderId)?.name :
    activeTagId ? `#${tags.find((t) => t.id === activeTagId)?.name}` :
    specialFilter === "favorites" ? "Favoritos" :
    specialFilter === "archived" ? "Archivados" :
    specialFilter === "trash" ? "Papelera" : "Notas";

  return (
    <div className={clsx("notes-layout", contextPanelOpen && !inTrash && current && "with-panel")}>
      <div className="note-list">
        <div className="note-list-head">
          <h2>{listTitle}</h2>
          <span className="n">{filtered.length}</span>
        </div>
        {filtered.map((n) => (
          <NoteCard
            key={n.id} note={n} active={n.id === currentNoteId}
            tags={noteTagMap[n.id] ?? []}
            onClick={() => openNote(n.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-4)", fontSize: 13 }}>
            No hay notas aquí.
          </div>
        )}
      </div>

      {current ? (
        <Editor
          key={current.id}
          note={current}
          inTrash={inTrash}
          onTitle={(t) => updateNoteTitle(current.id, t)}
          onContent={async (blocks) => { await updateNoteContent(current.id, blocks); }}
          onIcon={(ic) => setNoteIcon(current.id, ic)}
          onFavorite={() => toggleFavorite(current.id)}
          onTrash={() => trashNote(current.id)}
          onRestore={() => restoreNote(current.id)}
          onArchive={() => archiveNote(current.id)}
          onDelete={() => deleteNotePermanently(current.id)}
          onSyncLinks={() => syncLinksFromContent(current)}
        />
      ) : (
        <div className="empty-state">
          <div>
            <div className="big">📝</div>
            <h3>Ninguna nota seleccionada</h3>
            <p>Elige una nota de la lista o crea una nueva.</p>
            <button onClick={() => createNote()}>Crear nota</button>
          </div>
        </div>
      )}

      {contextPanelOpen && !inTrash && current && <ContextPanel note={current} />}
    </div>
  );
}

function NoteCard({ note, active, tags, onClick }: { note: Note; active: boolean; tags: Tag[]; onClick: () => void }) {
  const addTagToNote = useStore((s) => s.addTagToNote);
  const drag = useDraggable(() => ({ kind: "note", id: note.id, label: note.title || "Sin título" }));
  const { isOver, ...dropAttrs } = useDrop(["tag"], (p) => addTagToNote(note.id, p.id));

  const excerpt = useMemo(() => {
    const blocks = parseBlocks(note.content);
    return stripInline(blocks.map((b) => b.text).filter(Boolean).join(" · ")).slice(0, 80) || "Vacía";
  }, [note.content]);

  return (
    <div
      className={clsx("note-card", "draggable", active && "active", isOver && "tag-over")}
      onClick={onClick}
      {...drag}
      {...dropAttrs}
    >
      <div className="nc-title">
        {note.icon && <span>{note.icon}</span>}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.title || "Sin título"}</span>
        {note.is_favorite && <I.Star width={13} className="star" />}
      </div>
      <div className="nc-excerpt">{excerpt}</div>
      <div className="nc-meta">
        {tags.slice(0, 3).map((t) => (
          <span key={t.id} className="tag-chip" style={{ background: t.color + "22", color: t.color }}>{t.name}</span>
        ))}
        <span className="nc-date" style={{ marginLeft: "auto" }}>{relativeTime(note.updated_at)}</span>
      </div>
    </div>
  );
}

interface EditorProps {
  note: Note;
  inTrash: boolean;
  onTitle: (t: string) => void;
  onContent: (blocks: Block[]) => Promise<void>;
  onIcon: (ic: string) => void;
  onFavorite: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSyncLinks: () => void;
}

function Editor(props: EditorProps) {
  const { note, inTrash } = props;
  const [title, setTitle] = useState(note.title);
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(note.content));
  const [savedAt, setSavedAt] = useState<string>("guardado");
  const [pickIcon, setPickIcon] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const { openNote, notes, createNote } = useStore();

  // Autoguardado con debounce.
  const queueSave = (next: Block[]) => {
    setSavedAt("guardando…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await props.onContent(next);
      props.onSyncLinks();
      setSavedAt("guardado");
    }, 600);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const onOpenLink = async (linkTitle: string) => {
    const target = notes.find((n) => n.title.trim().toLowerCase() === linkTitle.trim().toLowerCase());
    if (target) openNote(target.id);
    else { const n = await createNote(); useStore.getState().updateNoteTitle(n.id, linkTitle); }
  };

  return (
    <div className="editor-wrap">
      <div className="editor">
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <div style={{ position: "relative" }}>
            <div className="editor-icon" onClick={() => setPickIcon((v) => !v)}>{note.icon || "📄"}</div>
            {pickIcon && (
              <div className="popover" style={{ top: 56, left: 0 }}>
                <div className="color-grid" style={{ gridTemplateColumns: "repeat(8,1fr)" }}>
                  {EMOJIS.map((e) => (
                    <button key={e} style={{ fontSize: 18 }} onClick={() => { props.onIcon(e); setPickIcon(false); }}>{e}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {inTrash ? (
              <>
                <button className="icon-btn" title="Restaurar" onClick={props.onRestore}><I.History /></button>
                <button className="icon-btn" title="Eliminar para siempre" onClick={props.onDelete}><I.Trash /></button>
              </>
            ) : (
              <>
                <button className="icon-btn" title="Favorito" onClick={props.onFavorite} style={note.is_favorite ? { color: "var(--amber)" } : undefined}>
                  {note.is_favorite ? <I.Star /> : <I.StarOutline />}
                </button>
                <button className="icon-btn" title="Archivar" onClick={props.onArchive}><I.Archive /></button>
                <button className="icon-btn" title="Mover a papelera" onClick={props.onTrash}><I.Trash /></button>
              </>
            )}
          </div>
        </div>

        <textarea
          className="editor-title" rows={1} value={title} placeholder="Sin título"
          onChange={(e) => { setTitle(e.target.value); props.onTitle(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          disabled={inTrash}
        />
        <div className="editor-meta">
          <span><I.Clock width={12} style={{ display: "inline", verticalAlign: "-2px", marginRight: 4 }} /> {savedAt}</span>
          <span>·</span>
          <span>Creada {new Date(note.created_at).toLocaleDateString("es-ES")}</span>
          <span>·</span>
          <span>{blocks.length} bloques</span>
        </div>

        <div style={inTrash ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
          <BlockEditor
            blocks={blocks}
            onChange={(next) => { setBlocks(next); queueSave(next); }}
            onOpenLink={onOpenLink}
          />
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
