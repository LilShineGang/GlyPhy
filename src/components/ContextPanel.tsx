import { useEffect, useState } from "react";
import { useStore } from "@/state/store";
import { api } from "@/lib/api";
import type { Note, Tag, Version } from "@/lib/types";
import { I } from "./Icons";

const TAG_COLORS = ["#8b5cf6", "#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#fb923c", "#f43f5e", "#ec4899", "#a78bfa", "#22d3ee", "#84cc16", "#94a3b8"];

export default function ContextPanel({ note }: { note: Note }) {
  const { tags: allTags, folders, openNote, createTag, refreshTags } = useStore();
  const [noteTags, setNoteTags] = useState<Tag[]>([]);
  const [backlinks, setBacklinks] = useState<Note[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [nt, bl, vs] = await Promise.all([
        api.noteTagsGet(note.id),
        api.notesBacklinks(note.id),
        api.notesVersions(note.id),
      ]);
      if (!alive) return;
      setNoteTags(nt); setBacklinks(bl); setVersions(vs);
    })();
    return () => { alive = false; };
  }, [note.id, note.updated_at]);

  const folder = folders.find((f) => f.id === note.folder_id);

  const toggleTag = async (tag: Tag) => {
    const has = noteTags.some((t) => t.id === tag.id);
    const next = has ? noteTags.filter((t) => t.id !== tag.id) : [...noteTags, tag];
    setNoteTags(next);
    await api.noteTagsSet(note.id, next.map((t) => t.id));
  };

  const addTag = async () => {
    const name = tagInput.trim().replace(/^#/, "");
    if (!name) { setAddingTag(false); return; }
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    await createTag(name, color);
    await refreshTags();
    const created = (await api.tagsList()).find((t) => t.name === name);
    if (created) {
      const next = [...noteTags, created];
      setNoteTags(next);
      await api.noteTagsSet(note.id, next.map((t) => t.id));
    }
    setTagInput(""); setAddingTag(false);
  };

  return (
    <aside className="ctx-panel">
      <div className="ctx-section">
        <h4>Propiedades</h4>
        <div className="ctx-row"><span>Carpeta</span><span style={{ color: "var(--text-1)" }}>{folder?.name ?? "—"}</span></div>
        <div className="ctx-row"><span>Creada</span><span>{new Date(note.created_at).toLocaleDateString("es-ES")}</span></div>
        <div className="ctx-row"><span>Modificada</span><span>{new Date(note.updated_at).toLocaleDateString("es-ES")}</span></div>
        <div className="ctx-row"><span>Favorito</span><span>{note.is_favorite ? "Sí" : "No"}</span></div>
      </div>

      <div className="ctx-section">
        <h4>Etiquetas</h4>
        <div className="ctx-tags">
          {noteTags.map((t) => (
            <span key={t.id} className="tag-chip" style={{ background: t.color + "22", color: t.color, cursor: "pointer" }} onClick={() => toggleTag(t)}>
              {t.name} <I.X width={10} />
            </span>
          ))}
          {addingTag ? (
            <input
              autoFocus className="block-input" style={{ fontSize: 12, width: 110, padding: "2px 6px", background: "var(--bg-4)", borderRadius: 8 }}
              placeholder="nombre…" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onBlur={addTag} onKeyDown={(e) => { if (e.key === "Enter") addTag(); if (e.key === "Escape") { setAddingTag(false); setTagInput(""); } }}
            />
          ) : (
            <button className="add-tag" onClick={() => setAddingTag(true)}>+ etiqueta</button>
          )}
        </div>
        {allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id)).length > 0 && (
          <div className="ctx-tags" style={{ marginTop: 8, opacity: 0.7 }}>
            {allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id)).map((t) => (
              <span key={t.id} className="tag-chip" style={{ background: "var(--bg-4)", color: "var(--text-3)", cursor: "pointer" }} onClick={() => toggleTag(t)}>
                + {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="ctx-section">
        <h4>Relaciones · {backlinks.length}</h4>
        {backlinks.length === 0 ? (
          <div className="ctx-empty">Ninguna nota enlaza aquí todavía. Usa [[{note.title}]] en otra nota.</div>
        ) : (
          backlinks.map((b) => (
            <div key={b.id} className="ctx-link" onClick={() => openNote(b.id)}>
              <I.Link width={14} style={{ color: "var(--accent-hover)" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.icon ? b.icon + " " : ""}{b.title || "Sin título"}</span>
            </div>
          ))
        )}
      </div>

      <div className="ctx-section">
        <h4 style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setShowVersions((v) => !v)}>
          <span>Historial · {versions.length}</span>
          {showVersions ? <I.ChevronUp width={14} /> : <I.ChevronDown width={14} />}
        </h4>
        {showVersions && (
          versions.length === 0 ? (
            <div className="ctx-empty">Las versiones se guardan automáticamente al archivar o mover a papelera.</div>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="ctx-link">
                <I.History width={14} />
                <span>{new Date(v.created_at).toLocaleString("es-ES")}</span>
              </div>
            ))
          )
        )}
      </div>
    </aside>
  );
}
