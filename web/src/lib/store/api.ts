"use client";
/**
 * WORFIX application API (local dev implementation).
 *
 * Contract: the Firebase adapter must implement this same surface, with every mutating call
 * executed in a Cloud Function (Admin SDK) that re-runs the same domain rules. This file never
 * trusts caller-supplied role, status, reward or verification values — it re-reads them from stored records.
 */
import { assertActive, canManageMission, canEnterArea, DomainError, isAdmin, type Area } from "../domain/permissions";
import { computeMissionReward, dayKey, levelForXp } from "../domain/rewards";
import { normaliseCode } from "../domain/certificates";
import { assessSubmission } from "../domain/fraud";
import { resubmit, reviewSubmission, type ReviewDecision } from "../domain/verification";
import {
  ageErrors, fieldErrors, loginSchema, missionSchema, organizationSchema, profileSchema, registerSchema, submissionSchema,
  type MissionInput, type OrganizationInput, type ProfileInput, type RegisterInput,
} from "../domain/validation";
import type {
  AuditLog, Category, Certificate, Evidence, Mission, MissionParticipant, Notification, Organization, Role, Submission,
  UserProfile, VerificationRecord,
} from "../domain/types";
import { computeAchievements, nextAchievement, type AchievementStats } from "../domain/achievements";
import { buildAdvice } from "../domain/advice";
import * as cloud from "./cloud";
import { commit, FIREBASE, getDB, hashPassword, nowIso, ready, uid, type DB } from "./db";

export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? "Check the highlighted fields.");
    this.name = "ValidationError";
  }
}

export type SelfUser = Omit<UserProfile, "trustScore">;
const SESSION_KEY = "worfix.dev.session";
const SESSION_HOURS: Record<string, number> = { admin: 8, super_admin: 8, default: 24 * 7 };
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60_000;

const strip = (u: UserProfile): SelfUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { trustScore, ...rest } = u;
  return rest;
};

/* ───────────────────────── session ───────────────────────── */

function readSession(db: DB): UserProfile | null {
  if (FIREBASE) {
    const u = db.users.find((x) => x.id === cloud.currentUid());
    return u && u.status === "active" ? u : null;
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as { userId: string; expiresAt: string };
    if (Date.parse(s.expiresAt) < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    const u = db.users.find((x) => x.id === s.userId);
    return u && u.status === "active" ? u : null;
  } catch {
    return null;
  }
}

function actor(db: DB): UserProfile {
  const u = readSession(db);
  if (!u) throw new DomainError("forbidden", "Please sign in to continue.");
  assertActive(u);
  return u;
}

function requireAdmin(db: DB) {
  const u = actor(db);
  if (!isAdmin(u.role)) throw new DomainError("forbidden", "Administrator access required.");
  return u;
}

function log(db: DB, a: { id: string; role: Role | "system" }, action: string, resource: string, resourceId: string, detail = "") {
  db.audits.unshift({
    id: uid(), actor: a.id, actorRole: a.role, action, resource, resourceId, timestamp: nowIso(), detail,
    ipAddress: null, device: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 120),
  });
}

function notify(db: DB, userId: string, n: Omit<Notification, "id" | "userId" | "read" | "createdAt">) {
  db.notifications.unshift({ id: uid(), userId, read: false, createdAt: nowIso(), ...n });
}

const orgOf = (db: DB, id: string) => db.organizations.find((o) => o.id === id) ?? null;

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import("zod").ZodError } }, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw new ValidationError(fieldErrors(r.error));
  return r.data;
}


/* ───────────────────────── community helpers ───────────────────────── */

/** What other volunteers may see about a person: never the email, trust score or exact location. */
function person(u: UserProfile) {
  return {
    id: u.id, fullName: u.fullName, username: u.username, avatar: u.avatar, city: u.city, province: u.province, country: u.country,
    level: levelForXp(u.xp), xp: u.xp, hours: u.totalVolunteerHours, impact: u.totalImpact, streak: u.streak,
  };
}
export type Person = ReturnType<typeof person>;

function friendIdsOf(db: DB, userId: string) {
  return new Set(db.friendships.filter((f) => f.status === "accepted" && (f.from === userId || f.to === userId)).map((f) => (f.from === userId ? f.to : f.from)));
}

function relationOf(db: DB, me: string, other: string): "none" | "friend" | "outgoing" | "incoming" {
  const f = db.friendships.find((x) => (x.from === me && x.to === other) || (x.from === other && x.to === me));
  if (!f) return "none";
  if (f.status === "accepted") return "friend";
  return f.from === me ? "outgoing" : "incoming";
}

function sameArea(a: { country: string; province: string; city: string }, b: { country: string; province: string; city: string }) {
  if (!a.country || a.country !== b.country) return false;
  return a.province && b.province ? a.province === b.province : a.city.toLowerCase() === b.city.toLowerCase();
}

/* ───────────────────────── api ───────────────────────── */

