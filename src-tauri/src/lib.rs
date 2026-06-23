//! GlyPhy — capa de aplicación Tauri.
//! Expone los comandos invocables desde el frontend y gestiona la
//! conexión SQLite protegida por un Mutex en el estado de la app.

mod db;

use std::sync::Mutex;

use db::*;
use rusqlite::Connection;
use tauri::{Manager, State};

pub struct AppState {
    pub conn: Mutex<Connection>,
}

type CmdResult<T> = Result<T, String>;

macro_rules! with_conn {
    ($state:expr, $conn:ident => $body:expr) => {{
        let $conn = $state.conn.lock().map_err(|e| e.to_string())?;
        $body
    }};
}

// ---------- Notas ----------

#[tauri::command]
fn notes_list(state: State<AppState>) -> CmdResult<Vec<Note>> {
    with_conn!(state, c => list_notes(&c))
}

#[tauri::command]
fn notes_query(state: State<AppState>, filter: String) -> CmdResult<Vec<Note>> {
    with_conn!(state, c => query_notes(&c, &filter))
}

#[tauri::command]
fn notes_get(state: State<AppState>, id: String) -> CmdResult<Option<Note>> {
    with_conn!(state, c => get_note(&c, &id))
}

#[tauri::command]
fn notes_create(state: State<AppState>, title: String, folder_id: Option<String>) -> CmdResult<Note> {
    with_conn!(state, c => create_note(&c, &title, folder_id))
}

#[tauri::command]
fn notes_update(state: State<AppState>, id: String, patch: NoteUpdate) -> CmdResult<Note> {
    with_conn!(state, c => update_note(&c, &id, patch))
}

#[tauri::command]
fn notes_delete(state: State<AppState>, id: String) -> CmdResult<()> {
    with_conn!(state, c => delete_note(&c, &id))
}

#[tauri::command]
fn notes_snapshot(state: State<AppState>, id: String) -> CmdResult<()> {
    with_conn!(state, c => snapshot_version(&c, &id))
}

#[tauri::command]
fn notes_versions(state: State<AppState>, id: String) -> CmdResult<Vec<Version>> {
    with_conn!(state, c => list_versions(&c, &id))
}

#[tauri::command]
fn notes_backlinks(state: State<AppState>, id: String) -> CmdResult<Vec<Note>> {
    with_conn!(state, c => backlinks(&c, &id))
}

// ---------- Carpetas ----------

#[tauri::command]
fn folders_list(state: State<AppState>) -> CmdResult<Vec<Folder>> {
    with_conn!(state, c => list_folders(&c))
}

#[tauri::command]
fn folders_create(state: State<AppState>, name: String, parent_id: Option<String>, color: Option<String>) -> CmdResult<Folder> {
    with_conn!(state, c => create_folder(&c, &name, parent_id, color))
}

#[tauri::command]
fn folders_rename(state: State<AppState>, id: String, name: String) -> CmdResult<()> {
    with_conn!(state, c => rename_folder(&c, &id, &name))
}

#[tauri::command]
fn folders_delete(state: State<AppState>, id: String) -> CmdResult<()> {
    with_conn!(state, c => delete_folder(&c, &id))
}

// ---------- Etiquetas ----------

#[tauri::command]
fn tags_list(state: State<AppState>) -> CmdResult<Vec<Tag>> {
    with_conn!(state, c => list_tags(&c))
}

#[tauri::command]
fn tags_create(state: State<AppState>, name: String, color: String) -> CmdResult<Tag> {
    with_conn!(state, c => create_tag(&c, &name, &color))
}

#[tauri::command]
fn tags_delete(state: State<AppState>, id: String) -> CmdResult<()> {
    with_conn!(state, c => delete_tag(&c, &id))
}

#[tauri::command]
fn note_tags_set(state: State<AppState>, note_id: String, tag_ids: Vec<String>) -> CmdResult<()> {
    with_conn!(state, c => set_note_tags(&c, &note_id, tag_ids))
}

#[tauri::command]
fn note_tags_get(state: State<AppState>, note_id: String) -> CmdResult<Vec<Tag>> {
    with_conn!(state, c => get_note_tags(&c, &note_id))
}

// ---------- Tareas ----------

#[tauri::command]
fn tasks_list(state: State<AppState>) -> CmdResult<Vec<Task>> {
    with_conn!(state, c => list_tasks(&c))
}

