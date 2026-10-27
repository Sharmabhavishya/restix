-- Cover images for events, uploaded by moderators.
--
-- Stored in the database (one small WebP per event, made server-side by sharp, metadata
-- stripped), so they work the same on the local database and on a free-tier deployment with no
-- separate file storage. A tiny blurred copy rides along as a data URL for the placeholder.
-- Served by src/app/event-cover/[id]/route.ts to signed-in students of the same college.

create table restix.event_covers (
  event_id    uuid primary key references restix.events(id) on delete cascade,
  image       bytea not null check (octet_length(image) between 100 and 1500000),
  width       integer not null check (width between 1 and 4000),
  height      integer not null check (height between 1 and 4000),
  blur        text not null check (blur like 'data:image/webp;base64,%' and char_length(blur) <= 4000),
  version     integer not null default 1,
  updated_by  uuid references restix.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table restix.event_covers enable row level security;

create policy event_covers_read on restix.event_covers for select to authenticated
  using (restix.event_college(event_id) = restix.my_college_id());
create policy event_covers_insert on restix.event_covers for insert to authenticated
  with check (restix.moderates(restix.event_college(event_id)));
create policy event_covers_update on restix.event_covers for update to authenticated
  using (restix.moderates(restix.event_college(event_id)))
  with check (restix.moderates(restix.event_college(event_id)));
create policy event_covers_delete on restix.event_covers for delete to authenticated
  using (restix.moderates(restix.event_college(event_id)));

grant select, insert, update, delete on restix.event_covers to authenticated;
