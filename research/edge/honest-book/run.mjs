// The honest book (pre-registered in preregistration.md, committed before this ran): three paper books of the council's systems
// on daily equity at the council's fixed 1R a position, compared on untouched data (2006-17), on the built-on years (2018-26)
// and on 2023-26. Reads only the per-position records earlier studies committed; nothing is re-run and nothing live changes.
//   node research/edge/honest-book/run.mjs            → result.json next to this file, tables on stdout
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EDGE = path.join(HERE, '..');
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const r1 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(1)), r2 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(2)), r3 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(3));

// ───────── booking days ─────────
const dayOfUnix = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const roll = (d) => (dow(d) === 6 ? addDays(d, 2) : dow(d) === 0 ? addDays(d, 1) : d);   // Sat / Sun UTC → Monday

// ───────── the per-position records: id → [{ day, x1, x2, market }] ─────────
const REC = {}, SRC = {};
const push = (id, day, x1, x2, market) => (REC[id] = REC[id] || []).push({ day: roll(day), x1, x2, market });
{
  const G = J(path.join(EDGE, 'gold-systems-oos/result.json'));
  for (const p of G.positions) push(p.sys, p.c.slice(0, 10), p.n, p.n2, 'xau');
  for (const id of ['gtrend', 'gtrend5', 'gtl', 'geg']) SRC[id] = 'research/edge/gold-systems-oos/result.json positions (close day, n / n2)';
  const M = J(path.join(EDGE, 'mosha-oos/result.json'));
  for (const p of M.positions) push('mosha-bo', p.c.slice(0, 10), p.n, p.n2, 'xau');
  SRC['mosha-bo'] = 'research/edge/mosha-oos/result.json positions (close day, n / n2)';
  const I = J(path.join(EDGE, 'sizing/inputs.json'));
  for (const [e, c, m, n1, n2] of I.systems.replica) push('replica', dayOfUnix(c), n1, n2, m);
  SRC.replica = 'research/edge/sizing/inputs.json systems.replica (#512 replay positions, close day, net1 / net2)';
  for (const [e, c, m, n1, n2] of I.systems['ict-a']) push('ict-a', dayOfUnix(c), n1, n2, m);
  SRC['ict-a'] = 'research/edge/sizing/inputs.json systems.ict-a (#526 run, close day, net1 / net2, live sizeOf)';
  const P = J(path.join(EDGE, 'robustness/out/gmp.json'));
  for (const t of P.trades) push('gmp', dayOfUnix(t.t), t.R, t.gross - 2 * (t.gross - t.R), 'xau');
  SRC.gmp = 'research/edge/robustness/out/gmp.json trades (entry day; R at 0.15, x2 = gross − 2 × cost)';
  const N = J(path.join(EDGE, 'nq-open-oos/result.json'));
  for (const t of N.trades) push('nq-open', t.d, t.R, 2 * t.R - t.gross, 'nas100');
  SRC['nq-open'] = 'research/edge/nq-open-oos/result.json trades (trade day; R net of 1 pt, x2 = 2R − gross)';
}
for (const id in REC) REC[id].sort((a, b) => (a.day < b.day ? -1 : 1));
const NAME = { replica: 'Gold replica', 'mosha-bo': 'Mosha BO', gtrend: 'Gold trend N20', gtrend5: 'Gold trend fast N5', gtl: 'Gold H4 trendline', geg: 'Gold daily engulf', gmp: 'Gold momentum pullback', 'nq-open': 'NQ NY open run', 'ict-a': 'ICT A-setups' };
const GOLD = ['gtrend', 'gtrend5', 'gtl', 'geg', 'mosha-bo', 'replica', 'gmp'];
const MARKET = { xau: 'gold', nas100: 'Nasdaq', spx500: 'S&P', us30: 'Dow' };

