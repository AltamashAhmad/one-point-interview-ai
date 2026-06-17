import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { getMyProfile } from '../services/api';

const AuthContext = createContext(null);

const IS_DEV = process.env.NODE_ENV !== 'production';

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError]             = useState(null);
  const profileFetchRef               = useRef(false);

  // ── Fetch user profile from backend ───────────────────────────────────────
  const fetchUserProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) { setUserProfile(null); return; }
    if (profileFetchRef.current) return;
    profileFetchRef.current = true;

    setProfileLoading(true);
    try {
      const data = await getMyProfile();
      setUserProfile(data?.profile ?? data ?? null);
    } catch (err) {
      if (IS_DEV) console.warn('[AuthContext] Profile fetch failed:', err.message);
      // Non-fatal — the app still works, access control falls back to backend
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
      profileFetchRef.current = false;
    }
  }, []);

  const refreshUserProfile = useCallback(() => {
    if (auth.currentUser) return fetchUserProfile(auth.currentUser);
  }, [fetchUserProfile]);

  // ── Handle redirect sign-in result on page load ───────────────────────────
  // This runs once on mount and captures the result of signInWithRedirect
  // (which is the automatic fallback when popup is blocked or fails).
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          if (IS_DEV) console.log('[Auth] Redirect sign-in succeeded for', result.user.email);
          // onAuthStateChanged will fire too, but we fetch profile immediately
          setUser(result.user);
        }
      })
      .catch((err) => {
        const code = err?.code || '';
        // Ignore the "no redirect pending" non-error
        if (code && code !== 'auth/no-redirect-result') {
          if (IS_DEV) console.error('[Auth] getRedirectResult error:', code, err.message);
          setError(getAuthErrorMessage(code, err.message));
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Firebase Auth state listener ──────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [fetchUserProfile]);

  const clearError = useCallback(() => setError(null), []);

  // ── Google Sign-In (popup → redirect fallback) ────────────────────────────
  // Companies like Firebase itself recommend popup for web, with redirect
  // as an automatic fallback for cases where popup is blocked or fails.
  const signInWithGoogle = useCallback(async () => {
    setError(null);

    // ── Attempt 1: Popup (best UX, instant) ──────────────────────────────
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (popupErr) {
      const code = popupErr?.code || 'unknown';

      if (IS_DEV) {
        console.group('[Auth] Google popup sign-in failed');
        console.error('Error code:', code);
        console.error('Error message:', popupErr.message);
        console.error('Full error:', popupErr);
        console.groupEnd();
      }

      // Errors where redirect is a valid fallback
      const tryRedirectFor = new Set([
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/internal-error',
        'auth/operation-not-supported-in-this-environment',
        'auth/web-storage-unsupported',
      ]);

      if (tryRedirectFor.has(code)) {
        if (IS_DEV) console.info('[Auth] Popup failed — falling back to redirect sign-in…');

        // ── Attempt 2: Full-page redirect (always works) ────────────────
        try {
          await signInWithRedirect(auth, googleProvider);
          // Page navigates away — code below never runs
          return null;
        } catch (redirectErr) {
          if (IS_DEV) console.error('[Auth] Redirect also failed:', redirectErr.code, redirectErr.message);
          setError(getAuthErrorMessage(redirectErr.code, redirectErr.message));
          throw redirectErr;
        }
      }

      // Non-retryable errors (user cancelled, wrong config, etc.)
      setError(getAuthErrorMessage(code, popupErr.message));
      throw popupErr;
    }
  }, []);

  // ── Email Sign-In ─────────────────────────────────────────────────────────
  const signInWithEmail = useCallback(async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      if (IS_DEV) console.error('[Auth] Email sign-in failed:', err.code, err.message);
      setError(getAuthErrorMessage(err.code, err.message));
      throw err;
    }
  }, []);

  // ── Email Sign-Up ─────────────────────────────────────────────────────────
  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      return result.user;
    } catch (err) {
      if (IS_DEV) console.error('[Auth] Email sign-up failed:', err.code, err.message);
      setError(getAuthErrorMessage(err.code, err.message));
      throw err;
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      setUserProfile(null);
      await signOut(auth);
    } catch (err) {
      console.error('[Auth] Logout failed:', err);
      setError('Failed to sign out. Please try again.');
    }
  }, []);

  // ── Computed convenience flags ─────────────────────────────────────────────
  const isAdmin     = userProfile?.role === 'admin';
  const isPending   = userProfile?.status === 'PENDING';
  const isApproved  = userProfile?.status === 'APPROVED';
  const isUnlimited = userProfile?.isUnlimited === true;
  const trialUsed   = userProfile?.freeTrialUsed    ?? 0;
  const trialLimit  = userProfile?.freeTrialLimit   ?? 3;
  const trialLeft   = userProfile?.freeTrialRemaining ?? Math.max(0, trialLimit - trialUsed);
  const dailyUsed   = userProfile?.dailyCallsUsed   ?? 0;
  const dailyLimit  = userProfile?.dailyLimit       ?? 20;
  const dailyLeft   = userProfile?.dailyCallsRemaining ?? Math.max(0, dailyLimit - dailyUsed);

  const value = useMemo(() => ({
    user,
    userProfile,
    loading,
    profileLoading,
    error,
    clearError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    refreshUserProfile,
    isAdmin,
    isPending,
    isApproved,
    isUnlimited,
    trialUsed,
    trialLimit,
    trialLeft,
    dailyUsed,
    dailyLimit,
    dailyLeft,
  }), [
    user, userProfile, loading, profileLoading, error,
    clearError, signInWithGoogle, signInWithEmail, signUpWithEmail, logout, refreshUserProfile,
    isAdmin, isPending, isApproved, isUnlimited,
    trialUsed, trialLimit, trialLeft, dailyUsed, dailyLimit, dailyLeft,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ── Human-readable error messages ────────────────────────────────────────────
function getAuthErrorMessage(code, rawMessage) {
  const messages = {
    // ── Credential errors ──
    'auth/invalid-credential':      'Incorrect email or password. Please try again.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password.',

    // ── Email / account ──
    'auth/email-already-in-use':    'An account with this email already exists.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/user-disabled':           'This account has been disabled. Contact support.',
    'auth/account-exists-with-different-credential':
                                    'An account already exists with a different sign-in method.',

    // ── Password ──
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/missing-password':        'Please enter your password.',

    // ── Rate limiting ──
    'auth/too-many-requests':       'Too many attempts. Please wait a few minutes and try again.',
    'auth/requires-recent-login':   'Please sign out and sign back in to continue.',

    // ── Google / OAuth popup ──
    'auth/popup-closed-by-user':    'Sign-in was cancelled. Please try again.',
    'auth/popup-blocked':           'Pop-up blocked — trying a different sign-in method…',
    'auth/cancelled-popup-request': 'Sign-in already in progress. Please wait.',

    // ── Domain / config ──
    'auth/unauthorized-domain':
      IS_DEV
        ? 'Unauthorized domain. Check Firebase Console → Auth → Settings → Authorized domains and ensure localhost is listed.'
        : 'This domain is not authorised for sign-in. Please contact support.',
    'auth/operation-not-allowed':
      IS_DEV
        ? 'Google sign-in is not enabled. Check Firebase Console → Auth → Sign-in method → Google.'
        : 'Google sign-in is not enabled. Please contact support.',
    'auth/invalid-action-code':     'This link has expired or already been used.',

    // ── Internal / network ──
    'auth/internal-error':
      IS_DEV
        ? `Sign-in failed internally (trying redirect fallback). Check browser console for full details.`
        : 'Sign-in failed. Please try again.',
    'auth/network-request-failed':  'Network error. Please check your connection and try again.',
  };

  const mapped = messages[code];
  if (mapped) return mapped;

  // In development, include the raw code to help diagnose unknown errors
  if (IS_DEV) {
    return `Authentication error (${code || 'unknown'}). Check browser console for details.`;
  }
  return 'Authentication failed. Please try again.';
}
