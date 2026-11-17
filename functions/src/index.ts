/**
 * WORFIX Cloud Functions — server-authoritative operations (Firebase Admin SDK).
 *
 * STATUS: written and type-checked; NOT yet exercised against the Firebase Emulator Suite or a live
 * project (no credentials/emulator were available when this was built). Treat as "implemented, untested".
 *
 * Implemented here (the integrity-critical paths): createUserProfile, joinMission, submitEvidence,
 * reviewSubmission, decideOrganization. Remaining operations from web/src/lib/store/api.ts
 * (saveMission, publishMission, registerOrganization, moderateMission, setUserStatus, …) follow the same
 * pattern and are listed in API_DOCUMENTATION.md. Firestore rules deny client writes to those
 * collections, so they are unavailable — not insecure — until implemented.
 *
 * Every function: authenticates, loads the caller's role from Firestore (never from client input),
 * validates input, runs the shared domain rules, and writes inside a transaction with an audit log.
 */
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { assertActive, DomainError, isAdmin } from "./domain/permissions";
import { assessSubmission } from "./domain/fraud";
import { resubmit, reviewSubmission as reviewDomain, type ReviewDecision } from "./domain/verification";
import { ageErrors } from "./domain/validation";
import type { AuditLog, Evidence, Mission, MissionParticipant, Organization, Submission, UserProfile } from "./domain/types";

initializeApp();
const db = getFirestore();
const nowIso = () => new Date().toISOString();
const OPTS = { region: "europe-west1", cors: true, enforceAppCheck: false /* enable once App Check is configured */ } as const;

/* ───────── helpers ───────── */
function uidOf(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "Please sign in.");
  return req.auth.uid;
}

async function loadUser(tx: Transaction, uid: string): Promise<UserProfile> {
  const snap = await tx.get(db.doc(`users/${uid}`));
  if (!snap.exists) throw new HttpsError("permission-denied", "No profile for this account.");
  const u = snap.data() as UserProfile;
  assertActive(u);
  return u;
}

function wrap<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((e) => {
    if (e instanceof HttpsError) throw e;
    if (e instanceof DomainError) {
      const map = { forbidden: "permission-denied", not_found: "not-found", invalid_state: "failed-precondition", validation: "invalid-argument", conflict: "already-exists", suspended: "permission-denied", unverified_email: "failed-precondition" } as const;
      throw new HttpsError(map[e.code], e.message);
    }
    console.error("unhandled", e);
    throw new HttpsError("internal", "Something went wrong. Please try again.");
  });
}

function audit(tx: Transaction, actor: { id: string; role: UserProfile["role"] }, action: string, resource: string, resourceId: string, detail = "") {
  const a: AuditLog = { id: randomUUID(), actor: actor.id, actorRole: actor.role, action, resource, resourceId, timestamp: nowIso(), detail, ipAddress: null, device: null };
  tx.set(db.doc(`auditLogs/${a.id}`), a);
}

const str = (v: unknown, max: number, field: string) => {
  if (typeof v !== "string" || v.length > max) throw new HttpsError("invalid-argument", `${field} is invalid.`);
  return v.trim();
};

/* ───────── createUserProfile ───────── */
export const createUserProfile = onCall(OPTS, (req) => wrap(async () => {
  const uid = uidOf(req);
  const d = req.data ?? {};
  const fullName = str(d.fullName, 80, "fullName");
  if (fullName.length < 2) throw new HttpsError("invalid-argument", "Full name is required.");
  const accountType = d.accountType === "organization" ? "organization" : "volunteer"; // admin can never be self-assigned
  const errs = ageErrors(d.birthYear, d.guardianConsent);
  if (Object.keys(errs).length || !Number.isInteger(d.birthYear)) throw new HttpsError("invalid-argument", Object.values(errs)[0] ?? "Enter a valid year of birth.");
  const email = req.auth?.token.email;
  if (!email) throw new HttpsError("failed-precondition", "Account has no email.");
  const ref = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return; // idempotent
    const t = nowIso();
    const user: UserProfile = {
      id: uid, email: email.toLowerCase(), emailVerified: !!req.auth?.token.email_verified, fullName, username: `user_${uid.slice(0, 8).toLowerCase()}`,
      avatar: null, bio: "", country: "", province: "", city: "", feedVisible: true, languages: [], skills: [], interests: [], level: 1, xp: 0, points: 0, trustScore: 50,
      reputation: 0, streak: 0, lastApprovedDay: null, totalVolunteerHours: 0, totalImpact: 0, impact: {}, onboarded: false, organizationId: null,
      role: accountType, status: "active", createdAt: t, updatedAt: t, lastLogin: t,
    };
    // Sensitive fields live in a separate, reviewer-only document so rules can hide them from the owner.
    const { trustScore, reputation, ...publicUser } = user;
    tx.set(ref, publicUser);
    tx.set(db.doc(`userPrivate/${uid}`), { trustScore, reputation });
    audit(tx, { id: uid, role: user.role }, "user.register", "users", uid);
  });
  return { ok: true };
}));

