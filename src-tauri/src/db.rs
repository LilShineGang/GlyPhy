//! Capa de persistencia de GlyPhy sobre SQLite.
//! Esquema con notas, carpetas anidadas, etiquetas, tareas, enlaces
//! bidireccionales (knowledge graph) e historial de versiones.

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

pub type DbResult<T> = Result<T, String>;

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

// ---------- Modelos ----------

#[derive(Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String, // JSON de bloques serializado
    pub folder_id: Option<String>,
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub is_trashed: bool,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color: Option<String>,
    pub position: i64,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub note_id: Option<String>,
    pub status: String,   // pending | in_progress | done | archived
    pub priority: String, // none | low | medium | high | urgent
    pub due_date: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Link {
    pub id: String,
    pub source_note_id: String,
    pub target_note_id: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Version {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub title: String,
    pub created_at: String,
}

// ---------- Inicialización ----------

pub fn init(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
            color TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '[]',
            folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
            icon TEXT,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            is_trashed INTEGER NOT NULL DEFAULT 0,
            is_archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#8b5cf6'
        );

        CREATE TABLE IF NOT EXISTS note_tags (
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (note_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            priority TEXT NOT NULL DEFAULT 'none',
            due_date TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS links (
            id TEXT PRIMARY KEY,
            source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            target_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            UNIQUE (source_note_id, target_note_id)
        );

        CREATE TABLE IF NOT EXISTS versions (
            id TEXT PRIMARY KEY,
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_note_id);
        CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_note_id);
        CREATE INDEX IF NOT EXISTS idx_versions_note ON versions(note_id);
        "#,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Notas ----------

pub fn create_note(conn: &Connection, title: &str, folder_id: Option<String>) -> DbResult<Note> {
    let id = new_id();
    let ts = now();
    let note = Note {
        id: id.clone(),
        title: title.to_string(),
        content: "[]".to_string(),
        folder_id,
        icon: None,
        is_favorite: false,
        is_trashed: false,
        is_archived: false,
        created_at: ts.clone(),
        updated_at: ts.clone(),
    };
    conn.execute(
        "INSERT INTO notes (id, title, content, folder_id, icon, is_favorite, is_trashed, is_archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, 0, ?6, ?6)",
        params![note.id, note.title, note.content, note.folder_id, note.icon, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(note)
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        folder_id: row.get(3)?,
        icon: row.get(4)?,
        is_favorite: row.get::<_, i64>(5)? != 0,
        is_trashed: row.get::<_, i64>(6)? != 0,
        is_archived: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

const NOTE_COLS: &str =
    "id, title, content, folder_id, icon, is_favorite, is_trashed, is_archived, created_at, updated_at";

pub fn list_notes(conn: &Connection) -> DbResult<Vec<Note>> {
    let sql = format!(
        "SELECT {} FROM notes WHERE is_trashed = 0 AND is_archived = 0 ORDER BY updated_at DESC",
        NOTE_COLS
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_note)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn get_note(conn: &Connection, id: &str) -> DbResult<Option<Note>> {
    let sql = format!("SELECT {} FROM notes WHERE id = ?1", NOTE_COLS);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt.query_map(params![id], row_to_note).map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

#[derive(Deserialize)]
pub struct NoteUpdate {
    pub title: Option<String>,
    pub content: Option<String>,
    pub folder_id: Option<Option<String>>,
    pub icon: Option<Option<String>>,
    pub is_favorite: Option<bool>,
    pub is_trashed: Option<bool>,
    pub is_archived: Option<bool>,
}

pub fn update_note(conn: &Connection, id: &str, patch: NoteUpdate) -> DbResult<Note> {
    let mut note = get_note(conn, id)?.ok_or_else(|| "Nota no encontrada".to_string())?;
    if let Some(v) = patch.title { note.title = v; }
    if let Some(v) = patch.content { note.content = v; }
    if let Some(v) = patch.folder_id { note.folder_id = v; }
    if let Some(v) = patch.icon { note.icon = v; }
    if let Some(v) = patch.is_favorite { note.is_favorite = v; }
    if let Some(v) = patch.is_trashed { note.is_trashed = v; }
    if let Some(v) = patch.is_archived { note.is_archived = v; }
    note.updated_at = now();
    conn.execute(
        "UPDATE notes SET title=?2, content=?3, folder_id=?4, icon=?5, is_favorite=?6, is_trashed=?7, is_archived=?8, updated_at=?9 WHERE id=?1",
        params![
            note.id, note.title, note.content, note.folder_id, note.icon,
            note.is_favorite as i64, note.is_trashed as i64, note.is_archived as i64, note.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(note)
}

pub fn delete_note(conn: &Connection, id: &str) -> DbResult<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn query_notes(conn: &Connection, filter: &str) -> DbResult<Vec<Note>> {
    let sql = match filter {
        "trash" => format!("SELECT {} FROM notes WHERE is_trashed = 1 ORDER BY updated_at DESC", NOTE_COLS),
        "archived" => format!("SELECT {} FROM notes WHERE is_archived = 1 AND is_trashed = 0 ORDER BY updated_at DESC", NOTE_COLS),
        "favorites" => format!("SELECT {} FROM notes WHERE is_favorite = 1 AND is_trashed = 0 ORDER BY updated_at DESC", NOTE_COLS),
        _ => format!("SELECT {} FROM notes WHERE is_trashed = 0 AND is_archived = 0 ORDER BY updated_at DESC", NOTE_COLS),
    };
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_note).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// ---------- Sincronización (upsert / lectura completa) ----------

// Devuelve TODAS las notas (incluidas papelera/archivadas) para sincronizar.
pub fn list_all_notes(conn: &Connection) -> DbResult<Vec<Note>> {
    let sql = format!("SELECT {} FROM notes", NOTE_COLS);
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_note).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn upsert_note(conn: &Connection, n: Note) -> DbResult<()> {
    conn.execute(
        "INSERT INTO notes (id, title, content, folder_id, icon, is_favorite, is_trashed, is_archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, folder_id=excluded.folder_id,
            icon=excluded.icon, is_favorite=excluded.is_favorite, is_trashed=excluded.is_trashed,
            is_archived=excluded.is_archived, created_at=excluded.created_at, updated_at=excluded.updated_at",
        params![n.id, n.title, n.content, n.folder_id, n.icon, n.is_favorite as i64, n.is_trashed as i64, n.is_archived as i64, n.created_at, n.updated_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_folder(conn: &Connection, f: Folder) -> DbResult<()> {
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, color, position, created_at) VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, parent_id=excluded.parent_id, color=excluded.color, position=excluded.position",
        params![f.id, f.name, f.parent_id, f.color, f.position, f.created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_tag(conn: &Connection, t: Tag) -> DbResult<()> {
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1,?2,?3)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color",
        params![t.id, t.name, t.color],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_task(conn: &Connection, t: Task) -> DbResult<()> {
    conn.execute(
        "INSERT INTO tasks (id, title, note_id, status, priority, due_date, position, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, note_id=excluded.note_id, status=excluded.status,
            priority=excluded.priority, due_date=excluded.due_date, position=excluded.position, updated_at=excluded.updated_at",
        params![t.id, t.title, t.note_id, t.status, t.priority, t.due_date, t.position, t.created_at, t.updated_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upsert_link(conn: &Connection, l: Link) -> DbResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO links (id, source_note_id, target_note_id) VALUES (?1,?2,?3)",
        params![l.id, l.source_note_id, l.target_note_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn link_note_tag(conn: &Connection, note_id: &str, tag_id: &str) -> DbResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
        params![note_id, tag_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn list_note_tag_pairs(conn: &Connection) -> DbResult<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT note_id, tag_id FROM note_tags").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// ---------- Versiones ----------

pub fn snapshot_version(conn: &Connection, note_id: &str) -> DbResult<()> {
    if let Some(note) = get_note(conn, note_id)? {
        conn.execute(
            "INSERT INTO versions (id, note_id, title, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id(), note.id, note.title, note.content, now()],
        )
        .map_err(|e| e.to_string())?;
        // Conserva solo las últimas 50 versiones por nota.
        conn.execute(
            "DELETE FROM versions WHERE note_id = ?1 AND id NOT IN (
                SELECT id FROM versions WHERE note_id = ?1 ORDER BY created_at DESC LIMIT 50
            )",
            params![note_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn list_versions(conn: &Connection, note_id: &str) -> DbResult<Vec<Version>> {
    let mut stmt = conn
        .prepare("SELECT id, note_id, title, content, created_at FROM versions WHERE note_id = ?1 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![note_id], |row| {
            Ok(Version {
                id: row.get(0)?,
                note_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// ---------- Carpetas ----------

pub fn create_folder(conn: &Connection, name: &str, parent_id: Option<String>, color: Option<String>) -> DbResult<Folder> {
    let folder = Folder {
        id: new_id(),
        name: name.to_string(),
        parent_id,
        color,
        position: 0,
        created_at: now(),
    };
    conn.execute(
        "INSERT INTO folders (id, name, parent_id, color, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![folder.id, folder.name, folder.parent_id, folder.color, folder.position, folder.created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(folder)
}

pub fn list_folders(conn: &Connection) -> DbResult<Vec<Folder>> {
    let mut stmt = conn
        .prepare("SELECT id, name, parent_id, color, position, created_at FROM folders ORDER BY position, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                color: row.get(3)?,
                position: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn rename_folder(conn: &Connection, id: &str, name: &str) -> DbResult<()> {
    conn.execute("UPDATE folders SET name = ?2 WHERE id = ?1", params![id, name])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_folder(conn: &Connection, id: &str) -> DbResult<()> {
    conn.execute("DELETE FROM folders WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Etiquetas ----------

pub fn create_tag(conn: &Connection, name: &str, color: &str) -> DbResult<Tag> {
    let tag = Tag { id: new_id(), name: name.to_string(), color: color.to_string() };
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)
         ON CONFLICT(name) DO UPDATE SET color = excluded.color",
        params![tag.id, tag.name, tag.color],
    )
    .map_err(|e| e.to_string())?;
    // devuelve la fila real (puede existir ya)
    let mut stmt = conn.prepare("SELECT id, name, color FROM tags WHERE name = ?1").map_err(|e| e.to_string())?;
    let t = stmt
        .query_row(params![name], |row| Ok(Tag { id: row.get(0)?, name: row.get(1)?, color: row.get(2)? }))
        .map_err(|e| e.to_string())?;
    Ok(t)
}

pub fn list_tags(conn: &Connection) -> DbResult<Vec<Tag>> {
    let mut stmt = conn.prepare("SELECT id, name, color FROM tags ORDER BY name").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok(Tag { id: row.get(0)?, name: row.get(1)?, color: row.get(2)? }))
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

pub fn delete_tag(conn: &Connection, id: &str) -> DbResult<()> {
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_note_tags(conn: &Connection, note_id: &str, tag_ids: Vec<String>) -> DbResult<()> {
    conn.execute("DELETE FROM note_tags WHERE note_id = ?1", params![note_id])
        .map_err(|e| e.to_string())?;
    for tid in tag_ids {
        conn.execute(
            "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?1, ?2)",
            params![note_id, tid],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_note_tags(conn: &Connection, note_id: &str) -> DbResult<Vec<Tag>> {
    let mut stmt = conn
        .prepare("SELECT t.id, t.name, t.color FROM tags t JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ?1 ORDER BY t.name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![note_id], |row| Ok(Tag { id: row.get(0)?, name: row.get(1)?, color: row.get(2)? }))
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// ---------- Tareas ----------

pub fn create_task(conn: &Connection, title: &str, note_id: Option<String>) -> DbResult<Task> {
    let ts = now();
    let task = Task {
        id: new_id(),
        title: title.to_string(),
        note_id,
        status: "pending".into(),
        priority: "none".into(),
        due_date: None,
        position: 0,
        created_at: ts.clone(),
        updated_at: ts.clone(),
    };
    conn.execute(
        "INSERT INTO tasks (id, title, note_id, status, priority, due_date, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![task.id, task.title, task.note_id, task.status, task.priority, task.due_date, task.position, ts],
    )
    .map_err(|e| e.to_string())?;
    Ok(task)
}

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        note_id: row.get(2)?,
        status: row.get(3)?,
        priority: row.get(4)?,
        due_date: row.get(5)?,
        position: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub fn list_tasks(conn: &Connection) -> DbResult<Vec<Task>> {
    let mut stmt = conn
        .prepare("SELECT id, title, note_id, status, priority, due_date, position, created_at, updated_at FROM tasks ORDER BY position, created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_task).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct TaskUpdate {
    pub title: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub due_date: Option<Option<String>>,
    pub position: Option<i64>,
    pub note_id: Option<Option<String>>,
}

pub fn update_task(conn: &Connection, id: &str, patch: TaskUpdate) -> DbResult<Task> {
    let mut stmt = conn
        .prepare("SELECT id, title, note_id, status, priority, due_date, position, created_at, updated_at FROM tasks WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let mut task = stmt
        .query_row(params![id], row_to_task)
        .map_err(|e| e.to_string())?;
    if let Some(v) = patch.title { task.title = v; }
    if let Some(v) = patch.status { task.status = v; }
    if let Some(v) = patch.priority { task.priority = v; }
    if let Some(v) = patch.due_date { task.due_date = v; }
    if let Some(v) = patch.position { task.position = v; }
    if let Some(v) = patch.note_id { task.note_id = v; }
    task.updated_at = now();
    conn.execute(
        "UPDATE tasks SET title=?2, status=?3, priority=?4, due_date=?5, position=?6, note_id=?7, updated_at=?8 WHERE id=?1",
        params![task.id, task.title, task.status, task.priority, task.due_date, task.position, task.note_id, task.updated_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(task)
}

pub fn delete_task(conn: &Connection, id: &str) -> DbResult<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Enlaces (knowledge graph) ----------

pub fn set_links(conn: &Connection, source: &str, targets: Vec<String>) -> DbResult<()> {
    conn.execute("DELETE FROM links WHERE source_note_id = ?1", params![source])
        .map_err(|e| e.to_string())?;
    for t in targets {
        if t == source { continue; }
        conn.execute(
            "INSERT OR IGNORE INTO links (id, source_note_id, target_note_id) VALUES (?1, ?2, ?3)",
            params![new_id(), source, t],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn list_links(conn: &Connection) -> DbResult<Vec<Link>> {
    let mut stmt = conn
        .prepare("SELECT id, source_note_id, target_note_id FROM links")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Link { id: row.get(0)?, source_note_id: row.get(1)?, target_note_id: row.get(2)? })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// Backlinks: notas que enlazan hacia `note_id`.
pub fn backlinks(conn: &Connection, note_id: &str) -> DbResult<Vec<Note>> {
    // Columnas cualificadas con el alias de tabla para evitar ambigüedad en el JOIN.
    let cols = NOTE_COLS
        .split(", ")
        .map(|c| format!("n.{c}"))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT {} FROM notes n JOIN links l ON l.source_note_id = n.id WHERE l.target_note_id = ?1 AND n.is_trashed = 0",
        cols
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![note_id], row_to_note).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(|e| e.to_string())
}

// Vacía TODAS las tablas de datos del usuario (aislamiento por cuenta).
// No reinicia el esquema; deja la base lista para recibir datos nuevos.
pub fn clear_local(conn: &Connection) -> DbResult<()> {
    conn.execute_batch(
        "DELETE FROM note_tags;
         DELETE FROM links;
         DELETE FROM versions;
         DELETE FROM tasks;
         DELETE FROM notes;
         DELETE FROM tags;
         DELETE FROM folders;",
    )
    .map_err(|e| e.to_string())
}

// ---------- Datos de ejemplo ----------

pub fn seed_if_empty(conn: &Connection) -> DbResult<()> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if count > 0 {
        return Ok(());
    }

    let work = create_folder(conn, "Trabajo", None, Some("#8b5cf6".into()))?;
    let _personal = create_folder(conn, "Personal", None, Some("#6366f1".into()))?;

    let welcome = create_note(conn, "Bienvenido a GlyPhy", None)?;
    let welcome_body = serde_json::json!([
        {"id": new_id(), "type": "heading", "text": "Bienvenido a GlyPhy ✨"},
        {"id": new_id(), "type": "paragraph", "text": "Tu espacio para notas y tareas con conocimiento conectado. Escribe en Markdown, enlaza notas con [[corchetes dobles]] y visualiza tus ideas en el grafo."},
        {"id": new_id(), "type": "heading", "text": "Atajos rápidos"},
        {"id": new_id(), "type": "bullet", "text": "Ctrl+P — paleta de comandos y búsqueda global"},
        {"id": new_id(), "type": "bullet", "text": "Ctrl+F — buscar dentro de la nota actual"},
        {"id": new_id(), "type": "bullet", "text": "Ctrl+N — nueva nota"},
        {"id": new_id(), "type": "todo", "text": "Crear mi primera tarea", "checked": false},
        {"id": new_id(), "type": "quote", "text": "El conocimiento conectado es más que la suma de sus notas."}
    ]);
    update_note(conn, &welcome.id, NoteUpdate {
        title: Some("Bienvenido a GlyPhy".into()),
        content: Some(welcome_body.to_string()),
        folder_id: None, icon: Some(Some("✨".into())),
        is_favorite: Some(true), is_trashed: None, is_archived: None,
    })?;

    let project = create_note(conn, "Proyecto GlyPhy", Some(work.id.clone()))?;
    let project_body = serde_json::json!([
        {"id": new_id(), "type": "heading", "text": "Proyecto GlyPhy"},
        {"id": new_id(), "type": "paragraph", "text": "Notas del proyecto. Relacionada con [[Bienvenido a GlyPhy]]."},
        {"id": new_id(), "type": "todo", "text": "Definir arquitectura", "checked": true},
        {"id": new_id(), "type": "todo", "text": "Diseñar knowledge graph", "checked": false}
    ]);
    update_note(conn, &project.id, NoteUpdate {
        title: Some("Proyecto GlyPhy".into()),
        content: Some(project_body.to_string()),
        folder_id: Some(Some(work.id.clone())), icon: Some(Some("🚀".into())),
        is_favorite: None, is_trashed: None, is_archived: None,
    })?;

    set_links(conn, &project.id, vec![welcome.id.clone()])?;

    let tag_idea = create_tag(conn, "idea", "#8b5cf6")?;
    let tag_urgent = create_tag(conn, "urgente", "#f43f5e")?;
    set_note_tags(conn, &welcome.id, vec![tag_idea.id.clone()])?;
    set_note_tags(conn, &project.id, vec![tag_idea.id, tag_urgent.id])?;

    let t1 = create_task(conn, "Revisar diseño de la app", Some(project.id.clone()))?;
    update_task(conn, &t1.id, TaskUpdate {
        title: None, status: Some("in_progress".into()), priority: Some("high".into()),
        due_date: Some(Some(now())), position: Some(0), note_id: None,
    })?;
    create_task(conn, "Escribir documentación", None)?;
    let t3 = create_task(conn, "Publicar primera versión", None)?;
    update_task(conn, &t3.id, TaskUpdate {
        title: None, status: Some("pending".into()), priority: Some("urgent".into()),
        due_date: None, position: Some(1), note_id: None,
    })?;

    Ok(())
}
