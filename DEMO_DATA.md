# Demo data playbook — populate Community Hero with realistic *real* data

The app no longer auto-seeds. Use this to fill it through the real UI across
several accounts so the map, dashboard, hotspots, forecast, scorecards,
leaderboard and discussions all look alive — with genuine data.

> Prereqs: (1) **redeploy** the latest code (no auto-seeder), (2) Supabase OTP
> email template has `{{ .Token }}`, (3) you can receive the OTP emails.

---

## 1. Create accounts (one inbox, many users)

Gmail **plus-addressing** lets one inbox act as many accounts — every `+tag`
still lands in your inbox, but Supabase treats each as a distinct user.

| Display name | Sign-in email | Role |
|---|---|---|
| You (authority) | `xsanchitguptaa@gmail.com` | **authority** ✅ already set |
| Aarav | `xsanchitguptaa+aarav@gmail.com` | citizen |
| Diya | `xsanchitguptaa+diya@gmail.com` | citizen |
| Kabir | `xsanchitguptaa+kabir@gmail.com` | citizen |
| Ananya | `xsanchitguptaa+ananya@gmail.com` | citizen |

To sign in as each: `/login` → enter the email → type the 6-digit code from the
email. (The first sign-in auto-creates the profile; its name defaults to the part
before `+`, i.e. "xsanchitguptaa" — rename later if you want via SQL:
`update public.profiles set name='Aarav', avatar='🦸' where id='<uuid>';`)

> **Tip:** open each account in a separate browser profile / incognito window so
> you can stay logged into several at once.

## 2. Get real photos first (moderation rejects blanks/non-civic)

The agent looks at the actual image, and **rejects photos that aren't a public
issue**. Grab ~13 real photos into a folder before you start:
- Your own phone photos, **or**
- Free stock: search **Pexels.com / Unsplash.com** for: `pothole road`,
  `water pipe leak street`, `broken streetlight night`, `garbage pile street india`,
  `clogged drain`, `fallen tree branch road`, `traffic signal junction`,
  `stray dogs street`, `public toilet`, `street vendors footpath`,
  `road construction debris`.

Match the photo to the category — the notes reinforce it.

## 3. The 13 reports (file via `/report`, signed in as the listed account)

For each: pick the photo, type the **Location** (use these exact localities so the
map pins land right), type the **Notes**, pick the **Language**, submit, and watch
the agent triage it.

| # | Account | Photo | Location | Notes to type | Language |
|---|---|---|---|---|---|
| 1 | Aarav | pothole | MG Road | Deep pothole in the middle of 100ft road, cars swerving dangerously | English |
| 2 | Diya | water leak | Jayanagar | Burst water pipeline flooding the street near the market | English |
| 3 | Kabir | streetlight | HSR Layout | Five streetlights dead for a week, the stretch is pitch dark at night | English |
| 4 | Ananya | garbage | BTM Layout | Overflowing garbage beside the vegetable market, stray dogs scattering it | Hindi |
| 5 | Diya | clogged drain | Koramangala | Open storm drain clogged with black water, mosquitoes breeding | English |
| 6 | Kabir | fallen branch | Malleshwaram | Large tree branch fell on the footpath after rain, blocking the path | Kannada |
| 7 | Aarav | traffic signal | Indiranagar | Traffic signal stuck on red at the busy junction, massive jam | English |
| 8 | Ananya | stray dogs | Marathahalli | Aggressive stray dog pack near the bus stop chasing commuters | English |
| 9 | Diya | public toilet | Jayanagar | Public toilet block has no water and a broken door, unusable for days | English |
| 10 | Aarav | footpath stalls | MG Road | Vendors have taken over the whole footpath, pedestrians pushed onto the road | English |
| 11 | Kabir | potholes | Whitefield | Cluster of potholes after the monsoon damaging vehicle suspensions | English |
| 12 | Ananya | construction debris | Electronic City | Construction debris dumped illegally in a vacant plot | Marathi |
| 13 | Diya | pothole | MG Road | Huge crater on MG Road near the junction, two-wheelers losing balance | English |

This spread gives you: every category, a mix of Critical/High/Medium/Low, ~9
localities (hotspots on the map), and Hindi/Kannada/Marathi reports for the
multilingual feature. **#13 is intentionally the same pothole as #1** — when you
file it, the agent's "duplicate check" step should flag a **semantic match** to #1
(showcases Gemini-embedding dedup).

## 4. Community verification (boosts priority + leaderboard)

Sign in as each citizen and **Verify** several issues *they didn't file*
(open the issue → "Verify this issue"). Suggested:
- Aarav verifies #2, #5, #6, #9
- Diya verifies #1, #3, #7, #11
- Kabir verifies #1, #4, #8, #10
- Ananya verifies #1, #2, #13

(Verifying #1 from several accounts pushes it up the priority/hotspot lists.)
Each verify = +5 pts, so the **leaderboard** fills with real users.

## 5. Discussion (collaboration)

On 2–3 of the critical issues (#1, #2), post comments from different accounts,
e.g. *"This has been here for weeks, please prioritise"* / *"Confirmed, my tyre
got damaged here."* Realtime threads appear on the issue page.

## 6. Authority workflow (sign in as `xsanchitguptaa`)

Open **/authority** (or the **Authority** nav link):
- **Acknowledge** #3, #8, #9; move #1, #2, #7 to **In Progress**.
- **Generate dispatch plan** — the AI Ops Co-pilot orders the open queue.
- **Resolve with proof** on a **pothole** (#1 or #11): click "Resolve with proof" →
  upload **`14-after-clean-road.jpg`** (fresh asphalt). Gemini Vision compares the
  original pothole vs the repaved road and stamps an **AI-verified fix** badge.

## 7. (Optional) Escalation demo

Auto-escalation fires on issues past their SLA. Fresh reports aren't overdue yet,
so to demo the ⚡ badge, backdate one in Supabase → SQL Editor, then click
**"Run escalation"** on the authority console:

```sql
-- make the BTM garbage report (12h SLA) look 2 days old → overdue
update public.issues
set created_at = now() - interval '2 days'
where location ilike 'BTM Layout%' and category = 'Garbage';
```

## ✅ After this you'll have
- A populated **map** (~9 localities), **dashboard** KPIs/trends/category mix,
  **hotspots** (MG Road leading), **AI forecast**, **department scorecards**,
  a **real leaderboard**, live **notifications**, **comments**, a **resolved**
  issue with before/after proof, a **semantic-duplicate** link, and an
  **escalated** issue — all from genuine multi-account activity.

> Reset anytime: delete rows in Supabase (`delete from public.issues;` cascades to
> timelines/comments/verifications) and you're clean again.
