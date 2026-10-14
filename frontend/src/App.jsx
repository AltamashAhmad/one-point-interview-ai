import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import AppShell from './components/layout/AppShell';
import { Icon } from './components/ui';
import './index.css';
import './components/AppStates.css';

// ── Code-split page imports (lazy-loaded) ──────────────────────────────────
const Landing       = React.lazy(() => import('./pages/Landing'));
const Login         = React.lazy(() => import('./pages/LoginPage'));
const Interview     = React.lazy(() => import('./pages/Interview'));
const History       = React.lazy(() => import('./pages/HistoryList'));
const HistoryDetail = React.lazy(() => import('./pages/SessionReview'));
const Scorecard     = React.lazy(() => import('./pages/ScorecardView'));
const LoopDashboard = React.lazy(() => import('./pages/LoopView'));
const AccessWall    = React.lazy(() => import('./pages/AccessWall'));
const Admin         = React.lazy(() => import('./pages/Admin'));
const DsaSheet      = React.lazy(() => import('./pages/DsaSheet'));
const PrepPlan      = React.lazy(() => import('./pages/PrepPlan'));
const NotFound      = React.lazy(() => import('./pages/NotFound'));
const Welcome       = React.lazy(() => import('./pages/Welcome'));
const NotesHome     = React.lazy(() => import('./pages/NotesHome'));
const NotesTrack    = React.lazy(() => import('./pages/NotesTrack'));
const NotesTopic    = React.lazy(() => import('./pages/NotesTopic'));

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
        <div className="loading-screen app-error">
          <h2 className="app-error__title"><Icon name="alert" size={22} /> Something went wrong</h2>
          <p className="app-error__text">
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
    <div className="app-blocker">
      <div className="app-blocker__icon">{icon}</div>
      <h1 className="app-blocker__title">{title}</h1>
      <p className="app-blocker__text">
        {subtitle}
      </p>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  // Visitors opening the bare site see the public page; deep links go straight to sign-in.
  return user ? children : <Navigate to={pathname === '/' ? '/welcome' : '/login'} replace />;
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
      icon={<Icon name="alert" size={28} />} 
      title="System Maintenance" 
      subtitle="We are currently upgrading the platform. Please check back shortly. We apologize for the inconvenience!"
    />;
  }

  // 2. Banned
  if (isBanned) {
    return <FullScreenBlocker 
      icon={<Icon name="ban" size={28} />} 
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
    } catch { /* invalid date: keep the generic wording */ }

    return <FullScreenBlocker 
      icon={<Icon name="pause" size={28} />} 
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
          className="app-trial-banner"
        >
          <Icon name="alert" size={16} /> Your free trial is exhausted. Click here to request full access.
        </div>
        <div className="app-trial-content">
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
          path="/welcome"
          element={
            <PublicRoute>
              <Welcome />
            </PublicRoute>
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

        {/* Signed-in pages share the app shell (sidebar on desktop, tab bar on phones). */}
        <Route
          element={
            <ProtectedRoute>
              <AccessGate>
                <AppShell />
              </AccessGate>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Landing />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<HistoryDetail />} />
          <Route path="/scorecard/:id" element={<Scorecard />} />
          <Route path="/loop/:id" element={<LoopDashboard />} />
          <Route path="/dsa-sheet" element={<DsaSheet />} />
          <Route path="/prep-plan" element={<PrepPlan />} />
          <Route path="/notes" element={<NotesHome />} />
          <Route path="/notes/:trackId" element={<NotesTrack />} />
          <Route path="/notes/:trackId/:topicId" element={<NotesTopic />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route
            path="/admin/prompts"
            element={
              <AdminRoute>
                <Landing adminPromptMode={true} />
              </AdminRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* The interview workspace needs the whole screen, so it sits outside the shell. */}
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
        <Route path="/roadmap" element={<Navigate to="/dsa-sheet" replace />} />
        <Route path="/striver-a2z" element={<Navigate to="/dsa-sheet" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

