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
  if (!userProfile) return <PageLoader />;
  if (userProfile.role !== 'admin') return <Navigate to="/" replace />;

  return children;
}

/**
 * AccessGate — wraps all protected pages.
 * If a PENDING user's free trial is exhausted, renders the AccessWall overlay.
 * Admins and APPROVED users pass straight through.
 */
function AccessGate({ children }) {
  const { profileLoading, isAdmin, isPending, trialUsed, trialLimit } = useAuth();

  // Don't gate while profile is loading
  if (profileLoading) return children;

  // Admins always pass through
  if (isAdmin) return children;

  // PENDING user with exhausted trial → show the wall as an overlay
  const exhausted = isPending && (trialUsed ?? 0) >= (trialLimit ?? 3);
  if (exhausted) {
    return (
      <>
        {children}
        <React.Suspense fallback={null}>
          <AccessWall />
        </React.Suspense>
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