export const api = {
  ready,

  /* ---- auth ---- */
  async me(): Promise<SelfUser | null> {
    await ready();
    const u = readSession(getDB());
    return u ? strip(u) : null;
  },

  /** "firebase" when Firebase is configured, otherwise the browser-local demo store. */
  mode: (FIREBASE ? "firebase" : "local") as "firebase" | "local",

  /** Firebase mode: call after the user opened the link in the verification email. */
  async refreshEmailVerified() {
    await ready();
    if (!FIREBASE) return readSession(getDB())?.emailVerified ?? false;
    const ok = await cloud.refreshVerified();
    if (ok) commit((db) => {
      const u = actor(db);
      if (!u.emailVerified) { u.emailVerified = true; log(db, u, "user.verify_email", "users", u.id); }
    });
    return ok;
  },

  async register(input: RegisterInput) {
    await ready();
    const parsed = registerSchema.safeParse(input);
    // Age rules are reported alongside any other field errors (zod skips cross-field checks when a field fails).
    const errs = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...ageErrors(input.birthYear, input.guardianConsent) };
    if (!parsed.success || Object.keys(errs).length) throw new ValidationError(errs);
    const data = parsed.data;
    let cloudUid = "";
    if (FIREBASE) {
      try { cloudUid = await cloud.signUp(data.email, data.password); } catch (e) {
        if (e instanceof cloud.CloudAuthError && e.code === "auth/email-already-in-use") throw new ValidationError({ email: e.message });
        throw e;
      }
    }
    const pw = FIREBASE ? null : await hashPassword(data.password);
    let token = "";
    commit((db) => {
      if (db.users.some((u) => u.email === data.email)) throw new ValidationError({ email: "An account with this email already exists." });
      const t = nowIso();
      const user: UserProfile = {
        id: cloudUid || uid(), email: data.email, emailVerified: false, fullName: data.fullName, username: `user_${uid().slice(0, 8)}`,
        avatar: null, bio: "", country: "", province: "", city: "", feedVisible: true, languages: [], skills: [], interests: [], level: 1, xp: 0, points: 0,
        trustScore: 50, reputation: 0, streak: 0, lastApprovedDay: null, totalVolunteerHours: 0, totalImpact: 0, impact: {},
        onboarded: false, organizationId: null,
        role: data.accountType, // only "volunteer" | "organization" are accepted by the schema — admin can never be self-assigned
        status: "active", createdAt: t, updatedAt: t, lastLogin: t,
      };
      db.users.push(user);
      log(db, { id: user.id, role: user.role }, "user.register", "users", user.id);
      if (!pw) return; // Firebase Auth holds the credentials and the session
      db.credentials.push({ userId: user.id, ...pw });
      token = uid();
      db.tokens.push({ token, userId: user.id, kind: "verify", expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
      const hours = SESSION_HOURS[user.role] ?? SESSION_HOURS.default;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString() }));
    });
    if (FIREBASE) await cloud.sendVerification().catch(() => undefined); // real email; can be re-sent from the dashboard
    // Local demo mode has no mail server; the token is returned so the UI can show a labelled dev link.
    return { devVerifyToken: token };
  },

  async login(input: { email: string; password: string }) {
    await ready();
    const data = parse(loginSchema, input);
    if (FIREBASE) {
      const id = await cloud.signIn(data.email, data.password);
      const u = getDB().users.find((x) => x.id === id);
      if (!u || u.status !== "active") {
        await cloud.logOut();
        throw new DomainError(u?.status === "suspended" ? "suspended" : "forbidden", u?.status === "suspended" ? "This account is suspended. Contact support." : "That email and password don't match.");
      }
      const verified = cloud.authEmailVerified();
      commit((db) => {
        const me = db.users.find((x) => x.id === id)!;
        me.lastLogin = nowIso();
        if (verified) me.emailVerified = true;
        log(db, { id: me.id, role: me.role }, "user.login", "users", me.id);
      });
      return strip(u);
    }
    const db0 = getDB();
    const att = db0.loginAttempts[data.email];
    if (att && Date.now() - att.first < WINDOW_MS && att.count >= MAX_ATTEMPTS) {
      throw new DomainError("forbidden", "Too many attempts. Wait a few minutes and try again.");
    }
    const user = db0.users.find((u) => u.email === data.email);
    const cred = user && db0.credentials.find((c) => c.userId === user.id);
    const ok = user && cred ? (await hashPassword(data.password, cred.salt)).hash === cred.hash : false;
    if (!user || !ok) {
      commit((db) => {
        const a = db.loginAttempts[data.email];
        db.loginAttempts[data.email] = !a || Date.now() - a.first > WINDOW_MS ? { count: 1, first: Date.now() } : { ...a, count: a.count + 1 };
      });
      throw new DomainError("forbidden", "That email and password don't match.");
    }
    if (user.status === "suspended") throw new DomainError("suspended", "This account is suspended. Contact support.");
    if (user.status === "deleted") throw new DomainError("forbidden", "That email and password don't match.");
    commit((db) => {
      delete db.loginAttempts[data.email];
      const u = db.users.find((x) => x.id === user.id)!;
      u.lastLogin = nowIso();
      const hours = SESSION_HOURS[u.role] ?? SESSION_HOURS.default;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, expiresAt: new Date(Date.now() + hours * 3_600_000).toISOString() }));
      log(db, { id: u.id, role: u.role }, "user.login", "users", u.id);
    });
    return strip(db0.users.find((u) => u.id === user.id)!);
  },

  async logout() {
    if (FIREBASE) return cloud.logOut();
    localStorage.removeItem(SESSION_KEY);
    commit(() => {});
  },

  async verifyEmail(token: string) {
    await ready();
    commit((db) => {
      const t = db.tokens.find((x) => x.token === token && x.kind === "verify");
      if (!t || Date.parse(t.expiresAt) < Date.now()) throw new DomainError("not_found", "This verification link is invalid or has expired.");
      const u = db.users.find((x) => x.id === t.userId)!;
      u.emailVerified = true;
      db.tokens = db.tokens.filter((x) => x !== t);
      log(db, { id: u.id, role: u.role }, "user.verify_email", "users", u.id);
    });
  },

  async resendVerification() {
    await ready();
    if (FIREBASE) {
      await cloud.sendVerification();
      return { devVerifyToken: "" };
    }
    let token = "";
    commit((db) => {
      const u = actor(db);
      if (u.emailVerified) throw new DomainError("conflict", "Your email is already verified.");
      db.tokens = db.tokens.filter((t) => !(t.userId === u.id && t.kind === "verify"));
      token = uid();
      db.tokens.push({ token, userId: u.id, kind: "verify", expiresAt: new Date(Date.now() + 86_400_000).toISOString() });
    });
    return { devVerifyToken: token };
  },

  async requestPasswordReset(email: string) {
    await ready();
    if (FIREBASE) {
      await cloud.sendReset(email.trim().toLowerCase());
      return { devResetToken: null as string | null };
    }
    let token: string | null = null;
    commit((db) => {
      const u = db.users.find((x) => x.email === email.trim().toLowerCase() && x.status === "active");
      if (!u) return;
      db.tokens = db.tokens.filter((t) => !(t.userId === u.id && t.kind === "reset"));
      token = uid();
      db.tokens.push({ token, userId: u.id, kind: "reset", expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    });
    return { devResetToken: token as string | null };
  },

  async resetPassword(token: string, password: string) {
    await ready();
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      throw new ValidationError({ password: "Use at least 8 characters with a letter and a number." });
    }
    const pw = await hashPassword(password);
    commit((db) => {
      const t = db.tokens.find((x) => x.token === token && x.kind === "reset");
      if (!t || Date.parse(t.expiresAt) < Date.now()) throw new DomainError("not_found", "This reset link is invalid or has expired.");
      db.credentials = db.credentials.filter((c) => c.userId !== t.userId);
      db.credentials.push({ userId: t.userId, ...pw });
      db.tokens = db.tokens.filter((x) => x !== t);
      const u = db.users.find((x) => x.id === t.userId)!;
      log(db, { id: u.id, role: u.role }, "user.reset_password", "users", u.id);
    });
  },

  /** Used by route guards. */
  async guard(area: Area): Promise<{ user: SelfUser | null; allowed: boolean }> {
    await ready();
    const u = readSession(getDB());
    if (!u) return { user: null, allowed: false };
    return { user: strip(u), allowed: canEnterArea(u.role, area) };
  },

  /* ---- profile ---- */
  async updateProfile(input: ProfileInput, extra: { avatar?: string | null; onboarded?: boolean } = {}) {
    await ready();
    const data = parse(profileSchema, input);
    commit((db) => {
      const u = actor(db);
      if (db.users.some((x) => x.id !== u.id && x.username === data.username)) throw new ValidationError({ username: "That username is taken." });
      Object.assign(u, data, { updatedAt: nowIso() });
      if (extra.avatar !== undefined) u.avatar = extra.avatar;
      if (extra.onboarded) u.onboarded = true;
      log(db, u, "user.update_profile", "users", u.id);
    });
  },

  async deleteAccount() {
    await ready();
    commit((db) => {
      const u = actor(db);
      if (isAdmin(u.role)) throw new DomainError("forbidden", "Administrator accounts are removed by a super admin.");
      for (const p of db.participants.filter((x) => x.userId === u.id && x.status !== "withdrawn")) {
        p.status = "withdrawn";
        const m = db.missions.find((x) => x.id === p.missionId);
        if (m) m.participantsCount = Math.max(0, m.participantsCount - 1);
      }
      // Anonymise: evidence is removed, verification outcomes and certificates stay verifiable without the person's name.
      for (const s of db.submissions.filter((x) => x.userId === u.id)) { s.images = []; s.videos = []; s.notes = ""; s.gps = null; }
      for (const c of db.certificates.filter((x) => x.userId === u.id)) c.holderName = "Former volunteer";
      db.notifications = db.notifications.filter((n) => n.userId !== u.id);
      db.credentials = db.credentials.filter((c) => c.userId !== u.id);
      db.tokens = db.tokens.filter((t) => t.userId !== u.id);
      db.friendships = db.friendships.filter((f) => f.from !== u.id && f.to !== u.id);
      db.cheers = db.cheers.filter((c) => c.userId !== u.id);
      Object.assign(u, {
        email: `deleted-${u.id}@deleted.invalid`, fullName: "Deleted user", username: `deleted_${u.id.slice(0, 8)}`, avatar: null,
        bio: "", city: "", province: "", country: "", skills: [], languages: [], interests: [], status: "deleted", updatedAt: nowIso(),
      });
      log(db, u, "user.delete_account", "users", u.id);
      localStorage.removeItem(SESSION_KEY);
    });
    if (FIREBASE) await cloud.deleteAuthUser();
  },

  async exportMyData() {
    await ready();
    const db = getDB();
    const u = actor(db);
    return {
      exportedAt: nowIso(),
      profile: strip(u),
      participations: db.participants.filter((p) => p.userId === u.id),
      submissions: db.submissions.filter((s) => s.userId === u.id).map(publicSubmission),
      certificates: db.certificates.filter((c) => c.userId === u.id),
      notifications: db.notifications.filter((n) => n.userId === u.id),
      friendships: db.friendships.filter((f) => f.from === u.id || f.to === u.id),
      cheers: db.cheers.filter((c) => c.userId === u.id),
    };
  },

  /* ---- organizations ---- */
  async registerOrganization(input: OrganizationInput) {
    await ready();
    const data = parse(organizationSchema, input);
    let id = "";
    commit((db) => {
      const u = actor(db);
      if (u.role !== "organization") throw new DomainError("forbidden", "Only organization accounts can register an organization.");
      if (u.organizationId) throw new DomainError("conflict", "Your account already has an organization.");
      id = uid();
      db.organizations.push({
        id, ...data, logo: null, verificationStatus: "pending", verificationNote: "", ownerId: u.id, members: [u.id],
        rating: 0, totalVolunteers: 0, totalMissions: 0, createdAt: nowIso(),
      });
      u.organizationId = id;
      log(db, u, "organization.register", "organizations", id, data.name);
      for (const a of db.users.filter((x) => isAdmin(x.role) && x.status === "active"))
        notify(db, a.id, { type: "organization", title: "Organization awaiting approval", message: data.name, link: "/admin/organizations" });
    });
    return { id };
  },

  async myOrganization(): Promise<Organization | null> {
    await ready();
    const db = getDB();
    const u = actor(db);
    return u.organizationId ? orgOf(db, u.organizationId) : null;
  },

  async updateOrganization(input: OrganizationInput) {
    await ready();
    const data = parse(organizationSchema, input);
    commit((db) => {
      const u = actor(db);
      const o = u.organizationId ? orgOf(db, u.organizationId) : null;
      if (!o || o.ownerId !== u.id) throw new DomainError("forbidden", "Only the organization owner can edit its profile.");
      Object.assign(o, data);
      log(db, u, "organization.update", "organizations", o.id);
    });
  },

  async publicOrganizations(): Promise<Organization[]> {
    await ready();
    return getDB().organizations.filter((o) => o.verificationStatus === "approved").map((o) => ({ ...o, members: [], ownerId: "" }));
  },

  /* ---- missions ---- */
  async listMissions(opts: { scope?: "public" | "mine" | "all"; category?: string; q?: string } = {}) {
    await ready();
    const db = getDB();
    let list = db.missions;
    if (opts.scope === "mine") {
      const u = actor(db);
      list = list.filter((m) => m.organizationId === u.organizationId);
    } else if (opts.scope === "all") {
      requireAdmin(db);
    } else {
      list = list.filter((m) => m.status === "published");
    }
    if (opts.category && opts.category !== "all") list = list.filter((m) => m.category === opts.category);
    if (opts.q) {
      const q = opts.q.toLowerCase();
      list = list.filter((m) => `${m.title} ${m.location} ${m.description}`.toLowerCase().includes(q));
    }
    const viewer = readSession(db);
    const showNote = viewer && (isAdmin(viewer.role) || viewer.organizationId);
    return list
      .map((m) => ({ ...m, moderationNote: showNote ? m.moderationNote : "", organizationName: orgOf(db, m.organizationId)?.name ?? "" }))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || Date.parse(a.date) - Date.parse(b.date));
  },

  async getMission(id: string) {
    await ready();
    const db = getDB();
    const m = db.missions.find((x) => x.id === id);
    if (!m) return null;
    const viewer = readSession(db);
    const canSeeAll = viewer && canManageMission(viewer, m);
    if (m.status !== "published" && !canSeeAll) return null;
    const org = orgOf(db, m.organizationId);
    return { mission: { ...m, moderationNote: canSeeAll ? m.moderationNote : "" }, organizationName: org?.name ?? "Unknown organization" };
  },

  async saveMission(input: MissionInput, existingId?: string) {
    await ready();
    const data = parse(missionSchema, input);
    let id = existingId ?? "";
    commit((db) => {
      const u = actor(db);
      const org = u.organizationId ? orgOf(db, u.organizationId) : null;
      if (!org) throw new DomainError("forbidden", "Register your organization first.");
      const reward = computeMissionReward(data.difficulty, data.duration); // server-computed
      const common = {
        title: data.title, description: data.description, category: data.category, difficulty: data.difficulty, ...reward,
        location: data.location, coordinates: data.lat !== null && data.lng !== null ? { lat: data.lat, lng: data.lng } : null,
        date: new Date(data.date).toISOString(), deadline: new Date(data.deadline).toISOString(), duration: data.duration,
        capacity: data.capacity, requirements: data.requirements, safety: data.safety, equipment: data.equipment,
        impactMetrics: data.impactLabel ? [{ label: data.impactLabel, amountPerVolunteer: data.impactAmount }] : [], updatedAt: nowIso(),
      };
      if (existingId) {
        const m = db.missions.find((x) => x.id === existingId);
        if (!m) throw new DomainError("not_found", "Mission not found.");
        if (!canManageMission(u, m)) throw new DomainError("forbidden", "You can only edit your own organization's missions.");
        if (m.status === "published" && data.capacity < m.participantsCount)
          throw new ValidationError({ capacity: `Already ${m.participantsCount} volunteers joined; capacity can't go lower.` });
        Object.assign(m, common);
        log(db, u, "mission.update", "missions", m.id);
      } else {
        id = uid();
        db.missions.push({
          id, organizationId: org.id, ...common, participantsCount: 0, status: "draft", featured: false, moderationNote: "",
          isDemo: false, createdAt: nowIso(),
        });
        org.totalMissions += 1;
        log(db, u, "mission.create", "missions", id, data.title);
      }
    });
    return { id };
  },

  async publishMission(id: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const m = db.missions.find((x) => x.id === id);
      if (!m) throw new DomainError("not_found", "Mission not found.");
      if (!canManageMission(u, m)) throw new DomainError("forbidden", "You can only publish your own organization's missions.");
      const org = orgOf(db, m.organizationId);
      if (org?.verificationStatus !== "approved") throw new DomainError("invalid_state", "Your organization must be approved before you can publish missions.");
      if (m.status !== "draft") throw new DomainError("invalid_state", "Only drafts can be published.");
      if (Date.parse(m.date) <= Date.now()) throw new DomainError("validation", "The start date is in the past — edit the mission first.");
      m.status = "published";
      m.updatedAt = nowIso();
      log(db, u, "mission.publish", "missions", id, m.title);
    });
  },

  async deleteDraft(id: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const m = db.missions.find((x) => x.id === id);
      if (!m) throw new DomainError("not_found", "Mission not found.");
      if (!canManageMission(u, m)) throw new DomainError("forbidden", "You can only delete your own organization's missions.");
      if (m.status !== "draft") throw new DomainError("invalid_state", "Only drafts can be deleted. Close a published mission instead.");
      db.missions = db.missions.filter((x) => x.id !== id);
      const org = orgOf(db, m.organizationId);
      if (org) org.totalMissions = Math.max(0, org.totalMissions - 1);
      log(db, u, "mission.delete_draft", "missions", id, m.title);
    });
  },

  async closeMission(id: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const m = db.missions.find((x) => x.id === id);
      if (!m) throw new DomainError("not_found", "Mission not found.");
      if (!canManageMission(u, m)) throw new DomainError("forbidden", "Not allowed.");
      if (m.status !== "published") throw new DomainError("invalid_state", "Only published missions can be closed.");
      m.status = "closed";
      m.updatedAt = nowIso();
      log(db, u, "mission.close", "missions", id);
    });
  },

  async moderateMission(id: string, action: "feature" | "unfeature" | "cancel", note = "") {
    await ready();
    commit((db) => {
      const u = requireAdmin(db);
      const m = db.missions.find((x) => x.id === id);
      if (!m) throw new DomainError("not_found", "Mission not found.");
      if (action === "cancel") {
        if (note.trim().length < 5) throw new ValidationError({ note: "Explain why the mission is being cancelled." });
        m.status = "cancelled";
        m.moderationNote = note.trim();
        const org = orgOf(db, m.organizationId);
        if (org) notify(db, org.ownerId, { type: "mission", title: "Mission cancelled by moderators", message: `${m.title}: ${note.trim()}`, link: "/org/missions" });
      } else {
        m.featured = action === "feature";
      }
      m.updatedAt = nowIso();
      log(db, u, `mission.${action}`, "missions", id, note);
    });
  },

  /* ---- participation ---- */
  async joinMission(missionId: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const m = db.missions.find((x) => x.id === missionId);
      if (!m || m.status !== "published") throw new DomainError("not_found", "This mission isn't open.");
      if (!u.emailVerified) throw new DomainError("unverified_email", "Verify your email before joining a mission.");
      if (!u.onboarded) throw new DomainError("invalid_state", "Finish your profile first so organizers know who is joining.");
      if (Date.parse(m.deadline) < Date.now()) throw new DomainError("invalid_state", "Sign-ups for this mission have closed.");
      if (u.organizationId === m.organizationId) throw new DomainError("forbidden", "Organizers can't join their own missions.");
      const id = `${missionId}_${u.id}`;
      const existing = db.participants.find((p) => p.id === id);
      if (existing && existing.status !== "withdrawn" && existing.status !== "rejected") throw new DomainError("conflict", "You've already joined this mission.");
      if (existing?.status === "rejected") throw new DomainError("forbidden", "The organizer declined your participation.");
      if (m.participantsCount >= m.capacity) throw new DomainError("conflict", "This mission is full.");
      if (existing) Object.assign(existing, { status: "accepted", joinedAt: nowIso(), completionStatus: "joined" });
      else db.participants.push({ id, missionId, userId: u.id, joinedAt: nowIso(), status: "accepted", attendance: false, completionStatus: "joined" });
      m.participantsCount += 1;
      const org = orgOf(db, m.organizationId);
      if (org) {
        org.totalVolunteers += 1;
        notify(db, org.ownerId, { type: "mission", title: "New volunteer", message: `${u.fullName} joined "${m.title}"`, link: `/org/missions/${m.id}` });
      }
      log(db, u, "mission.join", "missionParticipants", id);
    });
  },

  async leaveMission(missionId: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const p = db.participants.find((x) => x.id === `${missionId}_${u.id}`);
      if (!p || p.status !== "accepted") throw new DomainError("not_found", "You haven't joined this mission.");
      if (db.submissions.some((s) => s.missionId === missionId && s.userId === u.id)) throw new DomainError("invalid_state", "You already submitted evidence, so you can't withdraw.");
      p.status = "withdrawn";
      const m = db.missions.find((x) => x.id === missionId);
      if (m) m.participantsCount = Math.max(0, m.participantsCount - 1);
      log(db, u, "mission.leave", "missionParticipants", p.id);
    });
  },

  async myParticipations() {
    await ready();
    const db = getDB();
    const u = actor(db);
    return db.participants
      .filter((p) => p.userId === u.id && p.status !== "withdrawn")
      .map((p) => {
        const mission = db.missions.find((m) => m.id === p.missionId)!;
        const sub = db.submissions.find((s) => s.missionId === p.missionId && s.userId === u.id) ?? null;
        return { participant: p, mission, organizationName: orgOf(db, mission.organizationId)?.name ?? "", submission: sub ? publicSubmission(sub) : null };
      })
      .filter((x) => x.mission);
  },

  async missionParticipants(missionId: string) {
    await ready();
    const db = getDB();
    const u = actor(db);
    const m = db.missions.find((x) => x.id === missionId);
    if (!m || !canManageMission(u, m)) throw new DomainError("forbidden", "Not allowed.");
    return db.participants
      .filter((p) => p.missionId === missionId)
      .map((p) => {
        const v = db.users.find((x) => x.id === p.userId)!;
        const s = db.submissions.find((x) => x.missionId === missionId && x.userId === p.userId) ?? null;
        return {
          participant: p,
          volunteer: { id: v.id, fullName: v.fullName, username: v.username, city: v.city, country: v.country, level: v.level, interests: v.interests, skills: v.skills, bio: v.bio, languages: v.languages, avatar: v.avatar },
          submissionStatus: s?.verificationStatus ?? null,
        };
      });
  },

  async decideParticipant(missionId: string, userId: string, decision: "accepted" | "rejected") {
    await ready();
    commit((db) => {
      const u = actor(db);
      const m = db.missions.find((x) => x.id === missionId);
      if (!m || !canManageMission(u, m)) throw new DomainError("forbidden", "Not allowed.");
      const p = db.participants.find((x) => x.id === `${missionId}_${userId}`);
      if (!p) throw new DomainError("not_found", "Participant not found.");
      if (db.submissions.some((s) => s.missionId === missionId && s.userId === userId)) throw new DomainError("invalid_state", "This volunteer already submitted evidence.");
      if (decision === "rejected" && p.status === "accepted") m.participantsCount = Math.max(0, m.participantsCount - 1);
      if (decision === "accepted" && p.status !== "accepted") {
        if (m.participantsCount >= m.capacity) throw new DomainError("conflict", "Mission is full.");
        m.participantsCount += 1;
      }
      p.status = decision;
      notify(db, userId, { type: "mission", title: decision === "accepted" ? "You're in" : "Participation declined", message: m.title, link: `/app/missions/${m.id}` });
      log(db, u, `participant.${decision}`, "missionParticipants", p.id);
    });
  },

  /* ---- submissions ---- */
  async submitEvidence(missionId: string, input: { notes: string; gpsConsent: boolean; gps: { lat: number; lng: number; accuracy: number } | null; images: Evidence[] }) {
    await ready();
    const meta = parse(submissionSchema, { notes: input.notes, gpsConsent: input.gpsConsent });
    if (input.images.length < 1) throw new ValidationError({ images: "Add at least one photo as evidence." });
    if (input.images.length > 4) throw new ValidationError({ images: "Up to 4 photos per submission." });
    commit((db) => {
      const u = actor(db);
      const m = db.missions.find((x) => x.id === missionId);
      const p = db.participants.find((x) => x.id === `${missionId}_${u.id}`);
      if (!m || !p || p.status !== "accepted") throw new DomainError("forbidden", "Join this mission before submitting evidence.");
      const existing = db.submissions.find((s) => s.missionId === missionId && s.userId === u.id);
      const t = nowIso();
      const gps = meta.gpsConsent ? input.gps : null; // never keep location without consent
      if (existing) {
        const next = resubmit(existing, { images: input.images, notes: meta.notes }, t);
        const others = db.submissions.filter((s) => s.id !== existing.id);
        const fr = assessSubmission({ ...next, gps: gps ?? next.gps }, m, others);
        Object.assign(existing, next, { gps: gps ?? existing.gps, fraudScore: fr.score, fraudFlags: fr.flags });
        p.completionStatus = "submitted";
        log(db, u, "submission.resubmit", "missionSubmissions", existing.id);
      } else {
        const sub: Submission = {
          id: uid(), missionId, userId: u.id, organizationId: m.organizationId, images: input.images, videos: [], notes: meta.notes,
          gps, gpsConsent: meta.gpsConsent, timestamp: t, metadata: { userAgent: navigator.userAgent.slice(0, 160), submissionCount: 1 },
          aiConfidence: null, fraudScore: 0, fraudFlags: [], verificationStatus: "pending", reviewedBy: null, reviewedAt: null,
          reviewNote: "", rewardGrantedAt: null, certificateId: null,
        };
        const fr = assessSubmission(sub, m, db.submissions);
        sub.fraudScore = fr.score;
        sub.fraudFlags = fr.flags;
        db.submissions.push(sub);
        p.completionStatus = "submitted";
        log(db, u, "submission.create", "missionSubmissions", sub.id);
      }
      const org = orgOf(db, m.organizationId);
      if (org) notify(db, org.ownerId, { type: "submission", title: "Evidence to review", message: `${u.fullName} submitted evidence for "${m.title}"`, link: "/org/review" });
    });
  },

  async reviewQueue(scope: "org" | "admin") {
    await ready();
    const db = getDB();
    const u = actor(db);
    if (scope === "admin") requireAdmin(db);
    else if (u.role !== "organization" && !isAdmin(u.role)) throw new DomainError("forbidden", "Not allowed.");
    const subs = db.submissions.filter((s) => (scope === "admin" ? true : s.organizationId === u.organizationId));
    return subs
      .map((s) => ({
        submission: s, // reviewers may see fraud flags; volunteers never do (see publicSubmission)
        mission: db.missions.find((m) => m.id === s.missionId)!,
        volunteer: (({ id, fullName, username, city, country, level }) => ({ id, fullName, username, city, country, level }))(db.users.find((x) => x.id === s.userId)!),
      }))
      .filter((x) => x.mission)
      .sort((a, b) => Date.parse(b.submission.timestamp) - Date.parse(a.submission.timestamp));
  },

  async review(submissionId: string, decision: ReviewDecision, note: string) {
    await ready();
    commit((db) => {
      const reviewer = actor(db);
      const s = db.submissions.find((x) => x.id === submissionId);
      if (!s) throw new DomainError("not_found", "Submission not found.");
      const mission = db.missions.find((m) => m.id === s.missionId)!;
      const volunteer = db.users.find((x) => x.id === s.userId)!;
      const res = reviewSubmission({
        submission: s, mission, volunteer, reviewer, organization: orgOf(db, s.organizationId), decision, note,
        now: nowIso(), newId: uid, origin: window.location.origin,
      });
      Object.assign(s, res.submission);
      Object.assign(volunteer, res.volunteer);
      db.records.push(res.record);
      if (res.certificate) db.certificates.push(res.certificate);
      db.notifications.unshift(...res.notifications);
      db.audits.unshift(res.audit);
      const p = db.participants.find((x) => x.id === `${s.missionId}_${s.userId}`);
      if (p) {
        if (decision === "approved") Object.assign(p, { completionStatus: "completed", attendance: true });
        else p.completionStatus = decision === "needs_more_info" ? "joined" : "joined";
      }
    });
  },

  /* ---- rewards & certificates ---- */
  async myCertificates(): Promise<Certificate[]> {
    await ready();
    const db = getDB();
    const u = actor(db);
    return db.certificates.filter((c) => c.userId === u.id).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  },

  /** Public verification: returns a snapshot without any user id. */
  async verifyCertificate(code: string) {
    await ready();
    const c = getDB().certificates.find((x) => x.verificationCode === normaliseCode(code));
    if (!c) return null;
    return {
      verificationCode: c.verificationCode, holderName: c.holderName, missionTitle: c.missionTitle,
      organizationName: c.organizationName, issuedAt: c.issuedAt, hours: c.hours, xp: c.xp,
    };
  },

  /* ---- notifications ---- */
  async myNotifications() {
    await ready();
    const db = getDB();
    const u = actor(db);
    return db.notifications.filter((n) => n.userId === u.id).slice(0, 100);
  },
  async markNotificationsRead(ids?: string[]) {
    await ready();
    commit((db) => {
      const u = actor(db);
      for (const n of db.notifications) if (n.userId === u.id && (!ids || ids.includes(n.id))) n.read = true;
    });
  },


  /* ---- community: feed ---- */
  /** Approved work from the community. Only verified submissions appear, and only from people who share to the feed. */
  async feed(opts: { scope?: "all" | "friends" | "area" | "mine" } = {}) {
    await ready();
    const db = getDB();
    const u = actor(db);
    const friends = friendIdsOf(db, u.id);
    const items = db.submissions
      .filter((s) => s.verificationStatus === "approved")
      .flatMap((s) => {
        const author = db.users.find((x) => x.id === s.userId);
        const mission = db.missions.find((m) => m.id === s.missionId);
        if (!author || !mission || author.status !== "active") return [];
        const isMe = author.id === u.id;
        if (!isMe && !author.feedVisible) return [];
        const cheers = db.cheers.filter((c) => c.submissionId === s.id);
        return [{
          id: s.id, at: s.reviewedAt ?? s.timestamp, author: person(author), isMe, isFriend: friends.has(author.id),
          mission: { id: mission.id, title: mission.title, category: mission.category, location: mission.location, duration: mission.duration, isDemo: mission.isDemo, impactMetrics: mission.impactMetrics },
          organizationName: orgOf(db, mission.organizationId)?.name ?? "",
          photos: s.images.map((i) => i.dataUrl), notes: s.notes, cheers: cheers.length, cheered: cheers.some((c) => c.userId === u.id),
        }];
      })
      .filter((i) => {
        if (opts.scope === "friends") return i.isFriend;
        if (opts.scope === "mine") return i.isMe;
        if (opts.scope === "area") return sameArea(u, i.author);
        return true;
      });
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 60);
  },

  async toggleCheer(submissionId: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const s = db.submissions.find((x) => x.id === submissionId && x.verificationStatus === "approved");
      if (!s) throw new DomainError("not_found", "This post is no longer available.");
      if (s.userId === u.id) throw new DomainError("forbidden", "You can't cheer your own work.");
      const id = `${submissionId}_${u.id}`;
      if (db.cheers.some((c) => c.id === id)) {
        db.cheers = db.cheers.filter((c) => c.id !== id);
        return;
      }
      db.cheers.push({ id, submissionId, userId: u.id, createdAt: nowIso() });
      const m = db.missions.find((x) => x.id === s.missionId);
      notify(db, s.userId, { type: "system", title: "Someone cheered your work", message: `${u.fullName} cheered "${m?.title ?? "your mission"}".`, link: "/app/feed" });
    });
  },

  /* ---- community: friends ---- */
  async people(q = "") {
    await ready();
    const db = getDB();
    const u = actor(db);
    const needle = q.trim().toLowerCase();
    return db.users
      .filter((x) => x.id !== u.id && x.role === "volunteer" && x.status === "active" && x.onboarded)
      .filter((x) => !needle || `${x.fullName} ${x.username} ${x.city} ${x.province} ${x.country}`.toLowerCase().includes(needle))
      .map((x) => ({ ...person(x), relation: relationOf(db, u.id, x.id), nearby: sameArea(u, x) }))
      .sort((a, b) => Number(b.nearby) - Number(a.nearby) || b.xp - a.xp)
      .slice(0, 30);
  },

  async friendsOverview() {
    await ready();
    const db = getDB();
    const u = actor(db);
    const byId = (id: string) => db.users.find((x) => x.id === id && x.status === "active");
    const friends = [...friendIdsOf(db, u.id)].flatMap((id) => { const x = byId(id); return x ? [person(x)] : []; });
    const incoming = db.friendships.filter((f) => f.to === u.id && f.status === "pending").flatMap((f) => { const x = byId(f.from); return x ? [{ friendshipId: f.id, person: person(x) }] : []; });
    const outgoing = db.friendships.filter((f) => f.from === u.id && f.status === "pending").flatMap((f) => { const x = byId(f.to); return x ? [{ friendshipId: f.id, person: person(x) }] : []; });
    const leaderboard = [{ ...person(u), isMe: true }, ...friends.map((f) => ({ ...f, isMe: false }))].sort((a, b) => b.xp - a.xp);
    return { friends: friends.sort((a, b) => a.fullName.localeCompare(b.fullName)), incoming, outgoing, leaderboard };
  },

  async sendFriendRequest(userId: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const other = db.users.find((x) => x.id === userId && x.status === "active" && x.role === "volunteer");
      if (!other || other.id === u.id) throw new DomainError("not_found", "That person isn't available.");
      const rel = relationOf(db, u.id, other.id);
      if (rel === "friend") throw new DomainError("conflict", "You're already friends.");
      if (rel === "outgoing") throw new DomainError("conflict", "You already sent a request.");
      if (rel === "incoming") {
        const f = db.friendships.find((x) => x.from === other.id && x.to === u.id)!;
        f.status = "accepted";
        notify(db, other.id, { type: "system", title: "Friend request accepted", message: `You and ${u.fullName} are now friends.`, link: "/app/friends" });
      } else {
        db.friendships.push({ id: `${u.id}_${other.id}`, from: u.id, to: other.id, status: "pending", createdAt: nowIso() });
        notify(db, other.id, { type: "system", title: "New friend request", message: `${u.fullName} wants to be friends.`, link: "/app/friends" });
      }
      log(db, u, "friend.request", "friendships", `${u.id}_${other.id}`);
    });
  },

  async respondFriendRequest(friendshipId: string, accept: boolean) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const f = db.friendships.find((x) => x.id === friendshipId && x.to === u.id && x.status === "pending");
      if (!f) throw new DomainError("not_found", "That request is no longer open.");
      if (accept) {
        f.status = "accepted";
        notify(db, f.from, { type: "system", title: "Friend request accepted", message: `You and ${u.fullName} are now friends.`, link: "/app/friends" });
      } else db.friendships = db.friendships.filter((x) => x !== f);
      log(db, u, accept ? "friend.accept" : "friend.decline", "friendships", friendshipId);
    });
  },

  /** Removes a friend, or cancels a request you sent. */
  async removeFriend(userId: string) {
    await ready();
    commit((db) => {
      const u = actor(db);
      const before = db.friendships.length;
      db.friendships = db.friendships.filter((f) => !((f.from === u.id && f.to === userId) || (f.from === userId && f.to === u.id)));
      if (db.friendships.length === before) throw new DomainError("not_found", "Nothing to remove.");
      log(db, u, "friend.remove", "friendships", `${u.id}_${userId}`);
    });
  },

  /* ---- insights: analytics, achievements and advice for the signed-in volunteer ---- */
  async myInsights() {
    await ready();
    const db = getDB();
    const u = actor(db);
    const mine = db.submissions.filter((s) => s.userId === u.id);
    const approved = mine.filter((s) => s.verificationStatus === "approved");
    const rejected = mine.filter((s) => s.verificationStatus === "rejected").length;
    const missionOf = (id: string) => db.missions.find((m) => m.id === id);

    // XP per week for the last 8 weeks (weeks start on Monday, local time). XP comes from the issued certificate.
    const weekStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const thisWeek = weekStart(new Date());
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const start = new Date(thisWeek); start.setDate(start.getDate() - (7 - i) * 7);
      return { start: start.toISOString(), xp: 0, missions: 0, hours: 0 };
    });
    const byCategory: Partial<Record<Category, number>> = {};
    for (const s of approved) {
      const m = missionOf(s.missionId);
      const cert = db.certificates.find((c) => c.id === s.certificateId);
      if (m) byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
      const idx = Math.round((weekStart(new Date(s.reviewedAt ?? s.timestamp)).getTime() - Date.parse(weekly[0].start)) / (7 * 86_400_000));
      if (idx >= 0 && idx < weekly.length) {
        weekly[idx].xp += cert?.xp ?? m?.rewardXP ?? 0;
        weekly[idx].missions += 1;
        weekly[idx].hours += (m?.duration ?? 0) / 60;
      }
    }

    const friendIds = friendIdsOf(db, u.id);
    const cheersGiven = db.cheers.filter((c) => c.userId === u.id).length;
    const myApprovedIds = new Set(approved.map((s) => s.id));
    const profileComplete = Boolean(u.avatar && u.bio && u.country && u.city && u.skills.length);
    const stats: AchievementStats = {
      approvedMissions: approved.length, hours: u.totalVolunteerHours, xp: u.xp, level: levelForXp(u.xp), streak: u.streak, totalImpact: u.totalImpact,
      categories: Object.keys(byCategory), friends: friendIds.size, certificates: db.certificates.filter((c) => c.userId === u.id).length,
      cheersGiven, cheersReceived: db.cheers.filter((c) => myApprovedIds.has(c.submissionId)).length, profileComplete,
    };
    const achievements = computeAchievements(stats);

    const parts = db.participants.filter((p) => p.userId === u.id && p.status === "accepted");
    const subFor = (missionId: string) => mine.find((s) => s.missionId === missionId);
    const active = parts.filter((p) => { const st = subFor(p.missionId)?.verificationStatus; return st !== "approved" && st !== "rejected"; });
    const joined = new Set(parts.map((p) => p.missionId));
    const open = db.missions.filter((m) => m.status === "published" && !joined.has(m.id) && m.participantsCount < m.capacity && Date.parse(m.deadline) > Date.now());
    const place = [u.city, u.province.replace(/ (Region|Province|State)$/i, "")].filter((x) => x.length >= 3).map((x) => x.toLowerCase());
    const nearby = open.filter((m) => place.some((p) => m.location.toLowerCase().includes(p)));
    const leaderboard = [u, ...db.users.filter((x) => friendIds.has(x.id) && x.status === "active")].sort((a, b) => b.xp - a.xp);
    const rank = leaderboard.findIndex((x) => x.id === u.id) + 1;
    const top = (Object.entries(byCategory) as [Category, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const untried = open.map((m) => m.category).find((c) => !byCategory[c]) ?? null;

    const advice = buildAdvice({
      emailVerified: u.emailVerified, profileComplete, approvedMissions: approved.length, activeMissions: active.length,
      needsEvidence: active.filter((p) => !subFor(p.missionId) && Date.parse(missionOf(p.missionId)?.date ?? "") <= Date.now()).length,
      needsMoreInfo: mine.filter((s) => s.verificationStatus === "needs_more_info").length,
      streak: u.streak, lastApprovedDay: u.lastApprovedDay, today: dayKey(nowIso()), friends: friendIds.size,
      pendingFriendRequests: db.friendships.filter((f) => f.to === u.id && f.status === "pending").length,
      nearbyOpenMissions: nearby.length, topCategory: top, untriedCategory: untried, nextAchievement: nextAchievement(achievements),
      friendsRank: friendIds.size ? rank : null, xpToNextFriend: rank > 1 ? leaderboard[rank - 2].xp - u.xp + 1 : null,
    });

    return {
      weekly, byCategory, achievements, advice,
      totals: {
        approved: approved.length, rejected, pending: mine.filter((s) => s.verificationStatus === "pending").length,
        approvalRate: approved.length + rejected ? Math.round((approved.length / (approved.length + rejected)) * 100) : null,
        cheersReceived: stats.cheersReceived, unlocked: achievements.filter((a) => a.unlocked).length,
      },
      nearby: nearby.slice(0, 3).map((m) => ({ ...m, moderationNote: "", organizationName: orgOf(db, m.organizationId)?.name ?? "" })),
      friends: { count: friendIds.size, rank: friendIds.size ? rank : null, top: leaderboard.slice(0, 5).map((x) => ({ ...person(x), isMe: x.id === u.id })) },
    };
  },

  /* ---- analytics ---- */
  async publicStats() {
    await ready();
    const db = getDB();
    // Signed-out visitors in Firebase mode can't read submissions; every approval issues a public certificate, so count those.
    const approved: { missionId: string }[] = FIREBASE && !cloud.currentUid() ? db.certificates : db.submissions.filter((s) => s.verificationStatus === "approved");
    const impact: Record<string, number> = {};
    let hours = 0;
    for (const s of approved) {
      const m = db.missions.find((x) => x.id === s.missionId);
      if (!m) continue;
      hours += m.duration / 60;
      for (const im of m.impactMetrics) impact[im.label] = (impact[im.label] ?? 0) + im.amountPerVolunteer;
    }
    return {
      verifiedActions: approved.length,
      volunteers: Math.max(db.users.filter((u) => u.role === "volunteer" && u.status === "active").length, new Set(db.certificates.map((c) => c.userId)).size),
      hours: Math.round(hours * 10) / 10,
      impact,
      openMissions: db.missions.filter((m) => m.status === "published").length,
      organizations: db.organizations.filter((o) => o.verificationStatus === "approved").length,
      includesDemoData: db.missions.some((m) => m.isDemo) || db.organizations.some((o) => o.name.startsWith("Demo:")),
    };
  },

  async orgAnalytics() {
    await ready();
    const db = getDB();
    const u = actor(db);
    if (!u.organizationId) throw new DomainError("forbidden", "Register your organization first.");
    const missions = db.missions.filter((m) => m.organizationId === u.organizationId);
    const subs = db.submissions.filter((s) => s.organizationId === u.organizationId);
    const count = (st: string) => subs.filter((s) => s.verificationStatus === st).length;
    const approved = subs.filter((s) => s.verificationStatus === "approved");
    const hours = approved.reduce((a, s) => a + (missions.find((m) => m.id === s.missionId)?.duration ?? 0) / 60, 0);
    return {
      missions: missions.length,
      published: missions.filter((m) => m.status === "published").length,
      volunteers: new Set(db.participants.filter((p) => missions.some((m) => m.id === p.missionId) && p.status === "accepted").map((p) => p.userId)).size,
      pending: count("pending"), approved: count("approved"), rejected: count("rejected"), needsInfo: count("needs_more_info"),
      hours: Math.round(hours * 10) / 10,
      approvalRate: subs.length ? Math.round((approved.length / Math.max(1, count("approved") + count("rejected"))) * 100) : null,
    };
  },

  /* ---- admin ---- */
  async adminOverview() {
    await ready();
    const db = getDB();
    requireAdmin(db);
    return {
      users: db.users.length,
      volunteers: db.users.filter((u) => u.role === "volunteer").length,
      organizations: db.organizations.length,
      pendingOrganizations: db.organizations.filter((o) => o.verificationStatus === "pending").length,
      missions: db.missions.length,
      publishedMissions: db.missions.filter((m) => m.status === "published").length,
      pendingSubmissions: db.submissions.filter((s) => s.verificationStatus === "pending").length,
      flagged: db.submissions.filter((s) => s.fraudScore >= 0.5 && s.verificationStatus === "pending").length,
      suspended: db.users.filter((u) => u.status === "suspended").length,
      recentActivity: db.audits.slice(0, 8),
    };
  },
  async adminUsers(): Promise<UserProfile[]> {
    await ready();
    const db = getDB();
    requireAdmin(db);
    return [...db.users].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },
  async setUserStatus(userId: string, status: "active" | "suspended", reason = "") {
    await ready();
    commit((db) => {
      const a = requireAdmin(db);
      const u = db.users.find((x) => x.id === userId);
      if (!u) throw new DomainError("not_found", "User not found.");
      if (u.id === a.id) throw new DomainError("forbidden", "You can't change your own status.");
      if (isAdmin(u.role) && a.role !== "super_admin") throw new DomainError("forbidden", "Only a super admin can change another administrator.");
      if (u.status === "deleted") throw new DomainError("invalid_state", "This account was deleted.");
      if (status === "suspended" && reason.trim().length < 5) throw new ValidationError({ reason: "Give a reason for the suspension (recorded in the audit log)." });
      u.status = status;
      u.updatedAt = nowIso();
      log(db, a, `user.${status === "suspended" ? "suspend" : "reactivate"}`, "users", u.id, reason);
    });
  },
  async adminOrganizations(): Promise<(Organization & { ownerName: string })[]> {
    await ready();
    const db = getDB();
    requireAdmin(db);
    return db.organizations.map((o) => ({ ...o, ownerName: db.users.find((u) => u.id === o.ownerId)?.fullName ?? "—" }));
  },
  async decideOrganization(orgId: string, decision: "approved" | "rejected", note = "") {
    await ready();
    commit((db) => {
      const a = requireAdmin(db);
      const o = orgOf(db, orgId);
      if (!o) throw new DomainError("not_found", "Organization not found.");
      if (decision === "rejected" && note.trim().length < 5) throw new ValidationError({ note: "Tell the organization why it wasn't approved." });
      o.verificationStatus = decision;
      o.verificationNote = note.trim();
      notify(db, o.ownerId, {
        type: "organization", title: decision === "approved" ? "Organization approved" : "Organization not approved",
        message: decision === "approved" ? `${o.name} can now publish missions.` : note.trim(), link: "/org",
      });
      log(db, a, `organization.${decision}`, "organizations", orgId, note);
    });
  },
  async adminAudit(limit = 200): Promise<AuditLog[]> {
    await ready();
    const db = getDB();
    requireAdmin(db);
    return db.audits.slice(0, limit);
  },
  async adminRecords(): Promise<VerificationRecord[]> {
    await ready();
    const db = getDB();
    requireAdmin(db);
    return db.records;
  },
};

/** What a volunteer may see about their own submission: no fraud/AI fields. */
export function publicSubmission(s: Submission) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { fraudScore, fraudFlags, aiConfidence, ...rest } = s;
  return rest;
}
export type PublicSubmission = ReturnType<typeof publicSubmission>;

export { dayKey, levelForXp };
export type { Mission, MissionParticipant };
