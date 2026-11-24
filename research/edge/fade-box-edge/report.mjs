// research/edge/fade-box-edge/report.mjs - the pre-registered bar (AFTER costs) on sets D and E -> result.json.
//   node report.mjs <dir>            (dir holds discover.mjs output: D.<m>.json, E.<m>.json, and the discovery sets)
//   node report.mjs cut <set> <m>    cut test of one market -> printed JSON (kept in result.json by the report run)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import * as BOX from '../grid6-box-in-box/run.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { SETS } from './discover.mjs';
import { CONDS } from './analyze.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CANDIDATES = {
  E1: { k: 1, conds: ['rc8', 'topIn'], text: 'M15 box close-out faded, stop at the grid distance, trailing exit; risk >= 8 round trips and the close-out inside the H4 box' },
  E2: { k: 2, conds: ['rc8', 'er30'], text: 'M15 box close-out faded, stop 2 x the grid distance, trailing exit; risk >= 8 round trips and a choppy H1 (ER20 < 0.30)' },
  E3: { k: 2, conds: [], text: 'M15 box close-out faded, stop 2 x the grid distance, trailing exit; no condition' },
};
export const PRIMARY = ['D', 'E'], MIN_N = 100, PASS_T = 2;
const mIdx = (t, f) => { const a = new Date(f * 1000), d = new Date(t * 1000); return (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth(); };
const tM = (s) => { const n = s.length, m = s.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : 0; };
export const pick = (rows, c) => rows.filter((r) => r.ch === 1 && c.conds.every((k) => CONDS[k](r)) && r.R['k' + c.k]);
// costMult: 0 = before costs, 1 = after, 2 = at twice the cost
export function stat(rows, c, from, to, costMult = 1) {
  const NM = mIdx(to - 1, from) + 1, ms = new Array(NM).fill(0); let n = 0, s = 0, w = 0;
  for (const r of rows) { if (r.t < from || r.t >= to) continue; const q = r.R['k' + c.k]; const x = q.tr - costMult * q.cr; n++; s += x; if (x > 0) w++; ms[mIdx(r.t, from)] += x; }
  const t = tM(ms);
  return { n, meanR: n ? +(s / n).toFixed(4) : null, win: n ? +(w / n).toFixed(3) : null, tMonth: +t.toFixed(2), months: NM, pOne: +(t > 0 ? K.pFromT(t, NM - 1) / 2 : 1 - K.pFromT(t, NM - 1) / 2).toPrecision(4) };
}
export const ok = (s) => s.n >= MIN_N && s.meanR > 0 && s.tMonth >= PASS_T;
export function judge(primary) {
  const adj = K.holm(primary.map((p) => p.stat.pOne));
  primary.forEach((p, i) => { p.holm = +adj[i].toPrecision(4); p.pass = ok(p.stat) && adj[i] < 0.05; });
  const byC = Object.fromEntries(Object.keys(CANDIDATES).map((c) => { const d = primary.find((p) => p.c === c && p.set === 'D'), e = primary.find((p) => p.c === c && p.set === 'E'); return [c, { D: d.pass, E: e.pass, pass: d.pass && e.pass }]; }));
  const passed = Object.keys(byC).filter((c) => byC[c].pass), one = Object.keys(byC).filter((c) => byC[c].D !== byC[c].E);
  return { byC, passed, verdict: passed.length ? 'PASS' : one.length ? 'INCONCLUSIVE' : 'FAIL' };
}
const load = (dir, set) => SETS[set].markets.flatMap((m) => { const f = path.join(dir, `${set}.${m}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).map((r) => ({ ...r, m })) : []; });

// cut test: the H4-H1-M15 'out' signals known a day before a cut are the same on candles cut there
export function cutTest(set, market) {
  const S = SETS[set], from = Date.UTC(new Date(S.from * 1000).getUTCFullYear() - 1, 0, 1) / 1000;
  const M5 = K.load(market, '5m', { from, to: S.to }), key = (s) => BOX.sigKey(s), sel = (s) => s.ch === 1 && s.trig === 0;
  const full = BOX.signals(frames(M5), { from: S.from, to: S.to }).filter(sel), out = [];
  for (const f of [0.3, 0.6, 0.9]) {
    const C = S.from + Math.round((S.to - S.from) * f / 86400) * 86400 + 13 * 3600 + 37 * 60;
    const part = BOX.signals(frames(M5.filter((b) => b.e <= C)), { from: S.from, to: S.to }).filter(sel);
    const A = new Set(full.filter((s) => s.ts <= C - 86400).map(key)), B = new Set(part.filter((s) => s.ts <= C - 86400).map(key));
    let miss = 0, extra = 0; for (const k of A) if (!B.has(k)) miss++; for (const k of B) if (!A.has(k)) extra++;
    out.push({ set, market, cut: new Date(C * 1000).toISOString().slice(0, 16), signals: A.size, missing: miss, extra });
  }
  return out;
}

export function buildResult(dir, cut = []) {
  const sets = {}; const primary = [];
  for (const set of ['D', 'E']) { const rows = load(dir, set), S = SETS[set]; sets[set] = {};
    for (const [c, C] of Object.entries(CANDIDATES)) { const R = pick(rows, C);
      const after = stat(R, C, S.from, S.to, 1);
      sets[set][c] = { after, before: stat(R, C, S.from, S.to, 0), doubleCost: stat(R, C, S.from, S.to, 2),
        perMarket: Object.fromEntries(S.markets.map((m) => [m, stat(R.filter((r) => r.m === m), C, S.from, S.to, 1)])) };
      primary.push({ c, set, stat: after }); } }
  const J = judge(primary), f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3), nn = (x) => x.toLocaleString('en-US');
  const best = Object.keys(CANDIDATES).map((c) => ({ c, d: sets.D[c].after, e: sets.E[c].after })).sort((a, b) => Math.min(b.d.tMonth, b.e.tMonth) - Math.min(a.d.tMonth, a.e.tMonth))[0];
  const cutBad = cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const headline = `${J.verdict}: ${J.passed.length} of 3 candidates pass after costs on both unread sets (best ${best.c}: D ${f(best.d.meanR)}R a trade, n ${nn(best.d.n)}, month t ${best.d.tMonth.toFixed(2)}; E ${f(best.e.meanR)}R, n ${nn(best.e.n)}, t ${best.e.tMonth.toFixed(2)}); costs on these markets are assumed`;
  return { study: 'fade-box-edge', built: '2026-11-24', verdict: J.verdict, headline,
    basis: 'judged AFTER costs (pre-registered), month-sum t, Holm over 6 primary tests (3 candidates x sets D and E); costs assumed on these markets',
    candidates: CANDIDATES, primary: primary.map((p) => ({ candidate: p.c, set: p.set, n: p.stat.n, meanR: p.stat.meanR, tMonth: p.stat.tMonth, pOne: p.stat.pOne, holm: p.holm, pass: p.pass })),
    byCandidate: J.byC, sets, cut: { checks: cut.length, mismatches: cutBad, rows: cut },
    discovery: 'discovery.json (6,096 cells on data the fade was already read on; not evidence)' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [a, b, c] = process.argv.slice(2);
  if (a === 'cut') console.log(JSON.stringify(cutTest(b, c)));
  else { const cutF = path.join(a, 'cut.json'), cut = fs.existsSync(cutF) ? JSON.parse(fs.readFileSync(cutF, 'utf8')) : [];
    const out = buildResult(a, cut); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(out.headline);
    for (const p of out.primary) console.log(JSON.stringify(p));
    for (const s of ['D', 'E']) for (const k of Object.keys(CANDIDATES)) { const x = out.sets[s][k]; console.log(s, k, 'before', x.before.meanR, x.before.tMonth, 'after', x.after.meanR, x.after.tMonth, '2x', x.doubleCost.meanR, '|', Object.entries(x.perMarket).map(([m, v]) => `${m} ${v.n} ${v.meanR}`).join(' ')); } }
}
