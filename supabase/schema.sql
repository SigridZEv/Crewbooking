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
-- Prosjekter
-- Kilden skal etter hvert være Qondor (prosjektnummer + prosjektleder
-- hentes derfra). Inntil da legges de inn manuelt i portalen.
-- ------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_number text default '',          -- Qondor-prosjektnummer
  name text not null,
  client text default '',
  start_date date,
  end_date date,
  project_leader text default '',          -- navn på PL (fra Qondor senere)
  color_index integer default 0,
  qondor_id text default '',               -- teknisk id i Qondor (for synk)
  notes text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table projects add column if not exists client text default '';
alter table projects add column if not exists start_date date;
alter table projects add column if not exists end_date date;
alter table projects add column if not exists project_leader text default '';
alter table projects add column if not exists color_index integer default 0;
alter table projects add column if not exists qondor_id text default '';
alter table projects add column if not exists notes text default '';
alter table projects add column if not exists updated_at timestamptz default now();
alter table projects add column if not exists place text default '';
alter table projects add column if not exists team text default '';
alter table projects add column if not exists status text default '';      -- Confirmed / Pending (fra Qondor)
alter table projects add column if not exists producer text default '';
alter table projects add column if not exists creative text default '';
alter table projects add column if not exists source text default 'manual'; -- manual / qondor
create unique index if not exists projects_qondor_id_unique on projects(qondor_id) where qondor_id <> '';
create unique index if not exists projects_number_unique on projects(project_number) where project_number <> '';

-- Bookinger kobles til prosjekt. Fritekstfeltet 'project' beholdes for
-- visning og for gamle bookinger uten kobling.
alter table bookings add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists bookings_project_id_idx on bookings(project_id);

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
-- Roller: admin (@zevent.no) og crew (egen innlogging)
-- ============================================================
-- user_profiles.role styrer hva en innlogget bruker får se.
--   admin = full tilgang, inkl. timepris og roller (kun ADMIN_EMAILS under)
--   pl    = prosjektleder (@zevent.no og @dsdexplore.no) — alt unntatt å endre timepris
--   crew  = crew-medlem — ser bare egne bookinger og egen profil
alter table user_profiles add column if not exists role text default 'crew';
alter table user_profiles drop constraint if exists user_profiles_role_check;
alter table user_profiles add constraint user_profiles_role_check check (role in ('admin','pl','crew'));

-- Hvem som er admin. Legg til / fjern e-poster her og kjør skjemaet på nytt.
create or replace function role_for_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when lower(p_email) in ('martine.ingeberg@zevent.no', 'sigrid@zevent.no', 'kaja@zevent.no', 'kjetil@dsdexplore.no', 'matias@zevent.no') then 'admin'
    when lower(p_email) like '%@zevent.no' or lower(p_email) like '%@dsdexplore.no' then 'pl'
    else 'crew'
  end;
$$;

-- crew.user_id kobler en crew-person til sin innloggingskonto.
alter table crew add column if not exists user_id uuid references auth.users(id) on delete set null;
create unique index if not exists crew_user_id_unique on crew(user_id) where user_id is not null;

-- Invitasjoner: når/hvem sendte, og når personen fullførte oppsettet (satte passord).
alter table crew add column if not exists invited_at timestamptz;
alter table crew add column if not exists invited_by text;
alter table crew add column if not exists invite_accepted_at timestamptz;

-- Hjelpefunksjoner (security definer så de kan leses uavhengig av RLS).
-- is_admin  = kun admin (timepris, roller)
-- is_staff  = admin eller prosjektleder (alt annet i portalen)
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from user_profiles where id = auth.uid()),
    false
  );
$$;

create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin','pl') from user_profiles where id = auth.uid()),
    false
  );
$$;

-- Hjelpefunksjon: crew-id for innlogget bruker (null hvis ikke koblet)
create or replace function my_crew_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from crew where user_id = auth.uid() limit 1;
$$;

