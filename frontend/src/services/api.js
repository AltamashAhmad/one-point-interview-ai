import axios from 'axios';
import { auth, appCheck } from './firebase';
import { getToken } from 'firebase/app-check';

const API_BASE = import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

// Use a dedicated axios instance with no timeout so massive LLM generations
// never abort prematurely.
const apiClient = axios.create({
  baseURL: API_BASE,
});

/**
 * Get the current user's Firebase ID token for auth headers.
 */
async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get the Firebase App Check token for the X-Firebase-AppCheck header.
 * This proves the request is coming from our real React app.
 * Falls back gracefully if App Check is not configured (local dev without debug mode).
 */
async function getAppCheckHeader() {
  if (!appCheck) return {};
  try {
    const { token } = await getToken(appCheck, /* forceRefresh */ false);
    return { 'X-Firebase-AppCheck': token };
  } catch (err) {
    // Non-fatal in dev — backend uses SKIP_APP_CHECK=true locally
    console.warn('[AppCheck] Could not get token:', err.message);
    return {};
  }
}

/**
 * Get both auth and App Check headers merged together.
 */
async function getHeaders() {
  const [authHeader, appCheckHeader] = await Promise.all([
    getAuthHeader(),
    getAppCheckHeader(),
  ]);
  return { ...authHeader, ...appCheckHeader };
}

/** Error shaped like an axios error so callers can keep reading err.response.data. */
function responseError(status, data) {
  const err = new Error(data?.error || `Request failed with status ${status}`);
  err.response = { status, data: data || {} };
  return err;
}

/**
 * Parses a text/event-stream body and calls onEvent(event, data) for each message.
 * Exported for tests.
 */
export async function readEventStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

/** POSTs JSON to an SSE endpoint; streams `token` events to onToken and resolves with the `done` payload. */
async function postEventStream(path, body, { onToken, signal } = {}) {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw responseError(response.status, data);
  }

  let result = null;
  let streamError = null;
  await readEventStream(response.body, (event, data) => {
    if (event === 'token') {
      onToken?.(data.text);
    } else if (event === 'done') {
      result = data;
    } else if (event === 'error') {
      streamError = responseError(data?.code === 'SESSION_CONFLICT' || data?.code === 'SESSION_ENDED' ? 409 : 502, data);
    }
  });

  if (streamError) throw streamError;
  if (!result) throw responseError(502, { error: 'The connection closed before the AI finished. Please try again.' });
  return result;
}

/**
 * Platform catalogue: enabled AI models with availability, defaults and interview types.
 */
export async function getMeta() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/meta', { headers });
  return data;
}

/**
 * Fetch the list of companies available in the DSA question bank (for autocomplete).
 */
export async function getCompanyList() {
  try {
    const headers = await getHeaders();
    const { data } = await apiClient.get('/api/questions/companies', { headers });
    return data.companies;
  } catch (err) {
    console.warn('Could not load company list:', err.message);
    return [];
  }
}

// ── Sessions (interviews, tutor lessons, sheet practice, loop rounds) ──────

/**
 * List the user's sessions, newest first (no transcripts).
 * @param {{ status?, interviewType?, mode?, question?, loopId? }} filters
 */
export async function listSessions(filters = {}) {
  const headers = await getHeaders();
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const { data } = await apiClient.get('/api/sessions', { headers, params });
  return data.sessions;
}

/**
 * Start a session. Counts against the daily quota.
 * @param {{ interviewType, config?: { company, difficulty, language, model, scorecardModel }, questionTitle?, source? }} payload
 */
export async function createSession(payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.post('/api/sessions', payload, { headers });
  return data.session;
}

/** Full session including transcript. */
export async function getSession(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.get(`/api/sessions/${id}`, { headers });
  return data.session;
}

