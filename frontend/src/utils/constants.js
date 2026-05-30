/**
 * Shared constants and utilities used across multiple pages.
 * Extracted to avoid duplication between Interview.js, Landing.js, History.js, HistoryDetail.js.
 */

import { AVAILABLE_MODELS } from '../components/ModelSelector';
// ── Interview Type Configuration ──────────────────────────────────────────────
export const TYPE_CONFIG = {
  dsa: {
    id: 'dsa',
    label: 'DSA',
    fullName: 'Data Structures & Algorithms',
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.15)',
    emoji: '🧩',
  },
  systemDesign: {
    id: 'systemDesign',
    label: 'System Design',
    fullName: 'Scalable System Architecture',
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.15)',
    emoji: '🏗️',
    featured: true,
  },
  lld: {
    id: 'lld',
    label: 'LLD',
    fullName: 'Low-Level / OOP Design',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.15)',
    emoji: '🔧',
  },
  managerial: {
    id: 'managerial',
    label: 'Managerial',
    fullName: 'Behavioral & Leadership',
    color: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.15)',
    emoji: '👔',
  },
  tutorDsa: {
    id: 'tutorDsa',
    label: 'DSA Tutor',
    fullName: 'Learn Algorithms & Data Structures',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
    emoji: '🎓',
    isTutor: true,
    baseType: 'dsa',
  },
  tutorLld: {
    id: 'tutorLld',
    label: 'LLD Tutor',
    fullName: 'Learn Object-Oriented Design',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
    emoji: '🎓',
    isTutor: true,
    baseType: 'lld',
  },
  tutorSystemDesign: {
    id: 'tutorSystemDesign',
    label: 'System Design Tutor',
    fullName: 'Learn Scalable Architecture',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.15)',
    emoji: '🎓',
    isTutor: true,
    baseType: 'systemDesign',
  },
};

// ── Date Formatting ───────────────────────────────────────────────────────────
/**
 * Format a Firestore Timestamp or JS date into a readable string.
 * Handles Firestore's { _seconds, _nanoseconds } shape and raw ISO strings.
 *
 * @param {Object|string|number|null} timestamp
 * @param {Object} [options] - Intl.DateTimeFormat options override
 * @returns {string} formatted date or 'Unknown date'
 */
export function formatDate(timestamp, options = {}) {
  if (!timestamp) return 'Unknown date';
  const date = new Date(
    timestamp._seconds ? timestamp._seconds * 1000 : timestamp
  );
  if (isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

// ── Model Helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a raw model ID into a user-friendly display name.
 * @param {string} modelId
 * @returns {string}
 */
export function friendlyModelName(modelId) {
  if (!modelId) return 'Unknown model';
  const found = AVAILABLE_MODELS.find(m => m.id === modelId);
  return found ? found.name : modelId;
}

/**
 * Get the accent color for a model's provider (Gemini = purple, Groq = orange).
 * @param {string} modelId
 * @returns {string} CSS color
 */
export function modelProviderColor(modelId) {
  const found = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!found) return '#64748b';
  return found.provider === 'groq' ? '#f97316' : '#8b5cf6';
}
