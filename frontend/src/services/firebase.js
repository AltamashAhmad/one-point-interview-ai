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
// Because App Check is ENFORCED on Firebase Authentication in your Firebase 
// Console, we *must* initialize App Check even in local development.
// If we skip initialization, Firebase Auth's APIs (signInWithPopup, etc.)
// reject the request with 401 Unauthorized, causing `auth/internal-error`.
//
// Since reCAPTCHA v3 automatically allows "localhost", we can simply use 
// the real site key in both local dev and production.
//
let appCheckInstance = null;

const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

if (siteKey) {
  appCheckInstance = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
} else {
  console.error(
    '[Firebase] REACT_APP_RECAPTCHA_SITE_KEY is not set!\n' +
    'App Check is disabled. Firebase Auth will fail with auth/internal-error ' +
    'because enforcement is turned on in the Firebase Console.'
  );
}

export const appCheck = appCheckInstance;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
