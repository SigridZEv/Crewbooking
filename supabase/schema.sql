-- ============================================================
-- CREW BOOKING — Supabase SQL
-- Kjør dette i Supabase Dashboard → SQL Editor
-- ============================================================

-- Crew-tabell
create table if not exists crew (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  initials text not null,
  rate integer not null,
  color_index integer default 0,
  bio text default '',
  jobs integer default 0,
  created_at timestamptz default now()
);

-- Ferdigheter per crew-person
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crew(id) on delete cascade,
  name text not null,
  comment text default '',
  created_at timestamptz default now()
);

-- Bookingstatus per crew per dag
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid references crew(id) on delete cascade,
  date date not null,
  status text check (status in ('free','booked','requested','unavailable')) default 'free',
  created_at timestamptz default now(),
  unique(crew_id, date)
);

-- Aktiver Row Level Security
alter table crew enable row level security;
alter table skills enable row level security;
alter table bookings enable row level security;

-- Alle innloggede brukere kan lese og skrive
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

-- Eksempeldata (valgfritt — slett hvis du vil starte tomt)
insert into crew (name, initials, rate, color_index, bio, jobs) values
  ('Sara Haugen',  'SH', 650, 0, '10 år erfaring innen TV-produksjon og reklame.', 47),
  ('Magnus Lie',   'ML', 580, 1, 'Lydtekniker med bakgrunn fra musikkindustrien.', 61),
  ('Thea Bakke',   'TB', 620, 2, 'Kreativ lysdesigner med erfaring fra store festivaler.', 38);
