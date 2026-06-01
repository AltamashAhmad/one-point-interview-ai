import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signInWithGoogle = useCallback(async () => {
    try {
      setError(null);
      const result = await signInWithPopup(auth, googleProvider);
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
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to sign out. Please try again.');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    error,
    clearError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    logout,
  }), [user, loading, error, clearError, signInWithGoogle, signInWithEmail, signUpWithEmail, logout]);

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
