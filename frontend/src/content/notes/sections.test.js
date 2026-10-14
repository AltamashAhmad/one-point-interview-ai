import { slugify, splitSections } from './sections';
import { contentTopicIds, loadTopicContent } from './content';

describe('slugify', () => {
  it('makes URL-safe ids', () => {
    expect(slugify('1. What is an array?')).toBe('1-what-is-an-array');
    expect(slugify('  Static versus dynamic  ')).toBe('static-versus-dynamic');
  });
});

describe('splitSections', () => {
  const markdown = [
    '> Summary line',
    '',
    '## 1. First',
    'Some text',
    '',
    '```java',
    '## not a heading, it is a comment in code',
    '```',
    '',
    '### Sub heading stays inside its section',
    '',
    '## 2. Second `code`',
    'More text',
  ].join('\n');

  it('keeps text before the first heading as the intro', () => {
    expect(splitSections(markdown).intro).toBe('> Summary line');
  });

  it('splits at ## headings only, and not inside code fences', () => {
    const { sections } = splitSections(markdown);
    expect(sections.map((s) => s.id)).toEqual(['1-first', '2-second-code']);
    expect(sections[0].body).toContain('## not a heading');
    expect(sections[0].body).toContain('### Sub heading stays inside its section');
  });

  it('strips Markdown markers from titles', () => {
    expect(splitSections(markdown).sections[1].title).toBe('2. Second code');
  });

  it('handles a document with no sections', () => {
    expect(splitSections('Just text')).toEqual({ intro: 'Just text', sections: [] });
  });
});

describe('written topics', () => {
  it('split into sections with unique ids', async () => {
    for (const id of contentTopicIds()) {
      const { sections } = splitSections(await loadTopicContent(id));
      expect(sections.length).toBeGreaterThan(3);
      const ids = sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
