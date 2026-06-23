import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

// ── Code-split page imports (lazy-loaded) ──────────────────────────────────
const Landing       = React.lazy(() => import('./pages/Landing'));
const Login         = React.lazy(() => import('./pages/Login'));
const Interview     = React.lazy(() => import('./pages/Interview'));
const History       = React.lazy(() => import('./pages/History'));
const HistoryDetail = React.lazy(() => import('./pages/HistoryDetail'));
const Scorecard     = React.lazy(() => import('./pages/Scorecard'));
const LoopDashboard = React.lazy(() => import('./pages/LoopDashboard'));
const AccessWall    = React.lazy(() => import('./pages/AccessWall'));
const Admin         = React.lazy(() => import('./pages/Admin'));
const Roadmap       = React.lazy(() => import('./pages/Roadmap'));

// ── Loading fallback for Suspense ──────────────────────────────────────────
function PageLoader() {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

// ── Error Boundary — catches render errors gracefully ──────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="loading-screen" style={{ textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>⚠️ Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
          >
            Go to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function FullScreenBlocker({ title, subtitle, icon }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      backgroundColor: '#0f111a', color: '#fff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{icon}</div>
      <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem', fontWeight: 700 }}>{title}</h1>
      <p style={{ color: '#9ca3af', maxWidth: '400px', textAlign: 'center', lineHeight: 1.5 }}>
        {subtitle}
      </p>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return user ? children : <Navigate to="/login" replace />;
}

// Admin-only route wrapper — non-admins redirected to home
function AdminRoute({ children }) {
  const { user, loading, userProfile, profileLoading } = useAuth();

  if (loading || profileLoading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // If userProfile is still null after loading completes, the profile fetch failed (e.g. backend down).
  // Do not spin forever. Fallback to assuming they are not an admin.
  if (!userProfile) return <Navigate to="/" replace />;
  if (userProfile.role !== 'admin') return <Navigate to="/" replace />;

  return children;
}

/**
 * AccessGate — wraps all protected pages.
 * If a PENDING user's free trial is exhausted, renders the AccessWall overlay.
 * Admins and APPROVED users pass straight through.
 */
function AccessGate({ children }) {
  const { profileLoading, isAdmin, isPending, isBanned, isSuspended, isMaintenanceMode, userProfile, trialUsed, trialLimit, wallDismissed, setWallDismissed } = useAuth();

  // Don't gate while profile is loading
  if (profileLoading) return children;

  // Admins always pass through ALL gates
  if (isAdmin) return children;

  // 1. Maintenance Mode
  if (isMaintenanceMode) {
    return <FullScreenBlocker 
      icon="⚙️" 
      title="System Maintenance" 
      subtitle="We are currently upgrading the platform. Please check back shortly. We apologize for the inconvenience!"
    />;
  }

  // 2. Banned
  if (isBanned) {
    return <FullScreenBlocker 
      icon="🚫" 
      title="Account Banned" 
      subtitle={`Your account has been permanently banned. Reason: ${userProfile?.banReason || 'No reason provided.'}`}
    />;
  }

  // 3. Suspended
  if (isSuspended) {
    let dateStr = 'a future date';
    try {
      if (userProfile?.suspendedUntil) {
        dateStr = new Date(userProfile.suspendedUntil).toLocaleString();
      }
    } catch (e) {}

    return <FullScreenBlocker 
      icon="⏸️" 
      title="Account Suspended" 
      subtitle={`Your account is temporarily suspended until ${dateStr}. Reason: ${userProfile?.suspendNote || 'No reason provided.'}`}
    />;
  }

  // 4. PENDING user with exhausted trial → show the wall as an overlay
  const exhausted = isPending && (trialUsed ?? 0) >= (trialLimit ?? 3);
  if (exhausted && !wallDismissed) {
    return (
      <>
        {children}
        <React.Suspense fallback={null}>
          <AccessWall onClose={() => setWallDismissed(true)} />
        </React.Suspense>
      </>
    );
  }

  // If they exhausted but dismissed the wall, show a persistent banner at the top
  if (exhausted && wallDismissed) {
    return (
      <>
        <div 
          onClick={() => setWallDismissed(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, zIndex: 9999,
            backgroundColor: '#ef4444',
            color: 'white',
            textAlign: 'center',
            padding: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
        >
          ⚠️ Your free trial is exhausted. Click here to request full access.
        </div>
        <div style={{ marginTop: '40px' }}>
          {children}
        </div>
      </>
    );
  }

  return children;
}

// Public route — redirect to home if already logged in
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return !user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AccessGate>
                <Landing />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/interview/:type"
          element={
            <ProtectedRoute>
              <AccessGate>
                <Interview />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <AccessGate>
                <History />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:id"
          element={
            <ProtectedRoute>
              <AccessGate>
                <HistoryDetail />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/scorecard/:id"
          element={
            <ProtectedRoute>
              <AccessGate>
                <Scorecard />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/loop/:id"
          element={
            <ProtectedRoute>
              <AccessGate>
                <LoopDashboard />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/roadmap"
          element={
            <ProtectedRoute>
              <AccessGate>
                <Roadmap />
              </AccessGate>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