/* ───────── joinMission ───────── */
export const joinMission = onCall(OPTS, (req) => wrap(async () => {
  const uid = uidOf(req);
  const missionId = str(req.data?.missionId, 128, "missionId");
  await db.runTransaction(async (tx) => {
    const user = await loadUser(tx, uid);
    const mRef = db.doc(`missions/${missionId}`);
    const m = (await tx.get(mRef)).data() as Mission | undefined;
    if (!m || m.status !== "published") throw new DomainError("not_found", "This mission isn't open.");
    if (!req.auth?.token.email_verified) throw new DomainError("unverified_email", "Verify your email before joining a mission.");
    if (user.role !== "volunteer") throw new DomainError("forbidden", "Only volunteer accounts can join missions.");
    if (!user.onboarded) throw new DomainError("invalid_state", "Finish your profile first.");
    if (Date.parse(m.deadline) < Date.now()) throw new DomainError("invalid_state", "Sign-ups for this mission have closed.");
    const pRef = db.doc(`missionParticipants/${missionId}_${uid}`);
    const existing = (await tx.get(pRef)).data() as MissionParticipant | undefined;
    if (existing && (existing.status === "accepted" || existing.status === "pending")) throw new DomainError("conflict", "You've already joined this mission.");
    if (existing?.status === "rejected") throw new DomainError("forbidden", "The organizer declined your participation.");
    if (m.participantsCount >= m.capacity) throw new DomainError("conflict", "This mission is full.");
    const p: MissionParticipant = { id: pRef.id, missionId, userId: uid, joinedAt: nowIso(), status: "accepted", attendance: false, completionStatus: "joined" };
    tx.set(pRef, p);
    tx.update(mRef, { participantsCount: m.participantsCount + 1, updatedAt: nowIso() });
    audit(tx, user, "mission.join", "missionParticipants", pRef.id);
  });
  return { ok: true };
}));

/* ───────── submitEvidence ───────── */
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const submitEvidence = onCall(OPTS, (req) => wrap(async () => {
  const uid = uidOf(req);
  const d = req.data ?? {};
  const missionId = str(d.missionId, 128, "missionId");
  const notes = str(d.notes ?? "", 1000, "notes");
  const gpsConsent = d.gpsConsent === true;
  const rawImages = Array.isArray(d.images) ? d.images.slice(0, 4) : [];
  if (rawImages.length < 1) throw new HttpsError("invalid-argument", "Add at least one photo as evidence.");

  // Validate every upload server-side: path ownership, existence, real content type and size.
  const bucket = getStorage().bucket();
  const images: Evidence[] = [];
  for (const im of rawImages) {
    const path = str(im?.storagePath, 300, "storagePath");
    if (!path.startsWith(`evidence/${uid}/`) || path.includes("..")) throw new HttpsError("permission-denied", "Invalid upload path.");
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) throw new HttpsError("failed-precondition", "An uploaded photo is missing. Please upload it again.");
    const [meta] = await file.getMetadata();
    if (!TYPES.has(String(meta.contentType)) || Number(meta.size) > MAX_BYTES) {
      await file.delete().catch(() => {});
      throw new HttpsError("invalid-argument", "Photos must be JPEG, PNG or WebP under 8 MB.");
    }
    const sha256 = str(im?.sha256, 64, "sha256");
    images.push({ kind: "image", dataUrl: path /* storage path in Firebase mode */, sha256, name: str(im?.name ?? "photo", 80, "name"), size: Number(meta.size) });
  }
  const gps = gpsConsent && d.gps && Number.isFinite(d.gps.lat) && Number.isFinite(d.gps.lng) ? { lat: Number(d.gps.lat), lng: Number(d.gps.lng), accuracy: Number(d.gps.accuracy) || 0 } : null;

  // Duplicate detection input: other submissions that share a hash (denormalised imageHashes field).
  const hashes = images.map((i) => i.sha256);
  const dupSnap = await db.collection("missionSubmissions").where("imageHashes", "array-contains-any", hashes).limit(20).get();
  const others = dupSnap.docs.map((x) => x.data() as Submission);

  await db.runTransaction(async (tx) => {
    const user = await loadUser(tx, uid);
    const m = (await tx.get(db.doc(`missions/${missionId}`))).data() as Mission | undefined;
    const p = (await tx.get(db.doc(`missionParticipants/${missionId}_${uid}`))).data() as MissionParticipant | undefined;
    if (!m || !p || p.status !== "accepted") throw new DomainError("forbidden", "Join this mission before submitting evidence.");
    const sRef = db.doc(`missionSubmissions/${missionId}_${uid}`); // one submission per volunteer per mission
    const existing = (await tx.get(sRef)).data() as Submission | undefined;
    const t = nowIso();
    let sub: Submission;
    if (existing) {
      sub = { ...resubmit(existing, { images, notes }, t), gps: gps ?? existing.gps };
    } else {
      sub = {
        id: sRef.id, missionId, userId: uid, organizationId: m.organizationId, images, videos: [], notes, gps, gpsConsent, timestamp: t,
        metadata: { userAgent: String(req.rawRequest.headers["user-agent"] ?? "").slice(0, 160), submissionCount: 1 },
        aiConfidence: null, fraudScore: 0, fraudFlags: [], verificationStatus: "pending", reviewedBy: null, reviewedAt: null, reviewNote: "", rewardGrantedAt: null, certificateId: null,
      };
    }
    const fr = assessSubmission(sub, m, others.filter((o) => o.id !== sub.id));
    // Fraud fields are written to a reviewer-only document; the volunteer-readable doc never has them.
    const { fraudScore, fraudFlags, aiConfidence, ...publicSub } = sub;
    tx.set(sRef, { ...publicSub, imageHashes: sub.images.map((i) => i.sha256) });
    tx.set(db.doc(`submissionPrivate/${sRef.id}`), { fraudScore: fr.score, fraudFlags: fr.flags, aiConfidence });
    tx.update(db.doc(`missionParticipants/${missionId}_${uid}`), { completionStatus: "submitted" });
    audit(tx, user, existing ? "submission.resubmit" : "submission.create", "missionSubmissions", sRef.id);
  });
  return { ok: true };
}));

