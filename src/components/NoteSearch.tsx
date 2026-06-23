import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/state/store";
import { parseBlocks } from "@/lib/types";
import { I } from "./Icons";

// Búsqueda dentro de la nota actual (Ctrl+F). Cuenta coincidencias y
// permite navegar entre ellas; resalta el bloque que las contiene.
export default function NoteSearch() {
  const { noteSearchOpen, closeNoteSearch, notes, currentNoteId, view } = useStore();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const note = notes.find((n) => n.id === currentNoteId);

  const matches = useMemo(() => {
    if (!q.trim() || !note) return [] as { block: number; text: string }[];
    const blocks = parseBlocks(note.content);
    const res: { block: number; text: string }[] = [];
    const term = q.toLowerCase();
    blocks.forEach((b, i) => {
      let from = 0;
      const lower = b.text.toLowerCase();
      while (true) {
        const at = lower.indexOf(term, from);
        if (at === -1) break;
        res.push({ block: i, text: b.text });
        from = at + term.length;
      }
    });
    return res;
  }, [q, note]);

  useEffect(() => { if (noteSearchOpen) setTimeout(() => inputRef.current?.focus(), 10); }, [noteSearchOpen]);
  useEffect(() => { setIdx(0); }, [q]);

  // Resalta coincidencias en el DOM del editor.
  useEffect(() => {
    clearMarks();
    if (!noteSearchOpen || !q.trim()) return;
    highlight(q, idx);
    return clearMarks;
  }, [q, idx, noteSearchOpen, matches.length]);

  if (!noteSearchOpen || view !== "notes" || !note) return null;

  const go = (dir: number) => {
    if (matches.length === 0) return;
    setIdx((i) => (i + dir + matches.length) % matches.length);
  };

  return (
    <div className="note-search">
      <div className="note-search-input">
        <I.Search width={16} style={{ color: "var(--text-3)" }} />
        <input ref={inputRef} value={q} placeholder="Buscar en esta nota…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") go(e.shiftKey ? -1 : 1); if (e.key === "Escape") closeNoteSearch(); }}
        />
        <span className="count">{matches.length ? `${idx + 1}/${matches.length}` : "0/0"}</span>
        <div className="nav">
          <button onClick={() => go(-1)} title="Anterior"><I.ChevronUp width={15} /></button>
          <button onClick={() => go(1)} title="Siguiente"><I.ChevronDown width={15} /></button>
          <button onClick={closeNoteSearch} title="Cerrar"><I.X width={15} /></button>
        </div>
      </div>
    </div>
  );
}

function clearMarks() {
  document.querySelectorAll(".editor mark").forEach((m) => {
    const parent = m.parentNode!;
    parent.replaceChild(document.createTextNode(m.textContent || ""), m);
    parent.normalize();
  });
}

// El editor usa <textarea>, así que el resaltado real se limita a hacer
// scroll al bloque correspondiente y enfocarlo visualmente.
function highlight(term: string, current: number) {
  const inputs = Array.from(document.querySelectorAll<HTMLTextAreaElement>(".editor .block-input"));
  let count = 0;
  for (const el of inputs) {
    const lower = el.value.toLowerCase();
    const t = term.toLowerCase();
    let from = 0;
    while (true) {
      const at = lower.indexOf(t, from);
      if (at === -1) break;
      if (count === current) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.focus();
        el.setSelectionRange(at, at + term.length);
        return;
      }
      count++; from = at + t.length;
    }
  }
}
