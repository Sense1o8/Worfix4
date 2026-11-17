# Environment Setup

**Requirements:** Node 20+ (tested on 22), npm 10+. For Firebase work: Firebase CLI, Java 11+ (Firestore emulator).

## Web app (local demo mode — no credentials needed)

```bash
cd web && npm install && npm run dev
```
Copy `web/.env.example` → `web/.env.local` only when adding Firebase/Maps keys. Without them the app runs in labelled local demo mode and the map shows a fallback.

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*` (7 keys) | web | for Firebase mode | Public web config. Safe to expose; protect via rules + App Check |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | web | optional | Maps Embed. Restrict by HTTP referrer. Missing → fallback card |
| `PUBLIC_ORIGIN` | functions | yes | Base URL for certificate QR links |
| `GEMINI_API_KEY` | functions secret | Phase 3 | Server-side only; never `NEXT_PUBLIC_` |

## Firebase project (when credentials exist)

```bash
cp .firebaserc.example .firebaserc          # set your project id
cd functions && npm install && npm run typecheck
firebase emulators:start                     # auth, firestore, functions, storage
```
Enable in the console: Authentication (Email/Password, later Google), Firestore, Storage, Cloud Functions (Blaze plan), App Check. Then implement the Firebase adapter (see DEVELOPMENT_ROADMAP.md).

## Tests

`cd web && npm test` (domain). End-to-end: `npm run build && npm start -- -p 3100`, then `node e2e/journey.cjs` (needs Playwright installed) (the journey covered: join → submit → review → reward → certificate → public verify, role guards, age rules, suspension, 320 px overflow).
