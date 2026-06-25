# Community Hero — Hyperlocal Problem Solver
### Vibe2Ship submission (Coding Ninjas × Google for Developers)

> Copy everything below into a Google Doc, fill the two links at the top, set sharing
> to **"Anyone with the link → Viewer"**, and submit that link.

---

**Deployed application:** `https://community-hero-611630467420.asia-south1.run.app/`
**GitHub repository:** `https://github.com/xsanchitgupta/vibe2ship`
**Try the Authority Console:** on the login page click **“Enter as demo authority”** (one-click — no email/password needed). Citizens sign in with their own email + a one-time code (OTP).

---

## 1. Problem Statement Selected

**Community Hero — Hyperlocal Problem Solver.**

Communities constantly face issues like potholes, water leakages, broken streetlights,
waste mismanagement and other public-infrastructure failures. Reporting these is
fragmented, hard to track, and lacks transparency and accountability. The challenge is
to build a platform that enables citizens to **identify, report, validate, track and
resolve** community issues through collaboration, data and intelligent automation —
encouraging transparency, accountability and community participation.

## 2. Solution Overview

Community Hero turns every citizen with a phone into a sensor, and an **autonomous AI
agent into the city worker that never sleeps.** A resident snaps a photo of a local
problem; a transparent, multi-step **Civic Triage Agent** (Google Gemini) then *watches
itself work* in real time — it sees the photo, classifies the issue and severity,
detects duplicate reports nearby, routes it to the correct municipal department, scores
its priority, drafts an official work order, and files it. The whole community then
verifies, tracks and discusses the issue live until an authority resolves it — with the
resolution **AI-verified from a before/after photo**.

It is a genuine **two-sided platform**:
- **Citizens** report (by photo or voice, in 7 languages), verify, track, discuss, and earn points/badges.
- **Authorities** triage a live work queue, get an AI "ops co-pilot" dispatch plan, and resolve issues with AI-verified proof — under public **SLA accountability scorecards**.

What makes it different from a typical "form + one AI call":
- The agent is a **real Gemini function-calling loop**, streamed step-by-step so its reasoning is fully transparent (not a black box).
- **Before/After resolution proof** — Gemini Vision compares the original and the "fixed" photo to confirm a genuine fix (anti-fraud + accountability).
- **Semantic duplicate detection** via Gemini embeddings — matches recurring reports by *meaning*, not just GPS/category.
- **Predictive risk forecasting** — Gemini forecasts which areas will see the next cluster of issues.
- **Auto-escalation** of SLA breaches, **realtime** collaboration across all users, **live location** ("issues near me"), an **open-data API + embeddable map widget**, a **PWA** with offline report capture, and a grounded **conversational assistant**.

## 3. Key Features

- 📸 **Image & voice reporting** — one-tap photo; or dictate the issue (speech recognition, language-aware).
- 🤖 **Agentic AI triage** — Gemini Vision + a transparent function-calling loop (dedup → route → prioritise → file work order), streamed live.
- 🧠 **Semantic duplicate detection** — Gemini embeddings auto-link reports of the same real-world problem.
- 🗺️ **Geo-location & live map** — Google Maps with severity pins; **"issues near me"** with GPS + radius + manual locality.
- ✅ **Community verification & discussion** — neighbours confirm issues (boosting priority) and comment in realtime.
- ⏱️ **Real-time tracking** — transparent timeline Reported → Acknowledged → In Progress → Resolved, live across users.
- 🏛️ **Authority console** — work queue, SLA timers, an **AI ops co-pilot** dispatch plan, and **Before/After AI-verified resolution**.
- ⚡ **Auto-escalation** of SLA breaches + public **department accountability scorecards** (resolution rate, SLA compliance, grade).
- 📊 **Impact dashboard & predictive insights** — live KPIs, trends, hotspots, and **Gemini risk forecasting**.
- 🌐 **Multilingual reporting** (English/हिन्दी/ಕನ್ನಡ/தமிழ்/తెలుగు/मराठी/বাংলা).
- 🏆 **Gamification** — points, levels, badges and a civic-champions leaderboard.
- 🔔 **Realtime notifications**, 🌍 **open-data API + embeddable widget**, 📲 **installable PWA with offline capture**, 💬 **grounded AI assistant**.

## 4. Technologies Used

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript** — full-stack app + server API routes (the Gemini key stays server-side).
- **Supabase** — PostgreSQL with Row-Level Security, passwordless **email-OTP auth**, **Realtime**, and **Storage** (issue photos).
- **framer-motion** (micro-animations), **lucide-react** (icons), hand-crafted CSS design system.
- Deployed as a containerised app (Next.js standalone + Docker) on serverless infrastructure.

## 5. Google Technologies Utilized

- **Google Gemini API** (via Google AI Studio) — the core intelligence:
  - **Gemini Vision** — image understanding for issue classification & before/after resolution proof.
  - **Function calling / tool use** — the autonomous Civic Triage Agent loop.
  - **Structured output (response schemas)** — reliable JSON for classification, insights, forecasting, ops plans.
  - **Streaming** — live agent steps and the streamed assistant.
  - **Gemini Embeddings** (`gemini-embedding-001`, semantic-similarity task) — duplicate detection.
- **Google AI Studio** — used to develop, prototype and obtain the Gemini API key powering the solution.
- **Google Maps Platform** — Maps JavaScript API (live issue map) + Geocoding.
- **Google Cloud Run** — serverless deployment hosting the public application.

---

*Built for Vibe2Ship. Community Hero demonstrates how AI can help communities report,
verify, track and resolve local issues more efficiently, transparently and
accountably.*