// ───────── books and windows (as pre-registered) ─────────
const BOOKS = {
  A: { name: 'A, the live book', systems: ['replica', 'mosha-bo', 'gtrend', 'gtl', 'geg', 'gmp', 'nq-open', 'ict-a'] },
  B: { name: 'B, honest-positive', systems: ['gtrend', 'geg', 'mosha-bo', 'gtl'] },
  C: { name: 'C, B + Gold trend fast N5', systems: ['gtrend', 'geg', 'mosha-bo', 'gtl', 'gtrend5'] },
};
const WINDOWS = [
  { id: 'W1', label: 'W1 untouched 2006-07 .. 2017-12', from: '2006-07-01', to: '2017-12-31', halves: [['2006-07-01', '2011-12-31'], ['2012-01-01', '2017-12-31']], verdict: true },
  { id: 'W1o', label: 'W1-overlap 2008-01 .. 2017-12 (sensitivity)', from: '2008-01-01', to: '2017-12-31', halves: [['2008-01-01', '2012-12-31'], ['2013-01-01', '2017-12-31']] },
  { id: 'W2', label: 'W2 built-on 2018-01 .. 2026-10', from: '2018-01-01', to: '2026-10-31', halves: [['2018-01-01', '2022-12-31'], ['2023-01-01', '2026-10-31']] },
  { id: 'W3', label: 'W3 recent 2023-01 .. 2026-10', from: '2023-01-01', to: '2026-10-31', halves: [['2023-01-01', '2024-11-30'], ['2024-12-01', '2026-10-31']] },
];

// ───────── gold daily % returns (weekday candles) ─────────
const GRET = new Map();
{ const bars = J(path.join(HERE, 'gold-1d.json')).bars.map(([t, c]) => [dayOfUnix(t), c]).filter(([d]) => dow(d) !== 0 && dow(d) !== 6);
  for (let i = 1; i < bars.length; i++) GRET.set(bars[i][0], 100 * (bars[i][1] / bars[i - 1][1] - 1)); }

