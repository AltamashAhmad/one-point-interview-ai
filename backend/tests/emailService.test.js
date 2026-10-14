process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.FRONTEND_URL = 'https://app.example.com';

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: mockSendMail }) }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const email = require('../services/emailService');

const PAYLOAD = '<script>alert(1)</script><a href="https://evil.test">click</a>';
const lastHtml = () => mockSendMail.mock.calls.at(-1)[0].html;

beforeEach(() => mockSendMail.mockClear());

describe('email templates', () => {
  it('escapes the name, address and message in the admin notification', async () => {
    await email.sendAccessRequestEmail({
      uid: 'u1', email: `a${PAYLOAD}@x.test`, displayName: PAYLOAD, purpose: 'other', reason: PAYLOAD, requestId: 'r1',
    });

    const html = lastHtml();
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<a href="https://evil.test">');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('encodes the request id used in the admin link', async () => {
    await email.sendAccessRequestEmail({ uid: 'u1', email: 'a@x.test', displayName: 'A', purpose: 'other', requestId: 'r1&x=<b>' });

    expect(lastHtml()).toContain('/admin?tab=requests&id=r1%26x%3D%3Cb%3E');
  });

  it('escapes the denial reason and the name', async () => {
    await email.sendDenialEmail({ email: 'u@x.test', displayName: PAYLOAD, reason: PAYLOAD });

    expect(lastHtml()).not.toContain('<script>');
    expect(lastHtml()).toContain('&lt;a href=&quot;https://evil.test&quot;&gt;click&lt;/a&gt;');
  });

  it('escapes the suspension reason and the name', async () => {
    await email.sendSuspensionEmail({ email: 'u@x.test', displayName: PAYLOAD, suspendedUntil: '2030-01-01T00:00:00Z', reason: PAYLOAD });

    expect(lastHtml()).not.toContain('<script>');
  });

  it('escapes the name and quota in the approval email', async () => {
    await email.sendApprovalEmail({ email: 'u@x.test', displayName: PAYLOAD, dailyLimit: '<b>9</b>' });

    expect(lastHtml()).not.toContain('<script>');
    expect(lastHtml()).not.toContain('<b>9</b>');
  });

  it('still shows readable fallbacks when values are missing', async () => {
    await email.sendAccessRequestEmail({ uid: 'u1', purpose: 'other', requestId: 'r1' });

    expect(lastHtml()).toContain('Unknown');
    expect(lastHtml()).toContain('No message provided');
  });

  it('sends to the real address, not an escaped one', async () => {
    await email.sendDenialEmail({ email: "o'brien@x.test", displayName: 'O', reason: 'r' });

    expect(mockSendMail.mock.calls.at(-1)[0].to).toBe("o'brien@x.test");
  });
});
