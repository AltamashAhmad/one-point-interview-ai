import { formatDate, friendlyModelName, modelProviderColor } from './constants';

describe('Constants Utilities', () => {
  describe('formatDate', () => {
    it('should format a valid date string correctly', () => {
      // Using a fixed date so test doesn't fail based on timezone
      const date = new Date('2026-05-29T12:00:00Z');
      const formatted = formatDate(date.toISOString());
      expect(formatted).toMatch(/May 29, 2026/);
    });

    it('should return "Unknown date" for invalid input', () => {
      expect(formatDate(null)).toBe('Unknown date');
      expect(formatDate(undefined)).toBe('Unknown date');
      expect(formatDate('invalid-date-string')).toBe('Unknown date');
    });
  });

  describe('friendlyModelName', () => {
    it('should map known models correctly', () => {
      expect(friendlyModelName('llama-3.1-8b-instant')).toBe('Llama 3.1 8B');
      expect(friendlyModelName('gemini-3.1-flash-lite')).toBe('Gemini 3.1 Flash Lite');
    });

    it('should fallback to the raw model ID if unknown', () => {
      expect(friendlyModelName('unknown-model-xyz')).toBe('unknown-model-xyz');
    });
  });

  describe('modelProviderColor', () => {
    it('should return orange for llama models (Groq provider)', () => {
      expect(modelProviderColor('llama-3.1-8b-instant')).toBe('#f97316');
    });

    it('should return blue for gemini models', () => {
      expect(modelProviderColor('gemini-3.1-flash-lite')).toBe('#8b5cf6');
    });

    it('should default to gray for unknown models', () => {
      expect(modelProviderColor('unknown-model')).toBe('#64748b');
    });
  });
});
