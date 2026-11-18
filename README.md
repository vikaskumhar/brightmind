# Bright Mind

An accessible adult cognitive-practice web application with 3 daily warm-up games and a plug-and-play **6-exercise Advanced Cognitive Games Module** (`src/modules/AdvancedCognitiveGamesModule.tsx`), backed by **Firebase Authentication (Google Sign-In)** and **Cloud Firestore**.

## Included Cognitive Exercises

### Advanced Cognitive Suite (`AdvancedCognitiveGamesModule`)
1. **Mental Rotation 2D/3D Grid** — Visuospatial Manipulation (12 rounds, 5×5 asymmetrical polyominoes rotated 90°/180°/270° vs mirrored/altered decoys)
2. **Trail Making Test A & B** — Visual Attention & Task-Switching (16 nodes alternating `1 → A → 2 → B ... 8 → H`)
3. **Corsi Block-Tapping Span** — Visuospatial Working Memory (9 irregular blocks, Forward on odd rounds, Reverse on even rounds, adaptive span)
4. **Calcudoku 4×4** — Numerical Logic & Constraint Satisfaction (procedural Latin square & arithmetic cages `+`, `-`, `×`, `÷`)
5. **Rapid Visual Information Processing (RVIP)** — Sustained Vigilance (60s digit stream at 600ms/digit, 3-odd or 3-even target sequences)
6. **Anagrams & Word Unscrambler** — Verbal Fluency & Lexical Retrieval (60s countdown, 160+ adult-level 6–7 letter dictionary words, shuffle & streak bonus)

### Daily Warm-Up Classics
- Memory Match
- Number Sequence
- Word Builder

## Run Directly in VS Code (Desktop & Mobile)

1. Open this folder in **VS Code**.
2. Open the integrated terminal (`Ctrl + \`` or `Cmd + \``) and install dependencies:
   ```bash
   npm install
   ```
3. Start the app (builds the frontend and serves both UI + API on `0.0.0.0:3000`):
   ```bash
   npm run dev
   ```
4. Open on your computer: `http://localhost:3000`
5. **Open on Mobile (same Wi-Fi network):**
   Find your computer's local IP address (e.g. `192.168.1.42`) and open `http://192.168.1.42:3000` on your phone browser.

## Install on Mobile Without Laptop Open (PWA + Downloadable APK)

### Option A: Install Immediately as a Standalone Mobile App (PWA)
This app includes a Web App Manifest (`manifest.webmanifest`) and Service Worker (`vite-plugin-pwa`):
1. Open the deployed/shared HTTPS URL (e.g. `https://ais-pre-3zo32q3k6uppasl6r4bblz-310457913859.asia-east1.run.app`) directly on your phone browser (**Chrome on Android** or **Safari on iPhone**).
2. Tap **Install App** (or Chrome `⋮ → Install app` / Safari `Share → Add to Home Screen`).
3. Launch **Bright Mind** directly from your phone's home screen—no laptop needed—and sign in with Google to sync straight to Firebase Firestore.

### Option B: Build the Downloadable Android `.apk` (Capacitor + Native Google Sign-In)
Capacitor (`capacitor.config.ts`), `@capacitor-firebase/authentication`, and the native Android project (`android/`) are pre-configured in this repository:
1. Get your Android debug SHA-1 fingerprint (from the `android/` folder):
   ```bash
   cd android && ./gradlew signingReport
   ```
   Copy the `SHA1` value under `Variant: debug`.
2. In **Firebase Console → Project Settings → Your apps → Add app → Android**:
   - **Android package name:** `com.brightmind.app`
   - **Debug signing certificate SHA-1:** paste the SHA-1 from step 1
   - Download `google-services.json` and save it at `android/app/google-services.json`
3. In VS Code, install dependencies, build web assets, and sync them into `android/`:
   ```bash
   npm install
   npm run cap:sync
   ```
4. Open the `android/` project in Android Studio:
   ```bash
   npm run cap:android
   ```
5. In Android Studio, click **Build → Build Bundle(s) / APK(s) → Build APK(s)** (or run `cd android && ./gradlew assembleDebug`). The generated APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.
6. **Alternative without `google-services.json` or Android Studio:** Paste the live HTTPS URL into [pwabuilder.com](https://www.pwabuilder.com) and download a packaged Android APK (runs via Chrome Custom Tabs so Google Sign-In works immediately).


## Firebase Setup

Firebase client configuration lives in `firebase-applet-config.json` and Firestore security rules live in `firestore.rules` (validated against `firebase-blueprint.json`).
- **Authentication:** Google Sign-In (`signInWithPopup`)
- **Firestore Collections:**
  - `/users/{userId}` — non-PII profile, accessibility preferences, streaks, and total session counts
  - `/users/{userId}/private/info` — owner-only isolated PII (email, photo URL)
  - `/users/{userId}/sessions/{sessionId}` — immutable completed cognitive exercise telemetry (`gameId`, `domain`, `score`, `accuracyPercent`, `avgReactionTimeMs`, `durationSeconds`, `playedAt`)

> **Important for Firebase Auth on custom/local domains:** Ensure `localhost` (and any custom preview/production domain) is listed under **Firebase Console → Authentication → Settings → Authorized domains**.

## Push to GitHub from VS Code

```bash
git init
git add .
git commit -m "Add Bright Mind with 6-game AdvancedCognitiveGamesModule and Firebase Firestore"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Scripts

- `npm run dev` — Build frontend and start server on port `3000` (`0.0.0.0`)
- `npm run check` — Type-check client and server TypeScript
- `npm run build` — Production build (`dist/` and `dist-server/`)
- `npm start` — Run production Node server
- `npx eslint firestore.rules` — Lint Firestore security rules
