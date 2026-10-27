# Deployment

**Status:** ResTix has not been deployed by the build process, and real Google sign-in has
not been exercised (no credentials were available). Everything below is the procedure; each
step says how to verify it. Plan details were checked against vendor docs on 27 October 2026.

## 0. Choose hosting honestly

| Piece | Suggested | Free-tier facts that matter |
| --- | --- | --- |
| Database + Auth | Supabase Free | 500 MB database, 50,000 monthly active users, 5 GB egress. **Free projects pause after 1 week of inactivity.** **No automatic backups** on Free (see section 8). 2 active free projects. |
| App | Vercel Hobby, *if eligible* | Hobby is "non-commercial, personal use only". Vercel's definition of commercial use includes "advertising the sale of a product or service". ResTix charges nothing and processes no payments, but its listings advertise students' tickets for sale, so **ask Vercel support before launching on Hobby**, or use a host whose free tier allows this, or Vercel Pro. Cron jobs on Hobby run at most daily (ResTix needs one daily job). |

Sources: vercel.com/docs/plans/hobby, vercel.com/docs/limits/fair-use-guidelines, supabase.com/pricing.

## 1. Environment variables

See `.env.example`. Production values:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler** string (port 6543), user `postgres.<ref>`, with the DB password |
| `DB_POOL_MAX` | `3`-`5` (serverless instances each open their own pool) |
| `APP_URL` | `https://your-domain` (no trailing slash) |
| `AUTH_MODE` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the project's publishable key (`sb_publishable_...`) |
| `ALLOWED_EMAIL_DOMAINS` | the verified institutional domain(s), e.g. `snu.edu.in` |
| `DEFAULT_COLLEGE_SLUG` | e.g. `snu` |
| `CRON_SECRET` | 32+ random characters |

Never set `DEV_AUTH_SECRET` or `RESTIX_LOCAL_PROD_TEST` in production. Dev sign-in is also
refused whenever `NODE_ENV=production` or `VERCEL` is set, as a second guard.

## 2. Supabase project

1. Create a project (region: Mumbai, `ap-south-1`, for campus latency).
2. Apply migrations from your machine, using the **session pooler or direct** connection
   (DDL is more reliable outside transaction mode):
   ```bash
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" npm run db:migrate
   ```
3. Verify the server's role can act as a user (RLS depends on it):
   ```sql
   select pg_has_role('postgres', 'authenticated', 'member');  -- must be true
   select tableowner from pg_tables where schemaname = 'restix' limit 1;  -- postgres
   ```
4. **Data API:** Settings > API > Exposed schemas must NOT include `restix` (default is
   `public, graphql_public`). This keeps the tables unreachable with the public key.
5. Register the college:
   ```bash
   DATABASE_URL=... npm run college:add -- --slug snu --name "Shiv Nadar University" --short SNU --domain snu.edu.in
   ```
   Confirm the official name and domain with the institution first.

## 3. Google OAuth client

1. Google Cloud console > APIs & Services > Google Auth Platform > Clients > Create client >
   **Web application**.
2. Authorised JavaScript origins: `https://your-domain` (and `http://localhost:3000` only while testing).
3. Authorised redirect URIs: `https://<ref>.supabase.co/auth/v1/callback` (shown on Supabase's
   Google provider page).
4. Consent screen scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. No
   sensitive scopes, so no Google verification review should be needed.
5. Audience: if the institution's Google Workspace admin creates the client inside the
   institution's Workspace, choose **Internal** (only institution accounts can even reach the
   consent screen). Otherwise **External**; ResTix still rejects other domains itself.
6. Workspace policies can block third-party apps. If sign-in shows "access blocked", the
   Workspace admin must allow the OAuth client (Admin console > Security > API controls).
   Do not weaken ResTix's domain check to work around this.

## 4. Supabase Auth

1. Authentication > Providers > Google: enable, paste the client ID and secret.
2. Authentication > URL configuration: Site URL `https://your-domain`; Redirect URLs add
   `https://your-domain/auth/callback`.
3. Optional hardening: reject other domains before an auth user is even created, with a
   "Before User Created" hook (Authentication > Hooks), for example:
   ```sql
   create or replace function public.restix_before_user_created(event jsonb) returns jsonb
   language plpgsql as $$
   begin
     if split_part(lower(event->'user'->>'email'), '@', 2) <> all (array['snu.edu.in']) then
       return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Use your college account'));
     end if;
     return '{}'::jsonb;
   end $$;
   ```
   ResTix enforces the same rule on every request regardless; the hook only keeps stray
   accounts out of `auth.users`. Keep its domain list in sync with `ALLOWED_EMAIL_DOMAINS`.
4. Consider a session time-box (Authentication > Sessions) if available on your plan, so an
   account that loses access to its institutional mailbox is signed out sooner.

## 5. Deploy the app

Vercel (if eligible) or any Node 20.9+ host:
```bash
npm ci && npm run build && npm start   # generic Node host
```
Set the environment variables, deploy, then open `https://your-domain/sign-in` and sign in with
an institutional account. Expected: Google account chooser (pre-filtered to the domain when one
domain is configured) -> back to ResTix -> "you're in. one sec." welcome page.

Verify the rejection path too: a personal Gmail must land on "That college isn't on ResTix yet".

## 6. First admin

The first person signs in normally, then from your machine:
```bash
DATABASE_URL=... npm run admin:grant -- your.name@snu.edu.in admin
```
After that, admins grant roles in the app (Moderation > Accounts).

## 7. Daily maintenance

`vercel.json` schedules `GET /api/cron/maintenance` daily (03:00 IST). It needs `CRON_SECRET`.
Elsewhere, call it daily with `Authorization: Bearer <CRON_SECRET>`, or schedule
`select restix.purge_old_data();` with Supabase's pg_cron. Reads never depend on it.

## 8. Backups and recovery

Supabase Free has no automatic backups. At minimum, weekly:
```bash
pg_dump "$DIRECT_DATABASE_URL" --schema=restix --no-owner --format=custom -f restix-$(date +%F).dump
```
Store dumps privately (they contain student emails); keep about 4 weeks and delete older ones.
Restore into a fresh project after applying migrations with `pg_restore --data-only`.
If the project is paused for inactivity, restore it from the Supabase dashboard; data is kept.

## 9. Launch checklist

- [ ] `ALLOWED_EMAIL_DOMAINS` confirmed with the institution
- [ ] `restix` not in exposed schemas; `pg_has_role` check true
- [ ] Google sign-in works for an institutional account; Gmail is rejected
- [ ] First admin granted; a test event created (resale is open by default; restrictions are optional)
- [ ] No sample events in production (`select count(*) from restix.events where is_fixture` = 0)
- [ ] Cron returns 200 with the secret, 401 without
- [ ] Privacy and terms reviewed by the institution
- [ ] Hosting plan's terms confirmed for this use
