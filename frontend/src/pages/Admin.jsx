import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import PageHeader from '../components/PageHeader';
import { Badge, Button, Dialog, Icon, Table, Tabs, Toast } from '../components/ui';
import {
  getAdminStats,
  getAdminUsers,
  getAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  updateUserStatus,
  updateUserQuota,
  resetUserDailyQuota,
  deleteUserPermanent,
  getAdminSettings,
  updateAdminSettings,
} from '../services/api';
import './Admin.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '—';
  let d;
  if (ts?.toDate) {
    d = ts.toDate();
  } else if (ts?._seconds) {
    d = new Date(ts._seconds * 1000);
  } else if (ts?.seconds) {
    d = new Date(ts.seconds * 1000);
  } else {
    d = new Date(ts);
  }
  
  if (isNaN(d.getTime())) return '—';
  
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)   return `${Math.max(0, s)}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

const STATUS_BADGE = {
  APPROVED:  { tone: 'success', label: 'Approved' },
  PENDING:   { tone: 'warning', label: 'Pending' },
  BANNED:    { tone: 'danger',  label: 'Banned' },
  SUSPENDED: { tone: 'warning', label: 'Suspended' },
};

function StatusBadge({ status, isUnlimited }) {
  if (isUnlimited) return <Badge tone="info">Unlimited</Badge>;
  const { tone = 'neutral', label = status } = STATUS_BADGE[status] || {};
  return <Badge tone={tone}>{label}</Badge>;
}

// ─── Confirmation modal ──────────────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false, children }) {
  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      title={title}
      description={message}
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      )}
    >
      {children}
    </Dialog>
  );
}

// ─── Main Admin Component ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'requests', label: 'Requests' },
  { value: 'users', label: 'Users' },
  { value: 'settings', label: 'Settings' },
];

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = NAV_ITEMS.some((n) => n.value === searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';

  const setTab = useCallback(t => setSearchParams({ tab: t }), [setSearchParams]);

  return (
    <div className="page-shell admin-root">
      <PageHeader title="Admin" subtitle="Users, access requests and platform settings" />
      <Tabs items={NAV_ITEMS} value={tab} onChange={setTab} ariaLabel="Admin sections" className="admin-tabs" />
      {tab === 'dashboard' && <DashboardTab setTab={setTab} />}
      {tab === 'requests'  && <RequestsTab />}
      {tab === 'users'     && <UsersTab />}
      {tab === 'settings'  && <SettingsTab />}
    </div>
  );
}

// ─── DASHBOARD TAB ───────────────────────────────────────────────────────────
function DashboardTab({ setTab }) {
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
        <h2 className="tab-title">Dashboard</h2>
        <p className="tab-sub">Platform overview at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <StatCard icon="user" label="Total Users"     value={u.total     ?? 0} color="indigo" />
        <StatCard icon="clock" label="Pending"          value={u.pending   ?? 0} color="amber"  />
        <StatCard icon="check" label="Approved"         value={u.approved  ?? 0} color="green"  />
        <StatCard icon="x" label="Banned"           value={u.banned    ?? 0} color="red"    />
        <StatCard icon="alert" label="Suspended"        value={u.suspended ?? 0} color="orange" />
        <StatCard icon="sparkles" label="Unlimited Users"  value={u.unlimited ?? 0} color="purple" />
        <StatCard icon="shield" label="Pending Requests" value={stats?.pendingRequests ?? 0} color="blue" />
        <StatCard icon="message" label="Total AI Calls"   value={(stats?.totalAiCalls ?? 0).toLocaleString()} color="cyan" />
      </div>

      {/* Quick actions */}
      <div className="section-header"><h2>Quick Actions</h2></div>
      <div className="quick-actions">
        <QuickAction icon="shield" label="Review Requests" desc={`${stats?.pendingRequests ?? 0} awaiting review`} color="indigo" onClick={() => setTab('requests')} />
        <QuickAction icon="user" label="Manage Users"    desc={`${u.total ?? 0} registered users`}               color="green"  onClick={() => setTab('users')} />
        <QuickAction icon="lock" label="Platform Settings" desc="Configure limits & access"                      color="purple" onClick={() => setTab('settings')} />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-icon"><Icon name={icon} size={20} /></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function QuickAction({ icon, label, desc, color, onClick }) {
  return (
    <div
      className={`quick-action quick-action--${color}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
    >
      <div className="qa-icon"><Icon name={icon} size={22} /></div>
      <div>
        <div className="qa-label">{label}</div>
        <div className="qa-desc">{desc}</div>
      </div>
    </div>
  );
}

