# Water Vipers OC Timer — hosting & install guide

This folder is a complete Progressive Web App (PWA). Once it's hosted at a real
web link, your team taps that link once, adds it to their home screen, and it
behaves like an installed app — with the WV OC icon, full-screen, and working
offline during a session.

You only need to do the hosting setup **once**. After that, sharing the app is
just sharing a link.

---

## What's in this folder

- `index.html` — the app itself
- `manifest.webmanifest` — tells the phone the app's name, icon, and colors
- `sw.js` — the service worker that makes it work offline
- `sync.js` — the realtime sync module (talks to Firebase)
- `firebase-config.js` — where you paste your free Firebase project's keys
- `icons/` — the WV OC app icon in every size iOS and Android need

Keep the folder structure exactly as-is. Don't rename files.

---

## Hosting it (GitHub Pages — free, ~10 minutes, one time)

### 1. Make a free GitHub account
Go to https://github.com and sign up. Email + password, no credit card.

### 2. Create a new repository
- Click the **+** in the top-right → **New repository**
- Name it something like `wv-oc-timer`
- Set it to **Public**
- Click **Create repository**

### 3. Upload these files
- On the new repo page, click **uploading an existing file**
- Drag in **everything from this folder** — `index.html`, `manifest.webmanifest`,
  `sw.js`, and the whole `icons` folder
- Click **Commit changes**

> Tip: drag the *contents* of this folder, not the folder itself, so that
> `index.html` sits at the top level of the repo.

### 4. Turn on GitHub Pages
- In the repo, go to **Settings** → **Pages** (left sidebar)
- Under **Source**, choose **Deploy from a branch**
- Branch: **main**, folder: **/ (root)** → **Save**
- Wait 1–2 minutes

### 5. Get your link
GitHub shows a link like:
```
https://YOURNAME.github.io/wv-oc-timer/
```
That's the app. Open it on your own phone first to check it works, then share
it with the team.

---

## Installing it on a phone

Send your team the link and these two lines:

**iPhone (Safari):**
Open the link → tap the **Share** button → **Add to Home Screen** → **Add**.

**Android (Chrome):**
Open the link → tap the **⋮** menu → **Add to Home screen** / **Install app**.

After that, the WV OC icon sits on their home screen and opens full-screen like
any other app. It keeps working even with no signal once it's been opened once.

---

## Updating the app later

If you ever want to change something in the app:
1. Edit `index.html` (or have it rebuilt)
2. Open `sw.js` and bump the version number on this line:
   ```
   const CACHE_VERSION = "wv-oc-timer-v5";
   ```
   e.g. change `v5` to `v6`
3. Re-upload the changed files to the same repo

Everyone's app picks up the new version automatically the next time they open it
while online. No need to reinstall.

---

## Setting up realtime sync (live times between phones)

This is what makes the Start phone's taps appear instantly on the Finish
phone, with no extra device and no Bluetooth. It uses Firebase Realtime
Database — a free backend service from Google that the app talks to over
normal WiFi/cellular.

**Without this step, the app still works fine** — each phone times
independently and volunteers reconcile the two logs at the dock, same as
the original plan. This section is what upgrades that to instant live sync.

### 1. Create a free Firebase project
- Go to https://console.firebase.google.com → **Add project**
- Give it a name (e.g. `wv-oc-timer`) → follow the prompts → **Create project**
- No credit card required for what this app uses (Spark/free plan)

### 2. Add a Web App to the project
- In the project overview, click the **</>** (web) icon
- Nickname it anything → **Register app**
- Firebase shows a `firebaseConfig` object with keys like `apiKey`,
  `authDomain`, `databaseURL`, etc. — copy the whole thing.

### 3. Turn on Realtime Database
- Left sidebar → **Build** → **Realtime Database** → **Create Database**
- Pick a region close to you → start in **test mode** for now (we'll lock it
  down with the rules below)

### 4. Paste your keys into `firebase-config.js`
Open `firebase-config.js` in this folder and fill in the values Firebase
gave you in step 2:
```js
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "wv-oc-timer.firebaseapp.com",
  databaseURL: "https://wv-oc-timer-default-rtdb.firebaseio.com",
  projectId: "wv-oc-timer",
  storageBucket: "wv-oc-timer.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```
These values are safe to ship inside the app — they're not secret keys, every
Firebase web app includes them in plain view. What actually controls access
is the rules in the next step.

### 5. Set the security rules
In the Firebase console: **Realtime Database** → **Rules** tab → replace the
contents with this, then **Publish**:
```json
{
  "rules": {
    "sessions": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['meta']) || newData.hasChildren(['roster']) || newData.hasChildren(['events']) || newData.hasChildren(['presence'])"
      }
    }
  }
}
```
This scopes everything to a session code (the 4-digit code phones use to
join) so a phone can only see/write the session it's actually joined — the
code acts like a room PIN. Nothing requires a login on the volunteers' side.

### 6. Re-upload to GitHub Pages
Upload the updated `firebase-config.js`, plus the two new files `sync.js`
and the updated `sw.js`, to your GitHub repo (same steps as before). Bump
`CACHE_VERSION` in `sw.js` first if you're updating an already-deployed app,
so phones pick up the change.

### How it works, in short
- The coordinator's phone generates a 4-digit code and shares the roster —
  Start and Finish phones type that code in during morning sync instead of
  pairing over Bluetooth (Bluetooth from a web app isn't available on
  iPhone at all, so this is the actual working equivalent).
- All three phones' clocks agree automatically via Firebase's built-in
  server-time sync — no manual handshake needed.
- Every start/finish tap is saved to the phone **first** (instant, no
  network wait), then pushed to the other phones in the background —
  typically under a second.
- If the connection drops mid-session, taps keep recording locally and
  quietly catch up once signal returns. Nothing is ever lost.

---


