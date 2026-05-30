/**
 * questionBank.js
 *
 * Loads all pre-built question bank JSON files into memory on server start.
 * Provides fast, synchronous question selection for the chat route.
 */

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Load all data into memory once at startup
const DSA_BANK     = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'dsa.json'), 'utf8'));
const LLD_BANK     = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lld.json'), 'utf8'));
const SD_BANK      = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'system-design.json'), 'utf8'));
const COMPANY_LIST = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'companies.json'), 'utf8'));

console.log(`📚 Question bank loaded: ${Object.keys(DSA_BANK).length} DSA companies, ${LLD_BANK.length} LLD, ${SD_BANK.length} SD problems`);

/**
 * Normalize a company name typed by the user into a slug key.
 * Handles common aliases (meta→facebook, etc.)
 */
const ALIASES = {
  'meta':       'facebook',
  'facebook':   'facebook',
  'alphabet':   'google',
  'aws':        'amazon',
  'msft':       'microsoft',
  'ms':         'microsoft',
};

function normalizeCompany(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  const alias = ALIASES[lower];
  if (alias) return alias;
  // Convert to slug: lowercase, replace non-alphanumeric with dash
  return lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Pick a random element from an array.
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a DSA question.
 *
 * @param {string} [company]    - Company name typed by user (optional)
 * @param {string} [difficulty] - 'EASY' | 'MEDIUM' | 'HARD' | 'ANY'
 * @param {string[]} [practiced]- Array of question titles to exclude
 * @returns {{ question: Object, companyName: string|null, source: string }}
 */
function getDSAQuestion(company, difficulty = 'ANY', practiced = []) {
  const slug = normalizeCompany(company);
  let pool = null;
  let resolvedCompany = null;

  if (slug && DSA_BANK[slug]) {
    pool = DSA_BANK[slug].questions;
    resolvedCompany = DSA_BANK[slug].displayName;
  } else if (slug) {
    // Fuzzy match: find company whose slug contains the user's input
    const fuzzyKey = Object.keys(DSA_BANK).find(k => k.includes(slug) || slug.includes(k));
    if (fuzzyKey) {
      pool = DSA_BANK[fuzzyKey].questions;
      resolvedCompany = DSA_BANK[fuzzyKey].displayName;
    }
  }

  // Fallback: aggregate from all companies (general pool)
  if (!pool || pool.length === 0) {
    pool = Object.values(DSA_BANK).flatMap(c => c.questions.slice(0, 20)); // top 20 per company
    resolvedCompany = null;
  }

  // Filter by difficulty
  const diff = (difficulty || 'ANY').toUpperCase();
  let filtered = diff !== 'ANY' ? pool.filter(q => q.difficulty === diff) : pool;

  // If difficulty filter leaves nothing, fall back to full pool
  if (filtered.length === 0) filtered = pool;

  // Filter out practiced questions
  let unpracticed = filtered.filter(q => !practiced.includes(q.title));
  // If user has practiced all questions in this pool, ignore the exclusion list to prevent crashing
  if (unpracticed.length === 0) unpracticed = filtered;

  // Prefer "recent" questions (last 30 days) when available
  const recent = unpracticed.filter(q => q.recency === 'recent');
  const source  = recent.length > 3 ? recent : unpracticed;

  // Pick from top 15 most frequent to avoid always getting #1
  const topN = source.slice(0, Math.min(15, source.length));
  const question = pickRandom(topN);

  return { question, companyName: resolvedCompany, source: 'real-data' };
}

/**
 * Get a LLD problem.
 *
 * @param {string} [difficulty] - 'EASY' | 'MEDIUM' | 'HARD' | 'ANY'
 * @param {string[]} [practiced]- Array of question titles to exclude
 * @returns {{ problem: Object }}
 */
function getLLDProblem(difficulty = 'ANY', practiced = []) {
  const diff = (difficulty || 'ANY').toUpperCase();
  const filtered = diff !== 'ANY'
    ? LLD_BANK.filter(p => p.difficulty === diff)
    : LLD_BANK;

  let unpracticed = filtered.filter(p => !practiced.includes(p.title));
  if (unpracticed.length === 0) unpracticed = filtered;

  const pool = unpracticed.length > 0 ? unpracticed : LLD_BANK;
  return { problem: pickRandom(pool) };
}

/**
 * Get a System Design problem.
 *
 * @param {string} [difficulty] - 'EASY' | 'MEDIUM' | 'HARD' | 'ANY'
 * @param {string[]} [practiced]- Array of question titles to exclude
 * @returns {{ problem: Object }}
 */
function getSDProblem(difficulty = 'ANY', practiced = []) {
  const diff = (difficulty || 'ANY').toUpperCase();
  const filtered = diff !== 'ANY'
    ? SD_BANK.filter(p => p.difficulty === diff)
    : SD_BANK;

  let unpracticed = filtered.filter(p => !practiced.includes(p.title));
  if (unpracticed.length === 0) unpracticed = filtered;

  const pool = unpracticed.length > 0 ? unpracticed : SD_BANK;
  return { problem: pickRandom(pool) };
}

/**
 * Get a question/problem for any interview type.
 *
 * @param {string} interviewType - 'dsa' | 'systemDesign' | 'lld' | 'tutorDsa' | 'tutorLld' | 'tutorSystemDesign'
 * @param {string} [company]     - Company name (for DSA)
 * @param {string} [difficulty]  - 'EASY' | 'MEDIUM' | 'HARD' | 'ANY'
 * @param {string[]} [practiced] - Array of practiced question titles
 */
function getQuestion(interviewType, company, difficulty, practiced = []) {
  switch (interviewType) {
    case 'dsa':               return getDSAQuestion(company, difficulty, practiced);
    case 'lld':               return { ...getLLDProblem(difficulty, practiced), companyName: null };
    case 'systemDesign':      return { ...getSDProblem(difficulty, practiced), companyName: null };
    case 'tutorDsa':          return getDSAQuestion(company, difficulty, practiced);
    case 'tutorLld':          return { ...getLLDProblem(difficulty, practiced), companyName: null };
    case 'tutorSystemDesign': return { ...getSDProblem(difficulty, practiced), companyName: null };
    case 'managerial':
      return {
        title: 'Behavioral & Leadership Principles',
        question: 'The interviewer will assess your past experience, leadership principles, conflict resolution skills, and overall cultural fit for the role.',
        companyName: company || null
      };
    default:                  return getDSAQuestion(company, difficulty, practiced);
  }
}

/**
 * Get list of companies for autocomplete (DSA only).
 * Returns top 100 by question count for performance.
 */
function getCompanyList() {
  return COMPANY_LIST.slice(0, 200); // first 200 alphabetically (all are good)
}

module.exports = { getQuestion, getCompanyList, normalizeCompany };
