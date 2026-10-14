// Admin user search matches the start of any word in a user's email or display name.
// Each profile stores `searchTokens`: every prefix of every word in those fields. A search then
// becomes one `array-contains` query, which needs no composite index and no scan of all users.
const MAX_TOKEN_LENGTH = 20;
const WORD_SEPARATOR = /[^\p{L}\p{N}]+/u;

function splitWords(value) {
  return String(value || '').toLowerCase().split(WORD_SEPARATOR).filter(Boolean);
}

// Stored on profile creation and by scripts/backfillUserSearch.js.
function searchTokens(...values) {
  const tokens = new Set();
  for (const value of values) {
    for (const word of splitWords(value)) {
      for (let i = 1; i <= Math.min(word.length, MAX_TOKEN_LENGTH); i += 1) tokens.add(word.slice(0, i));
    }
  }
  return [...tokens];
}

// Terms typed in the admin search box, in the same form as the stored tokens.
function searchWords(query) {
  return splitWords(query).map((word) => word.slice(0, MAX_TOKEN_LENGTH));
}

module.exports = { searchTokens, searchWords };
