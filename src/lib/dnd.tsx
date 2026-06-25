// Sistema de arrastrar y soltar basado en eventos de puntero (mouse).
//
// NO usa la API nativa HTML5 Drag & Drop porque WebKitGTK (el motor que usa
// Tauri en Linux) se congela al iniciar una sesión de arrastre nativa. Esta
// implementación rastrea el ratón manualmente y detecta las zonas de destino
// con document.elementFromPoint, por lo que funciona igual en Windows y Linux.

import { createPortal } from "react-dom";
import { useEffect, useId, useRef } from "react";
import { create } from "zustand";

export interface DragPayload {
  kind: string; // "task" | "note" | "tag"
  id: string;
  label: string;
}

interface Zone {
  kinds: string[];
  onDrop: (p: DragPayload) => void;
}

const zones = new Map<string, Zone>();

interface DnDState {
  payload: DragPayload | null;
  x: number;
  y: number;
  overId: string | null;
  begin: (p: DragPayload, x: number, y: number) => void;
}

export const useDnD = create<DnDState>((set, get) => ({
  payload: null,
  x: 0,
  y: 0,
  overId: null,
  begin: (p, x, y) => {
    set({ payload: p, x, y, overId: null });
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const zoneEl = el?.closest<HTMLElement>("[data-drop-id]");
      let overId: string | null = null;
      if (zoneEl) {
        const z = zones.get(zoneEl.dataset.dropId!);
        if (z && z.kinds.includes(p.kind)) overId = zoneEl.dataset.dropId!;
      }
      set({ x: e.clientX, y: e.clientY, overId });
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const { overId, payload } = get();
      if (overId && payload) zones.get(overId)?.onDrop(payload);
      set({ payload: null, overId: null });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  },
}));

// No iniciar arrastre si el gesto empieza sobre un control interactivo.
const INTERACTIVE = "button, input, textarea, a, .todo-check, .tl-check";

/** Devuelve props para un elemento arrastrable. `payload` puede ser una función
 *  para leer datos frescos en el momento del arrastre. */
export function useDraggable(payload: DragPayload | (() => DragPayload)) {
  return {
    onMouseDown: (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      const sx = e.clientX, sy = e.clientY;
      const resolve = () => (typeof payload === "function" ? payload() : payload);

      const onMove = (ev: MouseEvent) => {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
          cleanup();
          useDnD.getState().begin(resolve(), ev.clientX, ev.clientY);
        }
      };
      const cleanup = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", cleanup);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", cleanup);
    },
  };
}

/** Registra una zona de destino. Devuelve props + estado de resaltado. */
export function useDrop(kinds: string[], onDrop: (p: DragPayload) => void) {
  const id = useId();
  const cb = useRef(onDrop);
  cb.current = onDrop;
  const kindsKey = kinds.join(",");

  useEffect(() => {
    const k = kindsKey.split(",");
    return zones.size >= 0
      ? (zones.set(id, { kinds: k, onDrop: (p) => cb.current(p) }), () => { zones.delete(id); })
      : undefined;
  }, [id, kindsKey]);

  const overId = useDnD((s) => s.overId);
  const dragging = useDnD((s) => !!s.payload && kinds.includes(s.payload.kind));

  return { "data-drop-id": id, isOver: overId === id, canDrop: dragging };
}

/** Fantasma que sigue al cursor durante el arrastre. Se monta una vez en App. */
export function DragGhost() {
  const payload = useDnD((s) => s.payload);
  const x = useDnD((s) => s.x);
  const y = useDnD((s) => s.y);
  if (!payload) return null;
  return createPortal(
    <div className="drag-ghost" style={{ left: x + 14, top: y + 10 }}>
      {payload.label}
    </div>,
    document.body
  );
}