// ───────── daily series ─────────
function weekdays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) if (dow(d) !== 0 && dow(d) !== 6) out.push(d); return out; }
function daily(id, days, cost) {
  const idx = new Map(days.map((d, i) => [d, i])), v = new Array(days.length).fill(0); let n = 0;
  for (const r of REC[id] || []) { const i = idx.get(r.day); if (i != null) { v[i] += r[cost]; n++; } }
  return { v, n };
}
const sum = (a) => a.reduce((s, x) => s + x, 0), mean = (a) => sum(a) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
function maxDD(v) { let c = 0, pk = 0, dd = 0; for (const x of v) { c += x; if (c > pk) pk = c; if (pk - c > dd) dd = pk - c; } return dd; }
function corr(a, b) { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : null; }
function metrics(v, days, from, to) {
  const total = sum(v), dd = maxDD(v), m = mean(v), s = sd(v), N = v.length;
  const years = (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400e3 / 365.25 + 1 / 365.25;
  const M = new Map(), Y = new Map(), act = new Set();
  days.forEach((d, i) => { const k = d.slice(0, 7), y = d.slice(0, 4); M.set(k, (M.get(k) || 0) + v[i]); Y.set(y, (Y.get(y) || 0) + v[i]); if (v[i] !== 0) act.add(k); });
  const mv = [...M.values()], yv = [...Y.values()];
  return { total: r1(total), perYear: r1(total / years), maxDD: r1(dd), retDD: dd > 0 ? r2(total / dd) : null, t: s > 0 ? r2((m / s) * Math.sqrt(N)) : null,
    sharpe: s > 0 ? r2((m / s) * Math.sqrt(252)) : null, days: N, months: mv.length, posMonths: r2(mv.filter((x) => x > 0).length / mv.length),
    activeMonths: act.size, posActiveMonths: act.size ? r2([...M].filter(([k, x]) => act.has(k) && x > 0).length / act.size) : null,
    years: yv.length, posYears: `${yv.filter((x) => x > 0).length}/${yv.length}`, worstMonth: r1(Math.min(...mv)), byYear: Object.fromEntries([...Y].map(([y, x]) => [y, r1(x)])) };
}
function beta(v, days) {
  const x = [], y = []; days.forEach((d, i) => { if (GRET.has(d)) { x.push(GRET.get(d)); y.push(v[i]); } });
  const n = x.length, mx = mean(x), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b = sxy / sxx, a = my - b * mx, res = y.map((yy, i) => yy - a - b * x[i]), sse = sum(res.map((e) => e * e)), s2 = sse / (n - 2);
  const seB = Math.sqrt(s2 / sxx), seA = Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)), sst = sum(y.map((yy) => (yy - my) ** 2)), tot = sum(y);
  return { days: n, beta: r3(b), betaT: r2(b / seB), alpha: r3(a), alphaT: r2(a / seA), R2: r3(1 - sse / sst), corr: r2(corr(x, y)), goldSumPct: r1(sum(x)), betaR: r1(b * sum(x)), betaShare: tot !== 0 ? r2((b * sum(x)) / tot) : null };
}
// paired month-block bootstrap (seed 1): P(diff > 0) and the 90 % interval of the difference in retDD and t
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function bootstrap(series, days, draws = 2000) {
  const months = [...new Set(days.map((d) => d.slice(0, 7)))], byM = Object.fromEntries(months.map((k) => [k, []]));
  days.forEach((d, i) => byM[d.slice(0, 7)].push(i));
  const rnd = mulberry32(1), ids = Object.keys(series), out = Object.fromEntries(ids.map((k) => [k, { retDD: [], t: [] }]));
  for (let k = 0; k < draws; k++) {
    const pick = []; for (let j = 0; j < months.length; j++) pick.push(months[Math.floor(rnd() * months.length)]);
    for (const id of ids) { const v = []; for (const mo of pick) for (const i of byM[mo]) v.push(series[id][i]);
      const tot = sum(v), dd = maxDD(v), s = sd(v); out[id].retDD.push(dd > 0 ? tot / dd : tot > 0 ? Infinity : -Infinity); out[id].t.push(s > 0 ? (mean(v) / s) * Math.sqrt(v.length) : 0); }
  }
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const pairs = {};
  for (const [p, q1] of [['B', 'A'], ['C', 'A'], ['C', 'B']]) { if (!out[p] || !out[q1]) continue;
    const d1 = out[p].retDD.map((x, i) => x - out[q1].retDD[i]), d2 = out[p].t.map((x, i) => x - out[q1].t[i]);
    pairs[`${p}-${q1}`] = { retDD: { pGt0: r3(d1.filter((x) => x > 0).length / d1.length), lo90: r2(q(d1, 0.05)), hi90: r2(q(d1, 0.95)) }, t: { pGt0: r3(d2.filter((x) => x > 0).length / d2.length), lo90: r2(q(d2, 0.05)), hi90: r2(q(d2, 0.95)) } }; }
  return { draws, months: months.length, pairs };
}

// ───────── run ─────────
const out = { at: new Date().toISOString(), prereg: 'research/edge/honest-book/preregistration.md', rule: 'paper research only: a proposal for the owner; no live rule, size, filter, tracker, replay or site code changes',
  sizing: 'fixed 1R a position as each source study recorded it (adds and live sizes inside the position); no weighting between systems',
  books: Object.fromEntries(Object.entries(BOOKS).map(([k, b]) => [k, { name: b.name, systems: b.systems }])), sources: SRC,
  coverage: Object.fromEntries(Object.keys(REC).map((id) => [id, { name: NAME[id], n: REC[id].length, from: REC[id][0].day, to: REC[id].at(-1).day }])), windows: {} };
