import { useMemo, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/state/store";
import { useSync } from "@/state/sync";
import { useDraggable, useDrop } from "@/lib/dnd";
import type { Folder } from "@/lib/types";
import { I } from "./Icons";

export default function Sidebar() {
  const {
    view, folders, tags, notes, tasks,
    activeFolderId, activeTagId, specialFilter,
    setView, selectFolder, selectTag, selectSpecial, createNote, createFolder,
    moveNoteToFolder,
  } = useStore();

  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const counts = useMemo(() => ({
    favorites: notes.filter((n) => n.is_favorite).length,
    tasks: tasks.filter((t) => t.status !== "done" && t.status !== "archived").length,
  }), [notes, tasks]);

  const folderNoteCount = (id: string) => notes.filter((n) => n.folder_id === id).length;

  const submitFolder = async () => {
    const name = folderName.trim();
    if (name) await createFolder(name);
    setFolderName(""); setAddingFolder(false);
  };

  // Zona de destino para quitar una nota de su carpeta.
  const allDrop = useDrop(["note"], (p) => moveNoteToFolder(p.id, null));

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">G</div>
        <div className="brand-name">Gly<b>Phy</b></div>
      </div>

      <button className="new-note-btn" onClick={() => createNote()}>
        <I.Plus width={16} /> Nueva nota
      </button>

      <div className="sb-scroll">
        <div className="sb-section sb-nav">
          <div
            className={clsx("sb-item big", view === "notes" && specialFilter === "all" && "active", allDrop.isOver && "drop-target")}
            data-drop-id={allDrop["data-drop-id"]}
            onClick={() => selectSpecial("all")}
            title="Suelta una nota aquí para quitarla de su carpeta"
          >
            <I.Home className="icon" /> Todas las notas
            <span className="count">{notes.length}</span>
          </div>
          <div className={clsx("sb-item big", view === "tasks" && "active")} onClick={() => setView("tasks")}>
            <I.Tasks className="icon" /> Tareas
            <span className="count">{counts.tasks}</span>
          </div>
          <div className={clsx("sb-item big", view === "graph" && "active")} onClick={() => setView("graph")}>
            <I.Graph className="icon" /> Grafo
          </div>
          <div className={clsx("sb-item big", specialFilter === "favorites" && "active")} onClick={() => selectSpecial("favorites")}>
            <I.Star className="icon" style={{ color: "var(--amber)" }} /> Favoritos
            <span className="count">{counts.favorites}</span>
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">
            Carpetas
            <button onClick={() => setAddingFolder(true)} title="Nueva carpeta"><I.Plus width={14} /></button>
          </div>
          {folders.map((f) => (
            <FolderItem
              key={f.id} folder={f}
              active={activeFolderId === f.id}
              count={folderNoteCount(f.id)}
              onSelect={() => selectFolder(f.id)}
              onDropNote={(noteId) => moveNoteToFolder(noteId, f.id)}
            />
          ))}
          {addingFolder && (
            <input
              autoFocus className="block-input" style={{ padding: "7px 9px", fontSize: 13 }}
              placeholder="Nombre de carpeta…" value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onBlur={submitFolder}
              onKeyDown={(e) => { if (e.key === "Enter") submitFolder(); if (e.key === "Escape") { setAddingFolder(false); setFolderName(""); } }}
            />
          )}
        </div>

        <div className="sb-section">
          <div className="sb-label">Etiquetas</div>
          {tags.map((t) => {
            const drag = useDraggable(() => ({ kind: "tag", id: t.id, label: `#${t.name}` }));
            return (
              <div
                key={t.id}
                className={clsx("sb-item", "draggable", activeTagId === t.id && "active")}
                onClick={() => selectTag(t.id)}
                title="Arrastra esta etiqueta sobre una nota para aplicarla"
                {...drag}
              >
                <span className="dot" style={{ background: t.color }} /> {t.name}
              </div>
            );
          })}
          {tags.length === 0 && <div className="sb-item" style={{ color: "var(--text-4)", fontSize: 12.5 }}>Sin etiquetas</div>}
        </div>

        <div className="sb-section">
          <div className="sb-label">Más</div>
          <div className={clsx("sb-item", specialFilter === "archived" && "active")} onClick={() => selectSpecial("archived")}>
            <I.Archive className="icon" /> Archivados
          </div>
          <div className={clsx("sb-item", specialFilter === "trash" && "active")} onClick={() => selectSpecial("trash")}>
            <I.Trash className="icon" /> Papelera
          </div>
        </div>
      </div>

      <CloudFooter />
    </aside>
  );
}

function CloudFooter() {
  const openCloud = useStore((s) => s.openCloud);
  const email = useSync((s) => s.email);
  const status = useSync((s) => s.status);

  const statusText =
    status === "syncing" ? "Sincronizando…" :
    status === "synced" ? "Sincronizado ✓" :
    status === "error" ? "Error de sync" :
    email ? "Conectado" : "Sync en la nube";

  const dotColor =
    status === "syncing" ? "var(--accent-hover)" :
    status === "synced" ? "var(--green)" :
    status === "error" ? "var(--red)" :
    email ? "var(--green)" : "var(--text-4)";

  return (
    <div className="sb-footer">
      <div className="sb-user" style={{ cursor: "pointer" }} onClick={openCloud} title="Sincronización en la nube">
        <div className="avatar">{email ? email[0]?.toUpperCase() : "D"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--text-2)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email ?? "Espacio local"}
          </div>
          <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flex: "none" }} />
            {statusText}
          </div>
        </div>
        <I.Cloud width={15} style={{ color: "var(--text-3)" }} />
      </div>
    </div>
  );
}

function FolderItem({ folder, active, count, onSelect, onDropNote }: {
  folder: Folder; active: boolean; count: number; onSelect: () => void; onDropNote: (noteId: string) => void;
}) {
  const { isOver, ...dropAttrs } = useDrop(["note"], (p) => onDropNote(p.id));
  return (
    <div
      className={clsx("sb-item", active && "active", isOver && "drop-target")}
      onClick={onSelect}
      {...dropAttrs}
    >
      <I.Folder className="icon" style={{ color: folder.color ?? undefined }} />
      {folder.name}
      <span className="count">{count}</span>
    </div>
  );
}
