import { useEffect } from "react";
import { useStore } from "@/state/store";
import { isTauri } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import CommandPalette from "@/components/CommandPalette";
import NoteSearch from "@/components/NoteSearch";
import CloudModal from "@/components/CloudModal";
import { DragGhost } from "@/lib/dnd";
import { useSync } from "@/state/sync";
import NotesView from "@/views/NotesView";
import TasksView from "@/views/TasksView";
import GraphView from "@/views/GraphView";
import clsx from "clsx";

export default function App() {
  const view = useStore((s) => s.view);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const loaded = useStore((s) => s.loaded);
  const bootstrap = useStore((s) => s.bootstrap);

  useEffect(() => { bootstrap().then(() => useSync.getState().init()); }, [bootstrap]);

  // Atajos globales
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const t = e.target as HTMLElement;
      const editable = t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable);
      // No robar los atajos de formato del editor.
      if (editable && mod && ["b", "i", "u", "e", "k", "h"].includes(e.key.toLowerCase())) return;
      if (mod && e.key.toLowerCase() === "p") {
        e.preventDefault();
        useStore.getState().paletteOpen ? useStore.getState().closePalette() : useStore.getState().openPalette();
      } else if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        useStore.getState().openNoteSearch();
      } else if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        useStore.getState().createNote();
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        useStore.getState().toggleSidebar();
      } else if (e.key === "Escape") {
        useStore.getState().closePalette();
        useStore.getState().closeNoteSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={clsx("app", sidebarCollapsed && "sidebar-collapsed")}>
      <Sidebar />
      <main className="main">
        <TopBar />
        <div className="content">
          {!loaded ? (
            <div className="boot">Cargando GlyPhy…</div>
          ) : view === "notes" ? (
            <NotesView />
          ) : view === "tasks" ? (
            <TasksView />
          ) : (
            <GraphView />
          )}
        </div>
        {!isTauri && (
          <div className="preview-badge" title="Estás en modo previsualización (navegador). Los datos se guardan localmente. En la app nativa se usa SQLite.">
            modo previsualización
          </div>
        )}
      </main>
      <CommandPalette />
      <NoteSearch />
      <CloudModal />
      <DragGhost />
    </div>
  );
}
