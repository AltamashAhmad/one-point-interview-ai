/**
 * Minimal in-memory stand-in for firebase-admin's Firestore, enough for route tests.
 * Supports doc get/set/update (incl. dotted paths)/delete, where('==') queries and select().
 */
function createFakeFirestore() {
  const collections = new Map();
  let autoId = 0;

  const table = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };

  const clone = (value) => (value === undefined ? undefined : structuredClone(value));

  // Real Firestore rejects these values, so fail loudly here too.
  function assertStorable(value, path = 'data') {
    if (value === undefined) throw new Error(`Cannot use undefined as a Firestore value (${path})`);
    if (typeof value === 'function') throw new Error(`Cannot store a function in Firestore (${path})`);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      for (const [k, v] of Object.entries(value)) assertStorable(v, `${path}.${k}`);
    }
  }

  function snapshot(name, id) {
    const data = table(name).get(id);
    return {
      id,
      exists: data !== undefined,
      ref: docRef(name, id),
      data: () => clone(data),
      get: (field) => data?.[field],
    };
  }

  function docRef(name, id = `auto${++autoId}`) {
    return {
      id,
      get: async () => snapshot(name, id),
      set: async (data) => { assertStorable(data); table(name).set(id, clone(data)); },
      update: async (patch) => {
        assertStorable(patch);
        const current = table(name).get(id);
        if (!current) throw new Error(`No document to update: ${name}/${id}`);
        for (const [key, value] of Object.entries(patch)) {
          const path = key.split('.');
          let target = current;
          path.slice(0, -1).forEach((p) => { target[p] = target[p] || {}; target = target[p]; });
          target[path[path.length - 1]] = clone(value);
        }
      },
      delete: async () => { table(name).delete(id); },
    };
  }

  function query(name, filters = []) {
    return {
      where: (field, op, value) => query(name, [...filters, [field, value]]),
      select: () => query(name, filters),
      limit: () => query(name, filters),
      get: async () => {
        const docs = [...table(name).entries()]
          .filter(([, data]) => filters.every(([f, v]) => data[f] === v))
          .map(([id]) => snapshot(name, id));
        return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
      },
    };
  }

  const db = {
    collection: (name) => ({
      doc: (id) => docRef(name, id),
      add: async (data) => { const ref = docRef(name); await ref.set(data); return ref; },
      ...query(name),
    }),
    batch: () => {
      const ops = [];
      return { update: (ref, patch) => ops.push(() => ref.update(patch)), commit: async () => { for (const op of ops) await op(); } };
    },
    // Single-process fake: reads happen immediately, writes are applied only if the callback succeeds.
    runTransaction: async (fn) => {
      const writes = [];
      const tx = {
        get: (ref) => ref.get(),
        update: (ref, patch) => { writes.push(() => ref.update(patch)); },
        set: (ref, data) => { writes.push(() => ref.set(data)); },
      };
      const result = await fn(tx);
      for (const write of writes) await write();
      return result;
    },
  };

  return { db, tables: collections, seed: (name, id, data) => table(name).set(id, clone(data)) };
}

module.exports = { createFakeFirestore };
