// Topic notes are Markdown files in ./topics/<topicId>.md, loaded on demand so the app bundle stays small.
const loaders = import.meta.glob('./topics/*.md', { query: '?raw', import: 'default' });

const keyFor = (topicId) => `./topics/${topicId}.md`;

const loaderMap = new Map();
for (const [key, fn] of Object.entries(loaders)) {
  if (typeof fn === 'function') {
    loaderMap.set(key, fn);
  }
}

export function hasTopicContent(topicId) {
  if (typeof topicId !== 'string') return false;
  return loaderMap.has(keyFor(topicId));
}

export async function loadTopicContent(topicId) {
  if (typeof topicId !== 'string') return null;
  const load = loaderMap.get(keyFor(topicId));
  return load ? load() : null;
}

/** Ids of every topic file on disk (used by tests to catch notes that are not in the study list). */
export function contentTopicIds() {
  return Array.from(loaderMap.keys()).map((k) => k.slice('./topics/'.length, -'.md'.length));
}
