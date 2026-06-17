// Firebase web app configuration
// Get these from: Firebase Console → Project Settings → Your apps → Web app
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// ── Firebase App Check ─────────────────────────────────────────────────────
//
// Enterprise pattern (same as Firebase's own docs & major companies):
//
//   LOCAL DEV  → App Check is completely OFF.
//                The backend has SKIP_APP_CHECK=true in backend/.env so no
//                API requests are blocked. Nothing is initialised here —
//                initialising with a fake/debug key breaks Firebase Auth
//                Google sign-in popup with auth/internal-error.
//
//   PRODUCTION → App Check ON with reCAPTCHA v3 (invisible, no user friction).
//                REACT_APP_RECAPTCHA_SITE_KEY must be set in .env.production
//                or in your CI/CD environment variables (Amplify Console).
//                All /api/* requests are verified to come from the real app.
//
// How to enable App Check in local dev (optional, advanced):
//   1. Remove the NODE_ENV guard below.
//   2. Add REACT_APP_FIREBASE_APPCHECK_DEBUG_TOKEN=true to frontend/.env.
//   3. Call initializeAppCheck with CustomProvider using the debug token.
//   4. Firebase prints the token to the browser console on first load —
//      add it to Firebase Console → App Check → your web app → Debug tokens.
//   5. Set SKIP_APP_CHECK=false in backend/.env.

let appCheckInstance = null;

if (process.env.NODE_ENV === 'production') {
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

  if (siteKey) {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    // Misconfiguration guard — loud error so it gets fixed before go-live
    console.error(
      '[Firebase] PRODUCTION BUILD: REACT_APP_RECAPTCHA_SITE_KEY is not set!\n' +
      'App Check is DISABLED. Set this key in AWS Amplify Console → Environment variables.'
    );
  }
}
// Development: App Check intentionally not initialised.
// Backend uses SKIP_APP_CHECK=true to bypass verification locally.

export const appCheck = appCheckInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
