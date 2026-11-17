# WORFIX — Small Actions. Big Impact.

AI-ready, verified volunteering platform. This repository is the **Phase 1 (MVP) foundation**: a Next.js web app with the complete volunteer → evidence → review → reward → certificate journey, three role portals, and a Firebase backend definition (rules, indexes, Cloud Functions).

> **Read this first — what is real and what is not**
>
> * Without Firebase keys the web app runs in **Local demo mode** (browser `localStorage`, yellow banner, labelled demo data).
> * With the `NEXT_PUBLIC_FIREBASE_*` variables set it runs on **Firebase Auth + Cloud Firestore** (`web/src/lib/store/cloud.ts`, `firestore.rules`). This mode was type-checked and built but **not run against a live Firebase project** — follow the smoke test in `DEPLOYMENT.md`.
> * The **AI mission agent** uses Gemini through the server route `/api/ai/missions` (`GEMINI_API_KEY`). It was not called against the live API from the build environment.
> * Deployment target: **Netlify** (`netlify.toml`). See `DEPLOYMENT.md`.

## Added in this version

| Feature | Where |
|---|---|
| AI mission agent — drafts missions for an area (typed or detected), saved as drafts | Organization portal → **AI agent** (`/org/missions/ai`) |
| Community feed — approved work from everyone / friends / your area, with cheers | Volunteer portal → **Feed** |
| Home — next-step advice, weekly XP chart, cause breakdown, friends leaderboard, achievements | Volunteer portal → **Home** |
| Friends — search, requests, private leaderboard | Volunteer portal → **Friends** |
| Profile — location auto-fill, all countries, provinces per country, feed-visibility switch | **Profile → Details** |
| Achievements — 18 achievements unlocked from verified activity | **Profile → Achievements** |
| Firebase Auth + Firestore backend, Netlify config | `web/src/lib/store/cloud.ts`, `firestore.rules`, `netlify.toml` |

## Status at a glance

| Area | Status |
|---|---|
| Public website (landing, about, explore, mission detail, impact, organizations, certificate verification) | ✅ Working (local store) |
| Auth: register, login, logout, email verification\*, forgot/reset password\*, session expiry, role redirects, protected routes | ✅ Working (local store). \*No email is sent in demo mode; a labelled dev link is shown |
| Volunteer portal: onboarding, dashboard, profile edit, discovery, join, my missions (tabs), evidence upload, verification status, XP/points/levels, impact, certificates (QR, print-to-PDF), notifications, data export, account deletion | ✅ Working (local store) |
| Organization portal: register, approval status, dashboard analytics, create/edit/delete draft/publish/close, participants, volunteer profiles, review (approve / reject / request info) | ✅ Working (local store) |
| Admin portal: overview, users + suspension, organization approval, mission moderation, submission review, fraud alerts, audit log | ✅ Working (local store) |
| Shared domain rules (state machine, reward-once guard, permissions, fraud heuristics, validation) | ✅ 18 unit tests |
| Firebase Auth + Firestore integration in the web app | 🟡 Wired, env-driven, **not yet run against a live project** |
| Firestore + Storage rules, indexes, Cloud Functions (5 critical callables) | 🟡 Written & compiled, **untested** |
| Google sign-in, admin MFA, email delivery, video evidence, PDF generation, Maps (key-gated), analytics/Crashlytics | ❌ / 🟡 See roadmap |
| Phase 2–4 remainder (squads, AI evidence checks, public API…) | 🗺️ Roadmap only — nothing pretends to work |

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:3000
npm test             # domain unit tests
npm run typecheck && npm run lint && npm run build
```

Demo accounts (local demo mode only — also one-click buttons on the login page):

| Role | Email | Password |
|---|---|---|
| Volunteer | `vol@demo.worfix.local` | `Vol-demo-1` |
| Organization | `org@demo.worfix.local` | `Org-demo-1` |
| Admin | `admin@demo.worfix.local` | `Admin-demo-1` |

Try the core journey: log in as the volunteer → join a mission → upload a photo → log out → log in as the organization → *Review* → approve → log back in as the volunteer to see XP, impact and the certificate → open the certificate's QR/verify link while signed out.

## Layout

```
web/                 Next.js 15 (App Router), React 19, strict TypeScript, Tailwind 4, Framer Motion
  src/lib/domain/    Pure business rules shared by web + functions (unit-tested)
  src/lib/store/     Local dev store + the API surface the Firebase adapter must implement
  src/components/    Design system (ui/), shells, forms, review queue
  src/app/           (public) (auth) /app /org /admin
functions/           Cloud Functions (Admin SDK) — reuses web/src/lib/domain via scripts/sync-domain.sh
firestore.rules  firestore.indexes.json  storage.rules  firebase.json
```

## Documents

`TECHNICAL_ARCHITECTURE.md` (+ PRD traceability) · `DATABASE_SCHEMA.md` · `API_DOCUMENTATION.md` · `SECURITY.md` · `ENVIRONMENT_SETUP.md` · `DEPLOYMENT.md` · `DEVELOPMENT_ROADMAP.md` · `DESIGN_SYSTEM.md`