/**
 * Send a message (or, with no content on a new session, request the opening message).
 * Reuse the same `turnId` when retrying so a reply that was saved before the connection dropped isn't duplicated.
 * The reply streams through onToken; resolves with { message, model, fellBack, messageCount, timerEndsAt }.
 */
export async function sendSessionTurn(id, { content, model, turnId } = {}, handlers = {}) {
  return postEventStream(`/api/sessions/${id}/turns`, { content, model, turnId }, handlers);
}

/** Submit code for review; resolves with the two messages appended to the transcript. */
export async function reviewSessionCode(id, code, language) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(`/api/sessions/${id}/code-review`, { code, language }, { headers });
  return data.messages;
}

/** End the session. Interviews come back with a scorecard. */
export async function endSession(id, scorecardModel) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(`/api/sessions/${id}/end`, { scorecardModel }, { headers });
  return data.session;
}

/** Generate (once) and return AI revision notes for a session. */
export async function generateSessionNotes(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(`/api/sessions/${id}/notes`, {}, { headers });
  return data.notes;
}

/** Update { isPinned?, notes?, code?, status?: 'archived' }. `code` is the editor content of an active session. */
export async function updateSession(id, patch) {
  const headers = await getHeaders();
  const { data } = await apiClient.patch(`/api/sessions/${id}`, patch, { headers });
  return data.session;
}

export async function deleteSession(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.delete(`/api/sessions/${id}`, { headers });
  return data;
}

// ── Interview Loops ──────────────────────────────────────────────

/**
 * Fetch all interview loops for the current user.
 */
export async function getLoops() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/loops', { headers });
  return data.loops;
}

/**
 * Fetch a single loop by ID.
 * @param {string} id
 */
export async function getLoop(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.get(`/api/loops/${id}`, { headers });
  return data.loop;
}

/**
 * Create a new loop.
 * @param {Object} payload - { company, level, rounds, status?, currentRoundIndex? }
 */
export async function createLoop(payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.post('/api/loops', payload, { headers });
  return data.loop;
}

/**
 * Delete a loop by ID.
 * @param {string} id
 */
export async function deleteLoop(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.delete(`/api/loops/${id}`, { headers });
  return data;
}

// ── Access Control ───────────────────────────────────────────────

/**
 * Fetch the current user's profile (status, role, quotas).
 * Called on login to populate AuthContext.userProfile.
 */
export async function getMyProfile() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/users/me', { headers });
  return data.profile;
}

/** Saves the signed-in user's theme ('dark' | 'light') on their profile. */
export async function updateMyPreferences(preferences) {
  const headers = await getHeaders();
  const { data } = await apiClient.patch('/api/users/me/preferences', preferences, { headers });
  return data;
}

// ── Study Tracker (DSA sheet, prep plan) ──────────────────────────────────

/**
 * Fetch all tracked items for a sheet.
 * @param {'dsa-master'|'prep-plan'} sheetId
 * @returns {Promise<Object<string, {done?, important?, note?, startDate?, log?}>>}
 */
export async function getTrackerItems(sheetId) {
  const headers = await getHeaders();
  const { data } = await apiClient.get(`/api/tracker/${sheetId}`, { headers });
  return data.items || {};
}

/**
 * Upsert one tracked item. patch: { done?, important?, note?, startDate?, log? }
 */
export async function updateTrackerItem(sheetId, itemKey, patch) {
  const headers = await getHeaders();
  const { data } = await apiClient.put(
    `/api/tracker/${sheetId}/items/${encodeURIComponent(itemKey)}`,
    patch,
    { headers }
  );
  return data;
}

export async function deleteTrackerItem(sheetId, itemKey) {
  const headers = await getHeaders();
  const { data } = await apiClient.delete(
    `/api/tracker/${sheetId}/items/${encodeURIComponent(itemKey)}`,
    { headers }
  );
  return data;
}

