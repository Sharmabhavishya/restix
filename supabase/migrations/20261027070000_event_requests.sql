-- Events open by default, and students can request an event in full.
--
-- 1. New events allow resale at any price unless a moderator sets a restriction. Restrictions
--    (face value only, no resale) stay available as an option per event.
-- 2. A student's event request carries what a moderator needs to publish it in one step: the
--    start time, venue and kind of event. Requests stay private until a moderator approves them;
--    approval creates the event (see approveSuggestion in src/server/event-admin.ts).

alter table restix.events alter column transfer_policy set default 'allowed';

alter table restix.event_suggestions
  add column starts_at timestamptz,
  add column venue     text check (char_length(venue) <= 120),
  add column category  text check (category in ('fest', 'concert', 'party', 'prom', 'workshop', 'sports', 'other'));
