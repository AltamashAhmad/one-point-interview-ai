import axios from 'axios';
import { auth } from './firebase';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

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
 * Send a message to the AI interviewer and get a response.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} interviewType - 'dsa' | 'systemDesign' | 'lld'
 * @param {string} userName - Candidate's first name
 * @param {string} model - Gemini model ID to use
 */
export async function sendMessage(messages, interviewType, userName = 'there', model) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/chat`,
    { messages, interviewType, userName, model },
    { headers }
  );
  return data;
}

/**
 * Fetch available interview types from the backend.
 */
export async function getInterviewTypes() {
  const { data } = await axios.get(`${API_BASE}/api/chat/types`);
  return data;
}

/**
 * Fetch all past interview sessions for the current user.
 */
export async function getHistory() {
  const headers = await getAuthHeader();
  const { data } = await axios.get(`${API_BASE}/api/history`, { headers });
  return data.interviews;
}

/**
 * Fetch a specific interview session by ID.
 * @param {string} id
 */
export async function getHistoryById(id) {
  const headers = await getAuthHeader();
  const { data } = await axios.get(`${API_BASE}/api/history/${id}`, { headers });
  return data.interview;
}

/**
 * Create or update an interview session.
 * @param {string} sessionId
 * @param {string} interviewType
 * @param {string} modelUsed
 * @param {Array} messages
 */
export async function saveSession(sessionId, interviewType, modelUsed, messages) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/history`,
    { sessionId, interviewType, modelUsed, messages },
    { headers }
  );
  return data;
}

/**
 * Delete a specific interview session by ID.
 * @param {string} id
 */
export async function deleteSession(id) {
  const headers = await getAuthHeader();
  const { data } = await axios.delete(`${API_BASE}/api/history/${id}`, { headers });
  return data;
}

/**
 * Check if the backend is reachable.
 */
export async function healthCheck() {
  const { data } = await axios.get(`${API_BASE}/api/health`);
  return data;
}
