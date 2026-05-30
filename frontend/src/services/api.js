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
<<<<<<< HEAD
 */
export async function sendMessage(messages, interviewType, userName = 'there', model) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/chat`,
    { messages, interviewType, userName, model },
    { headers }
=======
 * @param {Object} config - { company, difficulty, language }
 */
export async function sendMessage(messages, interviewType, userName = 'there', model, config = {}, signal) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/chat`,
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
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
  );
  return data;
}

/**
 * Request the AI to generate a runnable test template for the given problem.
 */
export async function generateTestTemplate(problemTitle, language, model) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/evaluate/generate-template`,
    { problemTitle, language, model },
    { headers }
  );
  return data.template;
}

/**
 * Fetch the list of companies available in the DSA question bank (for autocomplete).
 */
export async function getCompanyList() {
  try {
    const headers = await getAuthHeader();
    const { data } = await axios.get(`${API_BASE}/api/questions/companies`, { headers });
    return data.companies;
  } catch (err) {
    // Silently return empty list on auth errors so setup screen still works
    console.warn('Could not load company list:', err.message);
    return [];
  }
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
<<<<<<< HEAD
 * @param {Array} messages
 */
export async function saveSession(sessionId, interviewType, modelUsed, messages) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/history`,
    { sessionId, interviewType, modelUsed, messages },
=======
 * @param {Array}  messages
 * @param {Object} [meta] - { company, difficulty, language, questionTitle, questionLink }
 */
export async function saveSession(sessionId, interviewType, modelUsed, messages, meta = {}) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(
    `${API_BASE}/api/history`,
    { sessionId, interviewType, modelUsed, messages, ...meta },
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
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
<<<<<<< HEAD
=======
 * Generate and fetch the scorecard for an interview session.
 */
export async function generateScorecard(sessionId, model) {
  const headers = await getAuthHeader();
  const { data } = await axios.post(`${API_BASE}/api/history/${sessionId}/scorecard`, { model }, { headers });
  return data.scorecard;
}

/**
>>>>>>> 4d0bcd1 (Feat: Complete Company Loop UI and prepare for AWS EC2 Deployment)
 * Check if the backend is reachable.
 */
export async function healthCheck() {
  const { data } = await axios.get(`${API_BASE}/api/health`);
  return data;
}
