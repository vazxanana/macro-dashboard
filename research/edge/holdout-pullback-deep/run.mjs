// research/edge/holdout-pullback-deep/run.mjs - the end of an H4 pullback, taken only after the pullback reached the 50 %
// line of the H4 move (PREREGISTRATION.md, 23 Nov 2026). Judged on the untouched holdout only. Research only: nothing live
// reads it. Candles from the overnight toolkit's cache (research/edge/_lib/edgekit.mjs).
//   node research/edge/holdout-pullback-deep/run.mjs   harness gate, then the holdout run; writes result.json, trades.json, RESULT.md
// The rule = research/edge/h4-pullback-end/run.mjs `candidates` (imported, pinned by hash) with one change in the location
// step: only the external branch (pullback extreme P at or past M = (O + X) / 2, entry close at or below M for buys, mirrored
// for sells). The internal-range fallback gives no trade. One position at a time per market.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as H from '../h4-pullback-end/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
export const PIN = { 'research/edge/h4-pullback-end/run.mjs': 'c7abd9c768f0821b' };
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
// entry windows of the two holdout sets; candles past a set's end are read only to close a trade opened inside it
export const SETS = {
  A: { name: 'Set A: 2005-2009, five main markets', markets: K.MARKETS, from: D('2005-01-01'), to: D('2010-01-01'), loadFrom: '2005-01-01', loadTo: '2010-01-15' },
  B: { name: 'Set B: 2010 on, five fresh markets', markets: K.HOLDOUT_MARKETS, from: D('2010-01-01'), to: D('2100-01-01'), loadFrom: '2009-01-01', loadTo: null },
};
export const FAMILY = ['holdout-vb-early', 'holdout-pullback-deep', 'holdout-phase-pick', 'holdout-h1-veto', 'holdout-weekly-fade'];

export function pinsOk(root = ROOT) {
  const out = {};
  for (const [f, h] of Object.entries(PIN)) {
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 16);
    out[f] = { want: h, got, ok: got === h };
  }
  return out;
}

// the rule: external branch only; `internal` = the trades the removed fallback would have taken (comparison only)
export const isDeep = (x) => x.loc && x.range === 'external';
export function runMarket(bars5, market, opts = {}) {
  const c = H.candidates(bars5, market, opts);
  return { kept: H.oneAtATime(c.filter(isDeep)), internal: H.oneAtATime(c.filter((x) => x.loc && x.range === 'internal')) };
}

const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
// month sums by exit month, empty months inside the span (first to last exit month) as 0: the toolkit's own rule
export function monthSums(trades, key) {
  const m = new Map(); for (const x of trades) { const k = monthKey(x.exitT); m.set(k, (m.get(k) || 0) + x[key]); }
  if (!m.size) return [];
  const ks = [...m.keys()].sort(); const [y0, m0] = ks[0].split('-').map(Number), [y1, m1] = ks[ks.length - 1].split('-').map(Number);
  const out = []; for (let y = y0, mo = m0; y < y1 || (y === y1 && mo <= m1); mo === 12 ? (y++, (mo = 1)) : mo++) {
    const k = `${y}-${String(mo).padStart(2, '0')}`; out.push(m.get(k) || 0); }
  return out;
}
function moments(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, t: null, p: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  return { n, mean, t, p: t == null ? null : K.pFromT(t, n - 1) };
}
export const oneSided = H.oneSided;
// one stream's summary: per set (toolkit stats) and pooled (each set's own month sums, joined)
export function summary(trades, key) {
  const sets = {};
  const months = [];
  for (const [k, s] of Object.entries(SETS)) {
    const xs = trades.filter((x) => x.set === k);
    const st = K.stats(xs, { key, time: 'exitT' });
    sets[k] = { n: st.n, wins: st.wins, meanR: r4(st.meanR), total: r4(st.total), months: st.months, tMonth: r4(st.tMonth), maxDD: r4(st.maxDD) };
    months.push(...monthSums(xs, key));
  }
  const all = trades.map((x) => x[key]);
  const mt = moments(months), tr = moments(all);
  const pooled = { n: tr.n, wins: all.filter((v) => v > 0).length, meanR: r4(tr.mean), total: r4(all.reduce((a, b) => a + b, 0)), tTrade: r4(tr.t),
    months: mt.n, tMonth: r4(mt.t), pOne: r4(oneSided(mt.t, mt.p)) };
  return { sets, pooled };
}
export function block(trades) { return { net: summary(trades, 'Rnet'), net2x: summary(trades, 'Rnet2'), gross: summary(trades, 'R') }; }