/* ───────── reviewSubmission (the reward path) ───────── */
export const reviewSubmission = onCall(OPTS, (req) => wrap(async () => {
  const uid = uidOf(req);
  const submissionId = str(req.data?.submissionId, 200, "submissionId");
  const decision = req.data?.decision as ReviewDecision;
  if (!["approved", "rejected", "needs_more_info"].includes(decision)) throw new HttpsError("invalid-argument", "Invalid decision.");
  const note = str(req.data?.note ?? "", 1000, "note");
  const origin = process.env.PUBLIC_ORIGIN;
  if (!origin) throw new HttpsError("failed-precondition", "PUBLIC_ORIGIN is not configured.");

  await db.runTransaction(async (tx) => {
    const reviewer = await loadUser(tx, uid);
    const sRef = db.doc(`missionSubmissions/${submissionId}`);
    const submission = (await tx.get(sRef)).data() as Submission | undefined;
    if (!submission) throw new DomainError("not_found", "Submission not found.");
    const mission = (await tx.get(db.doc(`missions/${submission.missionId}`))).data() as Mission;
    const volunteer = (await tx.get(db.doc(`users/${submission.userId}`))).data() as UserProfile;
    const org = (await tx.get(db.doc(`organizations/${submission.organizationId}`))).data() as Organization | undefined;
    const vPriv = (await tx.get(db.doc(`userPrivate/${submission.userId}`))).data() as { trustScore: number; reputation: number } | undefined;

    // The same pure function the web app's tests cover: permissions, state machine, reward-once guard.
    const res = reviewDomain({
      submission, mission, volunteer: { ...volunteer, trustScore: vPriv?.trustScore ?? 50, reputation: vPriv?.reputation ?? 0 }, reviewer,
      organization: org ?? null, decision, note, now: nowIso(), newId: randomUUID, origin,
    });

    const { trustScore: _t, reputation: _r, ...pubVolunteer } = res.volunteer;
    tx.update(sRef, res.submission as unknown as Record<string, unknown>);
    tx.set(db.doc(`users/${volunteer.id}`), pubVolunteer);
    tx.set(db.doc(`verificationRecords/${res.record.id}`), res.record);
    if (res.certificate) tx.set(db.doc(`certificates/${res.certificate.id}`), res.certificate);
    for (const n of res.notifications) tx.set(db.doc(`notifications/${n.id}`), n);
    tx.set(db.doc(`auditLogs/${res.audit.id}`), res.audit);
    if (decision === "approved") tx.update(db.doc(`missionParticipants/${submission.missionId}_${submission.userId}`), { completionStatus: "completed", attendance: true });
  });
  return { ok: true };
}));

/* ───────── decideOrganization (admin) ───────── */
export const decideOrganization = onCall(OPTS, (req) => wrap(async () => {
  const uid = uidOf(req);
  const orgId = str(req.data?.organizationId, 128, "organizationId");
  const decision = req.data?.decision;
  if (decision !== "approved" && decision !== "rejected") throw new HttpsError("invalid-argument", "Invalid decision.");
  const note = str(req.data?.note ?? "", 600, "note");
  if (decision === "rejected" && note.length < 5) throw new HttpsError("invalid-argument", "Tell the organization why it wasn't approved.");
  await db.runTransaction(async (tx) => {
    const admin = await loadUser(tx, uid);
    if (!isAdmin(admin.role)) throw new DomainError("forbidden", "Administrator access required.");
    const ref = db.doc(`organizations/${orgId}`);
    const org = (await tx.get(ref)).data() as Organization | undefined;
    if (!org) throw new DomainError("not_found", "Organization not found.");
    tx.update(ref, { verificationStatus: decision, verificationNote: note });
    const nId = randomUUID();
    tx.set(db.doc(`notifications/${nId}`), {
      id: nId, userId: org.ownerId, type: "organization", title: decision === "approved" ? "Organization approved" : "Organization not approved",
      message: decision === "approved" ? `${org.name} can now publish missions.` : note, link: "/org", read: false, createdAt: nowIso(),
    });
    audit(tx, admin, `organization.${decision}`, "organizations", orgId, note);
  });
  return { ok: true };
}));
