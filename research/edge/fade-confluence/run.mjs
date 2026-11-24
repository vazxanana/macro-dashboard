// Fade confluence (pre-registered, PREREGISTRATION.md): when two or three of the five Equinox fade / gap rules signal the same
// market and side within 30 minutes, one trade at the later signal with the stricter stop, 1R, 1 day; after costs.
// Each rule's own signal code through the Equinox desks' adapters (council/edge-desks-2.mjs, read only).
//   node research/edge/fade-confluence/run.mjs market <market> <outdir>
//   node research/edge/fade-confluence/run.mjs report <outdir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { fadeTrades, bigTrades, roundTrades, boxTrades, fvgTrades, walk, toK, STUDY_MARKETS } from '../../../council/edge-desks-2.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = STUDY_MARKETS;
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const RULES = ['fade', 'bigfade', 'roundfade', 'boxfade', 'fvg'];
const GEN = { fade: fadeTrades, bigfade: bigTrades, roundfade: roundTrades, boxfade: boxTrades, fvg: fvgTrades };
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);   // fills 2005-01-01 .. 2026-10-31
export const NM = 262, DM = 120;                                     // months 2005-01 .. 2026-10; discovery 120
export const W = 1800, CAP = 86400, RR = 1, KS = [2, 3], DRAWS = 1000;
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
export const winOf = (t) => (t < SPLIT ? 0 : 1);
const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// The counted members of a signal at fill time t, side s: the latest signal of each distinct rule with fill in [t - W, t].
// `members` sorted by t. Reads nothing after t.
export function countAt(members, i, w = W) {
  const x = members[i], by = new Map();
  for (let j = i; j >= 0 && members[j].t >= x.t - w; j--) { const m = members[j]; if (m.s !== x.s) continue; if (!by.has(m.rule) || by.get(m.rule).t < m.t) by.set(m.rule, m); }
  for (let j = i + 1; j < members.length && members[j].t === x.t; j++) { const m = members[j]; if (m.s === x.s && !by.has(m.rule)) by.set(m.rule, m); }
  return [...by.values()];
}
// the stricter stop: among the counted members' stops strictly on the losing side of the entry with risk >= cost, the nearest
export function stricterStop(s, entry, stops, cost) {
  let best = null; for (const st of stops) { const r = s * (entry - st); if (r > 0 && r >= cost && (best == null || r < s * (entry - best))) best = st; }
  return best;
}
// the confluence entries of one stream (k >= kMin), one position per side; exitOf(entry) -> { endT, R } or null (still open)
export function confluence(members, kMin, cost, exitOf) {
  const out = [], busy = { 1: -Infinity, '-1': -Infinity };
  for (let i = 0; i < members.length; i++) { const x = members[i]; if (x.t <= busy[x.s]) continue;
    const cnt = countAt(members, i); if (cnt.length < kMin) continue;
    const stop = stricterStop(x.s, x.entry, cnt.map((m) => m.stop), cost); if (stop == null) continue;
    const e = { t: x.t, s: x.s, fi: x.fi, entry: x.entry, stop, k: cnt.length, rules: cnt.map((m) => m.rule).sort().join('+') };
    const r = exitOf(e); if (!r) { busy[x.s] = Infinity; continue; }
    busy[x.s] = r.endT; out.push({ ...e, ...r }); }
  return out;
}

