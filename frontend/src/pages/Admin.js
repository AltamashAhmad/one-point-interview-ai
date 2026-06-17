import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getAdminStats,
  getAdminUsers,
  getAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  updateUserStatus,
  updateUserQuota,
  resetUserDailyQuota,
  getAdminSettings,
  updateAdminSettings,
} from '../services/api';
import './Admin.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function StatusBadge({ status, isUnlimited }) {
  const map = {
    APPROVED:  ['badge-approved',  'Approved'],
    PENDING:   ['badge-pending',   'Pending'],
    BANNED:    ['badge-banned',    'Banned'],
    SUSPENDED: ['badge-suspended', 'Suspended'],
  };
  const [cls, label] = map[status] || ['badge-pending', status];
  return (
    <span className={`badge ${cls}`}>
      {isUnlimited ? '♾️ Unlimited' : label}
    </span>
  );
}

// ─── Confirmation modal ──────────────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false, children }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-msg">{message}</p>
        {children}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className={`btn-primary ${danger ? 'btn-danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Component ────────────────────────────────────────────────────
export default function Admin() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const TABS = ['dashboard', 'requests', 'users', 'settings'];
  const tab  = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';

  const setTab = useCallback(t => setSearchParams({ tab: t }), [setSearchParams]);

  return (
    <div className="admin-root">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span>🎯</span>
          <div>
            <div className="admin-logo-title">OnePoint AI</div>
            <div className="admin-logo-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="admin-nav">
          {[
            { key: 'dashboard', icon: '📊', label: 'Dashboard' },
            { key: 'requests',  icon: '📥', label: 'Requests'  },
            { key: 'users',     icon: '👥', label: 'Users'     },
            { key: 'settings',  icon: '⚙️', label: 'Settings'  },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`admin-nav-item ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <img
            src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=6366f1&color=fff`}
            alt="admin"
            className="admin-avatar"
          />
          <div className="admin-user-info">
            <div className="admin-user-name">{user?.displayName?.split(' ')[0]}</div>
            <div className="admin-user-role">Administrator</div>
          </div>
          <button className="btn-ghost admin-back-btn" onClick={() => navigate('/')} title="Back to app">
            ↩
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'requests'  && <RequestsTab  setTab={setTab} />}
        {tab === 'users'     && <UsersTab />}
        {tab === 'settings'  && <SettingsTab />}
      </main>
    </div>
  );
}

// ─── DASHBOARD TAB ───────────────────────────────────────────────────────────
function DashboardTab() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TabLoader />;

  const u = stats?.users || {};
  return (
    <div className="tab-content">
      <div className="tab-header">
        <h1 className="tab-title">Dashboard</h1>
        <p className="tab-sub">Platform overview at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard icon="👥" label="Total Users"     value={u.total     ?? 0} color="indigo" />
        <StatCard icon="⏳" label="Pending"          value={u.pending   ?? 0} color="amber"  />
        <StatCard icon="✅" label="Approved"         value={u.approved  ?? 0} color="green"  />
        <StatCard icon="🚫" label="Banned"           value={u.banned    ?? 0} color="red"    />
        <StatCard icon="⏸️" label="Suspended"        value={u.suspended ?? 0} color="orange" />
        <StatCard icon="♾️" label="Unlimited Users"  value={u.unlimited ?? 0} color="purple" />
        <StatCard icon="📥" label="Pending Requests" value={stats?.pendingRequests ?? 0} color="blue" />
        <StatCard icon="🤖" label="Total AI Calls"   value={(stats?.totalAiCalls ?? 0).toLocaleString()} color="cyan" />
      </div>

      {/* Quick actions */}
      <div className="section-header"><h2>Quick Actions</h2></div>
      <div className="quick-actions">
        <QuickAction icon="📥" label="Review Requests" desc={`${stats?.pendingRequests ?? 0} awaiting review`} color="indigo" />
        <QuickAction icon="👥" label="Manage Users"    desc={`${u.total ?? 0} registered users`}               color="green"  />
        <QuickAction icon="⚙️" label="Platform Settings" desc="Configure limits & access"                      color="purple" />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function QuickAction({ icon, label, desc, color }) {
  return (
    <div className={`quick-action quick-action--${color}`}>
      <div className="qa-icon">{icon}</div>
      <div>
        <div className="qa-label">{label}</div>
        <div className="qa-desc">{desc}</div>
      </div>
    </div>
  );
}

// ─── REQUESTS TAB ────────────────────────────────────────────────────────────
function RequestsTab({ setTab }) {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('pending');
  const [actionModal, setAction]  = useState(null); // { type:'approve'|'deny', request }
  const [denyReason, setDenyReason] = useState('');
  const [working, setWorking]     = useState(false);
  const [toast, setToast]         = useState(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getAccessRequests({ status: filter });
      setRequests(d.requests || []);
    } catch { showToast('Failed to load requests', false); }
    finally { setLoading(false); }
  }, [filter, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = useCallback(async () => {
    if (!actionModal) return;
    setWorking(true);
    try {
      await approveAccessRequest(actionModal.request.id);
      showToast('✅ Request approved — user notified by email');
      setAction(null);
      load();
    } catch { showToast('Failed to approve', false); }
    finally { setWorking(false); }
  }, [actionModal, load, showToast]);

  const handleDeny = useCallback(async () => {
    if (!actionModal) return;
    setWorking(true);
    try {
      await denyAccessRequest(actionModal.request.id, { reason: denyReason });
      showToast('Request denied — user notified');
      setDenyReason('');
      setAction(null);
      load();
    } catch { showToast('Failed to deny', false); }
    finally { setWorking(false); }
  }, [actionModal, denyReason, load, showToast]);

  const purposeLabel = { job_prep: '💼 Job prep', learning: '📚 Learning', academic: '🎓 Academic', other: '💡 Other' };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Access Requests</h1>
          <p className="tab-sub">Review and action user access requests</p>
        </div>
        <div className="filter-tabs">
          {['pending','approved','denied','all'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {loading ? <TabLoader /> : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No {filter} requests</p>
        </div>
      ) : (
        <div className="request-list">
          {requests.map(r => (
            <div key={r.id} className="request-card">
              <div className="request-card-top">
                <div className="request-user-info">
                  <div className="request-name">{r.displayName || 'Unknown User'}</div>
                  <div className="request-email">{r.email}</div>
                </div>
                <div className="request-meta">
                  <span className={`badge ${r.status === 'pending' ? 'badge-pending' : r.status === 'approved' ? 'badge-approved' : 'badge-banned'}`}>
                    {r.status}
                  </span>
                  <span className="request-time">{timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <div className="request-purpose">{purposeLabel[r.purpose] || r.purpose}</div>
              {r.reason && <div className="request-reason">"{r.reason}"</div>}
              {r.reviewNote && <div className="request-review-note">Admin note: {r.reviewNote}</div>}
              {r.status === 'pending' && (
                <div className="request-actions">
                  <button className="btn-approve" onClick={() => setAction({ type: 'approve', request: r })}>
                    ✅ Approve
                  </button>
                  <button className="btn-deny" onClick={() => { setDenyReason(''); setAction({ type: 'deny', request: r }); }}>
                    ❌ Deny
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Approve confirm */}
      <ConfirmModal
        isOpen={actionModal?.type === 'approve'}
        title="Approve Access Request"
        message={`Approve ${actionModal?.request?.displayName || actionModal?.request?.email}? They'll receive an email and get full access immediately.`}
        confirmLabel={working ? 'Approving…' : 'Yes, Approve'}
        onConfirm={handleApprove}
        onCancel={() => setAction(null)}
      />

      {/* Deny confirm */}
      <ConfirmModal
        isOpen={actionModal?.type === 'deny'}
        title="Deny Access Request"
        message={`Deny ${actionModal?.request?.displayName || actionModal?.request?.email}?`}
        confirmLabel={working ? 'Denying…' : 'Deny Request'}
        danger
        onConfirm={handleDeny}
        onCancel={() => setAction(null)}
      >
        <textarea
          className="modal-textarea"
          placeholder="Optional reason to include in the email…"
          value={denyReason}
          onChange={e => setDenyReason(e.target.value)}
          rows={3}
        />
      </ConfirmModal>
    </div>
  );
}

