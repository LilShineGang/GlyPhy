import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/state/store";

interface Sim { id: string; x: number; y: number; vx: number; vy: number; title: string; icon: string | null; fav: boolean; }

export default function GraphView() {
  const { notes, links, openNote, setView } = useStore();
  const [nodes, setNodes] = useState<Sim[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const W = 1000, H = 700;

  const edges = useMemo(
    () => links.filter((l) => notes.some((n) => n.id === l.source_note_id) && notes.some((n) => n.id === l.target_note_id)),
    [links, notes]
  );
  const degree = useMemo(() => {
    const d: Record<string, number> = {};
    edges.forEach((e) => { d[e.source_note_id] = (d[e.source_note_id] ?? 0) + 1; d[e.target_note_id] = (d[e.target_note_id] ?? 0) + 1; });
    return d;
  }, [edges]);

  // Inicializa posiciones en círculo.
  useEffect(() => {
    setNodes((prev) => {
      const existing = new Map(prev.map((n) => [n.id, n]));
      return notes.map((n, i) => {
        const old = existing.get(n.id);
        const a = (i / Math.max(1, notes.length)) * Math.PI * 2;
        return old ?? { id: n.id, x: W / 2 + Math.cos(a) * 220, y: H / 2 + Math.sin(a) * 220, vx: 0, vy: 0, title: n.title, icon: n.icon, fav: n.is_favorite };
      });
    });
  }, [notes]);

  // Simulación de fuerzas.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNodes((ns) => {
        if (ns.length === 0) return ns;
        const next = ns.map((n) => ({ ...n }));
        const byId = new Map(next.map((n) => [n.id, n]));
        // repulsión
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const a = next[i], b = next[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let dist2 = dx * dx + dy * dy || 0.01;
            const force = 9000 / dist2;
            const dist = Math.sqrt(dist2);
            const fx = (dx / dist) * force, fy = (dy / dist) * force;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          }
        }
        // atracción por aristas
        edges.forEach((e) => {
          const a = byId.get(e.source_note_id), b = byId.get(e.target_note_id);
          if (!a || !b) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = (dist - 140) * 0.01;
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        });
        // centrado + integración
        next.forEach((n) => {
          if (dragRef.current?.id === n.id) { n.vx = 0; n.vy = 0; return; }
          n.vx += (W / 2 - n.x) * 0.0015;
          n.vy += (H / 2 - n.y) * 0.0015;
          n.vx *= 0.82; n.vy *= 0.82;
          n.x += n.vx; n.y += n.vy;
        });
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [edges]);

  const toSvg = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const onMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const p = toSvg(e);
    setNodes((ns) => ns.map((n) => (n.id === dragRef.current!.id ? { ...n, x: p.x, y: p.y, vx: 0, vy: 0 } : n)));
  };

  if (notes.length === 0) {
    return <div className="empty-state"><div><div className="big">🕸️</div><h3>Aún no hay grafo</h3><p>Crea notas y enlázalas con [[corchetes]].</p></div></div>;
  }

  return (
    <div className="graph-view">
      <div className="graph-info">
        🕸️ {notes.length} notas · {edges.length} enlaces — arrastra los nodos · clic para abrir
      </div>
      <svg
        ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        onMouseMove={onMove} onMouseUp={() => (dragRef.current = null)} onMouseLeave={() => (dragRef.current = null)}
      >
        <defs>
          <radialGradient id="nodeGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </radialGradient>
          <radialGradient id="favGrad" cx="50%" cy="40%">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
        </defs>

        {edges.map((e, i) => {
          const a = nodes.find((n) => n.id === e.source_note_id);
          const b = nodes.find((n) => n.id === e.target_note_id);
          if (!a || !b) return null;
          const active = hover === a.id || hover === b.id;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? "#8b5cf6" : "#ffffff18"} strokeWidth={active ? 2 : 1.2} />;
        })}

        {nodes.map((n) => {
          const r = 8 + Math.min(14, (degree[n.id] ?? 0) * 3);
          const active = hover === n.id;
          return (
            <g key={n.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
              onMouseDown={() => (dragRef.current = { id: n.id })}
              onClick={() => { openNote(n.id); setView("notes"); }}
            >
              {active && <circle cx={n.x} cy={n.y} r={r + 8} fill="#8b5cf633" />}
              <circle cx={n.x} cy={n.y} r={r} fill={n.fav ? "url(#favGrad)" : "url(#nodeGrad)"} stroke={active ? "#fff" : "#ffffff30"} strokeWidth={active ? 2 : 1} />
              <text className="gnode-label" x={n.x} y={n.y + r + 14} textAnchor="middle" style={{ fontWeight: active ? 700 : 400, fill: active ? "#f2f2f7" : undefined }}>
                {(n.icon ? n.icon + " " : "") + (n.title.length > 18 ? n.title.slice(0, 18) + "…" : n.title || "Sin título")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
