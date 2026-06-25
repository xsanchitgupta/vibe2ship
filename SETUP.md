# Setup — Supabase + Google Maps

The app runs without these (in-memory data + SVG map). Add them to unlock auth,
persistence, realtime collaboration and the real Google map.

## 1. Supabase (auth + database + realtime + storage)

1. Create a project at https://supabase.com → **New project**.
2. **SQL Editor** → run, in order: `supabase/migrations/0001_init.sql`,
   `0002_resolution.sql` (Before/After proof columns),
   `0003_escalation.sql` (auto-escalation `escalated` flag), and
   `0004_comments.sql` (community discussion threads).
3. **Settings → API** → copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
4. **Email OTP** (6-digit code sign-in — the only auth method):
   - Authentication → **Providers → Email** → make sure **Email** is enabled.
   - Authentication → **Email Templates → Magic Link** → ensure the body includes
     the code token `{{ .Token }}` so users receive a 6-digit OTP (not just a link).
     A minimal template: `Your Community Hero code is: {{ .Token }}`
5. Storage bucket `issue-photos` is created by the migration (public read).
6. Judges get one-click authority access via the **“Enter as demo authority”** button on `/login` (server mints a session for the seeded `authority@demo.com` account — no password/inbox needed).

> To make yourself an **authority** (to use the Authority Console): after signing
> up, run in SQL Editor:
> `update public.profiles set role = 'authority' where id = (select id from auth.users where email = 'you@example.com');`

## 2. Google Maps

1. Google Cloud Console → enable **Maps JavaScript API** and **Geocoding API**.
2. **Credentials → Create API key** (Browser key).
3. Restrict it: Application restriction → **HTTP referrers** → add
   `http://localhost:3000/*` and your deployed domain `/*`.
4. Put it in `.env.local` as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.

## 3. Run

```bash
npm install
npm run dev
```

Restart `npm run dev` after editing `.env.local`.

## Gemini model & quota

Defaults to `gemini-2.5-flash-lite` (generous free-tier limits). The agent makes
several Gemini calls per report, so on the free tier you can hit per-minute
rate limits under heavy use — the app degrades gracefully (heuristic classifier)
when that happens. For the smoothest demo, **enable billing** on the API key, or
set a different model via `GEMINI_MODEL` in `.env.local` (e.g.
`GEMINI_MODEL=gemini-2.5-flash` once that model's quota resets).

