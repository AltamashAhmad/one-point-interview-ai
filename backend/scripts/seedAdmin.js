/**
 * One-time setup script: seeds the admin user profile in Firestore.
 *
 * Run this ONCE after Phase 1 is deployed:
 *   node backend/scripts/seedAdmin.js
 *
 * This creates the admin document in Firestore with:
 *   - role: 'admin'
 *   - status: 'APPROVED'
 *   - isUnlimited: true (no quota limits)
 *
 * Safe to run multiple times — uses merge so it won't overwrite existing data.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const admin = require('../config/firebase');

const ADMIN_UID = process.env.ADMIN_UID;

if (!ADMIN_UID) {
  console.error('❌ ADMIN_UID not set in backend/.env');
  process.exit(1);
}

async function seedAdmin() {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(ADMIN_UID);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  await userRef.set({
    uid:                  ADMIN_UID,
    email:                process.env.ADMIN_EMAIL || 'admin',
    displayName:          'Admin',
    photoURL:             null,
    role:                 'admin',
    status:               'APPROVED',
    isUnlimited:          true,    // ← No quota limits ever
    dailyLimit:           999999,  // Effectively unlimited
    freeTrialUsed:        0,
    freeTrialLimit:       3,
    dailyCallsUsed:       0,
    dailyCallsResetDate:  today,
    totalAiCalls:         0,
    banReason:            null,
    suspendedUntil:       null,
    suspendNote:          null,
    accessRequestId:      null,
    createdAt:            now,
    approvedAt:           now,
    approvedBy:           'system',
  }, { merge: true }); // merge: true = safe to re-run

  console.log(`✅ Admin profile seeded for UID: ${ADMIN_UID}`);
  console.log('   role: admin | status: APPROVED | isUnlimited: true');
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('❌ Failed to seed admin:', err.message);
  process.exit(1);
});
