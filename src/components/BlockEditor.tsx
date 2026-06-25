import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { Block, BlockType } from "@/lib/types";
import { renderInline } from "@/lib/markdown";
import { openExternal } from "@/lib/api";
import { useDraggable, useDrop, useDnD } from "@/lib/dnd";
import { I } from "./Icons";

let counter = 0;
const uid = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

const SHORTCUTS: Record<string, BlockType> = {
  "# ": "heading",
  "## ": "subheading",
  "- ": "bullet",
  "* ": "bullet",
  "1. ": "numbered",
  "[] ": "todo",
  "[ ] ": "todo",
  "> ": "quote",
  "``` ": "code",
  "--- ": "divider",
};

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onOpenLink: (title: string) => void;
}

export default function BlockEditor({ blocks, onChange, onOpenLink }: Props) {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [sel, setSel] = useState<{ id: string; start: number; end: number } | null>(null);

  useEffect(() => {
    if (blocks.length === 0) onChange([{ id: uid(), type: "paragraph", text: "" }]);
  }, [blocks.length, onChange]);

  // Enfoca un bloque que acaba de crearse/seleccionarse.
  useEffect(() => {
    if (pendingFocus && refs.current[pendingFocus]) {
      const el = refs.current[pendingFocus]!;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      autosize(el);
      setPendingFocus(null);
    }
  }, [pendingFocus, focusedId, blocks]);

  const update = (id: string, patch: Partial<Block>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const handleInput = (b: Block, value: string) => {
    for (const [prefix, type] of Object.entries(SHORTCUTS)) {
      if (value.startsWith(prefix)) {
        if (type === "divider") {
          update(b.id, { type: "divider", text: "" });
          addBlock(b.id, "paragraph");
        } else {
          update(b.id, { type, text: value.slice(prefix.length) });
        }
        return;
      }
    }
    update(b.id, { text: value });
  };

  const addBlock = (afterId: string, type: BlockType = "paragraph") => {
    const idx = blocks.findIndex((b) => b.id === afterId);
    const nb: Block = { id: uid(), type, text: "", checked: type === "todo" ? false : undefined };
    onChange([...blocks.slice(0, idx + 1), nb, ...blocks.slice(idx + 1)]);
    setFocusedId(nb.id);
    setPendingFocus(nb.id);
  };

  // Reordena un bloque arrastrado (sourceId) respecto a otro (targetId).
  const moveBlock = (sourceId: string, targetId: string, after: boolean) => {
    if (sourceId === targetId) return;
    const src = blocks.find((b) => b.id === sourceId);
    if (!src) return;
    const rest = blocks.filter((b) => b.id !== sourceId);
    let idx = rest.findIndex((b) => b.id === targetId);
    if (idx === -1) return;
    if (after) idx += 1;
    onChange([...rest.slice(0, idx), src, ...rest.slice(idx)]);
  };

  const removeBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (blocks.length === 1) { update(id, { type: "paragraph", text: "" }); return; }
    const prev = blocks[idx - 1];
    onChange(blocks.filter((b) => b.id !== id));
    if (prev) { setFocusedId(prev.id); setPendingFocus(prev.id); }
  };

  // Envuelve la selección con marcadores de formato.
  const applyWrap = (b: Block, before: string, after = before) => {
    const el = refs.current[b.id];
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const val = b.text;
    const inner = val.slice(s, e) || "texto";
    const next = val.slice(0, s) + before + inner + after + val.slice(e);
    update(b.id, { text: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + inner.length);
      setSel({ id: b.id, start: s + before.length, end: s + before.length + inner.length });
    });
  };

  const applyLink = (b: Block) => {
    const el = refs.current[b.id];
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const val = b.text;
    const inner = val.slice(s, e) || "enlace";
    const insert = `[${inner}](url)`;
    update(b.id, { text: val.slice(0, s) + insert + val.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      const urlStart = s + inner.length + 3;
      el.setSelectionRange(urlStart, urlStart + 3);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent, b: Block) => {
    const el = e.target as HTMLTextAreaElement;
    const mod = e.ctrlKey || e.metaKey;

    // Atajos de formato (evitan que el atajo global de la app actúe).
    if (mod && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === "b") { e.preventDefault(); e.stopPropagation(); applyWrap(b, "**"); return; }
      if (key === "i") { e.preventDefault(); e.stopPropagation(); applyWrap(b, "*"); return; }
      if (key === "u") { e.preventDefault(); e.stopPropagation(); applyWrap(b, "++"); return; }
      if (key === "e") { e.preventDefault(); e.stopPropagation(); applyWrap(b, "`"); return; }
      if (key === "k") { e.preventDefault(); e.stopPropagation(); applyLink(b); return; }
      if (key === "h") { e.preventDefault(); e.stopPropagation(); applyWrap(b, "=="); return; }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((b.type === "bullet" || b.type === "numbered" || b.type === "todo") && b.text === "") {
        update(b.id, { type: "paragraph", checked: undefined });
        return;
      }
      const continued = ["bullet", "numbered", "todo"].includes(b.type) ? (b.type as BlockType) : "paragraph";
      addBlock(b.id, continued);
    } else if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (b.type !== "paragraph") { e.preventDefault(); update(b.id, { type: "paragraph", checked: undefined }); return; }
      if (b.text === "") { e.preventDefault(); removeBlock(b.id); }
    } else if (e.key === "ArrowDown") {
      const idx = blocks.findIndex((x) => x.id === b.id);
      const nx = blocks[idx + 1];
      if (nx && el.selectionStart === el.value.length) { e.preventDefault(); setFocusedId(nx.id); setPendingFocus(nx.id); }
    } else if (e.key === "ArrowUp") {
      const idx = blocks.findIndex((x) => x.id === b.id);
      const pv = blocks[idx - 1];
      if (pv && el.selectionStart === 0) { e.preventDefault(); setFocusedId(pv.id); setPendingFocus(pv.id); }
    } else if (e.key === "Escape") {
      el.blur();
    }
  };

  const trackSelection = (b: Block, el: HTMLTextAreaElement) => {
    if (el.selectionStart !== el.selectionEnd) setSel({ id: b.id, start: el.selectionStart, end: el.selectionEnd });
    else setSel(null);
  };

  const handlers = {
    onWikiLink: onOpenLink,
    onOpenUrl: (url: string) => openExternal(url),
  };

  return (
    <div className="blocks">
      {blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          b={b}
          i={i}
          blocks={blocks}
          editing={focusedId === b.id}
          showToolbar={focusedId === b.id && sel?.id === b.id && sel.start !== sel.end}
          refs={refs}
          handlers={handlers}
          update={update}
          handleInput={handleInput}
          onKeyDown={onKeyDown}
          trackSelection={trackSelection}
          applyWrap={applyWrap}
          applyLink={applyLink}
          moveBlock={moveBlock}
          setFocusedId={setFocusedId}
          setPendingFocus={setPendingFocus}
          setSel={setSel}
        />
      ))}
    </div>
  );
}

