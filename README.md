# GlyPhy

> Gestión avanzada de notas y tareas con **conocimiento conectado**. Una mezcla
> entre Notion, Obsidian y un gestor de tareas moderno — con identidad propia,
> tema oscuro premium y acento morado.

Aplicación de escritorio **multiplataforma** (Windows 10/11 y Arch Linux)
construida con **Tauri 2 + React + TypeScript + SQLite**. Ligera (~30–60 MB de
RAM), binarios nativos pequeños y arranque instantáneo.

---

## ✨ Características implementadas

### Notas
- Crear, editar y eliminar notas con **editor de bloques** estilo Notion/Logseq.
- Atajos Markdown en vivo: `# ` título, `## ` subtítulo, `- ` lista, `1. `
  numerada, `[] ` tarea, `> ` cita, ` ``` ` código, `--- ` separador.
- **Texto enriquecido**: negrita `**`, cursiva `*`, subrayado `++`, tachado `~~`,
  resaltado `==`, código `` ` `` e **hiperenlaces** `[texto](url)` clicables que
  abren el navegador del sistema. Barra de formato flotante al seleccionar texto
  y atajos `Ctrl+B/I/U/E/K/H`. Vista renderizada al salir del bloque.
- **Autoguardado** con _debounce_ (no hay botón de guardar).
- Iconos/emoji por nota, favoritos, archivado y papelera.
- **Historial de versiones** (snapshot automático al archivar/eliminar).
- **Arrastrar y soltar** (basado en puntero, compatible con WebKitGTK): mover
  tareas entre columnas Kanban, notas a carpetas y etiquetas sobre notas.

### Conocimiento conectado
- **Enlaces bidireccionales** con sintaxis `[[Título de otra nota]]`.
- **Backlinks** (relaciones entrantes) en el panel contextual.
- **Knowledge Graph** interactivo: simulación de fuerzas en SVG, nodos
  arrastrables, tamaño por nº de conexiones, clic para abrir.

### Tareas
- Estados: Pendiente · En progreso · Completada · Archivada.
- Prioridades (clic para ciclar), fechas de vencimiento, vínculo a notas.
- **Vista Kanban** con _drag & drop_ entre columnas.
- **Vista Lista** y **Vista Calendario** mensual.

### Organización y búsqueda
- Carpetas, etiquetas con colores, favoritos, recientes, archivados, papelera.
- **`Ctrl/Cmd + P`** — paleta de comandos y búsqueda global (notas, tareas,
  carpetas, etiquetas, comandos) con navegación por teclado.
- **`Ctrl/Cmd + F`** — búsqueda dentro de la nota actual con contador y
  navegación entre coincidencias.
- **`Ctrl/Cmd + N`** nueva nota · **`Ctrl/Cmd + B`** alternar sidebar.

### Diseño
- Tema oscuro profundo + morado, alto contraste, animaciones suaves.
- Sidebar, editor central y panel contextual (propiedades/relaciones/historial).

---

## 🚀 Puesta en marcha

### Requisitos
- **Node.js** ≥ 18 y **Rust** ≥ 1.77 (`cargo`).
- **Linux (Arch):** instala la dependencia de sistema de WebView una vez:
  ```bash
  sudo pacman -S webkit2gtk-4.1
  ```
  (GTK3 ya suele estar presente.) En **Windows** no hace falta nada extra
  (usa WebView2, incluido en Windows 10/11).

### Desarrollo nativo (app de escritorio real, con SQLite)
```bash
npm install
npm run app:dev      # = tauri dev
```

### Compilar instaladores nativos
```bash
npm run app:build    # genera .deb/.AppImage (Linux) y .msi/.exe (Windows)
```

### Previsualización en navegador (sin compilar Rust)
La app detecta si corre fuera de Tauri y usa un **backend simulado** persistido
en `localStorage`, por lo que es totalmente funcional para previsualizar la UI:
```bash
npm install
npm run dev          # http://localhost:1420
```

---

## 🏗️ Arquitectura

```
glyphy/
├─ src/                      # Frontend React + TypeScript
│  ├─ components/            # Sidebar, TopBar, BlockEditor, CommandPalette,
│  │                         #   NoteSearch, ContextPanel, Icons
│  ├─ views/                 # NotesView, TasksView (Kanban/Lista/Calendario), GraphView
│  ├─ state/store.ts         # Estado global (Zustand)
│  ├─ lib/                   # api.ts (puente Tauri), types.ts, mockBackend.ts
│  └─ styles/                # Sistema de diseño (variables + componentes)
└─ src-tauri/                # Backend Rust
   ├─ src/db.rs              # Capa SQLite: notas, carpetas, etiquetas, tareas,
   │                         #   enlaces (grafo), versiones  ← lógica verificada
   ├─ src/lib.rs             # Comandos Tauri (invoke handlers)
   └─ tauri.conf.json        # Configuración de ventana/bundle
```

El frontend habla con el backend mediante `invoke()` (capa `src/lib/api.ts`).
La misma superficie de API tiene una implementación simulada (`mockBackend.ts`)
para el modo navegador. Cambiar a la app nativa **no requiere tocar la UI**.

### Base de datos (SQLite)
`notes`, `folders` (anidadas), `tags` + `note_tags`, `tasks`, `links`
(grafo de conocimiento), `versions` (historial). WAL activado, índices en las
claves de búsqueda y _foreign keys_ con borrado en cascada.

---

## ☁️ Sincronización en la nube (Supabase)

GlyPhy sincroniza notas, tareas, carpetas, etiquetas y enlaces entre
dispositivos usando **Supabase** (Postgres + Auth + Realtime). SQLite sigue
siendo la fuente local (modo offline); los cambios se publican a Supabase y se
reciben en tiempo real. Resolución de conflictos *last-write-wins* por
`updated_at`.

**Activarla (una sola vez):**
1. Crea un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](supabase/schema.sql)
   (crea las tablas con Row Level Security y habilita Realtime).
3. En **Project Settings → API**, copia la **Project URL** y la **anon key**.
4. En GlyPhy, pulsa el pie de la barra lateral → pega URL y anon key →
   **Conectar proyecto** → crea tu cuenta o inicia sesión.

A partir de ahí la sincronización es automática y en segundo plano. El estado
(Conectado / Sincronizando / Sincronizado ✓) se muestra en la barra lateral.

## 🗺️ Roadmap (siguiente fase)

- **Colaboración multiusuario** en tiempo real: espacios compartidos y permisos
  por usuario (la base con Supabase Auth + Realtime ya está puesta).
- **Sincronización de borrados** mediante *tombstones* (hoy se propagan altas y
  ediciones; el borrado de notas se refleja vía `is_trashed`).
- **Cifrado en reposo** (SQLCipher) y adjuntos de archivos/imágenes.
- Sistema de plugins y extensiones.

---

## ✅ Estado de verificación

- Frontend: `tsc` + `vite build` sin errores.
- Backend Rust: compila completo (`cargo build`) y la app **nativa arranca con
  SQLite real** (verificado en Arch/Hyprland).
- Drag & drop por puntero verificado (mover tarea entre columnas sin congelar).
- Texto enriquecido verificado (negrita/cursiva/enlace/resaltado se renderizan).
- Sincronización en la nube: capa cliente + esquema listos; requiere conectar tu
  proyecto Supabase (URL + anon key) para activarse.
- Instaladores: `.deb` generado; el binario release pesa ~5 MB. El AppImage
  requiere FUSE en el sistema de empaquetado.
# GlyPhy
