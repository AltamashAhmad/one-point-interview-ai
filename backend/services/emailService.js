const nodemailer = require('nodemailer');

// ── Gmail transporter (reused across all sends) ───────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.ADMIN_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  return transporter;
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL;

// ── Shared HTML email wrapper ─────────────────────────────────────────────────
function htmlWrapper(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OnePoint AI</title>
</head>
<body style="margin:0;padding:0;background:#0f0f14;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f14;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1e2e,#16213e);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:32px;margin-bottom:8px;">🎯</div>
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                OnePoint <span style="color:#6366f1;">AI</span>
              </div>
              <div style="font-size:13px;color:#6b7280;margin-top:4px;">Interview Practice Platform</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#13131f;padding:36px 40px;border-radius:0 0 16px 16px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="color:#374151;font-size:12px;margin:0;">
                OnePoint AI · This is an automated notification · Do not reply to this email
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── 1. Admin: new access request notification ─────────────────────────────────
async function sendAccessRequestEmail({ uid, email, displayName, purpose, reason, requestId }) {
  if (!ADMIN_EMAIL) {
    console.warn('[Email] ADMIN_EMAIL not set — skipping access request notification');
    return;
  }

  const purposeLabels = {
    job_prep:     '💼 Preparing for job interviews',
    learning:     '📚 Learning CS concepts',
    academic:     '🎓 Academic / university use',
    other:        '💡 Other',
  };

  const purposeLabel = purposeLabels[purpose] || purpose;
  const adminLink    = `${FRONTEND_URL}/admin?tab=requests&id=${requestId}`;

  const content = `
    <h2 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px;">🔔 New Access Request</h2>
    <p style="color:#9ca3af;font-size:14px;margin:0 0 28px;">A user has requested full access to OnePoint AI.</p>

    <!-- User card -->
    <div style="background:#1e1e2e;border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">User</span><br/>
            <span style="color:#ffffff;font-size:16px;font-weight:600;">${displayName || 'Unknown'}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</span><br/>
            <span style="color:#6366f1;font-size:14px;">${email || 'N/A'}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Purpose</span><br/>
            <span style="color:#ffffff;font-size:14px;">${purposeLabel}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 0 0;">
            <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Message</span><br/>
            <span style="color:#d1d5db;font-size:14px;font-style:${reason ? 'normal' : 'italic'};">
              ${reason || 'No message provided'}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-top:8px;">
      <a href="${adminLink}"
         style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;
                text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;
                font-weight:600;letter-spacing:0.3px;">
        🔗 Open Admin Panel
      </a>
    </div>
    <p style="color:#4b5563;font-size:12px;text-align:center;margin-top:16px;">
      Log in to approve or deny this request.
    </p>
  `;

  await getTransporter().sendMail({
    from:    `"OnePoint AI Admin" <${ADMIN_EMAIL}>`,
    to:      ADMIN_EMAIL,
    subject: `[OnePoint AI] New Access Request — ${displayName || email}`,
    html:    htmlWrapper(content),
  });

  console.log(`[Email] Access request notification sent for ${email}`);
}

// ── 2. User: request approved ─────────────────────────────────────────────────
async function sendApprovalEmail({ email, displayName, dailyLimit }) {
  if (!email) return;

  const loginLink = `${FRONTEND_URL}/login`;

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:16px;">🎉</div>
      <h2 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;">You're Approved!</h2>
      <p style="color:#9ca3af;font-size:15px;margin:0;">
        Your access request for OnePoint AI has been approved.
      </p>
    </div>

    <div style="background:#1e1e2e;border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:24px;margin-bottom:28px;">
      <p style="color:#d1d5db;font-size:14px;margin:0 0 12px;">Hi <strong style="color:#ffffff;">${displayName || 'there'}</strong>,</p>
      <p style="color:#d1d5db;font-size:14px;margin:0 0 12px;">
        You now have full access to OnePoint AI. Here's what you get:
      </p>
      <ul style="color:#d1d5db;font-size:14px;margin:0;padding-left:20px;line-height:2;">
        <li>✅ <strong style="color:#22c55e;">${dailyLimit || 20} AI sessions per day</strong></li>
        <li>✅ All interview types: DSA, System Design, LLD, Managerial</li>
        <li>✅ AI Tutor mode for learning</li>
        <li>✅ Interview history & scorecards</li>
        <li>✅ Company-specific question banks (464 companies)</li>
      </ul>
    </div>

    <div style="text-align:center;">
      <a href="${loginLink}"
         style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#ffffff;
                text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">
        🚀 Start Practicing Now
      </a>
    </div>
  `;

  await getTransporter().sendMail({
    from:    `"OnePoint AI" <${ADMIN_EMAIL}>`,
    to:      email,
    subject: `✅ You've been approved — OnePoint AI`,
    html:    htmlWrapper(content),
  });

  console.log(`[Email] Approval email sent to ${email}`);
}