// ─── REQUESTS TAB ────────────────────────────────────────────────────────────
function listErrorText(err, fallback) {
  return err?.response?.data?.code === 'INDEX_REQUIRED' ? err.response.data.error : fallback;
}

const REQUEST_PAGE_SIZE = 20;

function RequestsTab() {
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('pending');
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
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
      const d = await getAccessRequests({ status: filter, page });
      setRequests(d.requests || []);
      setTotal(d.total || 0);
    } catch (err) { showToast(listErrorText(err, 'Failed to load requests'), false); }
    finally { setLoading(false); }
  }, [filter, page, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = useCallback(async () => {
    if (!actionModal) return;
    setWorking(true);
    try {
      await approveAccessRequest(actionModal.request.id);
      showToast('Request approved — user notified by email');
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

  const purposeLabel = { job_prep: 'Job prep', learning: 'Learning', academic: 'Academic', other: 'Other' };

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Access Requests</h2>
          <p className="tab-sub">Review and action user access requests</p>
        </div>
        <div className="filter-tabs">
          {['pending','approved','denied','all'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setPage(1); }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {loading ? <TabLoader /> : requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="shield" size={36} /></div>
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
                  <Badge tone={r.status === 'pending' ? 'warning' : r.status === 'approved' ? 'success' : 'danger'}>
                    {r.status}
                  </Badge>
                  <span className="request-time">{timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <div className="request-purpose">{purposeLabel[r.purpose] || r.purpose}</div>
              {r.reason && <div className="request-reason">"{r.reason}"</div>}
              {r.reviewNote && <div className="request-review-note">Admin note: {r.reviewNote}</div>}
              {r.status === 'pending' && (
                <div className="request-actions">
                  <Button size="sm" onClick={() => setAction({ type: 'approve', request: r })}>
                    Approve
                  </Button>
                  <Button variant="danger-outline" size="sm" onClick={() => { setDenyReason(''); setAction({ type: 'deny', request: r }); }}>
                    Deny
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && total > REQUEST_PAGE_SIZE && (
        <div className="pagination">
          <Button variant="outline" size="sm" icon="arrowLeft" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="page-info">Page {page} · {total} requests</span>
          <Button variant="outline" size="sm" iconRight="arrowRight" disabled={page * REQUEST_PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
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
          aria-label="Reason for denial"
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
  const { user }                  = useAuth();
  const [users, setUsers]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('ALL');
  const [page, setPage]           = useState(1);
  const [toast, setToast]         = useState(null);
  const [actionModal, setAction]  = useState(null);
  const [selectedUser, setSelected] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [modalInput2, setModalInput2] = useState('');
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
      setTruncated(Boolean(d.truncated));
    } catch (err) { showToast(listErrorText(err, 'Failed to load users'), false); }
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
        showToast('User approved');
      } else if (actionModal === 'ban') {
        await updateUserStatus(uid, { action: 'ban', reason: modalInput });
        showToast('User banned');
      } else if (actionModal === 'unban') {
        await updateUserStatus(uid, { action: 'unban' });
        showToast('User unbanned');
      } else if (actionModal === 'promote') {
        await updateUserStatus(uid, { action: 'promote' });
        showToast('Promoted to Admin');
      } else if (actionModal === 'demote') {
        await updateUserStatus(uid, { action: 'demote' });
        showToast('Demoted from Admin');
      } else if (actionModal === 'suspend') {
        const days = parseInt(modalInput) || 7;
        await updateUserStatus(uid, { action: 'suspend', suspendDays: days, reason: modalInput2 });
        showToast(`User suspended for ${days} days`);
      } else if (actionModal === 'unsuspend') {
        await updateUserStatus(uid, { action: 'unsuspend' });
        showToast('User unsuspended');
      } else if (actionModal === 'unlimited') {
        await updateUserQuota(uid, { isUnlimited: true });
        showToast('Unlimited access granted');
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
      } else if (actionModal === 'delete') {
        await deleteUserPermanent(uid);
        showToast('User deleted permanently');
      }
      setAction(null);
      setModalInput('');
      setModalInput2('');
      load();
    } catch { showToast('Action failed. Try again.', false); }
    finally { setWorking(false); }
  }, [actionModal, selectedUser, modalInput, modalInput2, load, showToast]);

  const openModal = (type, user) => { setAction(type); setSelected(user); setModalInput(''); setModalInput2(''); };

  const STATUS_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'SUSPENDED', 'BANNED'];

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Users <span className="tab-count">{total}</span></h2>
          <p className="tab-sub">Manage all registered users</p>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Filters */}
      <div className="users-toolbar">
        <input
          ref={searchRef}
          className="search-input"
          placeholder="Search by name, email, UID…"
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

      {truncated && <p className="tab-sub">Showing the first matches. Narrow the search to see the rest.</p>}

      {loading ? <TabLoader /> : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Icon name="user" size={36} /></div>
          <p>No users found</p>
        </div>
      ) : (
        <>
          <Table ariaLabel="Users">
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
                          ? 'Unlimited'
                          : `${u.dailyCallsUsed ?? 0} / ${u.dailyLimit ?? 20}`}
                      </span>
                    </td>
                    <td><span className="total-calls">{(u.totalAiCalls || 0).toLocaleString()}</span></td>
                    <td><span className="joined-cell">{timeAgo(u.createdAt)}</span></td>
                    <td>
                      {u.isSuperAdmin ? (
                        <div className="supreme-leader-badge">
                          <span className="supreme-leader-icon" aria-hidden="true"><Icon name="shield" size={14} /></span> Supreme Leader
                        </div>
                      ) : (
                        <div className="action-menu">
                          {u.role !== 'admin' && <Button variant="secondary" size="xs" onClick={() => openModal('promote', u)}>Promote admin</Button>}
                          {u.role === 'admin' && u.uid !== user?.uid && <Button variant="outline" size="xs" onClick={() => openModal('demote', u)}>Demote admin</Button>}
                          {u.status === 'PENDING' && <Button variant="secondary" size="xs" onClick={() => openModal('approve', u)}>Approve</Button>}
                          {u.status === 'APPROVED' && <Button variant="outline" size="xs" onClick={() => openModal('suspend', u)}>Suspend</Button>}
                          {u.status === 'SUSPENDED' && <Button variant="secondary" size="xs" onClick={() => openModal('unsuspend', u)}>Lift suspension</Button>}
                          {u.status !== 'BANNED' && <Button variant="danger-outline" size="xs" onClick={() => openModal('ban', u)}>Ban</Button>}
                          {u.status === 'BANNED' && <Button variant="secondary" size="xs" onClick={() => openModal('unban', u)}>Unban</Button>}
                          {!u.isUnlimited && <Button variant="outline" size="xs" onClick={() => openModal('unlimited', u)}>Unlimited</Button>}
                          {u.isUnlimited && <Button variant="outline" size="xs" onClick={() => openModal('revoke-unlimited', u)}>Revoke unlimited</Button>}
                          <Button variant="outline" size="xs" onClick={() => openModal('set-limit', u)}>Set limit</Button>
                          <Button variant="outline" size="xs" onClick={() => openModal('reset-quota', u)}>Reset quota</Button>
                          {u.uid !== user?.uid && <Button variant="danger-outline" size="xs" onClick={() => openModal('delete', u)}>Delete</Button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

          {/* Pagination */}
          {total > 20 && (
            <div className="pagination">
              <Button variant="outline" size="sm" icon="arrowLeft" disabled={page === 1} onClick={() => setPage(p => p-1)}>Prev</Button>
              <span className="page-info">Page {page} · {total} users</span>
              <Button variant="outline" size="sm" iconRight="arrowRight" disabled={page * 20 >= total} onClick={() => setPage(p => p+1)}>Next</Button>
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
        isOpen={actionModal === 'promote'}
        title="Promote to Admin"
        message={`Give full administrator privileges to ${selectedUser?.displayName || selectedUser?.email}? They will get VIP AI keys and rate limit bypass.`}
        confirmLabel={working ? 'Promoting…' : 'Promote to Admin'}
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
      <ConfirmModal
        isOpen={actionModal === 'demote'}
        title="Demote from Admin"
        message={`Remove administrator privileges from ${selectedUser?.displayName || selectedUser?.email}?`}
        confirmLabel={working ? 'Demoting…' : 'Demote Admin'}
        danger
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
        confirmLabel={working ? 'Granting…' : 'Grant Unlimited'}
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
        confirmLabel={working ? 'Banning…' : 'Ban Permanently'}
        danger
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      >
        <input
          className="modal-input"
          aria-label="Reason for ban"
          placeholder="Reason for ban (shown to user)…"
          value={modalInput}
          onChange={e => setModalInput(e.target.value)}
        />
      </ConfirmModal>
      <ConfirmModal
        isOpen={actionModal === 'suspend'}
        title="Suspend User"
        message={`Suspend ${selectedUser?.displayName || selectedUser?.email}.`}
        confirmLabel={working ? 'Suspending…' : '⏸ Suspend'}
        danger
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      >
        <input
          className="modal-input"
          aria-label="Days to suspend"
          type="number"
          placeholder="Days to suspend (e.g. 7)"
          value={modalInput}
          onChange={e => setModalInput(e.target.value)}
          min={1}
          max={365}
        />
        <input
          className="modal-input"
          aria-label="Reason for suspension"
          placeholder="Reason for suspension (optional)…"
          value={modalInput2}
          onChange={e => setModalInput2(e.target.value)}
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
          aria-label="New daily limit"
          type="number"
          placeholder="New daily limit (e.g. 50)"
          value={modalInput}
          onChange={e => setModalInput(e.target.value)}
          min={1}
        />
      </ConfirmModal>
      <ConfirmModal
        isOpen={actionModal === 'delete'}
        title="Delete User Permanently"
        message={`Are you absolutely sure you want to delete ${selectedUser?.displayName || selectedUser?.email}? This will erase all their history and CANNOT be undone.`}
        confirmLabel={working ? 'Deleting…' : 'Delete Permanently'}
        danger
        onConfirm={doAction}
        onCancel={() => setAction(null)}
      />
    </div>
  );
}

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────
function SettingsTab() {
  const [, setSettings]        = useState(null);
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
      showToast('Settings saved successfully');
    } catch { showToast('Failed to save settings', false); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  if (loading) return <TabLoader />;

  return (
    <div className="tab-content">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Platform Settings</h2>
          <p className="tab-sub">Control platform-wide behaviour and limits</p>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <div className="settings-grid">
        {/* Access control */}
        <div className="settings-card">
          <h3 className="settings-card-title">Access Control</h3>

          <div className="settings-row">
            <div>
              <div className="settings-label">Allow New Sign-ups</div>
              <div className="settings-desc">If off, new users cannot create accounts</div>
            </div>
            <Toggle label="Allow new sign-ups" value={form.allowNewSignups ?? true} onChange={v => set('allowNewSignups', v)} />
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Maintenance Mode</div>
              <div className="settings-desc">Block all non-admin access to the platform</div>
            </div>
            <Toggle label="Maintenance mode" value={form.maintenanceMode ?? false} onChange={v => set('maintenanceMode', v)} danger />
          </div>
        </div>

        {/* Quotas */}
        <div className="settings-card">
          <h3 className="settings-card-title">Default Quotas</h3>

          <div className="settings-row">
            <div>
              <div className="settings-label">Free Trial Sessions</div>
              <div className="settings-desc">Sessions new (PENDING) users can start before they must request access</div>
            </div>
            <input
              className="settings-number-input"
              aria-label="Free trial sessions"
              type="number"
              min={1} max={20}
              value={form.freeTrialLimit ?? 3}
              onChange={e => set('freeTrialLimit', parseInt(e.target.value))}
            />
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Default Daily Limit</div>
              <div className="settings-desc">Sessions per day for newly approved users (each session includes its whole conversation; can be overridden per user)</div>
            </div>
            <input
              className="settings-number-input"
              aria-label="Default daily limit"
              type="number"
              min={1} max={500}
              value={form.defaultDailyLimit ?? 20}
              onChange={e => set('defaultDailyLimit', parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      <Button size="lg" loading={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  );
}

// ─── Reusable small components ────────────────────────────────────────────────
function Toggle({ value, onChange, label, danger = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={value}
      className={`toggle ${value ? 'toggle--on' : ''} ${danger && value ? 'toggle--danger' : ''}`}
      onClick={() => onChange(!value)}
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


