# 🦸 Community Hero — Hyperlocal Problem Solver

> Turn a photo of a local problem into filed civic action in seconds — with an **autonomous Gemini agent** doing the triage, routing and tracking.

Built for **Vibe2Ship** (Coding Ninjas × Google for Developers) on the problem statement **“Community Hero — Hyperlocal Problem Solver.”**

Communities face potholes, water leakages, broken streetlights and waste problems every day. Reporting them is fragmented, opaque and slow. Community Hero turns every citizen with a phone into a sensor, and an AI agent into the city worker who never sleeps — **identifying, reporting, validating, tracking and resolving** issues through collaboration, data and intelligent automation.

---

## ✨ What makes it different — *real agentic depth*

This isn’t a form with one AI call bolted on. The **Civic Triage Agent** runs a live **function-calling loop on Gemini 2.5 Flash**, and the citizen *watches it think*. For every report the agent autonomously:

1. 👁️ **Sees the photo** — Gemini Vision classifies the issue, severity, tags and safety risk.
2. 🔎 **Checks for duplicates** — calls a tool to find open reports of the same type nearby (geo dedup) so the same pothole isn’t filed ten times — instead duplicates *strengthen* the signal.
3. 🏛️ **Routes to the right department** — calls a tool to look up the responsible municipal body and its SLA.
4. 📊 **Scores priority (0–100)** — blends severity, duplicate count, SLA urgency and safety risk via a tool.
5. 📝 **Files the work order** — drafts a crisp official summary and a warm, plain-language citizen advisory, then files it.

Every tool call and its result is **streamed to the UI step-by-step** (NDJSON), so the agent’s reasoning is fully transparent — not a black box. The whole loop is genuinely orchestrated by the model deciding which tool to call next.

> The agent degrades gracefully: if the API is unavailable, a built-in heuristic classifier and deterministic triage keep the product fully usable.

---

## 🧩 Key features

| Problem-statement feature | In Community Hero |
| --- | --- |
| Image/video-based reporting | 📸 One-tap photo upload / camera capture |
| AI-powered issue categorization | 🤖 Gemini Vision → category, severity, tags, safety risk |
| Geo-location & mapping | 🗺️ Browser GPS + a live interactive city map of every report |
| Community verification | 👍 Neighbours verify issues, boosting priority & trust |
| Real-time issue tracking | ⏱️ Transparent timeline: Reported → Acknowledged → In Progress → Resolved |
| Impact dashboards | 📊 Live KPIs, 7-day trend, category breakdown, hotspots |
| Predictive insights | 🔮 Gemini analyses live data to predict hotspots & recommend actions |
| Gamification | 🏆 Points, levels and a civic-champions leaderboard |
| **Bonus: conversational assistant** | 💬 “Hero Assistant” — a Gemini chatbot grounded in live community data |

### Advanced AI features
- 🔁 **Before/After resolution proof** — when an authority resolves an issue they upload an “after” photo; **Gemini Vision compares before vs after** and confirms a genuine fix (anti-fraud + accountability).
- 🧠 **Semantic duplicate detection** — **Gemini embeddings** (`gemini-embedding-001`, `SEMANTIC_SIMILARITY`) match recurring reports by *meaning*, not just GPS/category, and auto-link duplicates.
- 📍 **“Issues near me”** — geolocation feed + radius filter on the home and dashboard, ranked by distance.
- 🌐 **Multilingual reporting** — pick a language (English / हिन्दी / ಕನ್ನಡ / தமிழ் / తెలుగు / मराठी / বাংলা) and the agent writes the report title, description and advisory in it.
- 🎙️ **Voice reporting** — dictate the issue with the browser's speech recognition (language-aware), no typing needed.
- 🏛️ **Department accountability scorecards** (`/scorecards`) — public per-department resolution rate, SLA compliance and turnaround, with an A–D grade.
- 🔔 **Live activity notifications** — a realtime bell tells reporters the moment their issue is acknowledged, progressed or resolved.
- 🔮 **Predictive risk forecasting** (`/api/forecast`, on the dashboard) — Gemini forecasts which areas are most likely to see new/worsening issues next, with a risk score and reason (heuristic fallback).
- 📲 **PWA** — installable, offline app shell, and **offline report capture** that queues reports and auto-submits them when connectivity returns.
- 🌍 **Open-data API + embeddable widget** — CORS-enabled `/api/public/issues` & `/api/public/stats` (PII-stripped) and a standalone **`/embed`** map widget for local news / resident associations.
- ⚡ **Auto-escalation** — issues that breach their SLA are automatically escalated (priority raised, flagged on the authority console) — idempotent, runs opportunistically.

- 💬 **Community discussion** — realtime comment threads on every issue (sign-in to post).
- 📤 **CSV export** & **toasts**, an **accessibility pass** (focus styles, skip-link, reduced-motion, ARIA) and a **mobile-responsive** layout.

