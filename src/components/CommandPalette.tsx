import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/state/store";
import { parseBlocks } from "@/lib/types";
import { I } from "./Icons";

interface Item {
  id: string;
  title: string;
  sub?: string;
  kind: string;
  icon: JSX.Element;
  run: () => void;
}

export default function CommandPalette() {
  const {
    paletteOpen, closePalette, notes, folders, tags, tasks,
    openNote, selectFolder, selectTag, selectSpecial, setView, createNote,
  } = useStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (paletteOpen) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [paletteOpen]);

  const commands: Item[] = useMemo(() => [
    { id: "cmd-new", title: "Nueva nota", sub: "Crear una nota en blanco", kind: "Comando", icon: <I.Plus width={17} />, run: () => createNote() },
    { id: "cmd-tasks", title: "Ir a Tareas", kind: "Comando", icon: <I.Tasks width={17} />, run: () => setView("tasks") },
    { id: "cmd-graph", title: "Abrir Grafo de conocimiento", kind: "Comando", icon: <I.Graph width={17} />, run: () => setView("graph") },
    { id: "cmd-fav", title: "Ver favoritos", kind: "Comando", icon: <I.Star width={17} />, run: () => selectSpecial("favorites") },
    { id: "cmd-trash", title: "Abrir papelera", kind: "Comando", icon: <I.Trash width={17} />, run: () => selectSpecial("trash") },
  ], [createNote, setView, selectSpecial]);

  const results: { label: string; items: Item[] }[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => s.toLowerCase().includes(term);

    const noteItems: Item[] = notes
      .filter((n) => !term || match(n.title) || match(parseBlocks(n.content).map((b) => b.text).join(" ")))
      .slice(0, 8)
      .map((n) => ({
        id: "note-" + n.id, title: n.title || "Sin título",
        sub: parseBlocks(n.content).map((b) => b.text).filter(Boolean).join(" · ").slice(0, 60),
        kind: "Nota", icon: <span style={{ fontSize: 16 }}>{n.icon || "📄"}</span>,
        run: () => openNote(n.id),
      }));

    const taskItems: Item[] = tasks
      .filter((t) => !term || match(t.title))
      .slice(0, 5)
      .map((t) => ({ id: "task-" + t.id, title: t.title, kind: "Tarea", icon: <I.Tasks width={17} />, run: () => setView("tasks") }));

    const folderItems: Item[] = folders
      .filter((f) => !term || match(f.name))
      .map((f) => ({ id: "folder-" + f.id, title: f.name, kind: "Carpeta", icon: <I.Folder width={17} />, run: () => selectFolder(f.id) }));

    const tagItems: Item[] = tags
      .filter((t) => !term || match(t.name))
      .map((t) => ({ id: "tag-" + t.id, title: "#" + t.name, kind: "Etiqueta", icon: <span className="dot" style={{ background: t.color, width: 12, height: 12 }} />, run: () => selectTag(t.id) }));

    const cmdItems = commands.filter((c) => !term || match(c.title));

    return [
      { label: "Comandos", items: cmdItems },
      { label: "Notas", items: noteItems },
      { label: "Tareas", items: taskItems },
      { label: "Carpetas", items: folderItems },
      { label: "Etiquetas", items: tagItems },
    ].filter((g) => g.items.length > 0);
  }, [q, notes, tasks, folders, tags, commands, openNote, setView, selectFolder, selectTag]);

  const flat = useMemo(() => results.flatMap((g) => g.items), [results]);

  useEffect(() => { setSel((s) => Math.min(s, Math.max(0, flat.length - 1))); }, [flat.length]);

  if (!paletteOpen) return null;

  const exec = (item?: Item) => { (item ?? flat[sel])?.run(); closePalette(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); exec(); }
  };

  return (
    <div className="overlay" onClick={closePalette}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <I.Search width={20} />
          <input ref={inputRef} value={q} placeholder="Buscar notas, tareas, carpetas, comandos…"
            onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} />
          <span className="kbd">Esc</span>
        </div>
        <div className="palette-results">
          {flat.length === 0 ? (
            <div className="palette-empty">Sin resultados para “{q}”.</div>
          ) : (
            results.map((g) => (
              <div key={g.label}>
                <div className="palette-group-label">{g.label}</div>
                {g.items.map((item) => {
                  const idx = flat.indexOf(item);
                  return (
                    <div key={item.id} className={clsx("palette-item", idx === sel && "sel")}
                      onMouseEnter={() => setSel(idx)} onClick={() => exec(item)}>
                      <span className="pi-icon">{item.icon}</span>
                      <span className="pi-title">{item.title}</span>
                      {item.sub && <span className="pi-sub">{item.sub}</span>}
                      <span className="pi-kind">{item.kind}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="palette-footer">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> navegar</span>
          <span><span className="kbd">↵</span> abrir</span>
          <span><span className="kbd">Esc</span> cerrar</span>
        </div>
      </div>
    </div>
  );
}
