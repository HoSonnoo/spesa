-- ============================================================
--  SPESA — Schema Supabase
--  Incolla questo nell'editor SQL di Supabase ed esegui.
--  Modello: ogni utente ha la sua lista base (sezioni →
--  sottosezioni → articoli) + sessioni di spesa temporanee.
-- ============================================================

-- ---------- 1. SEZIONI (es. "Frutta e Verdura") ----------
create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  emoji       text default '📦',
  position    int  not null default 0,        -- ordinamento manuale
  created_at  timestamptz default now()
);

-- ---------- 2. SOTTOSEZIONI (es. "Frutta", "Verdura") ----------
-- name può essere '' (sezione senza sottocategorie)
create table public.subsections (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.sections(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default '',
  position    int  not null default 0,
  created_at  timestamptz default now()
);

-- ---------- 3. ARTICOLI DELLA LISTA BASE ----------
-- Questi NON contengono lo stato "selezionato/comprato":
-- quello vive nella sessione, così la lista base resta pulita.
create table public.items (
  id             uuid primary key default gen_random_uuid(),
  subsection_id  uuid not null references public.subsections(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  position       int  not null default 0,
  created_at     timestamptz default now()
);

-- ---------- 4. SESSIONI DI SPESA ----------
create table public.shopping_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'active',   -- 'active' | 'completed'
  created_at   timestamptz default now(),
  completed_at timestamptz
);

-- ---------- 5. ARTICOLI DELLA SESSIONE (lista temporanea) ----------
-- Snapshot del nome al momento della selezione: se poi modifichi
-- la lista base, lo storico della spesa resta coerente.
create table public.session_items (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.shopping_sessions(id) on delete cascade,
  item_id      uuid references public.items(id) on delete set null,  -- può diventare null se l'articolo base viene eliminato
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,        -- snapshot del nome
  section_name text not null,        -- snapshot del reparto (per il raggruppamento)
  bought       boolean not null default false,
  created_at   timestamptz default now()
);

-- ---------- INDICI utili ----------
create index on public.subsections (section_id);
create index on public.items (subsection_id);
create index on public.session_items (session_id);

-- ============================================================
--  ROW LEVEL SECURITY
--  Ogni utente vede e modifica SOLO i propri dati.
-- ============================================================
alter table public.sections          enable row level security;
alter table public.subsections       enable row level security;
alter table public.items             enable row level security;
alter table public.shopping_sessions enable row level security;
alter table public.session_items     enable row level security;

-- Una policy "tutto sui propri dati" per ciascuna tabella.
-- (auth.uid() = il proprietario)
create policy "own_sections"   on public.sections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_subsections" on public.subsections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_items"      on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_sessions"   on public.shopping_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_session_items" on public.session_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  REALTIME (sync in tempo reale tra dispositivi)
--  Aggiunge le tabelle alla pubblicazione realtime di Supabase.
-- ============================================================
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.session_items;
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.subsections;

-- ============================================================
--  MIGRAZIONE — Quantità per articolo
--  Eseguire nell'editor SQL di Supabase se il DB esiste già.
-- ============================================================
alter table public.items
  add column if not exists default_quantity integer not null default 1;

alter table public.session_items
  add column if not exists quantity integer not null default 1;

-- ============================================================
--  SEED (opzionale) — lista base di partenza per il primo utente.
--  Esegui DOPO esserti registrato, sostituendo l'UID sotto con
--  il tuo (lo trovi in Authentication → Users).
--  Lasciato commentato di default.
-- ============================================================
-- do $$
-- declare uid uuid := 'IL-TUO-USER-ID-QUI';
-- declare s_fv uuid; declare sub uuid;
-- begin
--   insert into sections(user_id,name,emoji,position) values (uid,'Frutta e Verdura','🥬',0) returning id into s_fv;
--   insert into subsections(section_id,user_id,name,position) values (s_fv,uid,'Frutta',0) returning id into sub;
--   insert into items(subsection_id,user_id,name,position) values
--     (sub,uid,'Mele',0),(sub,uid,'Banane',1),(sub,uid,'Limoni',2);
-- end $$;
