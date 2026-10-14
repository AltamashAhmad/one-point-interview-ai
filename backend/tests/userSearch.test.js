const { searchTokens, searchWords } = require('../services/userSearch');

describe('searchTokens', () => {
  it('stores every prefix of each word in the email and name, lowercased', () => {
    const tokens = searchTokens('Ada@Example.com', 'Ada Lovelace');
    expect(tokens).toEqual(expect.arrayContaining(['a', 'ad', 'ada', 'exam', 'example', 'com', 'love', 'lovelace']));
  });

  it('splits on punctuation and ignores empty values', () => {
    expect(searchTokens(null, undefined, '')).toEqual([]);
    expect(searchTokens('bob.smith@mail.io')).toEqual(expect.arrayContaining(['bob', 'sm', 'smith', 'mail', 'io']));
  });

  it('keeps unicode letters inside words', () => {
    expect(searchTokens('José Núñez')).toEqual(expect.arrayContaining(['jo', 'josé', 'nú', 'núñez']));
  });

  it('caps stored prefixes at 20 characters', () => {
    const tokens = searchTokens('a'.repeat(30));
    expect(tokens).toContain('a'.repeat(20));
    expect(tokens).not.toContain('a'.repeat(21));
  });
});

describe('searchWords', () => {
  it('lowercases and splits the typed query into words', () => {
    expect(searchWords('  Ada   LOV ')).toEqual(['ada', 'lov']);
  });

  it('returns no words for punctuation only', () => {
    expect(searchWords('@@')).toEqual([]);
  });
});
