import { renderHook, act } from '@testing-library/react';
import { useSessionPersist } from './useSessionPersist';

describe('useSessionPersist', () => {
  const TEST_KEY = 'test_session_key';
  const FULL_KEY = 'opi_session_' + TEST_KEY;

  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should initialize with the initial value if no saved data exists', () => {
    const { result } = renderHook(() => useSessionPersist(TEST_KEY, 'initial'));
    expect(result.current.restore()).toBe(null);
  });

  it('should load saved data from localStorage if it exists', () => {
    window.localStorage.setItem(FULL_KEY, JSON.stringify('saved-value'));
    const { result } = renderHook(() => useSessionPersist(TEST_KEY, 'initial'));
    expect(result.current.restore()).toBe('saved-value');
  });

  it('should save data to localStorage when state changes', () => {
    const { result } = renderHook(() => useSessionPersist(TEST_KEY, 'initial'));
    
    act(() => {
      result.current.persist('new-value');
    });

    expect(result.current.restore()).toBe('new-value');
    expect(window.localStorage.getItem(FULL_KEY)).toBe(JSON.stringify('new-value'));
  });

  it('should clear localStorage when clear method is called', () => {
    const { result } = renderHook(() => useSessionPersist(TEST_KEY, 'initial'));
    
    act(() => {
      result.current.persist('new-value');
    });
    
    expect(window.localStorage.getItem(FULL_KEY)).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(result.current.restore()).toBe(null);
    expect(window.localStorage.getItem(FULL_KEY)).toBeNull();
  });
});
