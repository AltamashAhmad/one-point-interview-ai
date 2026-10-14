// Firebase web app configuration
// Get these from: Firebase Console → Project Settings → Your apps → Web app
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey:            import.meta.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        import.meta.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.REACT_APP_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

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

const siteKey = import.meta.env.REACT_APP_RECAPTCHA_SITE_KEY;

// Use debug token in local development to bypass reCAPTCHA completely
// This prevents ad-blocker or race condition issues locally.
if (import.meta.env.DEV) {
  window.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.REACT_APP_FIREBASE_APPCHECK_DEBUG_TOKEN || true;
}

if (siteKey) {
  if (typeof window !== 'undefined') {
    // Prevent double-initialization during Hot Module Reloading
    if (!window.__FIREBASE_APP_CHECK__) {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      window.__FIREBASE_APP_CHECK__ = appCheckInstance;
    } else {
      appCheckInstance = window.__FIREBASE_APP_CHECK__;
    }
  }
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
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
