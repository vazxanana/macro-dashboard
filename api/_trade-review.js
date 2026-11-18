// The trade reviewer's language-model part (17 Nov 2026, owner: "add an AI to check the actual trades and help the edge bots to
// trade better"). Module, not an endpoint (api/trade-review.js is the endpoint).
//
// What it does: council/trade-review.mjs writes council-data research/trade-review.json, the after-the-fact check of the trades
// the council took (per stream: n, win rate, R before and after costs, t, where the R goes, costs, demo slippage, splits) with
// FLAGS (each with n and t) and a rule-based review with proposals. This module turns that file, plus the latest closed trades
// it carries, into one request for the language model and checks the answer in code:
//   - the model writes a plain-language review per stream and may PROPOSE changes, but every proposal must name one of the
//     file's own flag ids; one that does not is dropped, never shown;
//   - the evidence (n, t, p, Holm, the in-sample warning) and the pre-registered test of a proposal are copied from the file, never
//     from the model's text, so no number on the page is the model's;
//   - nothing is applied: proposals only (absolute rule 3). ICT is not in the file and never in the request.
// Without a key the endpoint answers "off" and the page shows the rule-based review of the file alone. The adapter is the
// Academy's (api/_academy-llm.js: same key, endpoint, model and format settings) with this feature's own budgets and store.
'use strict';

const MAX_STREAMS = 16, MAX_RECENT = 12, MAX_FLAGS = 40;
const LIM = { overview: 700, review: 900, item: 240, items: 4, proposals: 3, change: 220, why: 400 };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');

const SYSTEM = [
  'You review the after-the-fact record of a PAPER trading desk (paper and demo accounts only; no real money).',
  'You get a JSON file the desk computed from its own closed trades, grouped in streams (one system in one book: live, shadow or research paper).',
  'Every figure you may rely on is in that file. Do not invent numbers, trades, markets or rules. Use R (risk units) as the file does.',
  'The patterns in the file were found by looking at these same trades: they are in sample and prove nothing on their own. Say so where it matters.',
  'Your job: for each stream you are given, write a short plain review (what is working, what is losing R and why) and, where a flag supports it, propose a concrete change.',
  'A proposal MUST name exactly one flag id from that stream\'s "flags" list as its evidence. A proposal without a valid flag id is discarded.',
  'A stream may carry "forwardChecks": the desk\'s own earlier proposals re-measured only on trades closed after they were recorded. Do not propose again a flag whose forward check is "faded"; such a proposal is discarded. "held" is a second small sample, not proof.',
  'Proposals are only suggestions for the owner; nothing is applied. Never suggest a live account, removing a stop or moving a stop further away.',
  'Answer with ONE JSON object and nothing else, in this shape:',
  '{"overview":"2-4 sentences","streams":[{"key":"<stream key>","review":"2-4 sentences","working":["..."],"losing":["..."],"proposals":[{"flag":"<flag id>","change":"one sentence","why":"one or two sentences"}]}]}',
].join('\n');