interface RowProps {
  b: Block;
  i: number;
  blocks: Block[];
  editing: boolean;
  showToolbar: boolean;
  refs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  handlers: { onWikiLink: (t: string) => void; onOpenUrl: (u: string) => void };
  update: (id: string, patch: Partial<Block>) => void;
  handleInput: (b: Block, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, b: Block) => void;
  trackSelection: (b: Block, el: HTMLTextAreaElement) => void;
  applyWrap: (b: Block, before: string, after?: string) => void;
  applyLink: (b: Block) => void;
  moveBlock: (sourceId: string, targetId: string, after: boolean) => void;
  setFocusedId: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingFocus: React.Dispatch<React.SetStateAction<string | null>>;
  setSel: React.Dispatch<React.SetStateAction<{ id: string; start: number; end: number } | null>>;
}

// Una fila de bloque. Es su propio componente para poder usar los hooks de DnD
// (useDrop/useDraggable) por bloque — NO se pueden llamar dentro de un .map.
function BlockRow(p: RowProps) {
  const { b, i, blocks, editing, showToolbar } = p;
  const rowRef = useRef<HTMLDivElement>(null);

  // El bloque es zona de destino: al soltar otro bloque, lo reordena según la
  // mitad superior/inferior sobre la que se suelte.
  const { isOver, canDrop, ...dropAttrs } = useDrop(["block"], (drag) => {
    const el = rowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = useDnD.getState().y;
    p.moveBlock(drag.id, b.id, y > rect.top + rect.height / 2);
  });

  // El tirador (⋮⋮) es la fuente de arrastre del bloque.
  const handleDrag = useDraggable(() => ({
    kind: "block",
    id: b.id,
    label: b.text.slice(0, 24) || "Bloque vacío",
  }));
  const dragging = useDnD((s) => s.payload?.kind === "block" && s.payload.id === b.id);

  return (
    <div
      ref={rowRef}
      className={clsx("block", b.type, b.type === "todo" && b.checked && "done", dragging && "block-dragging", canDrop && "block-droppable", isOver && "block-drop-over")}
      {...dropAttrs}
    >
      <span className="handle" title="Arrastrar para reordenar" {...handleDrag}>⋮⋮</span>

      {b.type === "bullet" && <span className="bullet-mark">•</span>}
      {b.type === "numbered" && <span className="num-mark">{numberOf(blocks, i)}.</span>}
      {b.type === "todo" && (
        <div className={clsx("todo-check", b.checked && "checked")} onClick={() => p.update(b.id, { checked: !b.checked })}>
          {b.checked && <I.Check width={13} />}
        </div>
      )}

      {b.type === "divider" ? (
        <hr />
      ) : editing ? (
        <div style={{ position: "relative", flex: 1 }}>
          {showToolbar && <FormatToolbar onFmt={(bef, aft) => p.applyWrap(b, bef, aft)} onLink={() => p.applyLink(b)} />}
          <textarea
            ref={(el) => { p.refs.current[b.id] = el; autosize(el); }}
            className="block-input"
            rows={1}
            value={b.text}
            autoFocus
            placeholder={i === 0 ? "Escribe… usa **negrita**, *cursiva*, [texto](url), [[enlace]] o '# ', '- ', '[] '" : "Escribe…"}
            onChange={(e) => { p.handleInput(b, e.target.value); autosize(e.target); }}
            onKeyDown={(e) => p.onKeyDown(e, b)}
            onSelect={(e) => p.trackSelection(b, e.target as HTMLTextAreaElement)}
            onBlur={() => { setTimeout(() => { p.setFocusedId((id) => (id === b.id ? null : id)); p.setSel(null); }, 120); }}
          />
        </div>
      ) : (
        <div
          className={clsx("block-rendered", !b.text && "empty")}
          onMouseDown={(e) => { e.preventDefault(); p.setFocusedId(b.id); p.setPendingFocus(b.id); }}
        >
          {b.type === "code"
            ? (b.text || "​")
            : b.text
              ? renderInline(b.text, p.handlers)
              : <span className="rendered-placeholder">{i === 0 ? "Escribe algo…" : ""}</span>}
        </div>
      )}
    </div>
  );
}

