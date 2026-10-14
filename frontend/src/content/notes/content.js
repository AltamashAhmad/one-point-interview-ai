// Topic notes are Markdown files in ./topics/<topicId>.md, loaded on demand so the app bundle stays small.
const loaders = import.meta.glob('./topics/*.md', { query: '?raw', import: 'default' });

const keyFor = (topicId) => `./topics/${topicId}.md`;

export function hasTopicContent(topicId) {
  return keyFor(topicId) in loaders;
}

export async function loadTopicContent(topicId) {
  const load = loaders[keyFor(topicId)];
  return load ? load() : null;
}

/** Ids of every topic file on disk (used by tests to catch notes that are not in the study list). */
export function contentTopicIds() {
  return Object.keys(loaders).map((k) => k.slice('./topics/'.length, -'.md'.length));
}