// the streams worth a model's time: live first, then by size; only those with 5+ closed trades or a flag
function pick(review) {
  const S = Array.isArray(review && review.systems) ? review.systems : [];
  const rank = (s) => (s.book === 'live' ? 0 : s.book === 'shadow' ? 1 : 2);
  return S.filter((s) => s && s.windows && s.windows.all && (s.windows.all.n >= 5 || (s.flags || []).length))
    .sort((a, b) => rank(a) - rank(b) || b.windows.all.n - a.windows.all.n).slice(0, MAX_STREAMS);
}
const W = (w) => (w ? { n: w.n, winRate: w.winRate, grossSum: w.gross && w.gross.sum, netSum: w.net && w.net.sum, netMean: w.net && w.net.mean, netT: w.net && w.net.t, costPerTrade: w.cost && w.cost.perTrade, costKnown: w.cost && w.cost.known } : null);
// the ledger's forward checks by stream key, and the flag ids whose proposal faded forward (17 Nov 2026)
function ledgerItems(review) { return review && review.ledger && Array.isArray(review.ledger.items) ? review.ledger.items : []; }
function fadedFlags(review) { return new Set(ledgerItems(review).filter((x) => x && x.forward && x.forward.status === 'faded').map((x) => x.flag)); }
function buildRequest(review) {
  const flags = new Map((review.flags || []).map((f) => [f.id, f])), led = ledgerItems(review);
  const streams = pick(review).map((s) => ({
    key: s.key, name: s.name, book: s.book,
    last7: W(s.windows.d7), last30: W(s.windows.d30), all: W(s.windows.all),
    exits: s.whereR && s.whereR.exits, fastStops: s.whereR && s.whereR.fastStops && { n: s.whereR.fastStops.n, ofLosses: s.whereR.fastStops.ofLosses, net: s.whereR.fastStops.net },
    reached1R: s.whereR && s.whereR.reached1R, lock1R: s.whereR && s.whereR.lock1R && { n: s.whereR.lock1R.n, mean: s.whereR.lock1R.mean, t: s.whereR.lock1R.t },
    demoSlippage: s.slippage && { n: s.slippage.n, mean: s.slippage.mean, t: s.slippage.t },
    sessions: (s.splits && s.splits.session || []).map((b) => ({ v: b.v, n: b.n, mean: b.mean, t: b.t })),
    sides: (s.splits && s.splits.side || []).map((b) => ({ v: b.v, n: b.n, mean: b.mean, t: b.t })),
    lossReasons: s.reviews && s.reviews.tags, decay: s.decay && s.decay.status,
    flags: (s.flags || []).map((id) => flags.get(id)).filter(Boolean).slice(0, MAX_FLAGS).map((f) => ({ id: f.id, kind: f.kind, n: f.n, mean: f.mean, t: f.t, holm: f.holm == null ? null : f.holm, text: f.text })),
    recent: (s.recent || []).slice(-MAX_RECENT).map((x) => ({ market: x.market, side: x.side, exit: x.exit, R: x.R, net: x.net, mfe: x.mfe, session: x.session })),
    forwardChecks: led.filter((x) => x && x.stream === s.key && x.forward).slice(0, MAX_FLAGS).map((x) => ({ flag: x.flag, change: str(x.change, LIM.change), recorded: x.recorded, recordedT: x.evidence && x.evidence.t, status: x.forward.status, n: x.forward.n, t: x.forward.t })),
  }));
  const payload = { at: review.at, rule: review.rule, inSample: review.inSample, thresholds: review.thresholds, streams };
  return { system: SYSTEM, prompt: `The desk's trade review file (JSON):\n${JSON.stringify(payload)}\n\nAnswer with the JSON object only.`, payload };
}

function jsonOf(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
const list = (v) => (Array.isArray(v) ? v.map((x) => str(x, LIM.item)).filter(Boolean).slice(0, LIM.items) : []);
// the answer checked against the file: unknown streams and proposals without one of the stream's own flags are dropped; the
// evidence and the test come from the file's proposal for that flag (or the flag itself)
function parseAnswer(text, review) {
  const j = jsonOf(text); if (!j || typeof j !== 'object') return { ok: false, why: ['the answer is not a JSON object'] };
  const byKey = new Map((review.systems || []).map((s) => [s.key, s])), flags = new Map((review.flags || []).map((f) => [f.id, f]));
  const props = new Map((review.proposals || []).map((p) => [p.flag, p])), faded = fadedFlags(review);
  const out = [], why = []; let dropped = 0;
  for (const s of Array.isArray(j.streams) ? j.streams : []) {
    const S = s && byKey.get(s.key); if (!S) { if (s && s.key) why.push(`unknown stream ${str(s.key, 60)}`); continue; }
    const own = new Set(S.flags || []), P = [];
    for (const p of Array.isArray(s.proposals) ? s.proposals : []) {
      const f = p && flags.get(p.flag);
      if (!f || !own.has(p.flag) || faded.has(f.id) || !str(p.change, LIM.change)) { dropped++; continue; }   // a faded idea is not proposed again
      if (P.length >= LIM.proposals) break;
      const base = props.get(f.id);
      P.push({ flag: f.id, change: str(p.change, LIM.change), why: str(p.why, LIM.why),
        evidence: base ? base.evidence : { n: f.n, mean: f.mean, t: f.t, ...(f.p != null ? { p: f.p } : {}), holm: f.holm == null ? null : f.holm, inSample: true, warning: review.inSample },
        test: base ? base.test : { question: `Does the pattern of flag ${f.id} hold out of sample?`, ...(review.test || {}) }, strong: !!(base && base.strong),
        ...(base && base.forward ? { forward: base.forward } : {}) });
    }
    if (out.some((x) => x.key === S.key)) continue;
    out.push({ key: S.key, name: S.name, book: S.book, review: str(s.review, LIM.review), working: list(s.working), losing: list(s.losing), proposals: P });
  }
  if (!out.length) return { ok: false, why: why.length ? why : ['no stream of the file was reviewed'] };
  return { ok: true, answer: { overview: str(j.overview, LIM.overview), streams: out, dropped } };
}

module.exports = { SYSTEM, MAX_STREAMS, pick, buildRequest, parseAnswer, jsonOf, fadedFlags };
