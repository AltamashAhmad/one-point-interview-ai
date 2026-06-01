import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import './Login.css';

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, error, clearError } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const displayError = localError || error;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    clearError();
    setLocalError('');
    try {
      await signInWithGoogle();
      navigate('/');
    } catch {
      // error set by context
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (mode === 'signup') {
      if (!form.name.trim()) return setLocalError('Please enter your name.');
      if (form.password.length < 6) return setLocalError('Password must be at least 6 characters.');
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(form.email, form.password);
      } else {
        await signUpWithEmail(form.email, form.password, form.name.trim());
      }
      navigate('/');
    } catch {
      // error set by context
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setLocalError('');
    clearError();
  };

  return (
    <div className="login-page">
      <ThemeToggle />
      <div className="login-bg-glow" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <span className="logo-icon">🎯</span>
          <span className="logo-text">OnePoint<span className="logo-ai"> AI</span></span>
        </div>

        <h1 className="login-title">
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="login-subtitle">
          {mode === 'signin'
            ? 'Sign in to continue your interview practice'
            : 'Start practicing FAANG interviews for free'}
        </p>

        {/* Google Sign In */}
        <button className="google-btn" onClick={handleGoogleSignIn} disabled={loading}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="divider">
          <span>or {mode === 'signin' ? 'sign in' : 'sign up'} with email</span>
        </div>

        {/* Email Form */}
        <form className="login-form" onSubmit={handleEmailAuth}>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </div>

          {displayError && (
            <div className="error-message" role="alert">
              ⚠️ {displayError}
            </div>
          )}

          <button type="submit" className="btn btn-primary submit-btn" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="toggle-mode">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button className="toggle-btn" onClick={toggleMode} type="button">
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
