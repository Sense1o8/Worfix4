"use client";
/**
 * APPLICATION DATABASE (in-memory) with two interchangeable backends:
 *
 *  • LOCAL DEMO MODE (default): persisted to this browser's localStorage and seeded with labelled demo data.
 *    Data never leaves the browser. The UI shows a persistent "Local demo mode" banner.
 *  • FIREBASE MODE (when NEXT_PUBLIC_FIREBASE_* is configured): kept live from Cloud Firestore and written
 *    back document-by-document — see ./cloud.ts.
 *
 * Either way, every write goes through commit() and the shared domain rules in api.ts.
 */
import { dayKey } from "../domain/rewards";
import { computeMissionReward } from "../domain/rewards";
import * as cloud from "./cloud";
import type {
  AuditLog,
  Certificate,
  Cheer,
  Friendship,
  Mission,
  MissionParticipant,
  Notification,
  Organization,
  Submission,
  UserProfile,
  VerificationRecord,
} from "../domain/types";

export interface Credential {
  userId: string;
  salt: string;
  hash: string;
}
export interface Token {
  token: string;
  userId: string;
  kind: "verify" | "reset";
  expiresAt: string;
}
export interface DB {
  version: 1;
  users: UserProfile[];
  organizations: Organization[];
  missions: Mission[];
  participants: MissionParticipant[];
  submissions: Submission[];
  records: VerificationRecord[];
  certificates: Certificate[];
  notifications: Notification[];
  audits: AuditLog[];
  friendships: Friendship[];
  cheers: Cheer[];
  credentials: Credential[];
  tokens: Token[];
  loginAttempts: Record<string, { count: number; first: number }>;
}

/** True when Firebase is configured; false = browser-local demo mode. */
export const FIREBASE = cloud.FIREBASE_ENABLED;

const KEY = "worfix.dev.db.v2";
const listeners = new Set<() => void>();
let cache: DB | null = null;
let version = 0;
let initPromise: Promise<void> | null = null;

export const DEMO_ACCOUNTS = [
  { label: "Volunteer", email: "vol@demo.worfix.local", password: "Vol-demo-1" },
  { label: "Organization", email: "org@demo.worfix.local", password: "Org-demo-1" },
  { label: "Admin", email: "admin@demo.worfix.local", password: "Admin-demo-1" },
] as const;

export const uid = () => globalThis.crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));

export async function sha256Hex(data: ArrayBuffer | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, salt = b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return { salt, hash: b64(bits) };
}

function empty(): DB {
  return {
    version: 1, users: [], organizations: [], missions: [], participants: [], submissions: [], records: [],
    certificates: [], notifications: [], audits: [], friendships: [], cheers: [], credentials: [], tokens: [], loginAttempts: {},
  };
}

function load(): DB {
  if (cache) return cache;
  if (FIREBASE) return (cache = empty()); // filled by Firestore listeners
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as DB) : empty();
  } catch {
    cache = empty();
  }
  return cache;
}

export function getDB() {
  return load();
}

export function commit(mutator: (db: DB) => void) {
  const db = load();
  const snapshot = JSON.stringify(db);
  try {
    mutator(db);
    if (FIREBASE) void cloud.push(JSON.parse(snapshot) as cloud.Snapshot, db as unknown as cloud.Snapshot);
    else localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    cache = JSON.parse(snapshot) as DB; // roll back in-memory state on any failure
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error("Local storage is full. Remove older submissions or use smaller photos.");
    }
    throw e;
  }
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      version++;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}
export const getVersion = () => version;

/* ── Firebase mode: live data + write-error reporting ── */
const syncErrorListeners = new Set<(message: string) => void>();
export function onSyncError(l: (message: string) => void) {
  syncErrorListeners.add(l);
  return () => void syncErrorListeners.delete(l);
}
const newestFirst = (key: string) => (a: Record<string, string>, b: Record<string, string>) => Date.parse(b[key]) - Date.parse(a[key]);