// ── 3. User: request denied ───────────────────────────────────────────────────
async function sendDenialEmail({ email, displayName, reason }) {
  if (!email) return;

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:16px;">📋</div>
      <h2 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;">Access Request Update</h2>
      <p style="color:#9ca3af;font-size:15px;margin:0;">
        We've reviewed your request for OnePoint AI access.
      </p>
    </div>

    <div style="background:#1e1e2e;border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:24px;margin-bottom:28px;">
      <p style="color:#d1d5db;font-size:14px;margin:0 0 12px;">Hi <strong style="color:#ffffff;">${displayName || 'there'}</strong>,</p>
      <p style="color:#d1d5db;font-size:14px;margin:0 0 12px;">
        Unfortunately, your access request was not approved at this time.
      </p>
      ${reason ? `
      <div style="background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;border-radius:0 6px 6px 0;padding:12px 16px;margin-top:16px;">
        <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Reason</span><br/>
        <span style="color:#d1d5db;font-size:14px;">${reason}</span>
      </div>` : ''}
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">
        You may submit a new request with more details about how you plan to use the platform.
      </p>
    </div>
  `;

  await getTransporter().sendMail({
    from:    `"OnePoint AI" <${ADMIN_EMAIL}>`,
    to:      email,
    subject: `OnePoint AI — Access Request Update`,
    html:    htmlWrapper(content),
  });

  console.log(`[Email] Denial email sent to ${email}`);
}

// ── 4. User: account suspended ────────────────────────────────────────────────
async function sendSuspensionEmail({ email, displayName, suspendedUntil, reason }) {
  if (!email) return;

  const until = suspendedUntil
    ? new Date(suspendedUntil).toLocaleDateString('en-US', { dateStyle: 'long' })
    : 'a future date';

  const content = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:16px;">⏸️</div>
      <h2 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 8px;">Account Temporarily Suspended</h2>
    </div>

    <div style="background:#1e1e2e;border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:24px;margin-bottom:28px;">
      <p style="color:#d1d5db;font-size:14px;margin:0 0 12px;">Hi <strong style="color:#ffffff;">${displayName || 'there'}</strong>,</p>
      <p style="color:#d1d5db;font-size:14px;margin:0 0 8px;">
        Your OnePoint AI account has been temporarily suspended until <strong style="color:#f59e0b;">${until}</strong>.
      </p>
      ${reason ? `
      <div style="background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;border-radius:0 6px 6px 0;padding:12px 16px;margin-top:16px;">
        <span style="color:#6b7280;font-size:12px;">Reason: </span>
        <span style="color:#d1d5db;font-size:14px;">${reason}</span>
      </div>` : ''}
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0;">Your account will be automatically restored after the suspension period ends.</p>
    </div>
  `;

  await getTransporter().sendMail({
    from:    `"OnePoint AI" <${ADMIN_EMAIL}>`,
    to:      email,
    subject: `⏸️ Your OnePoint AI account has been suspended`,
    html:    htmlWrapper(content),
  });
}

module.exports = {
  sendAccessRequestEmail,
  sendApprovalEmail,
  sendDenialEmail,
  sendSuspensionEmail,
};
