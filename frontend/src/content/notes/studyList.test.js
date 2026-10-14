import { NOTES_TRACKS, findTopic, getTrack, trackTopics } from './studyList';
import { contentTopicIds, hasTopicContent, loadTopicContent } from './content';

describe('study list', () => {
  it('has the Data Structures and Algorithms collections', () => {
    expect(NOTES_TRACKS.map((t) => t.id)).toEqual(['data-structures', 'algorithms']);
  });

  it('gives every topic a unique id within the whole list', () => {
    const ids = NOTES_TRACKS.flatMap(trackTopics).map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps every note file tied to a topic in the list', () => {
    const listed = new Set(NOTES_TRACKS.flatMap(trackTopics).map((t) => t.id));
    for (const id of contentTopicIds()) expect(listed.has(id)).toBe(true);
  });

  it('numbers topics in learning order and links neighbours', () => {
    const track = getTrack('data-structures');
    const first = findTopic(track, 'big-o');
    const second = findTopic(track, 'recursion');
    expect(first).toMatchObject({ number: 1, previous: null });
    expect(first.next.id).toBe('recursion');
    expect(second.previous.id).toBe('big-o');
    expect(findTopic(track, 'not-a-topic')).toBeNull();
  });
});

describe('topic content', () => {
  it('loads a written topic and reports unwritten ones as unavailable', async () => {
    expect(hasTopicContent('big-o')).toBe(true);
    expect(await loadTopicContent('big-o')).toContain('Big-O');
    expect(hasTopicContent('not-a-topic')).toBe(false);
    expect(await loadTopicContent('not-a-topic')).toBeNull();
  });
});
