import { useMemo, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/state/store";
import { useDraggable, useDrop, useDnD } from "@/lib/dnd";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { I } from "@/components/Icons";

type Mode = "kanban" | "list" | "calendar";

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: "pending", label: "Pendiente", color: "#94a3b8" },
  { status: "in_progress", label: "En progreso", color: "#8b5cf6" },
  { status: "done", label: "Completada", color: "#34d399" },
  { status: "archived", label: "Archivada", color: "#55556a" },
];

const PRIORITY: Record<TaskPriority, { label: string; color: string } | null> = {
  none: null,
  low: { label: "Baja", color: "var(--pri-low)" },
  medium: { label: "Media", color: "var(--pri-medium)" },
  high: { label: "Alta", color: "var(--pri-high)" },
  urgent: { label: "Urgente", color: "var(--pri-urgent)" },
};

export default function TasksView() {
  const { tasks, createTask } = useStore();
  const [mode, setMode] = useState<Mode>("kanban");
  const [newTitle, setNewTitle] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const add = async () => {
    const t = newTitle.trim();
    if (!t) return;
    await createTask(t);
    setNewTitle("");
  };

  return (
    <div className="tasks-view">
      <div className="tasks-toolbar">
        <h1>Tareas</h1>
        <div className="seg" style={{ marginLeft: 14 }}>
          <button className={clsx(mode === "kanban" && "active")} onClick={() => setMode("kanban")}><I.Board width={14} /> Kanban</button>
          <button className={clsx(mode === "list" && "active")} onClick={() => setMode("list")}><I.List width={14} /> Lista</button>
          <button className={clsx(mode === "calendar" && "active")} onClick={() => setMode("calendar")}><I.Calendar width={14} /> Calendario</button>
        </div>
        <button className={clsx("seg-note-toggle", showNotes && "active")} onClick={() => setShowNotes((v) => !v)} title="Mostrar notas para arrastrar a una tarea">
          <I.Note width={14} /> Notas
        </button>
        <div className="add-task">
          <input
            placeholder="Añadir tarea rápida…" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <button onClick={add}><I.Plus width={15} /></button>
        </div>
      </div>

      <div className="tasks-body">
        <div className="tasks-main">
          {mode === "kanban" && <Kanban tasks={tasks} />}
          {mode === "list" && <ListView tasks={tasks} />}
          {mode === "calendar" && <CalendarView tasks={tasks} />}
        </div>
        {showNotes && <NotesRail />}
      </div>
    </div>
  );
}

// Panel lateral de notas arrastrables: suelta una sobre una tarjeta de tarea
// para enlazarla (task.note_id). Es la "fuente" del drag dentro de esta vista.
function NotesRail() {
  const notes = useStore((s) => s.notes);
  const visible = notes.filter((n) => !n.is_trashed && !n.is_archived);
  return (
    <div className="notes-rail">
      <div className="notes-rail-head">Arrastra a una tarea</div>
      <div className="notes-rail-body">
        {visible.map((n) => <NoteDragItem key={n.id} id={n.id} title={n.title} icon={n.icon} />)}
        {visible.length === 0 && <div className="notes-rail-empty">No hay notas.</div>}
      </div>
    </div>
  );
}

function NoteDragItem({ id, title, icon }: { id: string; title: string; icon: string | null }) {
  const drag = useDraggable(() => ({ kind: "note", id, label: title || "Sin título" }));
  return (
    <div className="note-drag-item draggable" {...drag}>
      <span>{icon || "📄"}</span>
      <span className="ndi-title">{title || "Sin título"}</span>
    </div>
  );
}

function Kanban({ tasks }: { tasks: Task[] }) {
  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);
  return (
    <div className="kanban">
      {COLUMNS.map((col) => (
        <KanbanColumn key={col.status} col={col} tasks={byStatus(col.status)} />
      ))}
    </div>
  );
}

