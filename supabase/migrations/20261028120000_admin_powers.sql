-- Admin powers: admins can delete events outright, and two more kinds of entry in the audit log.
--
-- Only an active admin of the event's own college can delete it; moderators can't. Deleting an
-- event cascades to its ticket types, listings, requests, offers, saves, wants and cover
-- (existing foreign keys). Reports, appeals and audit entries keep their rows with the link
-- cleared, so moderation history survives.

grant delete on restix.events to authenticated;
drop policy if exists events_delete on restix.events;
create policy events_delete on restix.events for delete to authenticated
  using (restix.administers(college_id));

alter table restix.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table restix.moderation_actions add constraint moderation_actions_action_check
  check (action in ('approve_listing', 'reject_listing', 'hide_listing', 'restore_listing',
                    'remove_listing', 'restrict_user', 'suspend_user', 'reinstate_user',
                    'resolve_report', 'dismiss_report', 'start_review',
                    'update_event', 'create_event', 'decide_appeal',
                    'grant_role', 'revoke_role',
                    'delete_event', 'export_users'));
