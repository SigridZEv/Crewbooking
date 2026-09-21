-- Invitasjoner til crew (kjøres én gang i Supabase SQL Editor; schema.sql har det samme)
alter table crew add column if not exists invited_at timestamptz;
alter table crew add column if not exists invited_by text;
alter table crew add column if not exists invite_accepted_at timestamptz;

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
