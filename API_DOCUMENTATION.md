# API Documentation

The application talks to one async surface: `web/src/lib/store/api.ts`. Today it is implemented against the local dev store. The Firebase adapter must implement the same signatures, routing **every mutation** to a Cloud Function and **reads** to Firestore (rules-protected).

All mutating calls: derive the actor from the session, re-read role/status from the stored user, validate with the shared zod schemas, run the domain rules, and append an audit log entry.

## Cloud Functions (callable, region `europe-west1`) — written, **untested**

| Function | Input | Rules enforced |
|---|---|---|
| `createUserProfile` | `fullName, accountType(volunteer\|organization), birthYear, guardianConsent` | Role limited to volunteer/organization; age ≥ 15; guardian confirmation 15–17; idempotent |
| `joinMission` | `missionId` | Published, before deadline, capacity, email verified, volunteer role, onboarded, no duplicate/declined; transaction |
| `submitEvidence` | `missionId, notes, gpsConsent, gps?, images[{storagePath, sha256, name}]` | 1–4 photos; path must be `evidence/{uid}/…`; file exists, JPEG/PNG/WebP, ≤ 8 MB; GPS dropped without consent; fraud assessment stored in `submissionPrivate`; resubmission only from `needs_more_info` |
| `reviewSubmission` | `submissionId, decision(approved\|rejected\|needs_more_info), note` | Reviewer must be owning approved org staff or admin, never the author; legal transitions only; note required unless approving; **rewards + certificate once** |
| `decideOrganization` | `organizationId, decision, note` | Admin only; rejection needs a reason; notifies owner |

## Not yet implemented as functions (exist in the local API; Firestore rules currently deny these writes)

`registerOrganization`, `updateOrganization`, `saveMission`, `publishMission`, `closeMission`, `deleteDraft`, `leaveMission`, `decideParticipant`, `moderateMission`, `setUserStatus`, `deleteAccount`, `exportMyData`, `verifyCertificate` (public, returns the safe snapshot only), `markNotificationsRead` (rules allow client `read` flip).

## Local API surface (`api.*`)

Auth: `register, login, logout, me, verifyEmail, resendVerification, requestPasswordReset, resetPassword, guard`
Profile: `updateProfile, deleteAccount, exportMyData`
Organizations: `registerOrganization, myOrganization, updateOrganization, publicOrganizations`
Missions: `listMissions, getMission, saveMission, publishMission, deleteDraft, closeMission, moderateMission`
Participation: `joinMission, leaveMission, myParticipations, missionParticipants, decideParticipant`
Submissions: `submitEvidence, reviewQueue, review`
Rewards: `myCertificates, verifyCertificate`
Notifications: `myNotifications, markNotificationsRead`
Analytics: `publicStats, orgAnalytics, adminOverview`
Admin: `adminUsers, setUserStatus, adminOrganizations, decideOrganization, adminAudit, adminRecords`

## Errors

`DomainError(code, message)` with codes `forbidden | not_found | invalid_state | validation | conflict | suspended | unverified_email` — mapped to `HttpsError` in functions. `ValidationError(fields)` carries per-field messages for forms. Messages never blame the user and say what to do next.