function FormatToolbar({ onFmt, onLink }: { onFmt: (before: string, after?: string) => void; onLink: () => void }) {
  const btn = (label: ReactNodeLike, title: string, fn: () => void, style?: React.CSSProperties) => (
    <button className="fmt-btn" title={title} style={style}
      onMouseDown={(e) => { e.preventDefault(); fn(); }}>{label}</button>
  );
  return (
    <div className="fmt-toolbar" onMouseDown={(e) => e.preventDefault()}>
      {btn(<b>B</b>, "Negrita (Ctrl+B)", () => onFmt("**"))}
      {btn(<i>I</i>, "Cursiva (Ctrl+I)", () => onFmt("*"))}
      {btn(<u>U</u>, "Subrayado (Ctrl+U)", () => onFmt("++"))}
      {btn(<s>S</s>, "Tachado", () => onFmt("~~"))}
      {btn(<span style={{ background: "var(--accent)", color: "#fff", padding: "0 4px", borderRadius: 3 }}>H</span>, "Resaltar (Ctrl+H)", () => onFmt("=="))}
      {btn(<code style={{ fontSize: 12 }}>{"</>"}</code>, "Código (Ctrl+E)", () => onFmt("`"))}
      {btn(<I.Link width={14} />, "Enlace (Ctrl+K)", onLink)}
    </div>
  );
}

type ReactNodeLike = React.ReactNode;

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function numberOf(blocks: Block[], index: number): number {
  let n = 1;
  for (let i = index - 1; i >= 0; i--) {
    if (blocks[i].type === "numbered") n++;
    else break;
  }
  return n;
}