function runMarket(market) {
  const t0 = Date.now(); const raw = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const B = { '5m': raw.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c })) };
  const M5 = toK(B['5m']), cost = COSTS[market], X = exclusions(market);
  const members = [], own = {}; let dropped = 0;
  for (const rule of RULES) { own[rule] = [];
    for (const r of GEN[rule](B, { from: FROM, market })) { if (r.t < FROM || r.t >= TO) continue; if (X.length && inBad(X, r.t)) { dropped++; continue; }
      const risk = r.side * (r.entry - r.stop); if (!(risk > 0)) throw new Error('stop on the wrong side');
      if (r.R != null) own[rule].push([r.t, +r.R.toFixed(5), +(cost / risk).toFixed(5)]);
      members.push({ rule, t: r.t, s: r.side, entry: r.entry, stop: r.stop, fi: startIdx(M5, r.t) }); } }
  members.sort((a, b) => a.t - b.t || RULES.indexOf(a.rule) - RULES.indexOf(b.rule));
  const exitOf = (e) => { const risk = e.s * (e.entry - e.stop); const o = walk(M5, e.s, e.fi, e.entry, e.stop, e.entry + e.s * RR * risk, M5[e.fi].t + CAP);
    return !o || o.status === 'open' ? null : { endT: o.endT, R: +o.R.toFixed(5), cr: +(cost / risk).toFixed(5) }; };
  // single signals under the common exit (own stop): the control pool
  const single = []; for (const m of members) { const r = exitOf(m); if (r && m.s * (m.entry - m.stop) >= cost) single.push([m.t, RULES.indexOf(m.rule), r.R, r.cr]); }
  const streams = {}; for (const k of KS) streams[k] = confluence(members, k, cost, exitOf).map((e) => [e.t, e.s, e.k, e.rules, e.R, e.cr]);
  // cut test: entries known by a date, from members cut there (fill <= T), equal the full run's
  const cut = []; for (const c of ['2009-06-10', '2013-03-13', '2018-09-19', '2023-02-15']) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const key = (e) => [e.t, e.s, e.stop, e.k].join('|');
    const full = confluence(members, 2, cost, exitOf).filter((e) => e.t <= T && e.endT <= T).map(key);
    const part = confluence(members.filter((m) => m.t <= T), 2, cost, exitOf).filter((e) => e.t <= T && e.endT <= T).map(key);
    const A = new Set(part), Bs = new Set(full); cut.push({ cut: c, n: Bs.size, missing: [...Bs].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !Bs.has(k)).length }); }
  return { market, cost, assumed: ASSUMED.includes(market), members: members.length, byRule: Object.fromEntries(RULES.map((r) => [r, members.filter((m) => m.rule === r).length])),
    dropped, own, single, streams, cut, secs: Math.round((Date.now() - t0) / 1000) };
}

// ---- statistics ----
export function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return { months: n, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : 0 }; }
export const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
// rows [t, R, cr] -> per window { n, before, after, tMonth, p }
export function summarize(rows) {
  const ms = new Float64Array(NM), out = [];
  for (const [t, R, cr] of rows) ms[monthOf(t)] += R - cr;
  for (const w of [0, 1]) { const xs = rows.filter((r) => winOf(r[0]) === w), n = xs.length;
    const st = mstat(ms, w ? DM : 0, w ? NM : DM);
    const cr = xs.map((r) => r[2]).sort((a, b) => a - b);
    out.push({ n, before: n ? xs.reduce((a, r) => a + r[1], 0) / n : null, after: n ? xs.reduce((a, r) => a + r[1] - r[2], 0) / n : null,
      win: n ? xs.filter((r) => r[1] > 0).length / n : null, medCostR: n ? cr[n >> 1] : null, tMonth: +st.t.toFixed(2), p: p1(st.t, st.months - 1) }); }
  return out;
}

