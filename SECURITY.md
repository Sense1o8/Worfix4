# Security & Privacy

## Honest status

| Control | Status |
|---|---|
| Server-authoritative role / status / reward / verification | 🟡 enforced in domain + local API; Firebase version written, **untested** |
| Firestore + Storage rules | 🟡 written, **not run on the emulator** |
| Input validation (zod, shared) | ✅ tested |
| Reward-once, no self-approval, legal state transitions | ✅ unit-tested |
| Sensitive fields hidden from ordinary users | ✅ in API (volunteers never receive fraud/trust data; e2e asserts it) · 🟡 rules via `*Private` docs |
| Audit log of sensitive actions | ✅ |
| Login rate limit (5 / 10 min) | ✅ local only · ❌ server-side/App Check pending |
| Session expiry | ✅ local (7 d, admins 8 h) |
| Admin MFA | ❌ configure Firebase Auth MFA + enforce for admin claims |
| Secure uploads (type/size/ownership) | ✅ client + 🟡 server (function) |
| Account deletion / data export | ✅ local · ❌ Firebase function |
| Backups / recovery | ❌ enable Firestore PITR + scheduled exports (see DEPLOYMENT.md) |
| HTTPS | provided by hosting (Vercel / Firebase Hosting) |

## Threat notes

* **Local demo mode is not secure by design.** It's a browser store: anyone with DevTools can edit it. It exists for development and demos only; passwords are PBKDF2-hashed but this is not a production auth system.
* Never trust the client for: role, status, XP/points, mission rewards, verification state, `rewardGrantedAt`. The rules forbid writing them.
* Admins are created out-of-band (Admin SDK script setting `users/{uid}.role` and, recommended, a custom claim). There is deliberately no in-app path.
* Fraud signals are **advisory**; humans decide. AI output (Phase 3) must never auto-approve uncertain evidence.
* Evidence photos can contain EXIF/location data. Strip EXIF server-side before long-term storage (todo).
* Exact volunteer location is never shown publicly; only owning-org staff and admins can read it, and only if consented.

## Minors (users start at 15)

Privacy by default: location optional and per-submission; no public profiles; 15–17 confirm a parent/guardian knows. **This is not a claim of legal compliance** (COPPA/GDPR-K/local law). Obtain legal review for each launch jurisdiction before opening registration; consider verified parental consent flows.

## Before production

1. Run rule tests with `firebase emulators:exec` (cases: volunteer can't write role/XP; org A can't read org B's submissions; owner can't read `submissionPrivate`; double-approve rejected).
2. Enable App Check, rate limits on callables, Auth MFA for admins, email verification enforcement.
3. Add `PUBLIC_ORIGIN` secret; restrict the Maps key by referrer; enable audit-log export.
4. Independent security review / pen test.
