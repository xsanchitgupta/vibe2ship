# Submission guide — GitHub + Deploy + Google Doc

Three deliverables. Do them in this order. Everything runs from the
`community-hero-app/` folder.

> Prereqs: a free [GitHub](https://github.com) account, the
> [`gh` CLI](https://cli.github.com) (optional) or git, the
> [`gcloud` CLI](https://cloud.google.com/sdk/docs/install), and a Google Cloud
> project with **billing enabled** (Cloud Run has a generous free tier).

---

## ✅ Before anything: make sign-in work (2 min)

Auth is passwordless email OTP. In Supabase → **Authentication → Email Templates →
Magic Link**, make sure the body contains the code token:

```
Your Community Hero code is: {{ .Token }}
```

Without this the email only has a link and the 6-digit box won't validate.

---

## 1) GitHub repository

Secrets are safe: `.env.local` (your Gemini + service-role keys) is git-ignored.
Only `.env.production` (public client keys) is committed, which is fine.

**Option A — GitHub CLI (easiest):**
```bash
cd community-hero-app
gh auth login
git add -A
git commit -m "Community Hero — Vibe2Ship submission"
gh repo create community-hero --public --source . --push
```

**Option B — manual:**
1. Create an empty public repo on github.com (no README).
2. Then:
```bash
cd community-hero-app
git add -A
git commit -m "Community Hero — Vibe2Ship submission"
git branch -M main
git remote add origin https://github.com/<your-username>/community-hero.git
git push -u origin main
```

Copy the repo URL → paste into the Google Doc.

---

## 2) Deploy to Google Cloud Run

The app is powered by the **Google AI Studio (Gemini) API** and deploys to
**Google Cloud Run** — the same serverless backend AI Studio's "Publish" uses.
The included `Dockerfile` (Next.js standalone) + `.env.production` (public keys)
make this a one-command deploy; the **secret** keys are passed at deploy time.

```bash
cd community-hero-app
gcloud auth login
gcloud config set project <YOUR_GCP_PROJECT_ID>

gcloud run deploy community-hero \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --memory 1Gi --cpu 1 --timeout 300 \
  --set-env-vars "GEMINI_API_KEY=<your_gemini_key>,SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>,GEMINI_MODEL=gemini-2.5-flash-lite"
```

- First run: when prompted, allow it to enable **Cloud Run, Cloud Build &
  Artifact Registry** APIs and pick the region (`asia-south1` = Mumbai).
- It builds the Docker image, pushes it, and prints a public HTTPS URL like
  `https://community-hero-xxxxx.a.run.app` → that's your **Deployed application link**.
- Redeploy after changes: rerun the same command (use `--update-env-vars` instead
  of `--set-env-vars` to change only some vars).

> The `NEXT_PUBLIC_*` keys are baked in from `.env.production` at build time; the two
> secrets above are injected at runtime. Don't put secrets in `.env.production`.

### Post-deploy (so maps + auth work on the live URL)
1. **Google Maps key** → Google Cloud Console → APIs & Services → Credentials →
   your browser key → **HTTP referrers** → add `https://YOUR-CLOUD-RUN-URL/*`
   (and `http://localhost:3000/*`). Ensure **Maps JavaScript API** + **Geocoding
   API** are enabled.
2. **Supabase** → Authentication → **URL Configuration** → set **Site URL** to your
   Cloud Run URL and add it to the redirect allowlist.
3. Run the SQL migrations (`0001`–`0004`) in the Supabase SQL Editor if you haven't.

---

## 3) Google Doc (project description)

1. Open `GOOGLE_DOC.md` in this folder — it's the complete writeup
   (Problem Statement, Solution Overview, Key Features, Technologies Used, Google
   Technologies Utilized).
2. Create a new Google Doc, paste it in, and fill the **Deployed application** and
   **GitHub repository** links at the top.
3. **Share → Anyone with the link → Viewer.** Copy that link.

---

## Submit
- ✅ Deployed application link (Cloud Run URL)
- ✅ GitHub repository link
- ✅ Google Doc link (shared, view-access)

Keep the Cloud Run service and the doc live through the evaluation period.
