import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { getMyProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Firestore user doc
  const [loading, setLoading]         = useState(true);  // auth loading
  const [profileLoading, setProfileLoading] = useState(false); // profile fetch loading
  const [error, setError]             = useState(null);
  const profileFetchRef               = useRef(null); // prevent duplicate fetches

  /**
   * Fetch the user profile from the backend (/api/users/me).
   * Creates the Firestore document on first login.
   * Exposed as refreshUserProfile() so any component can force a refresh
   * (e.g. after admin approves the user).
   */
  const fetchUserProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) { setUserProfile(null); return; }

    // Debounce: if a fetch is already in-flight, don't start another
    if (profileFetchRef.current) return;
    profileFetchRef.current = true;

    setProfileLoading(true);
    try {
      const profile = await getMyProfile();
      setUserProfile(profile);
    } catch (err) {
      console.warn('[AuthContext] Could not load user profile:', err.message);
      // Non-fatal — the app still works, access control falls back to the backend
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
      profileFetchRef.current = false;
    }
  }, []);

  const refreshUserProfile = useCallback(() => {
    if (auth.currentUser) return fetchUserProfile(auth.currentUser);
  }, [fetchUserProfile]);

  // Listen for Firebase Auth state changes
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

  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
      // Profile fetch is triggered by onAuthStateChanged above
      return result.user;
    } catch (err) {
      console.error('[Auth] Google sign-in failed:', err.code, err.message);
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      return result.user;
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setUserProfile(null);
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to sign out. Please try again.');
    }
  }, []);

  // Computed helpers for components to use directly
  const isAdmin      = userProfile?.role === 'admin';
  const isPending    = userProfile?.status === 'PENDING';
  const isApproved   = userProfile?.status === 'APPROVED';
  const isUnlimited  = userProfile?.isUnlimited === true;
  const trialUsed    = userProfile?.freeTrialUsed    ?? 0;
  const trialLimit   = userProfile?.freeTrialLimit   ?? 3;
  const trialLeft    = userProfile?.freeTrialRemaining ?? Math.max(0, trialLimit - trialUsed);
  const dailyUsed    = userProfile?.dailyCallsUsed   ?? 0;
  const dailyLimit   = userProfile?.dailyLimit       ?? 20;
  const dailyLeft    = userProfile?.dailyCallsRemaining ?? Math.max(0, dailyLimit - dailyUsed);

  const value = useMemo(() => ({
    // Firebase user object
    user,
    // Firestore user profile (status, role, quotas)
    userProfile,
    // Loading states
    loading,
    profileLoading,
    // Errors
    error,
    clearError,
    // Auth actions
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
    // Profile refresh (call after admin actions)
    refreshUserProfile,
    // Computed convenience flags
    isAdmin,
    isPending,
    isApproved,
    isUnlimited,
    // Quota info
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

// Human-readable error messages
// Covers both legacy Firebase codes and modern Firebase v9+ unified codes
function getAuthErrorMessage(code) {
  const messages = {
    // ── Firebase v9+ unified credential error (replaces wrong-password + user-not-found) ──
    'auth/invalid-credential':          'Incorrect email or password. Please try again.',

    // ── Legacy codes (still emitted in some SDK paths) ──
    'auth/user-not-found':              'No account found with this email.',
    'auth/wrong-password':              'Incorrect password.',

    // ── Email / account ──
    'auth/email-already-in-use':        'An account with this email already exists.',
    'auth/invalid-email':               'Please enter a valid email address.',
    'auth/user-disabled':               'This account has been disabled. Contact support.',
    'auth/account-exists-with-different-credential':
                                        'An account already exists with a different sign-in method.',

    // ── Password ──
    'auth/weak-password':               'Password must be at least 6 characters.',
    'auth/missing-password':            'Please enter your password.',

    // ── Rate limiting / safety ──
    'auth/too-many-requests':           'Too many failed attempts. Please wait a few minutes and try again.',
    'auth/requires-recent-login':       'Please sign out and sign back in to continue.',

    // ── Google / OAuth popup ──
    'auth/popup-closed-by-user':        'Sign-in popup was closed. Please try again.',
    'auth/popup-blocked':               'Pop-up was blocked by your browser. Trying redirect sign-in…',
    'auth/cancelled-popup-request':     'Only one sign-in popup can be open at a time.',
    'auth/operation-not-supported-in-this-environment':
                                        'Google sign-in is not supported in this environment.',

    // ── Domain / config ──
    'auth/unauthorized-domain':         'This domain is not authorised for sign-in. Please contact support.',
    'auth/operation-not-allowed':       'Google sign-in is not enabled. Please contact support.',
    'auth/invalid-action-code':         'This link has expired or already been used. Please try again.',
    'auth/internal-error':              'An internal error occurred. Please try again.',

    // ── Network ──
    'auth/network-request-failed':      'Network error. Please check your connection and try again.',
  };
  return messages[code] || `Authentication failed. Please try again. (${code || 'unknown'})`;
}