-- Når en ny bruker registrerer seg:
--  1) opprett user_profiles-rad med riktig rolle (admin hvis @zevent.no)
--  2) koble til crew-rad med samme e-post (hvis den finnes og er ukoblet)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text;
begin
  new_role := role_for_email(new.email);

  insert into user_profiles (id, email, role)
  values (new.id, coalesce(new.email, ''), new_role)
  on conflict (id) do update set role = excluded.role;

  if new_role = 'crew' then
    update crew
       set user_id = new.id
     where user_id is null
       and lower(trim(email)) = lower(new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Når en admin legger inn/endrer e-post på en crew-person, koble automatisk
-- hvis det allerede finnes en konto med den e-posten.
create or replace function link_crew_to_existing_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null and new.email is not null and new.email <> '' then
    select u.id into new.user_id
      from auth.users u
      left join crew c on c.user_id = u.id
     where lower(u.email) = lower(trim(new.email))
       and c.id is null
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists on_crew_email_set on crew;
create trigger on_crew_email_set
  before insert or update of email on crew
  for each row execute function link_crew_to_existing_user();

-- Crew får kun endre kontaktfelt på egen rad. Alt annet settes tilbake.
-- Gjelder bare når det er crew-personen selv som lagrer (auth.uid() = egen rad).
-- Admin, SQL Editor og Supabase-dashbordet er ikke berørt.
create or replace function restrict_crew_self_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and auth.uid() = old.user_id and not is_staff() then
    new.name := old.name;
    new.initials := old.initials;
    new.rate := old.rate;
    new.color_index := old.color_index;
    new.bio := old.bio;
    new.jobs := old.jobs;
    new.birthdate := old.birthdate;
    new.notes := old.notes;
    new.employment_form := old.employment_form;
    new.category := old.category;
    new.is_new := old.is_new;
    new.has_contract := old.has_contract;
    new.has_office_key := old.has_office_key;
    new.has_warehouse_intro := old.has_warehouse_intro;
    new.has_sweater := old.has_sweater;
    new.has_tshirt := old.has_tshirt;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.invited_at := old.invited_at;
    new.invited_by := old.invited_by;
  end if;
  return new;
end;
$$;

drop trigger if exists on_crew_self_update on crew;
create trigger on_crew_self_update
  before update on crew
  for each row execute function restrict_crew_self_update();

-- Kun admin kan sette/endre timepris. Prosjektledere (og crew) får ikke røre den.
-- SQL Editor / dashbord (auth.uid() er null) er ikke berørt.
create or replace function protect_crew_rate()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if tg_op = 'UPDATE' then
      new.rate := old.rate;
    else
      new.rate := 0;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_crew_rate_change on crew;
create trigger on_crew_rate_change
  before insert or update on crew
  for each row execute function protect_crew_rate();

-- Backfill for eksisterende brukere (trygt å kjøre flere ganger)
insert into user_profiles (id, email, role)
select u.id, coalesce(u.email, ''), role_for_email(u.email)
  from auth.users u
 where not exists (select 1 from user_profiles p where p.id = u.id);

-- Sett riktig rolle på alle eksisterende brukere ut fra e-post
update user_profiles p
   set role = role_for_email(u.email)
  from auth.users u
 where u.id = p.id
   and p.role <> role_for_email(u.email);

update crew c
   set user_id = u.id
  from auth.users u
 where c.user_id is null
   and c.email <> ''
   and lower(trim(c.email)) = lower(u.email)
   and role_for_email(u.email) = 'crew'
   and not exists (select 1 from crew c2 where c2.user_id = u.id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table crew enable row level security;
alter table skills enable row level security;
alter table bookings enable row level security;
alter table user_profiles enable row level security;
alter table crew_comments enable row level security;
alter table projects enable row level security;

-- Fjern gamle policies (både gamle og nye navn) for å være idempotent
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

drop policy if exists "admin_all_crew" on crew;
drop policy if exists "crew_read_self" on crew;
drop policy if exists "crew_update_self" on crew;
drop policy if exists "admin_all_skills" on skills;
drop policy if exists "crew_read_own_skills" on skills;
drop policy if exists "crew_insert_own_allergy" on skills;
drop policy if exists "crew_update_own_allergy" on skills;
drop policy if exists "crew_delete_own_allergy" on skills;
drop policy if exists "admin_all_bookings" on bookings;
drop policy if exists "crew_read_own_bookings" on bookings;
drop policy if exists "crew_insert_own_unavailable" on bookings;
drop policy if exists "crew_update_own_unavailable" on bookings;
drop policy if exists "crew_delete_own_unavailable" on bookings;
drop policy if exists "admin_read_profiles" on user_profiles;
drop policy if exists "user_read_own_profile" on user_profiles;
drop policy if exists "user_update_own_profile" on user_profiles;
drop policy if exists "user_insert_own_profile" on user_profiles;
drop policy if exists "admin_all_comments" on crew_comments;
drop policy if exists "admin_read_comments" on crew_comments;
drop policy if exists "admin_insert_comments" on crew_comments;
drop policy if exists "author_delete_comments" on crew_comments;
drop policy if exists "Innloggede kan lese prosjekter" on projects;
drop policy if exists "Eier kan endre egne prosjekter" on projects;
drop policy if exists "staff_all_projects" on projects;

-- ---- crew ----
create policy "admin_all_crew" on crew
  for all using (is_staff()) with check (is_staff());

create policy "crew_read_self" on crew
  for select using (user_id = auth.uid());

-- (kolonner begrenses av trigger restrict_crew_self_update)
create policy "crew_update_self" on crew
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- skills ----
create policy "admin_all_skills" on skills
  for all using (is_staff()) with check (is_staff());

-- Crew ser egne ferdigheter og allergi, men ikke sertifikat-/interne rader
create policy "crew_read_own_skills" on skills
  for select using (crew_id = my_crew_id());

-- Crew kan kun legge til / endre / slette sin egen allergi-rad
create policy "crew_insert_own_allergy" on skills
  for insert with check (crew_id = my_crew_id() and name like 'Allergi:%');

create policy "crew_update_own_allergy" on skills
  for update using (crew_id = my_crew_id() and name like 'Allergi:%')
  with check (crew_id = my_crew_id() and name like 'Allergi:%');

create policy "crew_delete_own_allergy" on skills
  for delete using (crew_id = my_crew_id() and name like 'Allergi:%');

-- ---- bookings ----
create policy "admin_all_bookings" on bookings
  for all using (is_staff()) with check (is_staff());

create policy "crew_read_own_bookings" on bookings
  for select using (crew_id = my_crew_id());

-- Crew kan markere seg "Ikke tilgjengelig" på ledige dager, og angre det.
-- De kan aldri røre dager som er Booket eller Forespurt.
create policy "crew_insert_own_unavailable" on bookings
  for insert with check (crew_id = my_crew_id() and status = 'unavailable');

create policy "crew_update_own_unavailable" on bookings
  for update using (crew_id = my_crew_id() and status in ('free','unavailable'))
  with check (crew_id = my_crew_id() and status in ('free','unavailable'));

create policy "crew_delete_own_unavailable" on bookings
  for delete using (crew_id = my_crew_id() and status in ('free','unavailable'));

-- ---- user_profiles ----
create policy "admin_read_profiles" on user_profiles
  for select using (is_staff());

create policy "user_read_own_profile" on user_profiles
  for select using (auth.uid() = id);

create policy "user_insert_own_profile" on user_profiles
  for insert with check (auth.uid() = id);

-- Egen profil kan endres (rollen beskyttes av trigger under)
create policy "user_update_own_profile" on user_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Ingen kan endre sin egen rolle — kun admin kan endre roller.
-- SQL Editor / dashbord (auth.uid() er null) er ikke berørt.
create or replace function protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and new.role <> old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_role_change on user_profiles;
create trigger on_profile_role_change
  before update on user_profiles
  for each row execute function protect_profile_role();

-- ---- crew_comments: kun admin, og bare forfatter kan slette ----
create policy "admin_read_comments" on crew_comments
  for select using (is_staff());

create policy "admin_insert_comments" on crew_comments
  for insert with check (is_staff() and author_id = auth.uid());

create policy "author_delete_comments" on crew_comments
  for delete using (is_staff() and author_id = auth.uid());

-- ---- projects: alle prosjektledere/admin kan lese og endre ----
create policy "staff_all_projects" on projects
  for all using (is_staff()) with check (is_staff());

-- ============================================================
-- Eksempeldata (valgfritt — slett hvis du vil starte tomt)
-- ============================================================
-- Legges kun inn hvis crew-tabellen er helt tom (unngår duplikater ved ny kjøring)
insert into crew (name, initials, rate, color_index, bio, jobs)
select * from (values
  ('Sara Haugen',  'SH', 650, 0, '10 år erfaring innen TV-produksjon og reklame.', 47),
  ('Magnus Lie',   'ML', 580, 1, 'Lydtekniker med bakgrunn fra musikkindustrien.', 61),
  ('Thea Bakke',   'TB', 620, 2, 'Kreativ lysdesigner med erfaring fra store festivaler.', 38)
) as v(name, initials, rate, color_index, bio, jobs)
where not exists (select 1 from crew);