const lines = [];
const P = (s = '') => lines.push(s);
for (const W of WINDOWS) {
  const w = (out.windows[W.id] = { label: W.label, from: W.from, to: W.to, halves: W.halves, present: {}, missing: {}, systems: {}, x1: {}, x2: {}, h1: {}, h2: {}, corrGold: {}, beta: {}, perMarket: {}, byYear: {} });
  const days = weekdays(W.from, W.to), inWin = (id) => (REC[id] || []).some((r) => r.day >= W.from && r.day <= W.to);
  for (const [k, b] of Object.entries(BOOKS)) { w.present[k] = b.systems.filter(inWin); w.missing[k] = b.systems.filter((id) => !inWin(id)); }
  const S = {}; // system daily series in this window, x1 and x2
  for (const id of Object.keys(REC)) if (inWin(id)) { S[id] = { x1: daily(id, days, 'x1'), x2: daily(id, days, 'x2') };
    const m1 = metrics(S[id].x1.v, days, W.from, W.to), m2 = metrics(S[id].x2.v, days, W.from, W.to);
    w.systems[id] = { name: NAME[id], n: S[id].x1.n, x1: { total: m1.total, perTrade: r3(m1.total / S[id].x1.n), maxDD: m1.maxDD, retDD: m1.retDD, t: m1.t, sharpe: m1.sharpe }, x2: { total: m2.total, perTrade: r3(m2.total / S[id].x1.n), maxDD: m2.maxDD, retDD: m2.retDD }, byYear: m1.byYear }; }
  const bookSeries = (k, cost, dayList = days) => { const v = new Array(dayList.length).fill(0); for (const id of w.present[k]) { const s = daily(id, dayList, cost).v; for (let i = 0; i < v.length; i++) v[i] += s[i]; } return v; };
  const series = {};
  for (const k of Object.keys(BOOKS)) {
    for (const cost of ['x1', 'x2']) { const v = bookSeries(k, cost); if (cost === 'x1') series[k] = v; w[cost][k] = metrics(v, days, W.from, W.to); w[cost][k].n = w.present[k].reduce((s, id) => s + S[id].x1.n, 0); }
    for (const [hi, [hf, ht]] of W.halves.entries()) { const hd = weekdays(hf, ht), key = hi === 0 ? 'h1' : 'h2'; w[key][k] = { x1: metrics(bookSeries(k, 'x1', hd), hd, hf, ht), x2: metrics(bookSeries(k, 'x2', hd), hd, hf, ht) }; delete w[key][k].x1.byYear; delete w[key][k].x2.byYear; }
    w.beta[k] = beta(series[k], days);
    const pm = {}; for (const id of w.present[k]) for (const r of REC[id]) if (r.day >= W.from && r.day <= W.to) pm[MARKET[r.market] || r.market] = (pm[MARKET[r.market] || r.market] || 0) + r.x1; w.perMarket[k] = Object.fromEntries(Object.entries(pm).map(([m, x]) => [m, r1(x)]));
    w.byYear[k] = w.x1[k].byYear; delete w.x1[k].byYear; delete w.x2[k].byYear;
  }
  // gold systems' pairwise daily correlation
  const gold = GOLD.filter((id) => S[id]);
  for (let i = 0; i < gold.length; i++) for (let j = i + 1; j < gold.length; j++) w.corrGold[`${gold[i]}~${gold[j]}`] = r2(corr(S[gold[i]].x1.v, S[gold[j]].x1.v));
  w.bootstrap = bootstrap(series, days);
  // ── tables ──
  P(`### ${W.label}`); P();
  P(`Present: A = ${w.present.A.join(', ')}${w.missing.A.length ? ` (no record: ${w.missing.A.join(', ')})` : ''}; B = ${w.present.B.join(', ')}; C = ${w.present.C.join(', ')}`); P();
  P('| book | cost | positions | total R | R a year | worst DD | return / DD | Sharpe-like t | ann. Sharpe | months + (all / active) | years + | worst month |'); P('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(BOOKS)) for (const cost of ['x1', 'x2']) { const m = w[cost][k]; P(`| ${k} | ${cost} | ${m.n} | ${m.total} | ${m.perYear} | −${m.maxDD} | ${m.retDD} | ${m.t} | ${m.sharpe} | ${m.posMonths} / ${m.posActiveMonths} | ${m.posYears} | ${m.worstMonth} |`); }
  P(); P(`Halves (x1 → x2): ${W.halves.map((h) => h.join(' .. ')).join(' | ')}`); P();
  P('| book | H1 total | H1 DD | H1 ret/DD | H1 t | H2 total | H2 DD | H2 ret/DD | H2 t |'); P('|---|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(BOOKS)) { const a = w.h1[k], b = w.h2[k]; P(`| ${k} | ${a.x1.total} → ${a.x2.total} | −${a.x1.maxDD} | ${a.x1.retDD} → ${a.x2.retDD} | ${a.x1.t} | ${b.x1.total} → ${b.x2.total} | −${b.x1.maxDD} | ${b.x1.retDD} → ${b.x2.retDD} | ${b.x1.t} |`); }
  P(); P('| book | gold beta (R per 1 % gold day) | beta t | alpha R a day | alpha t | R² | corr | beta share of total |'); P('|---|---|---|---|---|---|---|---|');
  for (const k of Object.keys(BOOKS)) { const b = w.beta[k]; P(`| ${k} | ${b.beta} | ${b.betaT} | ${b.alpha} | ${b.alphaT} | ${b.R2} | ${b.corr} | ${b.betaShare} |`); }
  P(); P('Per market (x1 total R): ' + Object.keys(BOOKS).map((k) => `${k}: ${Object.entries(w.perMarket[k]).map(([m, x]) => `${m} ${x}`).join(', ')}`).join(' · ')); P();
  P('Gold systems, pairwise correlation of daily R: ' + Object.entries(w.corrGold).map(([p, c]) => `${p} ${c}`).join('; ')); P();
  P('| system | positions | x1 total | R a position | worst DD | ret/DD | t | x2 total |'); P('|---|---|---|---|---|---|---|---|');
  for (const [id, s] of Object.entries(w.systems)) P(`| ${s.name} | ${s.n} | ${s.x1.total} | ${s.x1.perTrade} | −${s.x1.maxDD} | ${s.x1.retDD} | ${s.x1.t} | ${s.x2.total} |`);
  P(); P('Paired month bootstrap (2,000 draws): ' + Object.entries(w.bootstrap.pairs).map(([p, b]) => `${p}: ret/DD diff P>0 ${b.retDD.pGt0} [${b.retDD.lo90}, ${b.retDD.hi90}], t diff P>0 ${b.t.pGt0} [${b.t.lo90}, ${b.t.hi90}]`).join(' · ')); P();
}
// ───────── verdict (W1, x1, return / drawdown; the pre-registered rule) ─────────
{
  const w = out.windows.W1, rank = Object.keys(BOOKS).map((k) => [k, w.x1[k].retDD ?? -Infinity]).sort((a, b) => b[1] - a[1]), [best, second] = rank.map((x) => x[0]);
  const pair = w.bootstrap.pairs[`${best}-${second}`] || w.bootstrap.pairs[`${second}-${best}`], flipped = !w.bootstrap.pairs[`${best}-${second}`];
  const pBoot = flipped ? 1 - pair.retDD.pGt0 : pair.retDD.pGt0;
  const tests = { bootstrapP: pBoot, bootstrapPass: pBoot >= 0.95, halvesPass: w.h1[best].x1.retDD > w.h1[second].x1.retDD && w.h2[best].x1.retDD > w.h2[second].x1.retDD, x2Pass: w.x2[best].retDD > w.x2[second].retDD };
  const more = tests.bootstrapPass && tests.halvesPass && tests.x2Pass;
  out.verdict = { window: 'W1 untouched 2006-07 .. 2017-12, x1 costs, return / drawdown', ranking: rank.map(([k, v]) => ({ book: k, retDD: v })), best, runnerUp: second, moreThanNoise: more, tests,
    text: `${BOOKS[best].name} is the best book by return/drawdown on the untouched window (${w.x1[best].retDD} against ${w.x1[second].retDD} for ${BOOKS[second].name}, ${w.x1[rank[2][0]].retDD} for ${BOOKS[rank[2][0]].name}); the difference is ${more ? 'more than noise' : 'within noise'} on the pre-registered rule (bootstrap P ${pBoot}, both halves ${tests.halvesPass ? 'yes' : 'no'}, x2 ${tests.x2Pass ? 'yes' : 'no'}).` };
  P('## Verdict'); P(); P(out.verdict.text);
}
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
console.log(lines.join('\n'));