function KanbanColumn({ col, tasks }: { col: { status: TaskStatus; label: string; color: string }; tasks: Task[] }) {
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const { isOver, canDrop, ...dropAttrs } = useDrop(["task"], (p) => setTaskStatus(p.id, col.status));
  return (
    <div className={clsx("kcol", canDrop && "drop-active", isOver && "drop-over")} {...dropAttrs}>
      <div className="kcol-head">
        <span className="sdot" style={{ background: col.color }} />
        {col.label}
        <span className="badge">{tasks.length}</span>
      </div>
      <div className="kcol-body">
        {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { notes, openNote, deleteTask, updateTask } = useStore();
  const drag = useDraggable(() => ({ kind: "task", id: task.id, label: task.title }));
  const dragging = useDnD((s) => s.payload?.kind === "task" && s.payload.id === task.id);
  // Soltar una nota sobre la tarjeta la enlaza a la tarea (task.note_id).
  const { isOver, canDrop, ...dropAttrs } = useDrop(["note"], (p) => updateTask(task.id, { note_id: p.id }));
  const note = notes.find((n) => n.id === task.note_id);
  const pri = PRIORITY[task.priority];
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  const cyclePriority = () => {
    const order: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
    const next = order[(order.indexOf(task.priority) + 1) % order.length];
    updateTask(task.id, { priority: next });
  };

  return (
    <div className={clsx("tcard", "draggable", dragging && "dragging", canDrop && "note-droppable", isOver && "note-over")} {...drag} {...dropAttrs}>
      <div className="tt">{task.title}</div>
      <div className="tmeta">
        {pri ? (
          <span className="pri" style={{ background: pri.color + "22", color: pri.color, cursor: "pointer" }} onClick={cyclePriority}>{pri.label}</span>
        ) : (
          <span className="pri" style={{ background: "var(--bg-4)", color: "var(--text-4)", cursor: "pointer" }} onClick={cyclePriority}>prioridad</span>
        )}
        {note && (
          <span className="tdue note-chip" style={{ marginLeft: 0, color: "var(--accent-hover)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }} onClick={() => openNote(note.id)} title={`Abrir «${note.title}»`}>
              <I.Note width={12} /> {note.title.slice(0, 14)}
            </span>
            <button className="note-unlink" title="Quitar nota" onClick={() => updateTask(task.id, { note_id: null })}><I.X width={10} /></button>
          </span>
        )}
        {task.due_date && (
          <span className={clsx("tdue", overdue && "overdue")}>
            <I.Clock width={12} /> {new Date(task.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </span>
        )}
        <button className="icon-btn" style={{ width: 22, height: 22, marginLeft: task.due_date || note ? 4 : "auto" }} onClick={() => deleteTask(task.id)} title="Eliminar"><I.Trash width={13} /></button>
      </div>
    </div>
  );
}

function ListView({ tasks }: { tasks: Task[] }) {
  const { setTaskStatus, deleteTask } = useStore();
  const sorted = useMemo(() => [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    return a.position - b.position;
  }), [tasks]);

  return (
    <div className="task-list">
      {sorted.map((t) => {
        const pri = PRIORITY[t.priority];
        const done = t.status === "done";
        return (
          <div key={t.id} className={clsx("tl-row", done && "done")}>
            <div className={clsx("tl-check", done && "done")} onClick={() => setTaskStatus(t.id, done ? "pending" : "done")}>
              {done && <I.Check width={13} />}
            </div>
            <span className="tl-title">{t.title}</span>
            {pri && <span className="pri" style={{ background: pri.color + "22", color: pri.color }}>{pri.label}</span>}
            <span style={{ fontSize: 11.5, color: "var(--text-4)", textTransform: "capitalize" }}>{COLUMNS.find((c) => c.status === t.status)?.label}</span>
            <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={() => deleteTask(t.id)}><I.Trash width={13} /></button>
          </div>
        );
      })}
      {tasks.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--text-4)" }}>No hay tareas. Añade una arriba.</div>}
    </div>
  );
}

function CalendarView({ tasks }: { tasks: Task[] }) {
  const [cursor, setCursor] = useState(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startDay = (first.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: { date: Date; dim: boolean }[] = [];
  for (let i = 0; i < startDay; i++) cells.push({ date: new Date(year, month, i - startDay + 1), dim: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), dim: false });
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month, daysInMonth + (cells.length % 7)), dim: true });

  const tasksOn = (date: Date) => tasks.filter((t) => t.due_date && sameDay(new Date(t.due_date), date));

  return (
    <div className="calendar">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button className="icon-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}><I.ChevronUp style={{ transform: "rotate(-90deg)" }} /></button>
        <h2 style={{ fontSize: 17, fontWeight: 650, textTransform: "capitalize", minWidth: 170 }}>
          {cursor.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
        </h2>
        <button className="icon-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}><I.ChevronUp style={{ transform: "rotate(90deg)" }} /></button>
        <button className="icon-btn" style={{ width: "auto", padding: "0 12px", fontSize: 12 }} onClick={() => setCursor(new Date())}>Hoy</button>
      </div>
      <div className="cal-grid">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((c, i) => (
          <div key={i} className={clsx("cal-cell", c.dim && "dim", sameDay(c.date, today) && "today")}>
            <div className="cal-num">{c.date.getDate()}</div>
            {tasksOn(c.date).map((t) => <div key={t.id} className="cal-task" title={t.title}>{t.title}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