// ─── USERS TAB ───────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('ALL');
  const [page, setPage]           = useState(1);
  const [toast, setToast]         = useState(null);
  const [actionModal, setAction]  = useState(null);
  const [selectedUser, setSelected] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [working, setWorking]     = useState(false);
  const searchRef                 = useRef(null);

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getAdminUsers({ status: statusFilter, search: search.trim(), page });
      setUsers(d.users || []);
      setTotal(d.total || 0);
    } catch { showToast('Failed to load users', false); }
    finally { setLoading(false); }
  }, [statusFilter, search, page, showToast]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);
  useEffect(() => { load(); }, [load]);

  const doAction = useCallback(async () => {
    if (!actionModal || !selectedUser) return;
    setWorking(true);
    try {
      const uid = selectedUser.uid;
      if (actionModal === 'approve') {
        await updateUserStatus(uid, { action: 'approve' });
        showToast('✅ User approved');
      } else if (actionModal === 'ban') {
        await updateUserStatus(uid, { action: 'ban', reason: modalInput });
        showToast('🚫 User banned');
      } else if (actionModal === 'unban') {
        await updateUserStatus(uid, { action: 'unban' });
        showToast('User unbanned');
      } else if (actionModal === 'suspend') {
        const days = parseInt(modalInput) || 7;
        await updateUserStatus(uid, { action: 'suspend', suspendDays: days, reason: '' });
        showToast(`⏸️ User suspended for ${days} days`);
      } else if (actionModal === 'unsuspend') {
        await updateUserStatus(uid, { action: 'unsuspend' });
        showToast('User unsuspended');
      } else if (actionModal === 'unlimited') {
        await updateUserQuota(uid, { isUnlimited: true });
        showToast('♾️ Unlimited access granted');
      } else if (actionModal === 'revoke-unlimited') {
        await updateUserQuota(uid, { isUnlimited: false });
        showToast('Unlimited access revoked');
      } else if (actionModal === 'set-limit') {
        const limit = parseInt(modalInput);
        if (!limit || limit < 1) { showToast('Enter a valid number', false); setWorking(false); return; }
        await updateUserQuota(uid, { dailyLimit: limit });
        showToast(`Daily limit set to ${limit}`);
      } else if (actionModal === 'reset-quota') {
        await resetUserDailyQuota(uid);
        showToast('Daily quota reset to 0');
      }
      setAction(null);
      setModalInput('');
      load();
    } catch { showToast('Action failed. Try again.', false); }
    finally { setWorking(false); }
  }, [actionModal, selectedUser, modalInput, load, showToast]);

  const openModal = (type, user) => { setAction(type); setSelected(user); setModalInput(''); };

  const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'SUSPENDED', 'BANNED'];

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Users <span className="tab-count">{total}</span></h1>
          <p className="tab-sub">Manage all registered users</p>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Filters */}
      <div className="users-toolbar">
        <input
          ref={searchRef}
          className="search-input"
          placeholder="🔍 Search by name, email, UID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {STATUS_FILTERS.map(f => (
            <button key={f} className={`filter-tab ${statusFilter === f ? 'active' : ''}`} onClick={() => setStatus(f)}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? <TabLoader /> : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <p>No users found</p>
        </div>
      ) : (
        <>
          <div className="user-table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Status</th>
                  <th>Daily Usage</th>
                  <th>Total Calls</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.uid}>
                    <td>
                      <div className="user-cell">
                        <div className="user-cell-name">{u.displayName || '—'}</div>
                        <div className="user-cell-email">{u.email || u.uid}</div>
                      </div>
                    </td>
                    <td><StatusBadge status={u.status} isUnlimited={u.isUnlimited} /></td>
                    <td>
                      <span className="quota-cell">
                        {u.isUnlimited
                          ? '♾️'
                          : `${u.dailyCallsUsed ?? 0} / ${u.dailyLimit ?? 20}`}
                      </span>
                    </td>
                    <td><span className="total-calls">{(u.totalAiCalls || 0).toLocaleString()}</span></td>
                    <td><span className="joined-cell">{timeAgo(u.createdAt)}</span></td>
                    <td>
                      <div className="action-menu">
                        {u.status === 'PENDING'   && <button className="action-btn action-approve" onClick={() => openModal('approve', u)}>✅ Approve</button>}
                        {u.status === 'APPROVED'  && <button className="action-btn action-suspend" onClick={() => openModal('suspend', u)}>⏸ Suspend</button>}
                        {u.status === 'SUSPENDED' && <button className="action-btn action-approve" onClick={() => openModal('unsuspend', u)}>▶ Lift</button>}
                        {u.status !== 'BANNED'    && <button className="action-btn action-ban"     onClick={() => openModal('ban', u)}>🚫 Ban</button>}
                        {u.status === 'BANNED'    && <button className="action-btn action-approve" onClick={() => openModal('unban', u)}>↩ Unban</button>}
                        {!u.isUnlimited && <button className="action-btn action-unlimited" onClick={() => openModal('unlimited', u)}>♾️ Unlimited</button>}
                        {u.isUnlimited  && <button className="action-btn action-suspend"   onClick={() => openModal('revoke-unlimited', u)}>⬇ Revoke ∞</button>}
                        <button className="action-btn action-quota" onClick={() => openModal('set-limit', u)}>✏️ Set Limit</button>
                        <button className="action-btn action-reset" onClick={() => openModal('reset-quota', u)}>↺ Reset Quota</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p-1)}>← Prev</button>
              <span className="page-info">Page {page} · {total} users</span>
              <button className="page-btn" disabled={page * 20 >= total} onClick={() => setPage(p => p+1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Action modals */}
      <ConfirmModal
        isOpen={actionModal === 'approve'}
        title="Approve User"
        message={`Approve ${selectedUser?.displayName || selectedUser?.email}? They'll get full access immediately.`}
        confirmLabel={working ? 'Approving…' : 'Approve'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'unban'}
        title="Unban User"
        message={`Remove the ban on ${selectedUser?.displayName || selectedUser?.email}? Their status will return to PENDING.`}
        confirmLabel={working ? 'Unbanning…' : 'Unban'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'unsuspend'}
        title="Lift Suspension"
        message={`Lift the suspension on ${selectedUser?.displayName || selectedUser?.email}? They'll be restored to APPROVED.`}
        confirmLabel={working ? 'Lifting…' : 'Lift Suspension'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'unlimited'}
        title="Grant Unlimited Access"
        message={`Give ${selectedUser?.displayName || selectedUser?.email} unlimited daily AI calls (no quota)?`}
        confirmLabel={working ? 'Granting…' : '♾️ Grant Unlimited'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'revoke-unlimited'}
        title="Revoke Unlimited Access"
        message={`Revoke unlimited access from ${selectedUser?.displayName || selectedUser?.email}? They'll go back to their daily limit.`}
        confirmLabel={working ? 'Revoking…' : 'Revoke'}
        danger
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'reset-quota'}
        title="Reset Daily Quota"
        message={`Reset ${selectedUser?.displayName || selectedUser?.email}'s daily call counter to 0?`}
        confirmLabel={working ? 'Resetting…' : 'Reset Quota'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'ban'}
        title="Ban User"
        message={`Permanently ban ${selectedUser?.displayName || selectedUser?.email}? They will not be able to use the platform.`}
        confirmLabel={working ? 'Banning…' : '🚫 Ban Permanently'}
        danger
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      >
        <input
          className="modal-input"
          placeholder="Reason for ban (shown to user)…"
          value={modalInput}
          onChange={e => setModalInput(e.target.value)}
        />
      </ConfirmModal>
      <ConfirmModal
        isOpen={actionModal === 'suspend'}
        title="Suspend User"
        message={`Suspend ${selectedUser?.displayName || selectedUser?.email}. Enter duration in days.`}
        confirmLabel={working ? 'Suspending…' : '⏸ Suspend'}
        danger
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      >
        <input
          className="modal-input"
          type="number"
          placeholder="Days to suspend (e.g. 7)"
          value={modalInput}
          onChange={e => setModalInput(e.target.value)}
          min={1}
          max={365}
        />
      </ConfirmModal>
      <ConfirmModal
        isOpen={actionModal === 'set-limit'}
        title="Set Daily Limit"
        message={`Set a custom daily AI call limit for ${selectedUser?.displayName || selectedUser?.email}.`}
        confirmLabel={working ? 'Saving…' : 'Set Limit'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      >
        <input
          className="modal-input"
          type="number"
          placeholder="Daily limit (e.g. 50, 100, 500)"
          value={modalInput}
          onChange={e => setModalInput(e.target.value)}
          min={1}
          max={10000}
        />
      </ConfirmModal>
    </div>
  );
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────
function SettingsTab() {
  const [settings, setSettings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [form, setForm]           = useState({});

  const showToast = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    getAdminSettings()
      .then(s => { setSettings(s); setForm(s); })
      .catch(() => showToast('Failed to load settings', false))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAdminSettings(form);
      setSettings(form);
      showToast('✅ Settings saved successfully');
    } catch { showToast('Failed to save settings', false); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  if (loading) return <TabLoader />;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Platform Settings</h1>
          <p className="tab-sub">Control platform-wide behaviour and limits</p>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div className="settings-grid">
        {/* Access control */}
        <div className="settings-card">
          <h3 className="settings-card-title">🔐 Access Control</h3>

          <div className="settings-row">
            <div>
              <div className="settings-label">Allow New Sign-ups</div>
              <div className="settings-desc">If off, new users cannot create accounts</div>
            </div>
            <Toggle value={form.allowNewSignups ?? true} onChange={v => set('allowNewSignups', v)} />
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Maintenance Mode</div>
              <div className="settings-desc">Block all non-admin access to the platform</div>
            </div>
            <Toggle value={form.maintenanceMode ?? false} onChange={v => set('maintenanceMode', v)} danger />
          </div>
        </div>

        {/* Quotas */}
        <div className="settings-card">
          <h3 className="settings-card-title">📊 Default Quotas</h3>

          <div className="settings-row">
            <div>
              <div className="settings-label">Free Trial Sessions</div>
              <div className="settings-desc">AI calls for new (PENDING) users before they must request access</div>
            </div>
            <input
              className="settings-number-input"
              type="number"
              min={1} max={20}
              value={form.freeTrialLimit ?? 3}
              onChange={e => set('freeTrialLimit', parseInt(e.target.value))}
            />
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Default Daily Limit</div>
              <div className="settings-desc">AI calls per day for newly approved users (can be overridden per user)</div>
            </div>
            <input
              className="settings-number-input"
              type="number"
              min={1} max={500}
              value={form.defaultDailyLimit ?? 20}
              onChange={e => set('defaultDailyLimit', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      <button className="btn-save" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : '💾 Save Settings'}
      </button>
    </div>
  );
}

// ─── Reusable small components ────────────────────────────────────────────────
function Toggle({ value, onChange, danger = false }) {
  return (
    <button
      className={`toggle ${value ? 'toggle--on' : ''} ${danger && value ? 'toggle--danger' : ''}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span className="toggle-knob" />
    </button>
  );
}

function TabLoader() {
  return (
    <div className="tab-loader">
      <div className="spinner-ring" />
    </div>
  );
}

function Toast({ msg, ok }) {
  return (
    <div className={`toast ${ok ? 'toast--ok' : 'toast--err'}`}>
      {msg}
    </div>
  );
}
