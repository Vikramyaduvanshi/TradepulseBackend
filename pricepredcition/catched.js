const store = new Map();      // key -> { value, exp }
const inflight = new Map();   // key -> Promise

// ttl ke andar cache se, ek hi time par ek hi fetch, fail hone par purana value
async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await fn();
      if (value !== null && value !== undefined) store.set(key, { value, exp: Date.now() + ttlMs });
      return value;
    } catch (err) {
      if (hit) return hit.value;     // purana data de do, error nahi
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

module.exports = { cached };