/**
 * Generate pseudocode-only study notes for one tracker item. Does not save anything.
 * @param {'dsa-master'|'prep-plan'} sheetId
 * @param {string} itemKey
 * @param {{itemType: 'question'|'section', title: string, difficulty?: string, sectionTitle?: string, language?: string}} context
 * @returns {Promise<string>} the generated notes (Markdown)
 */
export async function generateTrackerNote(sheetId, itemKey, context) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(
    `/api/tracker/${sheetId}/items/${encodeURIComponent(itemKey)}/notes/generate`,
    context,
    { headers }
  );
  return data.notes;
}

/**
 * Submit an access request for a PENDING user.
 * @param {{ purpose: string, reason: string }} payload
 */
export async function submitAccessRequest(payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.post('/api/access/request', payload, { headers });
  return data;
}

/**
 * Get the status of the current user's access request.
 * @returns {{ status: 'pending'|'approved'|'denied'|null, reason?: string }}
 */
export async function getAccessRequestStatus() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/access/status', { headers });
  return data;
}

// ── Admin Panel ──────────────────────────────────────────────────

/**
 * Fetch admin dashboard stats.
 */
export async function getAdminStats() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/admin/stats', { headers });
  return data;
}

/**
 * Fetch paginated user list. params: { status, search, page }
 */
export async function getAdminUsers(params = {}) {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/admin/users', { headers, params });
  return data;
}

/**
 * Fetch public platform settings (e.g. signups enabled).
 */
export async function getPublicPlatformStatus() {
  const { data } = await apiClient.get('/api/public/status');
  return data;
}

/**
 * Delete a user permanently.
 * @param {string} uid
 */
export async function deleteUserPermanent(uid) {
  const headers = await getHeaders();
  const { data } = await apiClient.delete(`/api/admin/users/${uid}`, { headers });
  return data;
}

/**
 * Update a user's status (approve / suspend / ban / unban).
 * @param {string} uid
 * @param {{ action: 'approve'|'suspend'|'ban'|'unban', suspendDays?: number, reason?: string }} payload
 */
export async function updateUserStatus(uid, payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.put(`/api/admin/users/${uid}/status`, payload, { headers });
  return data;
}

/**
 * Update a user's quota settings.
 * @param {string} uid
 * @param {{ dailyLimit?: number, isUnlimited?: boolean }} payload
 */
export async function updateUserQuota(uid, payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.put(`/api/admin/users/${uid}/quota`, payload, { headers });
  return data;
}

/**
 * Reset a user's daily call counter to 0.
 */
export async function resetUserDailyQuota(uid) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(`/api/admin/users/${uid}/reset-quota`, {}, { headers });
  return data;
}

/**
 * Fetch access requests. params: { status: 'pending'|'all' }
 */
export async function getAccessRequests(params = {}) {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/admin/requests', { headers, params });
  return data;
}

/**
 * Approve an access request.
 */
export async function approveAccessRequest(requestId) {
  const headers = await getHeaders();
  const { data } = await apiClient.put(`/api/admin/requests/${requestId}/approve`, {}, { headers });
  return data;
}

/**
 * Deny an access request.
 * @param {string} requestId
 * @param {{ reason?: string }} payload
 */
export async function denyAccessRequest(requestId, payload = {}) {
  const headers = await getHeaders();
  const { data } = await apiClient.put(`/api/admin/requests/${requestId}/deny`, payload, { headers });
  return data;
}

/**
 * Fetch platform settings.
 */
export async function getAdminSettings() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/admin/settings', { headers });
  return data.settings;
}

/**
 * Update platform settings.
 * @param {Object} payload - partial settings object
 */
export async function updateAdminSettings(payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.put('/api/admin/settings', payload, { headers });
  return data;
}

/**
 * Generate a system prompt (Admin only).
 * @param {object} payload - { interviewType, userName, config: { company, difficulty, language, questionSeed } }
 */
export async function generateAdminPrompt(payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.post('/api/prompts/generate', payload, { headers });
  return data;
}
