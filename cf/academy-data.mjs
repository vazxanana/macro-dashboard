// The Academy's generated files on Cloudflare (15 Nov 2026). On Vercel api/academy.js reads academy/data/*.json from disk; a
// Worker has no disk, and these files hold trade OUTCOMES that must never be public (no look-ahead: an outcome leaves the API
// only after an attempt is stored), so they are NOT in the site's assets. The deploy workflow uploads them to the private R2
// bucket under academy-data/ (same file names; ml/models/index.json as academy-data/ml-index.json), and this reader hands them
// to api/academy.js through its `d.data` hook (the same hook its tests use). Parsed once per Worker instance.
import { EDGES } from '../academy/edges.mjs';
export const PREFIX = 'academy-data/';
export function academyData(bucket) {
  const cache = new Map();
  const json = async (name) => {
    if (cache.has(name)) return cache.get(name);
    const o = bucket ? await bucket.get(PREFIX + name) : null;
    const v = o ? JSON.parse(await o.text()) : null;
    cache.set(name, v); return v;
  };
  return {
    async edges() { return EDGES || json('edges.json'); },
    candidates: (e) => json(`cand-${e}.json`), outcomes: (e) => json(`out-${e}.json`), features: (e) => json(`feat-${e}.json`),
    calendar: () => json('calendar.json'), research: () => json('research.json'), evaluation: () => json('eval.json'),
    training: () => json('ml-index.json'),
  };
}