// the five pass lines; holmP may be null (family results not all in yet)
export function verdictOf(b, holmP) {
  const n = b.net.pooled.n;
  const lines = {
    setAMean: b.net.sets.A.meanR > 0, setBMean: b.net.sets.B.meanR > 0, pooledT: b.net.pooled.tMonth >= 2,
    holm: holmP == null ? null : holmP < 0.05, n100: n >= 100, x2Mean: b.net2x.pooled.meanR > 0,
  };
  if (!(n >= 100)) return { lines, verdict: 'INCONCLUSIVE', why: 'fewer than 100 pooled holdout trades' };
  const known = Object.entries(lines).filter(([, v]) => v === false);
  if (known.length) return { lines, verdict: 'FAIL', why: 'lines missed: ' + known.map(([k]) => k).join(', ') };
  if (lines.holm == null) return { lines, verdict: 'PENDING', why: 'every other line holds; the five-study Holm needs the other results' };
  return { lines, verdict: 'PASS', why: 'every line holds' };
}
// Holm over the family from the siblings' result.json (primary one-sided p); null when one is missing
export function familyHolm(myP, dir = path.dirname(HERE)) {
  const ps = [], have = {};
  for (const s of FAMILY) {
    if (s === 'holdout-pullback-deep') { ps.push(myP); have[s] = myP; continue; }
    const f = path.join(dir, s, 'result.json');
    let p = null;
    if (fs.existsSync(f)) { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); p = j.primaryP ?? j.primary?.pOne ?? j.primary?.p ?? null; } catch { p = null; } }
    have[s] = p; ps.push(p);
  }
  const complete = ps.every((p) => Number.isFinite(p));
  const h = complete ? K.holm(ps) : null;
  return { have, complete, holmP: complete ? r4(h[1]) : null, bound: r4(Math.min(1, 5 * myP)) };
}

// harness gate: the original rule (internal branch kept) on 2010-2026, five main markets, against h4-pullback-end/result.json
export function gate() {
  const ref = JSON.parse(fs.readFileSync(path.join(HERE, '../h4-pullback-end/result.json'), 'utf8')).tests[0].windows;
  const trades = [];
  for (const m of K.MARKETS) trades.push(...H.runMarket(K.load(m, '5m', { from: '2010-01-01' }), m).kept);
  const got = H.block(trades.filter((x) => x.entryT >= H.W.rep[0]));
  const rows = {};
  let ok = true;
  for (const k of ['rep', 'is', 'oos']) {
    const a = ref[k].net, b = got[k].net;
    const nOk = Math.abs(b.n - a.n) <= 0.02 * a.n, rOk = Math.abs(b.meanR - a.meanR) <= 0.01;
    rows[k] = { refN: a.n, n: b.n, refMeanR: a.meanR, meanR: b.meanR, ok: nOk && rOk };
    ok = ok && nOk && rOk;
  }
  return { ok, rows, note: 'code check only; 2010-2026 on the five main markets is not holdout data and is not part of the verdict' };
}

export function runHoldout() {
  const kept = [], internal = [], perMarket = {};
  for (const [k, s] of Object.entries(SETS)) for (const m of s.markets) {
    const bars5 = K.load(m, '5m', { from: s.loadFrom, to: s.loadTo ?? undefined });
    const r = runMarket(bars5, m);
    const inSet = (x) => x.entryT >= s.from && x.entryT < s.to;
    const a = r.kept.filter(inSet).map((x) => ({ ...x, set: k })), b = r.internal.filter(inSet).map((x) => ({ ...x, set: k }));
    kept.push(...a); internal.push(...b);
    perMarket[k + ':' + m] = { first: bars5.length ? new Date(bars5[0].t * 1000).toISOString().slice(0, 10) : null, kept: a.length, internal: b.length };
    console.error(k, m, a.length, b.length);
  }
  const srt = (xs) => xs.sort((p, q) => p.entryT - q.entryT);
  return { kept: srt(kept), internal: srt(internal), perMarket };
}

