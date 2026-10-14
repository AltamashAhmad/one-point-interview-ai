import { describe, it, expect } from 'vitest';
import { READ_AT, readingSummary } from './progress';

describe('readingSummary', () => {
  it('counts topics read at the threshold and sums the saved progress', () => {
    const items = { 'big-o': { progress: 100 }, recursion: { progress: READ_AT }, array: { progress: 40 } };
    expect(readingSummary(['big-o', 'recursion', 'array', 'string'], items)).toEqual({ read: 2, points: 230, max: 400 });
  });

  it('is empty when no topic is written yet', () => {
    expect(readingSummary([], { 'big-o': { progress: 100 } })).toEqual({ read: 0, points: 0, max: 0 });
  });
});
