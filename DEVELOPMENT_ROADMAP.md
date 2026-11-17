# Development Roadmap

## Done (Phase 1 foundation, on local store)
Public site · auth flows · volunteer/org/admin portals · evidence → review → reward → certificate journey · shared domain rules with tests · design system · Firebase rules/indexes/functions drafted.

## Next: connect Firebase (highest priority — makes it a real product)
1. Create `web/src/lib/store/firebase.ts` implementing the same `api` surface: Auth (email/password, verification, reset), Firestore reads with `limit()` + cursors, callable functions for every mutation, Storage uploads (hash locally, send `storagePath`+`sha256`).
2. Pick the adapter at runtime from `NEXT_PUBLIC_FIREBASE_*`; keep local mode for demos only.
3. Finish the remaining functions (see API_DOCUMENTATION.md) and a public `verifyCertificate` function.
4. Emulator rule tests + function tests; re-run the e2e journey against emulators.
5. Admin bootstrap script; enforce MFA for admins; App Check; rate limits.
6. Signed-URL reads for evidence; EXIF stripping; scheduled backups.

## Remaining Phase 1 gaps
Google sign-in · email delivery · video evidence · server-generated certificate PDFs · nearby/new discovery · org reports · platform settings page · account-deletion function · pagination in UI · measured performance · full WCAG audit (screen-reader pass, contrast re-check in production themes).

## Phase 2 — Growth (architecture-ready, not built)
Badges/achievements, advanced XP & seasons, leaderboards, personal impact dashboard, advanced analytics, push notifications, global search, Google Maps integration, squads, campaigns. Collections reserved; rules closed.

## Phase 3 — Intelligence
Gemini recommendations & plans, AI impact summaries, smart search, Vision-assisted evidence analysis (fills `aiConfidence`), fraud assistance. Server-side only; AI is advisory and never auto-approves uncertain evidence.

## Phase 4 — Ecosystem
Public API, university/government portals, NGO marketplace, native app + offline sync, i18n (Uzbek, Russian, English first), partners, CSR/company portal.
