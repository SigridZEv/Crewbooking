-- ============================================================
-- CREW BOOKING — Supabase SQL
-- Kjør dette i Supabase Dashboard → SQL Editor
--
-- Skjemaet er idempotent — det er trygt å kjøre om igjen
-- (eksisterende tabeller, kolonner og policies blir ikke
-- rørt hvis de allerede finnes).
-- ============================================================

-- ------------------------------------------------------------
-- Crew (frilansere som kan bookes)
-- ------------------------------------------------------------
create table if not exists crew (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  rate integer not null,
  color_index integer default 0,
  bio text default '',
  jobs integer default 0,
  birthdate date,
  location text default '',
  notes text default '',
  created_at timestamptz default now()
);

-- Sørg for at eldre installasjoner får de nye kolonnene
alter table crew add column if not exists birthdate date;
alter table crew add column if not exists location text default '';
alter table crew add column if not exists notes text default '';
alter table crew add column if not exists phone text default '';
alter table crew add column if not exists email text default '';
alter table crew add column if not exists employment_form text default '';
-- category: Erfarne / Uerfarne / Utenfor Oslo / Fast jobb / Ekstern (eller annet)
alter table crew add column if not exists category text default '';
-- is_new: flagget for nye crew (uavhengig av kategori)
alter table crew add column if not exists is_new boolean default false;
-- Onboarding-sjekkliste
alter table crew add column if not exists has_contract boolean default false;
alter table crew add column if not exists has_office_key boolean default false;
alter table crew add column if not exists has_warehouse_intro boolean default false;
alter table crew add column if not exists has_sweater boolean default false;
alter table crew add column if not exists has_tshirt boolean default false;

-- ------------------------------------------------------------
-- Skills / Allergier / Sertifikater per crew-person
-- (skills-tabellen brukes også til Allergi: og Sertifikat:
--  via name-prefiks — sjekk koden i BookingPage.js)
-- ------------------------------------------------------------
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crew(id) on delete cascade,
  name text not null,
  comment text default '',
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Bookingstatus per crew per dag
-- ------------------------------------------------------------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crew(id) on delete cascade,
  date date not null,
  status text check (status in ('free','booked','requested','unavailable')) default 'free',
  project text default '',
  booked_by text default '',
  created_at timestamptz default now(),
  unique(crew_id, date)
);

alter table bookings add column if not exists project text default '';
alter table bookings add column if not exists booked_by text default '';

-- ------------------------------------------------------------
-- Prosjekter (eid av en prosjektleder/bruker)
-- ------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  project_number text default '',
  project_name text not null,
  created_at timestamptz default now()
);

-- Bookings får en valgfri kobling til et prosjekt (i tillegg til det eksisterende
-- fritekst-feltet 'project' som beholdes for bakoverkompatibilitet).
alter table bookings add column if not exists project_id uuid references projects(id) on delete set null;

-- ------------------------------------------------------------
-- Brukerprofiler (innloggede brukere — separat fra crew)
-- ------------------------------------------------------------
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text default '',
  title text default '',
  phone text default '',
  email text default '',
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Kommentarer på crew-personer (skrevet av innloggede brukere)
-- ------------------------------------------------------------
create table if not exists crew_comments (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crew(id) on delete cascade,
  author text default 'Ukjent',
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table crew enable row level security;
alter table skills enable row level security;
alter table bookings enable row level security;
alter table user_profiles enable row level security;
alter table crew_comments enable row level security;
alter table projects enable row level security;

-- Drop + recreate policies for å være idempotent
drop policy if exists "Innloggede brukere kan lese crew" on crew;
drop policy if exists "Innloggede brukere kan endre crew" on crew;
drop policy if exists "Innloggede brukere kan lese skills" on skills;
drop policy if exists "Innloggede brukere kan endre skills" on skills;
drop policy if exists "Innloggede brukere kan lese bookings" on bookings;
drop policy if exists "Innloggede brukere kan endre bookings" on bookings;
drop policy if exists "Innloggede brukere kan lese profiles" on user_profiles;
drop policy if exists "Brukere kan endre egen profil" on user_profiles;
drop policy if exists "Innloggede brukere kan lese kommentarer" on crew_comments;
drop policy if exists "Innloggede brukere kan skrive kommentarer" on crew_comments;
drop policy if exists "Forfatter kan slette egen kommentar" on crew_comments;
drop policy if exists "Innloggede kan lese prosjekter" on projects;
drop policy if exists "Eier kan endre egne prosjekter" on projects;

create policy "Innloggede brukere kan lese crew" on crew
  for select using (auth.role() = 'authenticated');

create policy "Innloggede brukere kan endre crew" on crew
  for all using (auth.role() = 'authenticated');

create policy "Innloggede brukere kan lese skills" on skills
  for select using (auth.role() = 'authenticated');

create policy "Innloggede brukere kan endre skills" on skills
  for all using (auth.role() = 'authenticated');

create policy "Innloggede brukere kan lese bookings" on bookings
  for select using (auth.role() = 'authenticated');

create policy "Innloggede brukere kan endre bookings" on bookings
  for all using (auth.role() = 'authenticated');

-- user_profiles: alle innloggede kan lese, men kun eier kan endre sin
create policy "Innloggede brukere kan lese profiles" on user_profiles
  for select using (auth.role() = 'authenticated');

create policy "Brukere kan endre egen profil" on user_profiles
  for all using (auth.uid() = id);

-- crew_comments: alle innloggede kan lese og skrive, men kun forfatter kan slette
create policy "Innloggede brukere kan lese kommentarer" on crew_comments
  for select using (auth.role() = 'authenticated');

create policy "Innloggede brukere kan skrive kommentarer" on crew_comments
  for insert with check (auth.role() = 'authenticated');

create policy "Forfatter kan slette egen kommentar" on crew_comments
  for delete using (auth.uid() = author_id);

-- Prosjekter: alle innloggede kan lese alle prosjekter (slik at en kollegas
-- bookede prosjekt-navn vises overalt), men kun eieren kan endre sine egne.
create policy "Innloggede kan lese prosjekter" on projects
  for select using (auth.role() = 'authenticated');

create policy "Eier kan endre egne prosjekter" on projects
  for all using (auth.uid() = owner_id);

-- ============================================================
-- Eksempeldata (valgfritt — slett hvis du vil starte tomt)
-- ============================================================
insert into crew (name, initials, rate, color_index, bio, jobs) values
  ('Sara Haugen',  'SH', 650, 0, '10 år erfaring innen TV-produksjon og reklame.', 47),
  ('Magnus Lie',   'ML', 580, 1, 'Lydtekniker med bakgrunn fra musikkindustrien.', 61),
  ('Thea Bakke',   'TB', 620, 2, 'Kreativ lysdesigner med erfaring fra store festivaler.', 38)
on conflict do nothing;
