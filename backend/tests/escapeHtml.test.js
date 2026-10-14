const { escapeHtml } = require('../utils/escapeHtml');

describe('escapeHtml', () => {
  it('escapes the characters that can open tags or break out of attributes', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(escapeHtml(`Tom & 'Jerry' \`x\``)).toBe('Tom &amp; &#39;Jerry&#39; &#96;x&#96;');
  });

  it('escapes the ampersand first so entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('returns an empty string for null and undefined, and stringifies other values', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(20)).toBe('20');
  });
});
