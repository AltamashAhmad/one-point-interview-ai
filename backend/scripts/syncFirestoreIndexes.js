// Creates the composite indexes declared in firestore.indexes.json that the project does not have yet.
// Uses the same service account as the API, so no Firebase CLI login is needed. Usage: node scripts/syncFirestoreIndexes.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const { v1 } = require('@google-cloud/firestore');

const declared = require(path.join(__dirname, '../../firestore.indexes.json')).indexes;
const projectId = process.env.FIREBASE_PROJECT_ID;
const client = new v1.FirestoreAdminClient({
  projectId,
  credentials: {
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

// Firestore stores a trailing __name__ field on every composite index; it is not part of the declaration.
const declaredFields = (fields) => fields.filter((f) => f.fieldPath !== '__name__');
const sameFields = (a, b) => a.length === b.length && a.every((f, i) => f.fieldPath === b[i].fieldPath && f.order === b[i].order);

(async () => {
  for (const idx of declared) {
    const parent = `projects/${projectId}/databases/(default)/collectionGroups/${idx.collectionGroup}`;
    const [existing] = await client.listIndexes({ parent });
    const found = existing.find((e) => e.queryScope === idx.queryScope && sameFields(declaredFields(e.fields), idx.fields));
    const label = `${idx.collectionGroup} (${idx.fields.map((f) => f.fieldPath).join(' + ')})`;
    if (found) {
      console.log(`present: ${label} [${found.state}]`);
      continue;
    }
    console.log(`creating: ${label}`);
    const [operation] = await client.createIndex({ parent, index: { queryScope: idx.queryScope, fields: idx.fields } });
    await operation.promise();
    console.log(`ready: ${label}`);
  }
  process.exit(0);
})().catch((err) => {
  console.error('Index sync failed:', err.message);
  process.exit(1);
});
