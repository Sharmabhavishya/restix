-- Events say what kind of ticket they have, and student requests can say it too.
--
-- 1. events.ticket_format: the kind of ticket the whole event uses (wristband, QR, ...). Optional:
--    null means "not set", and sellers pick for themselves. When set, the Sell form starts from it
--    and a seller can still change it for their own listing.
-- 2. event_suggestions.ticket_format and .ticket_types: what the student says the event has, so an
--    approval can publish the event exactly as requested, levels (e.g. Normal, Fan pit) included.
--    Column grants already cover new columns (insert on the whole table for students; events are
--    written by moderators only, as before).

alter table restix.events
  add column if not exists ticket_format text
    check (ticket_format in ('wristband', 'paper', 'qr', 'email', 'app', 'pass', 'token', 'other'));

alter table restix.event_suggestions
  add column if not exists ticket_format text
    check (ticket_format in ('wristband', 'paper', 'qr', 'email', 'app', 'pass', 'token', 'other')),
  add column if not exists ticket_types text[] not null default '{}'
    check (cardinality(ticket_types) <= 12 and char_length(array_to_string(ticket_types, '|')) <= 800);
