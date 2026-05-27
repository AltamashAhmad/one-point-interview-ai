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
 * @param {Array<{role: string, content: string}>} messages - Full conversation history
 * @param {string} interviewType - 'dsa' | 'systemDesign' | 'lld'
 * @returns {Promise<{role: string, content: string}>}
 */
export async function sendMessage(messages, interviewType) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/chat`,
    { messages, interviewType },
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
 * Check if the backend is reachable.
 */
export async function healthCheck() {
  const { data } = await axios.get(`${API_BASE}/api/health`);
  return data;
}