const f = (v, d = 3) => (v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const ft = (v) => (v == null ? '-' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
function detail(trades) {
  const byMarket = {}, byYear = {}, byReason = {}, bySide = {};
  for (const x of trades) {
    const add = (o, k) => { const g = (o[k] ||= { n: 0, R: 0, Rnet: 0 }); g.n++; g.R += x.R; g.Rnet += x.Rnet; };
    add(byMarket, x.set + ':' + x.market); add(byYear, new Date(x.entryT * 1000).getUTCFullYear()); add(byReason, x.reason); add(bySide, x.side > 0 ? 'buy' : 'sell');
  }
  for (const o of [byMarket, byYear, byReason, bySide]) for (const g of Object.values(o)) { g.meanR = r4(g.R / g.n); g.meanRnet = r4(g.Rnet / g.n); g.R = r4(g.R); g.Rnet = r4(g.Rnet); }
  return { byMarket, byYear, byReason, bySide };
}

export function report(res) {
  const L = [], p = res.primary.net, s = p.sets;
  L.push('# The end of an H4 pullback, only after a pullback past the 50 % line: holdout result (23 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.headline}`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any holdout candle was read for this study); run once by `run.mjs` on the',
    'toolkit\'s OANDA mid 5m cache. R after the toolkit\'s round-trip costs unless said (Set B costs are ASSUMED, not measured); t on',
    'calendar-month sums by exit month, each set\'s own months joined; p one-sided (mean > 0).', '');
  L.push('| Stream | n | R a trade after costs | month t | at 2x costs | before costs |', '|---|---|---|---|---|---|');
  const row = (name, b, k) => { const g = k ? b.net.sets[k] : b.net.pooled; const g2 = k ? b.net2x.sets[k] : b.net2x.pooled; const g0 = k ? b.gross.sets[k] : b.gross.pooled;
    return `| ${name} | ${g.n} | ${f(g.meanR)} | ${ft(g.tMonth)} | ${f(g2.meanR)} | ${f(g0.meanR)} |`; };
  L.push(row('Rule, Set A (2005-2009, five main markets)', res.primary, 'A'), row('Rule, Set B (2010 on, five fresh markets)', res.primary, 'B'),
    row('**Rule, pooled holdout (primary)**', res.primary, null), row('Removed internal branch, pooled (comparison)', res.internal, null),
    row('Gold alone (Set A)', res.gold, null), row('Forex alone (both sets)', res.forex, null), row('Silver alone (Set B)', res.silver, null));
  L.push('', `Primary: one-sided p ${ft(p.pooled.pOne)}; Holm over the five holdout studies ${res.holm.complete ? ft(res.holm.holmP) : 'not yet computable (' + Object.entries(res.holm.have).filter(([, v]) => v == null).map(([k]) => k).join(', ') + ' missing); it is at most ' + ft(res.holm.bound)}.`);
  L.push('', 'Pass lines: ' + Object.entries(res.lines).map(([k, v]) => `${k} ${v == null ? 'pending' : v ? 'yes' : 'no'}`).join(', ') + '.');
  L.push('', `Deep against internal (pooled holdout, after costs): ${f(res.welch.diff)}R a trade, Welch t ${ft(res.welch.t)} (n ${res.welch.na} / ${res.welch.nb}). Reported only.`);
  L.push('', '## Per market, R a trade after costs (n)', '', Object.entries(res.detail.byMarket).map(([k, g]) => `${k} ${f(g.meanRnet)} (${g.n})`).join(' · '));
  L.push('', '## By entry year, R a trade after costs (n)', '', Object.entries(res.detail.byYear).map(([k, g]) => `${k} ${f(g.meanRnet)} (${g.n})`).join(' · '));
  L.push('', '## Exits and sides', '', Object.entries(res.detail.byReason).map(([k, g]) => `${k} ${g.n} (${f(g.meanR, 2)}R before costs)`).join(', ') + '; ' +
    Object.entries(res.detail.bySide).map(([k, g]) => `${k}s ${f(g.meanRnet)}R after costs (n ${g.n})`).join(', ') + '.');
  L.push('', '## Harness gate', '', `The original rule (internal branch kept) re-run on 2010-2026, five main markets: ${res.gate.ok ? 'reproduced' : 'MISSED'} ` +
    Object.entries(res.gate.rows).map(([k, r]) => `${k} n ${r.n} / ${r.refN}, ${f(r.meanR)} / ${f(r.refMeanR)}R`).join('; ') + '. A code check only, not part of the verdict.');
  L.push('', '## What it does NOT show', '',
    '- One mechanical reading (3-candle swings, the toolkit\'s structure), not the owner\'s reading on a chart; no variant was tried.',
    '- Set B costs are assumed round trips; financing is not charged; stop slippage beyond a gap is not modelled.',
    '- Set A trades opened in late December 2009 are closed on candles of the first half of January 2010 (exit only).',
    '- The deep/internal split that suggested this rule came from 2024-2026 on the main markets; that data does not judge it.',
    '- A FAIL is about this rule on this holdout; it does not judge discretionary trades.', '');
  L.push('Nothing live changed. Files: result.json (every number), trades.json (rule and comparison trades), tests/holdout-pullback-deep.test.mjs.');
  return L.join('\n') + '\n';
}

export function main() {
  const pins = pinsOk();
  const pinOk = Object.values(pins).every((x) => x.ok);
  const g = gate();
  console.error('gate', JSON.stringify(g.rows));
  const H0 = runHoldout();
  const kept = H0.kept;
  const primary = block(kept), internal = block(H0.internal);
  const gold = block(kept.filter((x) => x.market === 'xau')), silver = block(kept.filter((x) => x.market === 'xag'));
  const forex = block(kept.filter((x) => x.market !== 'xau' && x.market !== 'xag'));
  const pOne = primary.net.pooled.pOne ?? 1;
  const holm = familyHolm(pOne);
  let v = verdictOf(primary, holm.holmP);
  if (!pinOk || !g.ok) v = { ...v, verdict: 'INCONCLUSIVE', why: !pinOk ? 'pinned module hash differs' : 'harness gate missed' };
  const w = H.welch(kept.map((x) => x.Rnet), H0.internal.map((x) => x.Rnet));
  const welch = { t: r4(w.t), df: r4(w.df), p: r4(w.p), diff: r4(w.diff), na: w.na, nb: w.nb };
  const P0 = primary.net;
  const headline = `Pooled holdout ${f(P0.pooled.meanR)}R a trade after costs (n ${P0.pooled.n}, month t ${ft(P0.pooled.tMonth)}, one-sided p ${ft(P0.pooled.pOne)}); `
    + `Set A ${f(P0.sets.A.meanR)}R (n ${P0.sets.A.n}), Set B ${f(P0.sets.B.meanR)}R (n ${P0.sets.B.n}); at 2x costs ${f(primary.net2x.pooled.meanR)}R; before costs ${f(primary.gross.pooled.meanR)}R. ${v.why[0].toUpperCase() + v.why.slice(1)}.`;
  const res = { study: 'holdout-pullback-deep', built: '2026-11-23', verdict: v.verdict, why: v.why, headline, primaryP: r4(pOne),
    lines: v.lines, holm, pins, gate: g, sets: Object.fromEntries(Object.entries(SETS).map(([k, s]) => [k, { name: s.name, markets: s.markets, from: s.from, to: s.to }])),
    costs: K.COSTS, params: H.P, perMarket: H0.perMarket, primary, internal, gold, forex, silver, welch, detail: detail(kept) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const cols = ['stream', 'set', 'market', 'side', 'signalT', 'entryT', 'entry', 'planned', 'stop', 'target', 'exitT', 'exit', 'reason', 'R', 'Rnet', 'Rnet2', 'O', 'X', 'P'];
  const p7 = (x) => +x.toPrecision(7);
  const rows = [];
  for (const [name, xs] of [['rule', kept], ['internal', H0.internal]]) for (const x of xs)
    rows.push([name, x.set, x.market, x.side, x.signalT, x.entryT, p7(x.entry), p7(x.planned), p7(x.stop), p7(x.target), x.exitT, p7(x.exit), x.reason,
      +x.R.toFixed(4), +x.Rnet.toFixed(4), +x.Rnet2.toFixed(4), p7(x.O), p7(x.X), p7(x.P)]);
  const tj = { cols, note: 'times unix s UTC; signalT = close of the H1 entry candle; entry = filled price (next 5m open); R before costs, Rnet after 1x, Rnet2 after 2x costs; rule = the pre-registered stream, internal = the removed branch (comparison only)', rows };
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(tj).replace(/\],\[/g, '],\n[') + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(res.verdict, headline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
