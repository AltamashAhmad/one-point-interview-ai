import { useEffect, useRef, useState } from 'react';

const ERROR_TEXT = {
  'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in your browser settings.',
  'service-not-allowed': 'Voice input is not available in this browser.',
  'audio-capture': 'No microphone was found. Check that one is connected.',
  network: 'Voice input needs an internet connection.',
};
// Sessions that end within a second (a refused microphone, for example) are not retried forever.
const MAX_FAST_FAILURES = 3;

/**
 * useVoiceToText wraps the browser's Web Speech API.
 *
 * onTranscript receives each finished phrase. Returns:
 *   isListening  boolean   true while recording
 *   interim      string    the phrase still being spoken
 *   isSupported  boolean   false on browsers that lack the API
 *   startListening()       start recording
 *   stopListening()        stop recording
 *   error        string|null
 */
export function useVoiceToText({ onTranscript, continuous = true, language = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim]         = useState('');
  const [error, setError]             = useState(null);
  const recognitionRef                = useRef(null);
  const wantListeningRef              = useRef(false);
  const processedRef                  = useRef(0);
  const startedAtRef                  = useRef(0);
  const fastFailuresRef               = useRef(0);
  const onTranscriptRef               = useRef(onTranscript);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  // Releases the microphone when the page unmounts.
  useEffect(() => () => {
    wantListeningRef.current = false;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.abort();
  }, []);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const resetListening = () => {
    wantListeningRef.current = false;
    recognitionRef.current = null;
    setIsListening(false);
    setInterim('');
  };

  // Chrome ends a session after a pause, so a new one is opened until the user stops.
  const openSession = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    processedRef.current = 0;
    startedAtRef.current = Date.now();

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const finals = [];
      let pending = '';
      // Results accumulate within a session; start after the last final one so none is read twice.
      for (let i = Math.max(event.resultIndex || 0, processedRef.current); i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finals.push(result[0].transcript.trim());
          processedRef.current = i + 1;
        } else {
          pending += result[0].transcript;
        }
      }
      fastFailuresRef.current = 0;
      const phrase = finals.filter(Boolean).join(' ');
      if (phrase) onTranscriptRef.current?.(phrase);
      if (wantListeningRef.current) setInterim(pending.trim());
    };

    recognition.onerror = (event) => {
      // no-speech and aborted are normal; onend decides whether to keep listening.
      if (recognitionRef.current !== recognition || event.error === 'no-speech' || event.error === 'aborted') return;
      resetListening();
      setError(ERROR_TEXT[event.error] || `Voice input stopped (${event.error}).`);
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition || !wantListeningRef.current) return;
      fastFailuresRef.current = Date.now() - startedAtRef.current < 1000 ? fastFailuresRef.current + 1 : 0;
      if (fastFailuresRef.current >= MAX_FAST_FAILURES) {
        resetListening();
        setError('Voice input keeps stopping. Check your microphone, then try again.');
        return;
      }
      try {
        openSession();
      } catch {
        resetListening();
        setError('Voice input could not restart. Try again.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const startListening = () => {
    if (!isSupported) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (wantListeningRef.current) return;
    setError(null);
    wantListeningRef.current = true;
    fastFailuresRef.current = 0;
    setIsListening(true);
    try {
      openSession();
    } catch {
      resetListening();
      setError('Voice input could not start. Try again.');
    }
  };

  const stopListening = () => {
    const recognition = recognitionRef.current;
    resetListening();
    // Chrome still delivers the phrase being spoken after stop(), so onresult stays attached.
    try { recognition?.stop(); } catch { /* already stopped */ }
  };

  return { isListening, interim, isSupported, startListening, stopListening, error };
}
