import type { ReactNode } from "react";

// Renderizador de formato inline para los bloques de texto.
// Soporta: **negrita**, __negrita__, *cursiva*, _cursiva_, ~~tachado~~,
// ++subrayado++, ==resaltado==, `código`, [texto](url) y [[wikilink]].

export interface InlineHandlers {
  onWikiLink?: (title: string) => void;
  onOpenUrl?: (url: string) => void;
}

type RuleType = "bold" | "italic" | "strike" | "underline" | "highlight" | "code" | "wiki" | "link";

const RULES: { re: RegExp; type: RuleType }[] = [
  { re: /\*\*([\s\S]+?)\*\*/, type: "bold" },
  { re: /__([\s\S]+?)__/, type: "bold" },
  { re: /\+\+([\s\S]+?)\+\+/, type: "underline" },
  { re: /~~([\s\S]+?)~~/, type: "strike" },
  { re: /==([\s\S]+?)==/, type: "highlight" },
  { re: /\*([\s\S]+?)\*/, type: "italic" },
  { re: /_([\s\S]+?)_/, type: "italic" },
  { re: /`([^`]+?)`/, type: "code" },
  { re: /\[\[([^\]]+?)\]\]/, type: "wiki" },
  { re: /\[([^\]]+?)\]\(([^)]+?)\)/, type: "link" },
];

export function renderInline(text: string, h: InlineHandlers = {}, key = "i"): ReactNode[] {
  if (!text) return [];

  // Busca la coincidencia más temprana entre todas las reglas (sin flag global).
  let best: { index: number; type: RuleType; m: RegExpExecArray } | null = null;
  for (const { re, type } of RULES) {
    const m = new RegExp(re.source).exec(text);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, type, m };
  }
  if (!best) return [text];

  const { index, type, m } = best;
  const out: ReactNode[] = [];
  if (index > 0) out.push(text.slice(0, index));
  const inner = m[1];
  const k = `${key}-${index}`;

  switch (type) {
    case "bold": out.push(<strong key={k}>{renderInline(inner, h, k)}</strong>); break;
    case "italic": out.push(<em key={k}>{renderInline(inner, h, k)}</em>); break;
    case "underline": out.push(<u key={k}>{renderInline(inner, h, k)}</u>); break;
    case "strike": out.push(<s key={k}>{renderInline(inner, h, k)}</s>); break;
    case "highlight": out.push(<mark key={k} className="md-mark">{renderInline(inner, h, k)}</mark>); break;
    case "code": out.push(<code key={k} className="md-code">{inner}</code>); break;
    case "wiki":
      out.push(
        <span key={k} className="wikilink" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); h.onWikiLink?.(inner.trim()); }}>
          {inner}
        </span>
      );
      break;
    case "link": {
      const url = m[2];
      out.push(
        <a key={k} className="md-link" href={url}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); h.onOpenUrl?.(url); }}>
          {renderInline(inner, h, k)}
        </a>
      );
      break;
    }
  }

  out.push(...renderInline(text.slice(index + m[0].length), h, k + "r"));
  return out;
}

// Quita los marcadores de formato para obtener texto plano (búsqueda, excerpts).
export function stripInline(text: string): string {
  return text
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/\+\+([\s\S]+?)\+\+/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/==([\s\S]+?)==/g, "$1")
    .replace(/\*([\s\S]+?)\*/g, "$1")
    .replace(/_([\s\S]+?)_/g, "$1")
    .replace(/`([^`]+?)`/g, "$1")
    .replace(/\[\[([^\]]+?)\]\]/g, "$1")
    .replace(/\[([^\]]+?)\]\(([^)]+?)\)/g, "$1");
}
