-- Students can suggest an event that isn't listed yet; moderators of their college review it.
-- A suggestion never creates an event by itself: a moderator adds the event (with a resale
-- policy and its source) and marks the suggestion done.

create table restix.event_suggestions (
  id            uuid primary key default gen_random_uuid(),
  college_id    uuid not null references restix.colleges(id),
  suggested_by  uuid references restix.profiles(id) on delete set null,
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  happens_on    date,
  details       text check (char_length(details) <= 1000),
  status        text not null default 'open' check (status in ('open', 'added', 'declined')),
  moderator_note text check (char_length(moderator_note) <= 500),
  event_id      uuid references restix.events(id) on delete set null,
  decided_by    uuid references restix.profiles(id) on delete set null,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index event_suggestions_queue on restix.event_suggestions (college_id, status, created_at);

-- The college always comes from the suggester's profile.
create or replace function restix.prepare_event_suggestion() returns trigger
language plpgsql security definer set search_path = restix, pg_temp as $$
begin
  new.college_id := restix.user_college(new.suggested_by);
  if new.college_id is null then
    raise exception 'unknown college' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger event_suggestions_prepare before insert on restix.event_suggestions
  for each row execute function restix.prepare_event_suggestion();

alter table restix.event_suggestions enable row level security;

create policy event_suggestions_read on restix.event_suggestions for select to authenticated
  using (suggested_by = auth.uid() or restix.moderates(college_id));
create policy event_suggestions_insert on restix.event_suggestions for insert to authenticated
  with check (
    suggested_by = auth.uid() and restix.is_eligible() and status = 'open'
    and moderator_note is null and event_id is null and decided_by is null and decided_at is null
  );
create policy event_suggestions_update on restix.event_suggestions for update to authenticated
  using (restix.moderates(college_id)) with check (restix.moderates(college_id));

grant select, insert on restix.event_suggestions to authenticated;
grant update (status, moderator_note, event_id, decided_by, decided_at) on restix.event_suggestions to authenticated;
