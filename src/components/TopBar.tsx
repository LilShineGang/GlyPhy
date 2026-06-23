import clsx from "clsx";
import { useStore } from "@/state/store";
import { I } from "./Icons";

export default function TopBar() {
  const {
    view, folders, tags, notes, currentNoteId,
    activeFolderId, activeTagId, specialFilter,
    setView, toggleSidebar, openPalette, openNoteSearch, toggleContextPanel, contextPanelOpen,
  } = useStore();

  const note = notes.find((n) => n.id === currentNoteId);
  const folder = folders.find((f) => f.id === activeFolderId);
  const tag = tags.find((t) => t.id === activeTagId);

  const crumb =
    view === "tasks" ? "Tareas" :
    view === "graph" ? "Grafo de conocimiento" :
    folder ? folder.name :
    tag ? `#${tag.name}` :
    specialFilter === "favorites" ? "Favoritos" :
    specialFilter === "archived" ? "Archivados" :
    specialFilter === "trash" ? "Papelera" : "Todas las notas";

  return (
    <header className="topbar">
      <button className="icon-btn" onClick={toggleSidebar} title="Alternar panel lateral (Ctrl+B)"><I.Sidebar /></button>
      <div className="crumb">
        {crumb}
        {view === "notes" && note && <><span>/</span><b>{note.icon ? note.icon + " " : ""}{note.title || "Sin título"}</b></>}
      </div>

      {view !== "notes" && (
        <div className="seg" style={{ marginLeft: 16 }}>
          {view === "tasks" && <TaskViewTabs />}
        </div>
      )}

      <button className="search-trigger" onClick={openPalette}>
        <I.Search width={15} />
        Buscar en todo…
        <span className="kbd">Ctrl P</span>
      </button>

      {view === "notes" && note && (
        <button className="icon-btn" onClick={openNoteSearch} title="Buscar en la nota (Ctrl+F)"><I.Search width={17} /></button>
      )}
      <div className="seg">
        <button className={clsx(view === "notes" && "active")} onClick={() => setView("notes")} title="Notas"><I.Note width={15} /></button>
        <button className={clsx(view === "tasks" && "active")} onClick={() => setView("tasks")} title="Tareas"><I.Tasks width={15} /></button>
        <button className={clsx(view === "graph" && "active")} onClick={() => setView("graph")} title="Grafo"><I.Graph width={15} /></button>
      </div>
      {view === "notes" && (
        <button className={clsx("icon-btn", contextPanelOpen && "active")} onClick={toggleContextPanel} title="Panel contextual"><I.Panel /></button>
      )}
    </header>
  );
}

function TaskViewTabs() {
  // Las pestañas de tareas viven dentro de TasksView; aquí solo placeholder vacío.
  return null;
}
