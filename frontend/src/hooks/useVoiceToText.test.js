import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVoiceToText } from './useVoiceToText';

// Stands in for the browser's speech engine so each event can be sent by hand.
class FakeRecognition {
  static instances = [];

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() { this.onstart?.(); }

  stop() { this.onend?.(); }

  abort() { this.onend?.(); }

  end() { this.onend?.(); }

  fail(error) { this.onerror?.({ error }); }

  say(results, resultIndex = 0) {
    this.onresult?.({
      resultIndex,
      results: results.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })),
    });
  }
}

const latest = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

beforeEach(() => {
  FakeRecognition.instances = [];
  window.webkitSpeechRecognition = FakeRecognition;
});

afterEach(() => {
  delete window.webkitSpeechRecognition;
});

describe('useVoiceToText', () => {
  it('reports browsers without speech recognition', () => {
    delete window.webkitSpeechRecognition;
    const { result } = renderHook(() => useVoiceToText());
    expect(result.current.isSupported).toBe(false);
    act(() => result.current.startListening());
    expect(result.current.error).toMatch(/not supported/);
  });

  it('delivers every finished phrase, including repeats', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceToText({ onTranscript }));
    act(() => result.current.startListening());
    act(() => latest().say([['yes', true]]));
    act(() => latest().say([['yes', true], [' yes ', true]], 1));
    expect(onTranscript.mock.calls).toEqual([['yes'], ['yes']]);
  });

  it('shows the phrase still being spoken until it is final', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceToText({ onTranscript }));
    act(() => result.current.startListening());
    act(() => latest().say([['hash', false]]));
    expect(result.current.interim).toBe('hash');
    act(() => latest().say([['hash map', true]]));
    expect(onTranscript).toHaveBeenCalledWith('hash map');
    expect(result.current.interim).toBe('');
  });

  it('keeps listening when the browser ends a session', () => {
    const { result } = renderHook(() => useVoiceToText());
    act(() => result.current.startListening());
    act(() => latest().end());
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(result.current.isListening).toBe(true);
  });

  it('stops on request but still delivers the phrase being finished', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceToText({ onTranscript }));
    act(() => result.current.startListening());
    const recognition = latest();
    act(() => result.current.stopListening());
    expect(result.current.isListening).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(1);
    act(() => recognition.say([['last words', true]]));
    expect(onTranscript).toHaveBeenCalledWith('last words');
  });

  it('reports a blocked microphone and does not retry', () => {
    const { result } = renderHook(() => useVoiceToText());
    act(() => result.current.startListening());
    act(() => latest().fail('not-allowed'));
    expect(result.current.error).toMatch(/Microphone access is blocked/);
    expect(result.current.isListening).toBe(false);
    act(() => latest().end());
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('gives up when sessions keep ending right away', () => {
    const { result } = renderHook(() => useVoiceToText());
    act(() => result.current.startListening());
    for (let i = 0; i < 3; i += 1) act(() => latest().end());
    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toMatch(/keeps stopping/);
  });
});
