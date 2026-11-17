// The Academy's generated files on a host with no project files (the Cloudflare Worker).
// api/academy.js fileData() reads them from disk on Node and Vercel; here the same files arrive bundled as text
// (./bundled.mjs, wrangler.jsonc `rules`) and are read the same way: one method per file, null for a file that is not
// there, each file parsed once per instance and only when a request asks for it (the Academy is the owner's alone, so
// no other route pays for parsing about 2.5 MB of JSON).
// The rules of the Academy are the API's and do not change here: outcomes (out-*.json) leave api/academy.js only after an
// attempt is stored, the exam pool is decided by each candidate's own `pool`, and nothing of academy/archive/ is bundled.

// Every file fileData() can read, for the given edge registry (the test checks ./bundled.mjs imports each one).
export const ACADEMY_COMMON = ['academy/data/calendar.json', 'academy/data/research.json', 'academy/data/eval.json', 'ml/models/index.json'];
export const academyFiles = (edges) => [...ACADEMY_COMMON, ...edges.flatMap((e) => ['cand', 'out', 'feat'].map((k) => `academy/data/${k}-${typeof e === 'string' ? e : e.id}.json`))];

// texts: { '<repo path>': JSON text (or an already parsed value) }; edges: the registry (academy/edges.mjs EDGES).
export function bundledData(texts, edges = null) {
  const parsed = new Map();
  const json = (f) => {
    if (parsed.has(f)) return parsed.get(f);
    const raw = Object.prototype.hasOwnProperty.call(texts, f) ? texts[f] : null;
    const v = raw == null ? null : typeof raw === 'string' ? JSON.parse(raw) : raw;
    parsed.set(f, v);
    return v;
  };
  return {
    async edges() { return edges || json('academy/data/edges.json'); },
    async candidates(edge) { return json(`academy/data/cand-${edge}.json`); },
    async outcomes(edge) { return json(`academy/data/out-${edge}.json`); },
    async features(edge) { return json(`academy/data/feat-${edge}.json`); },
    async calendar() { return json('academy/data/calendar.json'); },
    async research() { return json('academy/data/research.json'); },
    async evaluation() { return json('academy/data/eval.json'); },
    async training() { return json('ml/models/index.json'); },
  };
}