**Embed snippet:**
```html
<iframe src="https://YOUR-DOMAIN/embed?area=Koramangala" width="100%" height="480" style="border:0;border-radius:16px"></iframe>
```

---

## 🛠️ Google technologies used

- **Google Gemini API (`gemini-2.5-flash`)** via the official **`@google/genai`** SDK
  - **Vision** — multimodal image understanding of the reported issue
  - **Function calling / tool use** — the agent’s autonomous triage loop
  - **Structured output (`responseSchema`)** — reliable JSON for classification & insights
  - **Streaming** — live agent steps and the streamed assistant chat
- **Google Maps Platform** — live interactive issue map (markers, info windows) + geocoding
- **Google AI Studio** — prototyping and one-click **Publish** deployment
- **Google Cloud Run** — the serverless target AI Studio publishes to

Gemini works from a single `GEMINI_API_KEY`; Maps + Supabase keys unlock the live map, auth and persistence (see `SETUP.md`).

---

## 🧱 Tech stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- Server-side **Route Handlers** keep the Gemini key secret (never shipped to the browser)
- Hand-crafted light CSS design system + floating glassmorphic pill navbar
- `lucide-react` icons
- **Supabase** — Postgres (RLS), passwordless **email OTP** auth, Realtime, Storage
- Clean data facade (`lib/data.ts`) that uses Supabase when configured and an in-memory store otherwise

## 📁 Project structure

```
src/
├── app/
│   ├── page.tsx                 # Landing (live stats)
│   ├── report/                  # ⭐ Agentic report flow (live streaming)
│   ├── dashboard/               # KPIs, charts, hotspots, AI insights
│   ├── map/                     # Interactive city map
│   ├── leaderboard/             # Gamification
│   ├── issues/[id]/             # Issue detail, timeline, verify/track
│   └── api/
│       ├── triage/              # Runs the agent, streams NDJSON
│       ├── issues/ …            # list / detail / verify / status
│       ├── stats, hotspots      # analytics
│       ├── insights/            # Gemini predictive insights
│       └── assistant/           # streamed Gemini chat
├── components/                  # Navbar, CityMap, AgentTimeline, Assistant, …
└── lib/
    ├── agent.ts                 # 🧠 The Civic Triage Agent (tools + loop)
    ├── gemini.ts                # Gemini client + helpers
    ├── store.ts                 # In-memory store (dedup, stats, gamification)
    ├── departments.ts           # Category → department, SLA, priority model
    ├── geo.ts                   # Geo math + map projection
    └── seed.ts, types.ts
```

---

## 🚀 Run locally

```bash
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY
npm run dev                        # http://localhost:3000
```

Get a free key at **https://aistudio.google.com/apikey**.

## ☁️ Deploy

**Google AI Studio (as required):** open the app in AI Studio → **Publish** → **Publish App**. AI Studio builds and deploys to a **Cloud Run** URL and injects `GEMINI_API_KEY`. See the [AI Studio deploying guide](https://ai.google.dev/gemini-api/docs/aistudio-deploying).

**Docker / Cloud Run (manual):** a production `Dockerfile` (Next.js standalone output) is included:

```bash
docker build -t community-hero .
gcloud run deploy community-hero --source . --set-env-vars GEMINI_API_KEY=...
```

---

## 🎯 How it maps to the evaluation matrix

- **Problem solving & impact** — closes the full loop (report → triage → route → track → resolve) with dedup so signal isn’t diluted.
- **Agentic depth** — a real, transparent multi-tool Gemini function-calling agent, streamed step-by-step.
- **Innovation** — “watch the agent work,” geo-aware dedup, AI advisories, predictive insights, grounded assistant.
- **Google technologies** — Gemini vision + tools + structured output + streaming, deployed via AI Studio → Cloud Run.
- **Product experience & design** — cohesive, animated, responsive UI.
- **Technical implementation** — typed, modular, secure (server-side key), clean build.
- **Completeness & usability** — every feature is wired end-to-end and works, with graceful AI fallbacks.

### Roles & demo access
Two roles: **citizen** (report, verify, track) and **authority** (claim → acknowledge → resolve, with the AI Ops Co-pilot).

Sign-in is **passwordless email OTP**. To explore the **Authority Console** instantly, click **“Enter as demo authority”** on the `/login` page — it's one-click (no email/password needed; the server mints a session for a pre-seeded authority account). Citizens sign in with their own email + a one-time code. To promote any real user to authority, see the snippet in `SETUP.md`.

> **Resilience:** every integration degrades gracefully. Without Supabase the app uses a seeded in-memory store; without a Maps key it uses a built-in SVG map; without Gemini it uses a heuristic classifier. The data layer is isolated behind `lib/data.ts`.