function startCloud() {
  return cloud.start({
    onData(name, docs) {
      const db = load() as unknown as Record<string, unknown[]>;
      // api.ts relies on newest-first order for these two (it unshifts into them).
      if (name === "notifications") (docs as unknown as Record<string, string>[]).sort(newestFirst("createdAt"));
      if (name === "audits") (docs as unknown as Record<string, string>[]).sort(newestFirst("timestamp"));
      db[name] = docs;
      version++;
      listeners.forEach((l) => l());
    },
    onError(message) {
      syncErrorListeners.forEach((l) => l(message));
    },
  });
}

export function resetDevData() {
  localStorage.removeItem(KEY);
  localStorage.removeItem("worfix.dev.session");
  cache = null;
  initPromise = null;
  version++;
  listeners.forEach((l) => l());
}

/** Idempotent: seeds clearly-labelled demonstration data on first run. */
export function ready() {
  if (FIREBASE) return (initPromise ??= startCloud());
  initPromise ??= (async () => {
    const db = load();
    if (db.users.length > 0) return;
    const t = nowIso();
    const base = (over: Partial<UserProfile>): UserProfile => ({
      id: uid(), email: "", emailVerified: true, fullName: "", username: "", avatar: null, bio: "", country: "Uzbekistan",
      province: "Samarqand Region", city: "Samarkand", feedVisible: true, languages: ["Uzbek", "English"], skills: [], interests: ["environment"], level: 1, xp: 0,
      points: 0, trustScore: 50, reputation: 0, streak: 0, lastApprovedDay: null, totalVolunteerHours: 0,
      totalImpact: 0, impact: {}, onboarded: true, organizationId: null, role: "volunteer", status: "active",
      createdAt: t, updatedAt: t, lastLogin: null, ...over,
    });
    const orgId = uid();
    const vol = base({ email: DEMO_ACCOUNTS[0].email, fullName: "Demo Volunteer", username: "demo_volunteer", interests: ["environment", "water"] });
    const orgUser = base({ email: DEMO_ACCOUNTS[1].email, fullName: "Demo Organizer", username: "demo_organizer", role: "organization", organizationId: orgId });
    const admin = base({ email: DEMO_ACCOUNTS[2].email, fullName: "Demo Admin", username: "demo_admin", role: "admin" });
    const org: Organization = {
      id: orgId, name: "Demo: Green Samarkand", logo: null,
      description: "Demonstration organization used to showcase WORFIX. Not a real NGO.",
      website: "", email: "org@demo.worfix.local", phone: "", address: "Demo address, Samarkand", country: "Uzbekistan",
      city: "Samarkand", organizationType: "NGO", verificationStatus: "approved", verificationNote: "", ownerId: orgUser.id,
      members: [orgUser.id], rating: 0, totalVolunteers: 0, totalMissions: 0, createdAt: t,
    };
    db.users.push(vol, orgUser, admin);
    db.organizations.push(org);
    for (const u of [vol, orgUser, admin]) {
      const pw = DEMO_ACCOUNTS.find((a) => a.email === u.email)!.password;
      db.credentials.push({ userId: u.id, ...(await hashPassword(pw)) });
    }
    const day = 86_400_000;
    const at = (d: number, h: number) => {
      const x = new Date(Date.now() + d * day);
      x.setUTCHours(h, 0, 0, 0);
      return x.toISOString();
    };
    const seed = (
      title: string, category: Mission["category"], difficulty: Mission["difficulty"], duration: number, location: string,
      lat: number, lng: number, startIn: number, capacity: number, featured: boolean, description: string,
      impact: [string, number] | null,
    ) => {
      const r = computeMissionReward(difficulty, duration);
      db.missions.push({
        id: uid(), organizationId: orgId, title, description, category, difficulty, ...r, location,
        coordinates: { lat, lng }, date: at(startIn, 5), deadline: at(startIn - 1, 12), duration, capacity,
        participantsCount: 0, status: "published", featured,
        requirements: "Closed shoes and a water bottle. Volunteers aged 15–17 need a guardian's knowledge.",
        safety: "Follow the coordinator's instructions, work in pairs, and stop if you feel unwell.",
        equipment: "Gloves and tools are provided.",
        impactMetrics: impact ? [{ label: impact[0], amountPerVolunteer: impact[1] }] : [], moderationNote: "", isDemo: true,
        createdAt: t, updatedAt: t,
      });
    };
    seed("[Demo] Plant saplings along the canal", "environment", "medium", 180, "Siab canal, Samarkand", 39.6612, 66.9714, 5, 25, true,
      "Help plant and water young trees along a stretch of canal to add shade and reduce dust. Planting is guided and tools are provided.", ["trees planted", 3]);
    seed("[Demo] Riverbank clean-up", "water", "easy", 120, "Zarafshan riverbank, Samarkand", 39.6395, 66.9301, 3, 40, true,
      "Collect and sort litter from the riverbank. We separate recyclables and weigh everything at the end.", ["kg of litter collected", 8]);
    seed("[Demo] Reading hour at the community library", "education", "easy", 90, "Community library, Tashkent", 41.3111, 69.2797, 8, 12, false,
      "Read aloud with primary-school children and help them practise Uzbek and English.", ["children supported", 2]);
    seed("[Demo] Shelter dog walking day", "animals", "easy", 120, "Animal shelter, Bukhara", 39.7681, 64.4556, 10, 15, false,
      "Walk, groom and socialise shelter dogs. No experience needed; staff will brief you first.", ["dogs walked", 1]);
    seed("[Demo] Recycling sorting drive", "recycling", "medium", 240, "Recycling point, Tashkent", 41.2856, 69.2034, 12, 30, false,
      "Sort paper, plastic and glass at a neighbourhood collection point and help residents learn what goes where.", ["kg recycled", 20]);
    seed("[Demo] Neighbourhood elder support visits", "community", "hard", 180, "Mahalla centre, Samarkand", 39.6481, 66.9805, 14, 10, false,
      "Visit elderly neighbours to help with shopping and small errands. Pairs only; coordinator assigns visits.", ["elders assisted", 1]);
    seedCommunity(db, base, vol, orgId);
    db.audits.push({
      id: uid(), actor: "system", actorRole: "system", action: "seed.demo", resource: "system", resourceId: "demo",
      timestamp: t, detail: "Demonstration data created in local dev store", ipAddress: null, device: null,
    });
    localStorage.setItem(KEY, JSON.stringify(db));
    version++;
  })();
  return initPromise;
}