#[tauri::command]
fn tasks_create(state: State<AppState>, title: String, note_id: Option<String>) -> CmdResult<Task> {
    with_conn!(state, c => create_task(&c, &title, note_id))
}

#[tauri::command]
fn tasks_update(state: State<AppState>, id: String, patch: TaskUpdate) -> CmdResult<Task> {
    with_conn!(state, c => update_task(&c, &id, patch))
}

#[tauri::command]
fn tasks_delete(state: State<AppState>, id: String) -> CmdResult<()> {
    with_conn!(state, c => delete_task(&c, &id))
}

// ---------- Sincronización ----------

#[tauri::command]
fn sync_all_notes(state: State<AppState>) -> CmdResult<Vec<Note>> {
    with_conn!(state, c => list_all_notes(&c))
}

#[tauri::command]
fn sync_note_tag_pairs(state: State<AppState>) -> CmdResult<Vec<(String, String)>> {
    with_conn!(state, c => list_note_tag_pairs(&c))
}

#[tauri::command]
fn sync_upsert_note(state: State<AppState>, note: Note) -> CmdResult<()> {
    with_conn!(state, c => upsert_note(&c, note))
}

#[tauri::command]
fn sync_upsert_folder(state: State<AppState>, folder: Folder) -> CmdResult<()> {
    with_conn!(state, c => upsert_folder(&c, folder))
}

#[tauri::command]
fn sync_upsert_tag(state: State<AppState>, tag: Tag) -> CmdResult<()> {
    with_conn!(state, c => upsert_tag(&c, tag))
}

#[tauri::command]
fn sync_upsert_task(state: State<AppState>, task: Task) -> CmdResult<()> {
    with_conn!(state, c => upsert_task(&c, task))
}

#[tauri::command]
fn sync_upsert_link(state: State<AppState>, link: Link) -> CmdResult<()> {
    with_conn!(state, c => upsert_link(&c, link))
}

#[tauri::command]
fn sync_link_note_tag(state: State<AppState>, note_id: String, tag_id: String) -> CmdResult<()> {
    with_conn!(state, c => link_note_tag(&c, &note_id, &tag_id))
}

// Vacía la base local (aislamiento de datos al cambiar de cuenta).
#[tauri::command]
fn clear_local(state: State<AppState>) -> CmdResult<()> {
    with_conn!(state, c => db::clear_local(&c))
}

// ---------- Enlaces ----------

#[tauri::command]
fn links_set(state: State<AppState>, source: String, targets: Vec<String>) -> CmdResult<()> {
    with_conn!(state, c => set_links(&c, &source, targets))
}

#[tauri::command]
fn links_list(state: State<AppState>) -> CmdResult<Vec<Link>> {
    with_conn!(state, c => list_links(&c))
}

// Abre una URL en el navegador del sistema sin plugins externos.
#[tauri::command]
fn open_external(url: String) -> CmdResult<()> {
    // Solo http/https por seguridad.
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("URL no permitida".into());
    }
    #[cfg(target_os = "windows")]
    let res = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    #[cfg(target_os = "macos")]
    let res = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let res = std::process::Command::new("xdg-open").arg(&url).spawn();
    res.map(|_| ()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("no app data dir");
            std::fs::create_dir_all(&dir).ok();
            let db_path = dir.join("glyphy.db");
            let conn = Connection::open(db_path).expect("no se pudo abrir la base de datos");
            db::init(&conn).expect("no se pudo inicializar el esquema");
            db::seed_if_empty(&conn).ok();
            app.manage(AppState { conn: Mutex::new(conn) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            notes_list, notes_query, notes_get, notes_create, notes_update, notes_delete,
            notes_snapshot, notes_versions, notes_backlinks,
            folders_list, folders_create, folders_rename, folders_delete,
            tags_list, tags_create, tags_delete, note_tags_set, note_tags_get,
            tasks_list, tasks_create, tasks_update, tasks_delete,
            links_set, links_list,
            open_external,
            sync_all_notes, sync_note_tag_pairs, sync_upsert_note, sync_upsert_folder,
            sync_upsert_tag, sync_upsert_task, sync_upsert_link, sync_link_note_tag,
            clear_local
        ])
        .run(tauri::generate_context!())
        .expect("error al ejecutar GlyPhy");
}
