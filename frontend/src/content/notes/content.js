// Topic notes are Markdown files in ./topics/<topicId>.md, loaded on demand so the app bundle stays small.
const loaders = import.meta.glob('./topics/*.md', { query: '?raw', import: 'default' });

const keyFor = (topicId) => `./topics/${topicId}.md`;

export function hasTopicContent(topicId) {
  const key = keyFor(topicId);
  return Object.prototype.hasOwnProperty.call(loaders, key);
}

export async function loadTopicContent(topicId) {
  const key = keyFor(topicId);
  if (!Object.prototype.hasOwnProperty.call(loaders, key)) return null;
  const load = loaders[key];
  return typeof load === 'function' ? load() : null;
}

/** Ids of every topic file on disk (used by tests to catch notes that are not in the study list). */
export function contentTopicIds() {
  return Object.keys(loaders).map((k) => k.slice('./topics/'.length, -'.md'.length));
}
