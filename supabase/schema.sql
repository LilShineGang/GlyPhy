-- ============================================================
-- GlyPhy — Esquema de Supabase (Postgres)
-- Ejecuta este SQL en el editor SQL de tu proyecto Supabase.
-- Crea las tablas de sincronización con Row Level Security (RLS)
-- para que cada usuario solo acceda a sus propios datos.
-- ============================================================

-- Notas
create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '[]',
  folder_id uuid,
  icon text,
  is_favorite boolean not null default false,
  is_trashed boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.folders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid,
  color text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  updated_at timestamptz not null default now()
);

create table if not exists public.note_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  tag_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (note_id, tag_id)
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  note_id uuid,
  status text not null default 'pending',
  priority text not null default 'none',
  due_date timestamptz,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null,
  target_note_id uuid not null,
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.notes enable row level security;
alter table public.folders enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
alter table public.tasks enable row level security;
alter table public.links enable row level security;

-- Política reutilizable: el usuario solo ve/edita filas con su user_id.
do $$
declare t text;
begin
  foreach t in array array['notes','folders','tags','note_tags','tasks','links'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($f$
      create policy "own rows" on public.%I
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id)
    $f$, t);
  end loop;
end $$;

-- ---------- Realtime ----------
-- Habilita las notificaciones en tiempo real para sincronización multidispositivo.
alter publication supabase_realtime add table
  public.notes, public.folders, public.tags, public.note_tags, public.tasks, public.links;
