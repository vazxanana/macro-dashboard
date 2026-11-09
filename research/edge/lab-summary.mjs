// The Edge lab's one-file summary (9 Nov 2026, performance pass): /edge-lab.html used to download every study's full
// result.json on each load and again every two minutes (about 7 MB decoded, 57 requests). `slimStudy` keeps exactly the
// fields the page reads (system, variantsTried, verdict, best, baseline, years, notes and per candidate rule / verdict /
// IS and OOS stats / years); research/edge/build.mjs writes them for every study into <out>/research/edge/lab.json.
// The full result.json files are still published for "Open raw" and anything else that reads them.
const STAT = ['exp', 'R', 'n', 'wr', 'maxDD', 't'];
const VKEYS = ['verdict', 'primary', 'label', 'status', 'decision'];
const pick = (o, keys) => { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };
const obj = (o) => o && typeof o === 'object' && !Array.isArray(o);

function stat(s) { return obj(s) ? pick(s, STAT) : undefined; }
function years(y) {
  if (!y || typeof y !== 'object') return undefined;
  const one = (s) => (typeof s === 'number' || typeof s === 'string') ? s : obj(s) ? pick(s, ['year', 'y', ...STAT]) : null;
  if (Array.isArray(y)) return y.map(one).filter((s) => s != null);
  const r = {}; for (const k of Object.keys(y)) { const s = one(y[k]); if (s != null) r[k] = s; } return r;
}
function verdict(v) { return obj(v) ? pick(v, VKEYS) : v; }
function side(b) {
  if (!obj(b)) return undefined;
  const r = {}; if (b.is) r.is = stat(b.is); if (b.oos) r.oos = stat(b.oos); if (b.years) r.years = years(b.years); return r;
}
export function slimCandidate(c) {
  if (!obj(c)) return c;
  const r = {}; if (c.rule != null) r.rule = c.rule; if (c.verdict !== undefined) r.verdict = verdict(c.verdict);
  if (c.is) r.is = stat(c.is); if (c.oos) r.oos = stat(c.oos); if (c.years) r.years = years(c.years); return r;
}
function baseline(bl) {
  if (!obj(bl)) return undefined;
  if (bl.is || bl.oos) return side(bl);
  const r = {}; for (const k of Object.keys(bl)) { const v = bl[k]; if (obj(v) && (v.is || v.oos)) r[k] = side(v); } return r;
}
export function slimStudy(d) {
  if (!obj(d)) return {};
  const r = {};
  if (d.system != null) r.system = d.system;
  if (d.variantsTried != null) r.variantsTried = d.variantsTried;
  if (d.verdict !== undefined) r.verdict = verdict(d.verdict);
  if (Array.isArray(d.candidates)) r.candidates = d.candidates.map(slimCandidate);
  if (d.best != null) r.best = obj(d.best) ? slimCandidate(d.best) : d.best;
  if (d.baseline) r.baseline = baseline(d.baseline);
  if (d.years) r.years = years(d.years);
  if (d.notes) r.notes = d.notes;
  return r;
}
