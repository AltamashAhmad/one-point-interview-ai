// Topic notes are Markdown files in ./topics/<topicId>.md, loaded on demand so the app bundle stays small.
const KNOWN_TOPICS = new Set(['array', 'big-o', 'recursion']);

export function hasTopicContent(topicId) {
  if (typeof topicId !== 'string') return false;
  return KNOWN_TOPICS.has(topicId);
}

export async function loadTopicContent(topicId) {
  if (!hasTopicContent(topicId)) return null;

  switch (topicId) {
    case 'array': {
      const mod = await import('./topics/array.md?raw');
      return mod.default || mod;
    }
    case 'big-o': {
      const mod = await import('./topics/big-o.md?raw');
      return mod.default || mod;
    }
    case 'recursion': {
      const mod = await import('./topics/recursion.md?raw');
      return mod.default || mod;
    }
    default:
      return null;
  }
}

/** Ids of every topic file on disk (used by tests to catch notes that are not in the study list). */
export function contentTopicIds() {
  return Array.from(KNOWN_TOPICS);
}
