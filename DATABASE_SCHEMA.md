# Database Schema (Cloud Firestore)

Source of truth for types: `web/src/lib/domain/types.ts`. Fields marked **EXTRA** are beyond the PRD list, with the reason.

## Collections

| Collection | Doc id | Notes |
|---|---|---|
| `users` | auth uid | Profile + progress. **No** trustScore/reputation here. |
| `userPrivate` | auth uid | `trustScore`, `reputation` — admin-read only |
| `organizations` | auto | `verificationStatus`: pending/approved/rejected; `members[]`, `ownerId` |
| `missions` | auto | `rewardXP/rewardPoints` server-computed; `status`: draft/pending_review/published/closed/cancelled |
| `missionParticipants` | `{missionId}_{userId}` | Uniqueness by id; status pending/accepted/rejected/withdrawn |
| `missionSubmissions` | `{missionId}_{userId}` | Volunteer-visible fields only; `imageHashes[]` (**EXTRA**) for duplicate lookup |
| `submissionPrivate` | same id | `fraudScore`, `fraudFlags`, `aiConfidence` — staff-read only |
| `verificationRecords` | auto | Immutable decision history (reviewer, role, decision, note) |
| `certificates` | auto | Snapshot (`holderName`, `missionTitle`, `organizationName`, hours, xp) so it verifies even if source data changes |
| `notifications` | auto | Owner reads; may flip `read` only |
| `auditLogs` | auto | Immutable; admin read |
| `companies, achievements, badges, userBadges, squads, campaigns, reports, settings` | — | Phase 2+; rules closed; not created yet |

## EXTRA fields and why

`users`: `emailVerified` (join gate), `points` (PRD separates XP from reward points), `lastApprovedDay` (streak), `impact` map (per-label breakdown behind `totalImpact`), `onboarded`, `organizationId`.
`organizations`: `verificationNote` (rejection reason).
`missions`: `deadline`, `requirements`, `safety`, `equipment` (PRD mission-details list), `moderationNote` (staff), `isDemo` (seed data must be labelled).
`missionSubmissions`: `organizationId` (org-scoped queries and rules), `gpsConsent`, `rewardGrantedAt` (reward-once guard), `certificateId`, `reviewNote`.
`auditLogs`: `device`, `ipAddress` (server fills IP in Firebase mode).

## Evidence storage

Photos upload to `evidence/{uid}/{file}` (Storage rules: owner create only, image types, ≤ 8 MB). `images[].dataUrl` holds the **Storage path** in Firebase mode. Reads use short-lived signed URLs issued by a function (to be added). In local demo mode the field holds a downsized data URL.

## Indexes

See `firestore.indexes.json` (missions by status/date/category/org; participants by user/mission; submissions by org+status+time and user+time; notifications; certificates; audit). Pagination is not yet implemented in the UI — lists are bounded by demo-scale data; add `limit()` + cursors when wiring Firestore.

## Privacy

Exact volunteer GPS is stored only when consented and only readable by the owning org's staff and admins. Account deletion anonymises: evidence/notes/GPS removed, certificates keep verifiability but show "Former volunteer".