function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const tests = KS.map((k) => {
    const rows = data.flatMap((d) => d.streams[k].map((e) => [e[0], e[4], e[5]]));
    const S = summarize(rows);
    // control: per market and window, the same count of single signals, own stop, 1R, 1 day
    const ctl = [0, 1].map((w) => { const r = K.rng(1000 * k + w + 7), means = [];
      const plan = data.map((d) => ({ pool: d.single.filter((x) => winOf(x[0]) === w), n: d.streams[k].filter((e) => winOf(e[0]) === w).length }));
      for (let i = 0; i < DRAWS; i++) { let s = 0, n = 0; for (const p of plan) { if (!p.pool.length) continue; for (let j = 0; j < p.n; j++) { const x = p.pool[Math.floor(r() * p.pool.length)]; s += x[2] - x[3]; n++; } } means.push(n ? s / n : 0); }
      means.sort((a, b) => a - b); return { p50: +means[DRAWS >> 1].toFixed(4), p95: +means[Math.floor(0.95 * DRAWS)].toFixed(4), above: means.filter((m) => m >= S[w].after).length / DRAWS }; });
    const pairs = {}; for (const d of data) for (const e of d.streams[k]) { const key = e[3]; const w = winOf(e[0]); (pairs[key] ||= [[], []])[w].push([e[0], e[4], e[5]]); }
    const byRules = Object.entries(pairs).map(([rules, ws]) => ({ rules, d: ws[0].length, c: ws[1].length,
      cBefore: ws[1].length ? +(ws[1].reduce((a, x) => a + x[1], 0) / ws[1].length).toFixed(4) : null,
      cAfter: ws[1].length ? +(ws[1].reduce((a, x) => a + x[1] - x[2], 0) / ws[1].length).toFixed(4) : null })).sort((a, b) => b.c - a.c);
    const byMarket = data.map((d) => { const s = summarize(d.streams[k].map((e) => [e[0], e[4], e[5]])); return { market: d.market, d: s[0], c: s[1] }; });
    return { test: 'T' + k, k, discovery: S[0], confirmation: S[1], control: ctl, byRules, byMarket };
  });
  const adj = K.holm(tests.map((x) => x.confirmation.p));
  tests.forEach((x, i) => { x.holm = adj[i]; const c = x.confirmation, d = x.discovery;
    x.pass = d.after > 0 && c.after > 0 && c.tMonth >= 2 && adj[i] < 0.05 && c.n >= 200 && c.after > x.control[1].p95; });
  const alone = RULES.map((rule) => { const own = summarize(data.flatMap((d) => d.own[rule]));
    const com = summarize(data.flatMap((d) => d.single.filter((x) => RULES[x[1]] === rule).map((x) => [x[0], x[2], x[3]])));
    return { rule, own: { d: own[0], c: own[1] }, common: { d: com[0], c: com[1] } }; });
  const allSingle = summarize(data.flatMap((d) => d.single.map((x) => [x[0], x[2], x[3]])));
  const R = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
  const npass = tests.filter((x) => x.pass).length;
  const fmt = (n) => n.toLocaleString('en-GB');
  const out = { topic: 'fade-confluence', built: new Date().toISOString().slice(0, 10), verdict: npass ? 'PASS' : 'FAIL', passed: npass, of: tests.length,
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS, assumedCosts: ASSUMED,
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), rule: { window: W, target: RR + 'R', cap: CAP, stop: 'nearest valid member stop', onePosition: 'per market and side' },
    members: Object.fromEntries(data.map((d) => [d.market, d.byRule])), dropped: data.reduce((a, d) => a + d.dropped, 0),
    cut: data.flatMap((d) => d.cut.map((c) => ({ market: d.market, ...c }))), tests, alone, allSingle: { d: allSingle[0], c: allSingle[1] } };
  const T2 = tests[0], T3 = tests[1];
  out.headline = `${out.verdict}, ${npass} of 2. k >= 2: ${R(T2.confirmation.after)}R a trade after costs in 2015-26 (n ${fmt(T2.confirmation.n)}, month t ${T2.confirmation.tMonth}; before costs ${R(T2.confirmation.before)}R), discovery ${R(T2.discovery.after)}R (n ${fmt(T2.discovery.n)}); k >= 3: ${R(T3.confirmation.after)}R (n ${fmt(T3.confirmation.n)}, t ${T3.confirmation.tMonth}; before ${R(T3.confirmation.before)}R).`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(5) : v), 1) + '\n');
  console.log(out.headline);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const r = runMarket(a); fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r));
    console.log(a, r.members, r.byRule, 'k2', r.streams[2].length, 'k3', r.streams[3].length, 'cut', JSON.stringify(r.cut), r.secs + 's'); }
  else if (cmd === 'report') report(a);
  else console.log('usage: market <m> <dir> | report <dir>');
}
