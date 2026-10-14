export const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Splits a topic's Markdown at its `## ` headings, ignoring `##` lines inside code fences.
 * `intro` is everything before the first heading; `### ` sub-headings stay inside their section.
 */
export function splitSections(markdown) {
  const intro = [];
  const sections = [];
  let current = null;
  let inFence = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      const title = line.slice(3).trim().replace(/[`*_]/g, '');
      current = { id: slugify(title), title, lines: [] };
      sections.push(current);
    } else {
      (current ? current.lines : intro).push(line);
    }
  }

  return {
    intro: intro.join('\n').trim(),
    sections: sections.map(({ id, title, lines }) => ({ id, title, body: lines.join('\n').trim() })),
  };
}
