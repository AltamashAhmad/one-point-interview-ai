import { useState, useRef, useCallback } from 'react';

/**
 * useVoiceToText — wraps the browser's Web Speech API.
 *
 * Returns:
 *   isListening  boolean   — true while recording
 *   isSupported  boolean   — false on browsers that lack the API
 *   startListening()       — start recording
 *   stopListening()        — stop manually
 *   error        string|null
 */
export function useVoiceToText({ onTranscript, continuous = true, language = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError]             = useState(null);
  const recognitionRef                = useRef(null);
  const lastTranscriptRef             = useRef(''); // Bug #9: dedup guard

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    if (isListening) return;

    setError(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition       = new SpeechRecognition();

    recognition.lang            = language;
    recognition.continuous      = continuous;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend   = () => {
      // In continuous mode, auto-restart if user hasn't clicked stop.
      // This handles the browser's internal session timeout so silence
      // doesn't cut the mic — the user may just be thinking.
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (_) {}
      } else {
        setIsListening(false);
      }
    };
    recognition.onerror = (e) => {
      if (e.error === 'no-speech') {
        // Silence is intentional — user is thinking. Don't show error.
        return;
      }
      if (e.error === 'aborted') {
        // Fired when we call .stop() manually — safe to ignore.
        return;
      }
      setIsListening(false);
      recognitionRef.current = null;
      if (e.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setError(`Speech recognition error: ${e.error}`);
      }
    };

    recognition.onresult = (event) => {
      let newlyFinalized = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newlyFinalized += event.results[i][0].transcript;
        }
      }
      
      newlyFinalized = newlyFinalized.trim();

      if (newlyFinalized && newlyFinalized !== lastTranscriptRef.current && onTranscript) {
        lastTranscriptRef.current = newlyFinalized;
        onTranscript(newlyFinalized);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, isListening, language, continuous, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null; // clear FIRST so onend doesn't auto-restart
      r.stop();
    }
    lastTranscriptRef.current = ''; // reset dedup guard for next session
    setIsListening(false);
  }, []);

  return { isListening, isSupported, startListening, stopListening, error };
}
