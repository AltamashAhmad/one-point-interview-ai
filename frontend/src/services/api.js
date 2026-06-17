import axios from 'axios';
import { auth, appCheck } from './firebase';
import { getToken } from 'firebase/app-check';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

// Use a dedicated axios instance with a default timeout of 10s to all requests so the app never hangs indefinitely
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
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

/**
 * Send a message to the AI interviewer and get a response.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} interviewType - 'dsa' | 'systemDesign' | 'lld'
 * @param {string} userName - Candidate's first name
 * @param {string} model - Gemini model ID to use
 * @param {Object} config - { company, difficulty, language }
 */
export async function sendMessage(messages, interviewType, userName = 'there', model, config = {}, signal) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(
    '/api/chat',
    {
      messages,
      interviewType,
      userName,
      model,
      company:    config.company    || '',
      difficulty: config.difficulty || 'ANY',
      language:   config.language   || 'any language',
    },
    { headers, ...(signal && { signal }) }
  );
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

/**
 * Fetch available interview types from the backend.
 */
export async function getInterviewTypes() {
  const { data } = await apiClient.get('/api/chat/types');
  return data;
}

/**
 * Fetch all past interview sessions for the current user.
 */
export async function getHistory() {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/history', { headers });
  return data.interviews;
}

/**
 * Fetch a specific interview session by ID.
 * @param {string} id
 */
export async function getHistoryById(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.get(`/api/history/${id}`, { headers });
  return data.interview;
}

/**
 * Create or update an interview session.
 * @param {string} sessionId
 * @param {string} interviewType
 * @param {string} modelUsed
 * @param {Array}  messages
 * @param {Object} [meta] - { company, difficulty, language, questionTitle, questionLink }
 */
export async function saveSession(sessionId, interviewType, modelUsed, messages, meta = {}) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(
    '/api/history',
    { sessionId, interviewType, modelUsed, messages, ...meta },
    { headers }
  );
  return data;
}

/**
 * Delete a specific interview session by ID.
 * @param {string} id
 */
export async function deleteSession(id) {
  const headers = await getHeaders();
  const { data } = await apiClient.delete(`/api/history/${id}`, { headers });
  return data;
}

/**
 * Generate and fetch the scorecard for an interview session.
 */
export async function generateScorecard(sessionId, model) {
  const headers = await getHeaders();
  const { data } = await apiClient.post(`/api/history/${sessionId}/scorecard`, { model }, { headers });
  return data.scorecard;
}

/**
 * Check if the backend is reachable.
 */
export async function healthCheck() {
  const { data } = await apiClient.get('/api/health');
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
 * Update a single round of a loop and apply progression on the server.
 * @param {string} loopId
 * @param {Object} payload - { roundIndex, status?, score?, sessionId? }
 */
export async function updateLoopRound(loopId, payload) {
  const headers = await getHeaders();
  const { data } = await apiClient.put(`/api/loops/${loopId}/round`, payload, { headers });
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
 * Fetch a single user's full profile.
 */
export async function getAdminUser(uid) {
  const headers = await getHeaders();
  const { data } = await apiClient.get(`/api/admin/users/${uid}`, { headers });
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
 * Fetch usage analytics. params: { days: 7|14|30 }
 */
export async function getAdminUsage(params = { days: 30 }) {
  const headers = await getHeaders();
  const { data } = await apiClient.get('/api/admin/usage', { headers, params });
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