/**
 * Demo community (local demo mode only): a few labelled demo volunteers with already-approved work, so the
 * feed, friends and leaderboard screens have something to show on a single device.
 */
function seedCommunity(db: DB, base: (over: Partial<UserProfile>) => UserProfile, me: UserProfile, orgId: string) {
  const day = 86_400_000;
  const ago = (d: number) => new Date(Date.now() - d * day).toISOString();
  const people = [
    base({ email: "aziza@demo.worfix.local", fullName: "Aziza Karimova (demo)", username: "demo_aziza", city: "Samarkand", bio: "Weekend tree planter.", interests: ["environment", "water"] }),
    base({ email: "timur@demo.worfix.local", fullName: "Timur Rakhimov (demo)", username: "demo_timur", city: "Samarkand", bio: "River clean-ups and recycling.", interests: ["water", "recycling"] }),
    base({ email: "malika@demo.worfix.local", fullName: "Malika Yusupova (demo)", username: "demo_malika", province: "Tashkent", city: "Tashkent", bio: "Reading volunteer.", interests: ["education", "community"] }),
    base({ email: "jasur@demo.worfix.local", fullName: "Jasur Aliev (demo)", username: "demo_jasur", province: "Bukhara Region", city: "Bukhara", bio: "Shelter dog walker.", interests: ["animals"] }),
  ];
  db.users.push(...people);
  const past = (
    title: string, category: Mission["category"], difficulty: Mission["difficulty"], duration: number, location: string, daysAgo: number, impact: [string, number],
  ): Mission => {
    const r = computeMissionReward(difficulty, duration);
    const m: Mission = {
      id: uid(), organizationId: orgId, title, description: "Completed demonstration mission.", category, difficulty, ...r, location, coordinates: null,
      date: ago(daysAgo), deadline: ago(daysAgo + 1), duration, capacity: 20, participantsCount: 0, status: "closed", featured: false,
      requirements: "", safety: "Follow the coordinator's instructions.", equipment: "",
      impactMetrics: [{ label: impact[0], amountPerVolunteer: impact[1] }], moderationNote: "", isDemo: true, createdAt: ago(daysAgo + 7), updatedAt: ago(daysAgo),
    };
    db.missions.push(m);
    return m;
  };
  const m1 = past("[Demo] Park tree-planting morning", "environment", "medium", 180, "University Boulevard, Samarkand", 2, ["trees planted", 3]);
  const m2 = past("[Demo] Canal litter pick", "water", "easy", 120, "Siab canal, Samarkand", 5, ["kg of litter collected", 6]);
  const m3 = past("[Demo] Story time for first-graders", "education", "easy", 90, "School library, Tashkent", 8, ["children supported", 2]);
  const m4 = past("[Demo] Shelter clean-up day", "animals", "medium", 150, "Animal shelter, Bukhara", 12, ["dogs walked", 2]);
  const done = (u: UserProfile, m: Mission, daysAgo: number, notes: string) => {
    const t = ago(daysAgo);
    db.participants.push({ id: `${m.id}_${u.id}`, missionId: m.id, userId: u.id, joinedAt: ago(daysAgo + 3), status: "accepted", attendance: true, completionStatus: "completed" });
    const s: Submission = {
      id: uid(), missionId: m.id, userId: u.id, organizationId: orgId, images: [], videos: [], notes, gps: null, gpsConsent: false, timestamp: t,
      metadata: { userAgent: "demo", submissionCount: 1 }, aiConfidence: null, fraudScore: 0, fraudFlags: [], verificationStatus: "approved",
      reviewedBy: null, reviewedAt: t, reviewNote: "", rewardGrantedAt: t, certificateId: null,
    };
    db.submissions.push(s);
    m.participantsCount += 1;
    u.xp += m.rewardXP;
    u.points += m.rewardPoints;
    u.totalVolunteerHours = Math.round((u.totalVolunteerHours + m.duration / 60) * 100) / 100;
    for (const im of m.impactMetrics) {
      u.impact[im.label] = (u.impact[im.label] ?? 0) + im.amountPerVolunteer;
      u.totalImpact += im.amountPerVolunteer;
    }
    u.level = Math.floor(Math.sqrt(u.xp / 100)) + 1;
    u.streak = 1;
    u.lastApprovedDay = dayKey(t);
    return s;
  };
  const [aziza, timur, malika, jasur] = people;
  const s1 = done(aziza, m1, 2, "Planted three plane trees near the fountain and watered the whole row.");
  const s2 = done(timur, m1, 2, "Dug planting holes with the morning team.");
  const s3 = done(timur, m2, 5, "Two full bags of plastic bottles from the canal bank.");
  done(aziza, m2, 5, "Sorted recyclables at the weighing point.");
  const s5 = done(malika, m3, 8, "Read two picture books and practised English colours with the kids.");
  done(jasur, m4, 12, "Walked Rex and Bella, then helped clean the kennels.");
  const cheer = (s: Submission, u: UserProfile) => db.cheers.push({ id: `${s.id}_${u.id}`, submissionId: s.id, userId: u.id, createdAt: s.timestamp });
  cheer(s1, timur); cheer(s1, malika); cheer(s2, aziza); cheer(s3, aziza); cheer(s3, jasur); cheer(s5, aziza);
  db.friendships.push(
    { id: `${aziza.id}_${timur.id}`, from: aziza.id, to: timur.id, status: "accepted", createdAt: ago(20) },
    { id: `${aziza.id}_${me.id}`, from: aziza.id, to: me.id, status: "pending", createdAt: ago(1) },
  );
  db.notifications.unshift({ id: uid(), userId: me.id, type: "system", title: "New friend request", message: `${aziza.fullName} wants to be friends.`, link: "/app/friends", read: false, createdAt: ago(1) });
}
