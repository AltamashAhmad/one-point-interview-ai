// Fills searchTokens on user profiles for admin search and removes the old emailLower / nameLower
// fields. Safe to re-run: profiles that already have tokens and no old fields are skipped.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const admin = require('../config/firebase');
const { searchTokens } = require('../services/userSearch');

(async () => {
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;
  const snap = await db.collection('users').get();
  const stale = snap.docs.filter((doc) => {
    const d = doc.data();
    return !Array.isArray(d.searchTokens) || 'emailLower' in d || 'nameLower' in d;
  });

  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    for (const doc of stale.slice(i, i + 400)) {
      const d = doc.data();
      batch.update(doc.ref, {
        searchTokens: searchTokens(d.email, d.displayName),
        emailLower: FieldValue.delete(),
        nameLower: FieldValue.delete(),
      });
    }
    await batch.commit();
  }

  console.log(`Updated ${stale.length} of ${snap.size} user profiles.`);
  process.exit(0);
})().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
