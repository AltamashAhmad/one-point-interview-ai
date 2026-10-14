import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useTracker from './useTracker';
import * as api from '../services/api';

vi.mock('../services/api');

describe('useTracker load failures', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flags a failed load and recovers on reload', async () => {
    api.getTrackerItems
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ a: { done: true } });

    const { result } = renderHook(() => useTracker('sheet'));

    await waitFor(() => expect(result.current.loadFailed).toBe(true));
    expect(result.current.error).toBeTruthy();

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.items).toEqual({ a: { done: true } }));
    expect(result.current.loadFailed).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not flag a failed save as a load failure', async () => {
    api.getTrackerItems.mockResolvedValueOnce({});
    api.updateTrackerItem.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useTracker('sheet'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.update('a', { done: true }).catch(() => {}); });

    expect(result.current.error).toBeTruthy();
    expect(result.current.loadFailed).toBe(false);
  });
});
