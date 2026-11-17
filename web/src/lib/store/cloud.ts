"use client";
/**
 * FIREBASE MODE — Firebase Auth + Cloud Firestore.
 *
 * Active when the NEXT_PUBLIC_FIREBASE_* variables are set (see .env.example); otherwise the app stays on the
 * browser-local demo store. In Firebase mode:
 *   • accounts live in Firebase Auth (email + password, real verification and reset emails);
 *   • every collection of the app database is a Firestore collection with one document per record;
 *   • the in-memory database in db.ts is kept live with onSnapshot listeners, and each commit() writes only the
 *     documents it changed, in one atomic batch.
 * Business rules still run in the browser (api.ts) and firestore.rules guards the sensitive fields
 * (roles, rewards, organization approval). Moving the mutations into Cloud Functions is the hardening step
 * described in DEPLOYMENT.md.
 */
import { getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword, deleteUser, getAuth, onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, type Auth, type User,
} from "firebase/auth";
import { collection, doc, getFirestore, onSnapshot, query, where, writeBatch, type Firestore, type Unsubscribe } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const FIREBASE_ENABLED = Boolean(config.apiKey && config.projectId && config.appId);

/** Collections mirrored to Firestore. Readable while signed out: only what the public website shows. */
const PUBLIC = ["missions", "organizations", "certificates"] as const;
const PRIVATE = ["users", "participants", "submissions", "records", "notifications", "audits", "friendships", "cheers"] as const;
export const SYNCED = [...PUBLIC, ...PRIVATE] as const;
export type SyncedName = (typeof SYNCED)[number];
type Doc = { id: string };
export type Snapshot = Record<SyncedName, Doc[]>;

let auth: Auth;
let fs: Firestore;
function init() {
  if (!auth) {
    const app = getApps()[0] ?? initializeApp(config);
    auth = getAuth(app);
    fs = getFirestore(app);
  }
}

let started: Promise<void> | null = null;
let authUser: User | null = null;
let privateUnsubs: Unsubscribe[] = [];
let privateReady: Promise<void> = Promise.resolve();
let handlers: { onData: (name: SyncedName, docs: Doc[]) => void; onError: (message: string) => void };

function listen(name: SyncedName, uid?: string) {
  // Notifications are private: each user only ever queries their own.
  const ref = name === "notifications" && uid ? query(collection(fs, name), where("userId", "==", uid)) : collection(fs, name);
  let done!: () => void;
  const first = new Promise<void>((r) => (done = r));
  const unsub = onSnapshot(
    ref,
    (snap) => { handlers.onData(name, snap.docs.map((d) => d.data() as Doc)); done(); },
    (err) => {
      // e.g. the audit log, which only administrators may read.
      if (err.code !== "permission-denied") console.warn(`[worfix] Firestore listener "${name}" failed:`, err.message);
      handlers.onData(name, []);
      done();
    },
  );
  return { unsub, first };
}

/** Idempotent. Resolves once the auth state is known and every listener has delivered its first snapshot. */
export function start(h: typeof handlers) {
  started ??= (async () => {
    init();
    handlers = h;
    const pub = PUBLIC.map((n) => listen(n));
    const authKnown = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (u) => {
        authUser = u;
        privateUnsubs.forEach((f) => f());
        privateUnsubs = [];
        if (u) {
          const ls = PRIVATE.map((n) => listen(n, u.uid));
          privateUnsubs = ls.map((l) => l.unsub);
          privateReady = Promise.all(ls.map((l) => l.first)).then(() => undefined);
        } else {
          PRIVATE.forEach((n) => handlers.onData(n, []));
          privateReady = Promise.resolve();
        }
        resolve();
      });
    });
    await Promise.all([...pub.map((l) => l.first), authKnown]);
    await privateReady;
  })();
  return started;
}

export const currentUid = () => authUser?.uid ?? null;
export const authEmailVerified = () => authUser?.emailVerified ?? false;

/** Wait until the listeners for the given signed-in user have loaded. */
async function synced(uid: string) {
  for (let i = 0; i < 100 && authUser?.uid !== uid; i++) await new Promise((r) => setTimeout(r, 50));
  await privateReady;
}

const AUTH_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/weak-password": "Use at least 8 characters with a letter and a number.",
  "auth/network-request-failed": "No connection. Check your internet and try again.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled in the Firebase console yet.",
};
export class CloudAuthError extends Error {
  constructor(public code: string) {
    super(AUTH_MESSAGES[code] ?? "Sign-in failed. Please try again.");
    this.name = "CloudAuthError";
  }
}
const wrap = async <T>(p: Promise<T>) => {
  try { return await p; } catch (e) { throw new CloudAuthError((e as { code?: string }).code ?? "unknown"); }
};

export async function signUp(email: string, password: string) {
  init();
  const cred = await wrap(createUserWithEmailAndPassword(auth, email, password));
  await synced(cred.user.uid);
  return cred.user.uid;
}
export async function signIn(email: string, password: string) {
  init();
  const cred = await wrap(signInWithEmailAndPassword(auth, email, password));
  await synced(cred.user.uid);
  return cred.user.uid;
}
export async function logOut() {
  init();
  await signOut(auth);
}
export async function sendVerification() {
  if (!authUser) throw new CloudAuthError("unknown");
  await wrap(sendEmailVerification(authUser));
}
export async function sendReset(email: string) {
  init();
  // Never reveals whether the address has an account.
  await sendPasswordResetEmail(auth, email).catch(() => undefined);
}
/** Re-reads the Auth user (and its ID token, which the security rules check) after the email link was opened. */
export async function refreshVerified() {
  if (!authUser) return false;
  await authUser.reload();
  if (authUser.emailVerified) await authUser.getIdToken(true);
  return authUser.emailVerified;
}
export async function deleteAuthUser() {
  if (!authUser) return;
  await deleteUser(authUser).catch(() => signOut(auth)); // needs a recent login; otherwise just sign out
}

/** Writes exactly the documents that differ between two database snapshots, atomically (≤ 450 writes per batch). */
export async function push(before: Snapshot, after: Snapshot) {
  init();
  const ops: ({ name: SyncedName; id: string; data: Doc } | { name: SyncedName; id: string; data: null })[] = [];
  for (const name of SYNCED) {
    const prev = new Map((before[name] ?? []).map((d) => [d.id, JSON.stringify(d)]));
    for (const d of after[name] ?? []) {
      const cur = JSON.stringify(d);
      if (prev.get(d.id) !== cur) ops.push({ name, id: d.id, data: JSON.parse(cur) as Doc }); // JSON round-trip drops `undefined`
      prev.delete(d.id);
    }
    for (const id of prev.keys()) ops.push({ name, id, data: null });
  }
  try {
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(fs);
      for (const op of ops.slice(i, i + 450)) {
        const ref = doc(fs, op.name, op.id);
        if (op.data) batch.set(ref, op.data);
        else batch.delete(ref);
      }
      await batch.commit();
    }
  } catch (e) {
    const err = e as { code?: string; message: string };
    handlers?.onError(err.code === "permission-denied" ? "The server did not allow that change." : "Your last change could not be saved. Check your connection.");
    console.error("[worfix] Firestore write failed:", err.message);
  }
}
