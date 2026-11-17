# Deploying WORFIX — Netlify + Firebase

The web app (`web/`) deploys to **Netlify**. Data lives in **Firebase** (Auth + Cloud Firestore).
The AI mission agent calls **Gemini** from a server route, so the key never reaches the browser.

> **What has and hasn't been verified.** The app was type-checked, linted, unit-tested, built and clicked through in
> **local demo mode**. The Firebase mode and `firestore.rules` compile and follow the documented SDK, but were **not run
> against a live Firebase project** (none was available), and the Gemini route was **not called against the live API**
> from the build environment. Do the smoke test in step 4 after your first deploy.

## 1. Create the Firebase project (5 minutes)

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** (production mode, a region near your users).
4. **Project settings → General → Your apps → Web app (</>)** → register → copy the `firebaseConfig` values.
5. **Authentication → Settings → Authorized domains** → add your Netlify domain (`your-site.netlify.app`).
6. Deploy the security rules from this folder:
   ```bash
   npm i -g firebase-tools && firebase login
   cp .firebaserc.example .firebaserc      # put your project id in it
   firebase deploy --only firestore:rules
   ```
   (Or paste the contents of `firestore.rules` into Firestore → Rules → Publish.)

No composite indexes, Storage bucket or Cloud Functions are needed for this mode, so the free Spark plan is enough.

## 2. Deploy to Netlify

1. Push this folder to GitHub/GitLab, then Netlify → **Add new site → Import an existing project**.
   `netlify.toml` already sets base directory `web`, build command `npm run build`, publish `.next`.
2. **Site configuration → Environment variables** — add, then redeploy:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | your Gemini key (server-only) |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

   `NEXT_PUBLIC_*` values are baked in at build time, so **redeploy after changing them**.
   Without the Firebase values the site runs in *Local demo mode* (yellow banner, data stays in each browser).

CLI alternative: `npm i -g netlify-cli && netlify init && netlify env:import web/.env.local && netlify deploy --build --prod`.

## 3. Create the first administrator

Firebase mode has no demo accounts. Register normally on the site, then in Firestore → `users` → your document set
`role` to `admin`. Sign out and in again; you land in the admin portal and can approve organizations.

## 4. Smoke test

1. Register a volunteer → verification email arrives → "I've verified my email" on the dashboard.
2. Register an organization account (second browser) → as admin, approve it.
3. Organization → **AI agent** → generate → *Save as draft* → set date → publish.
4. Volunteer joins, uploads a photo; organization approves in **Review**.
5. Volunteer sees XP, an unlocked achievement, and the post in **Feed**; add each other in **Friends**.

If something is refused, a red "Not saved" bar appears and the browser console shows `permission-denied` with the
collection name — that points at the rule to adjust in `firestore.rules`.

## How Firebase mode works, and its limits

* `web/src/lib/store/cloud.ts` keeps the app's in-memory database live with Firestore listeners and writes back only
  the documents each action changed, in one atomic batch. Collections: `users, organizations, missions, participants,
  submissions, records, certificates, notifications, audits, friendships, cheers`.
* Business rules run in the browser; `firestore.rules` blocks forging roles, rewards, approvals and other people's
  data. A determined user could still write things the UI wouldn't (e.g. join a full mission). Before a large public
  launch, move mutations to the Cloud Functions in `functions/` and switch to `firestore.functions-backend.rules`.
* Signed-in users can read other users' profile documents (including email) and submissions. Fine for a pilot;
  split private fields into a separate collection before scaling.
* Evidence photos are stored inside the submission document (compressed to 800 px), so no Storage bucket is needed.
  Every signed-in client downloads all collections; expect to add queries/pagination beyond a few thousand records.
* `/api/ai/missions` is public and rate-limited per IP per server instance. Restrict the Gemini key in Google AI Studio
  / Cloud Console and set a quota so it can't be drained.
* Netlify's function time limit applies to the agent. If you see timeouts, ask for fewer missions or set
  `GEMINI_MODEL` to a faster "flash-lite" model.
