/** Rejects IDs that could escape a collection path or hit Firestore reserved names. */
function isValidDocId(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 128) return false;
  if (id.includes('/') || id === '.' || id === '..') return false;
  if (/^__.*__$/.test(id)) return false;
  return true;
}

module.exports = { isValidDocId };
