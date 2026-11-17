# Technical Architecture

## 1. Assessment

The PRD asks for a verified-action platform. The hard part is **integrity** (nobody rewards themselves, nobody is rewarded twice, evidence is reviewed by a human), not screens. So the architecture is built around one pure, tested module — `web/src/lib/domain` — that both the web app and Cloud Functions run.

```
            ┌────────────── web (Next.js) ──────────────┐
 Browser ──▶│ pages → components → api (store/api.ts)   │
            └───────────────┬───────────────────────────┘
                            │ same API surface
              ┌─────────────┴─────────────┐
              ▼ today                      ▼ production
   Local dev store (localStorage)   Firebase adapter ──▶ Cloud Functions ─▶ Firestore / Storage
              └──────── both call ───────▶ domain/ (permissions · state machine · rewards · fraud · validation)
```

### Decisions and why

| Decision | Reason |
|---|---|
| Domain rules in pure TypeScript, shared via `scripts/sync-domain.sh` | One implementation, unit-tested, no drift between client dev mode and server |
| Local dev store behind the same async API | Lets the entire journey run and be e2e-tested without credentials; replaced, not rewritten, when Firebase is connected |
| Role/status/rewards/verification only written server-side | PRD §12 "never trust client-provided role, status, reward values" |
| Sensitive fields in `userPrivate` / `submissionPrivate` | Firestore rules cannot hide single fields; a separate doc can be denied to owners |
| Rewards computed from difficulty + duration, never typed by organizers | Prevents inflated rewards |
| Reward-once guard = `rewardGrantedAt` on the submission + terminal states | XP can't be granted twice even if status is tampered back to pending (tested) |
| One submission per volunteer per mission (id `missionId_userId`) | Cheap uniqueness, simple resubmission flow |
| No microservices | Per master prompt; one Next app + one functions codebase |
| Motion: Framer Motion, 140–300 ms, transform/opacity only, reduced-motion honoured | Per design brief; also `MotionConfig reducedMotion="user"` and CSS media query |

## 2. Routing

Public: `/ /about /missions /missions/[id] /impact /organizations /verify /verify/[code]`
Auth: `/login /register /forgot-password /reset-password /verify-email`
Volunteer `/app`: `/ /onboarding /profile /missions /missions/[id] /certificates /notifications`
Organization `/org`: `/ /register /profile /missions /missions/new /missions/[id] /missions/[id]/edit /review /notifications`
Admin `/admin`: `/ /users /organizations /missions /submissions /audit`

Route guards (`components/guard.tsx`) are UX only; every API call re-checks session, status and role.

## 3. Roles

`volunteer`, `organization`, `company` (reserved, not built), `admin`, `super_admin`. Registration accepts only `volunteer`/`organization`. There is **no UI or API to grant admin**; production admins are created by a server-side script that sets `role` (see SECURITY.md).

## 4. Assumptions where the PRD was ambiguous or incomplete

1. **Publishing:** an *approved* organization publishes missions directly; admins moderate after the fact (feature / cancel). Pre-publication moderation (`pending_review`) is modelled but not enforced.
2. **Joining:** joins are accepted immediately (capacity-checked); organizers may decline afterwards.
3. **Reward formula:** XP = base(easy 50 / medium 100 / hard 200) + 10 per 30 min; points = XP/2; +5 % per streak day capped at +25 %. Levels: level *n* starts at 100·(n−1)² XP; titles Explorer / Volunteer(10) / Protector(25) / Guardian(50) / Legend(100). Tune in `rewards.ts`.
4. **Age:** minimum 15; 15–17 must confirm a parent/guardian knows. This is a product safeguard, **not a legal-compliance claim** — needs legal review per jurisdiction.
5. **Rejected is final**; "needs more info" returns to *pending* when the volunteer resubmits.
6. **Fraud score** is advisory (duplicate photo, early timestamp, GPS distance). It never approves or rejects. `aiConfidence` stays `null` until Phase 3.
7. **Timestamps** are ISO strings in the domain; the Firebase adapter may add server timestamps.
8. **Video evidence, PDF certificates, nearby/“new” discovery sections, org reports, company portal** are not built (see roadmap).

## 5. PRD traceability (MVP scope)

Legend: ✅ done · 🟡 partial · ❌ not built. “Local” = works on the local store; Firebase wiring pending for all.

| Requirement | Status | Where |
|---|---|---|
| Landing explains product immediately | ✅ | `(public)/page.tsx` |
| About / Explore / Mission details / Impact / Organizations / Login / Register / responsive nav | ✅ | `(public)`, `(auth)`, `shells.tsx` |
| Email+password register, login, logout | ✅ Local | `api.register/login/logout` |
| Email verification, forgot password | 🟡 Local — no mail sent, labelled dev link | `api.verifyEmail`, `requestPasswordReset` |
| Session management / expiry | ✅ Local (7 d; 8 h for admins) | `api.ts` |
| Role-based redirects, protected routes | ✅ | `guard.tsx`, `homeForRole` |
| Google authentication | ❌ (needs credentials) | roadmap |
| Onboarding: name, username, picture, country, city, languages, interests, skills, causes | ✅ | `profile-form.tsx` |
| Dashboard, profile edit, interests/skills | ✅ | `/app`, `/app/profile` |
| Discovery: recommended, featured, categories, search | ✅ | recommendations = interest match only |
| Discovery: nearby, “new” | ❌ | needs geolocation/maps ranking |
| Mission details (all PRD fields) | ✅ | `/missions/[id]` |
| Join, My/Upcoming/In-progress/Completed | ✅ | `/app/missions` |
| Evidence: photo + notes, GPS with consent | ✅ Local | `/app/missions/[id]` |
| Evidence: video | ❌ needs Cloud Storage | |
| Verification status transparency | ✅ | status badges, timeline, reviewer note |
| Basic impact stats, certificate section, QR + code | ✅ | dashboard, `/app/certificates`, `/verify/[code]` |
| Org: register, status, dashboard, create/edit/delete draft/publish | ✅ | `/org/*` |
| Org: participants, volunteer profiles | ✅ | `/org/missions/[id]` |
| Org: review, approve, reject, request more evidence | ✅ | `review-queue.tsx` |
| Org: basic analytics / generate reports | 🟡 analytics ✅, reports ❌ | `api.orgAnalytics` |
| Admin: dashboard, users, org approval, mission moderation, review, fraud alerts, suspension, audit, controls | ✅ (platform settings page ❌) | `/admin/*` |
| XP, points, certificates, XP never twice | ✅ + unit tests | `verification.ts` |
| In-app notifications | ✅ | bell + `/app/notifications` |
| Secure rules, server-side enforcement | 🟡 written, untested, not wired | `firestore.rules`, `functions/` |
| Rate limiting | 🟡 login attempts (local only) | functions: App Check/rate-limit pending |
| Admin MFA, backups, Analytics/Crashlytics/Monitoring | ❌ | roadmap |
| Account deletion, data export | ✅ Local | profile page |
| WCAG 2.2 AA, light/dark, reduced motion, 320 px | ✅ designed for; e2e checks 320 px overflow; **no full audit run** | `DESIGN_SYSTEM.md` |
| Performance targets | ⚪ not measured | |

> The master prompt says the PRD has 10 sections; for this build the requirements were taken from the master prompt plus the PRD's verification, rewards/levels, data-model, design-token and MVP-roadmap sections. A line-by-line pass of all 145 PRD pages against this table is still recommended.
