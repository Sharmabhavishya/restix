-- Names come from the college Google account and can't be edited by students.
-- The server sets them at sign-in (asSystem); clients lose the column grant.
revoke update (display_name) on restix.profiles from authenticated;
