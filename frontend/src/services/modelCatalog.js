import { useEffect, useSyncExternalStore } from 'react';
import { getMeta } from './api';
import { AVAILABLE_MODELS } from './modelList';

// Icon name per provider (replaces the per-model emoji in the catalogue).
export const PROVIDER_ICON = { groq: 'bolt', gemini: 'sparkles', openrouter: 'shield' };

// Starts with the bundled list so the UI works offline; replaced by GET /api/meta once loaded.
let state = { models: AVAILABLE_MODELS, defaultModelId: AVAILABLE_MODELS[0].id, loaded: false };
let inflight = null;
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function loadModels() {
  if (inflight) return inflight;
  inflight = getMeta()
    .then((meta) => {
      if (Array.isArray(meta?.models) && meta.models.length > 0) {
        state = { models: meta.models, defaultModelId: meta.defaults?.chat || meta.models[0].id, loaded: true };
        emit();
      }
      return state;
    })
    .catch(() => {
      inflight = null;
      return state;
    });
  return inflight;
}

/** Looks in the live list first, then the bundled list (for old sessions). */
export function findModel(id) {
  return state.models.find((m) => m.id === id) || AVAILABLE_MODELS.find((m) => m.id === id) || null;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: current models + default, loading the live catalogue on first use. */
export function useModels() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    loadModels();
  }, []);
  return snapshot;
}
