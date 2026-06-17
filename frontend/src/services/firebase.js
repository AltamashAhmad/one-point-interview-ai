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
// App Check ensures only our real React app can send requests to Firebase
// and our backend. Bots, scrapers, and direct API calls are blocked.
//
// How it works per environment:
//   Local dev  → REACT_APP_FIREBASE_APPCHECK_DEBUG_TOKEN=true in .env
//                A debug token is printed to the browser console on first load.
//                Copy it → Firebase Console → App Check → Debug tokens → Add.
//
//   Production → REACT_APP_RECAPTCHA_SITE_KEY is set in .env.production
//                Uses reCAPTCHA v3 — invisible, no user friction required.

let appCheckInstance = null;

const siteKey    = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
const debugMode  = process.env.REACT_APP_FIREBASE_APPCHECK_DEBUG_TOKEN === 'true';

if (debugMode) {
  // Local development: generate a debug token.
  // On first load, open browser DevTools → Console and look for:
  // "App Check debug token: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  // Copy that token → Firebase Console → App Check → [your app] → Debug tokens → Add token
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (siteKey) {
  // Production: reCAPTCHA v3 (invisible, no user interaction needed)
  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (debugMode) {
  // Local dev: App Check still initialises but uses the debug token printed to console
  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('debug-placeholder'),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.warn(
    '[Firebase] App Check not configured.\n' +
    'Local dev: set REACT_APP_FIREBASE_APPCHECK_DEBUG_TOKEN=true in frontend/.env\n' +
    'Production: set REACT_APP_RECAPTCHA_SITE_KEY in frontend/.env.production'
  );
}

export const appCheck = appCheckInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
