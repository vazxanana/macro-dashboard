// The Mosha sequence entries with the weekly side and a trending Daily (PREREGISTRATION.md, 23 Nov 2026).
// The desk's own code, imported; nothing here changes a rule. Candles: the edgekit research cache (outside git).
//   node research/edge/mosha-weekly-er/run.mjs market <key> <dir>     that market's trades into <dir>/mwe-<key>.json
//   node research/edge/mosha-weekly-er/run.mjs report <dir>           result.json and RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadFns } from '../../../council/mosha-desk.mjs';
import { load, resample } from '../_lib/edgekit.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const WARM = T('2019-06-01'), A = [T('2020-01-01'), T('2024-01-01')], Bw = [T('2024-01-01'), Infinity];
export const PRIMARY = ['xau', 'eurusd', 'gbpusd'], REPORTED = ['usdjpy', 'audusd'], MARKETS = [...PRIMARY, ...REPORTED];
const PIP = { eurusd: 0.0001, gbpusd: 0.0001, audusd: 0.0001, usdjpy: 0.01 };
export const cost = (mk, px) => (PIP[mk] ? 0.000045 * px + 0.5 * PIP[mk] : px * 0.00005);
// the sequence's EG entry: sop-<tf>-… or sop-i-<tf>-… (market prefix allowed); not c2 / l / vr / vc / nv / nc
export const isEntry = (r) => r.kind === 'sop' && /(^|:)sop-(i-)?(1d|4h|1h|30m|15m|5m|1m)-/.test(String(r.id || ''));
export const inF1 = (r) => r.withWeekly === true && r.er20 >= 0.2;
export const inF2 = (r) => r.withWeekly === true && r.er20 >= 0.35;
export const known = (r) => r.withWeekly != null && r.er20 != null;

const bars = (rows) => rows.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
function market(mk, dir) {
  const F = loadFns(), M5 = load(mk, '5m', { from: WARM }), B = { '5m': bars(M5) };
  for (const [tf, sec] of [['15m', 900], ['30m', 1800], ['1h', 3600], ['4h', 14400]]) { const g = resample(M5, sec); B[tf] = bars(g.slice(0, g.length - 1)); }   // last bucket may be forming
  B['1d'] = bars(load(mk, '1d', { from: WARM }));
  const lastT = M5[M5.length - 1].e, t0 = Date.now();
  B['1d'] = B['1d'].filter((b) => b.time + 86400 <= lastT);
  const all = SOP.sopTrades(B, F, { from: A[0], market: mk });
  const rows = all.filter((r) => r.t >= A[0] && r.R != null).map((r) => ({ id: r.id, entry: isEntry(r), t: r.t, side: r.side, h: r.h, l: r.l, R: +r.R.toFixed(4), px: r.entry, r0: r.r0, withWeekly: r.withWeekly, er20: r.er20, status: r.status }));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `mwe-${mk}.json`), JSON.stringify({ market: mk, last: new Date(lastT * 1000).toISOString(), rows }));
  console.log(mk, rows.length, 'records,', rows.filter((r) => r.entry).length, 'EG entries,', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

// ─── statistics ───
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function stats(rows, key = 'net') {
  const n = rows.length; if (!n) return { n: 0 };
  const v = rows.map((r) => r[key]), sum = v.reduce((a, b) => a + b, 0), months = new Map();
  for (const r of rows) months.set(monthOf(r.t), (months.get(monthOf(r.t)) || 0) + r[key]);
  const ms = [...months.values()], mm = ms.reduce((a, b) => a + b, 0) / ms.length, mv = ms.length > 1 ? ms.reduce((a, b) => a + (b - mm) ** 2, 0) / (ms.length - 1) : 0;
  const win = v.filter((x) => x > 0), loss = v.filter((x) => x < 0), gw = win.reduce((a, b) => a + b, 0), gl = -loss.reduce((a, b) => a + b, 0);
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
  return { n, win: +(100 * win.length / n).toFixed(1), pf: gl > 0 ? +(gw / gl).toFixed(2) : null, mean: +(sum / n).toFixed(4), total: +sum.toFixed(2), dd: +dd.toFixed(2), months: ms.length, tMonth: mv > 0 ? +(mm / Math.sqrt(mv / ms.length)).toFixed(2) : null };
}
export function welch(a, b, key = 'net') {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const m = (x) => x.reduce((s, r) => s + r[key], 0) / x.length, v = (x, mu) => x.reduce((s, r) => s + (r[key] - mu) ** 2, 0) / (x.length - 1);
  const ma = m(a), mb = m(b), se = Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length);
  return { diff: +(ma - mb).toFixed(4), t: se > 0 ? +((ma - mb) / se).toFixed(2) : null };
}
export const pOne = (t) => { if (t == null) return 1; const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z); const p = 0.5 * (1 - erf); return t > 0 ? p : 1 - p; };
const inWin = (r, w) => r.t >= w[0] && r.t < w[1];

function rowsOf(dir) {
  let rows = [], last = null;
  for (const mk of MARKETS) { const f = path.join(dir, `mwe-${mk}.json`); if (!fs.existsSync(f)) continue; const j = JSON.parse(fs.readFileSync(f, 'utf8')); if (!last || j.last < last) last = j.last;
    rows = rows.concat(j.rows.filter((r) => r.entry).map((r) => { const c = cost(mk, r.px) / r.r0; return { ...r, market: mk, gross: r.R, net: r.R - c, net2: r.R - 2 * c, costR: c }; })); }
  return { rows: rows.sort((a, b) => a.t - b.t), last };
}
function block(G, R) { // group G against its rest R, per window
  const out = {}; for (const [k, w] of [['A', A], ['B', Bw]]) { const g = G.filter((r) => inWin(r, w)), q = R.filter((r) => inWin(r, w));
    out[k] = { group: { ...stats(g), gross: stats(g, 'gross').mean, net2: stats(g, 'net2').mean }, rest: { ...stats(q), gross: stats(q, 'gross').mean }, vsRest: welch(g, q) }; }
  return out;
}
function report(dir) {
  const { rows, last } = rowsOf(dir), prim = rows.filter((r) => PRIMARY.includes(r.market)), pk = prim.filter(known);
  const tests = {};
  for (const [id, f, what] of [['F1', inF1, 'weekly side agrees AND er20 >= 0.2 (primary)'], ['F2', inF2, 'weekly side agrees AND er20 >= 0.35 (secondary)']]) {
    const G = pk.filter(f), R = pk.filter((r) => !f(r)), b = block(G, R);
    const pA = pOne(b.A.group.tMonth), pB = pOne(b.B.group.tMonth);
    tests[id] = { what, ...b, p: +Math.max(pA, pB).toFixed(4) };
  }
  const ps = Object.keys(tests).map((id) => [id, tests[id].p]).sort((a, b) => a[1] - b[1]); let run = 0;
  ps.forEach(([id, p], i) => { run = Math.max(run, Math.min(1, p * (ps.length - i))); tests[id].holm = +run.toFixed(4); });
  for (const id of Object.keys(tests)) { const t = tests[id], ok = (w) => t[w].group.n >= 100;
    const checks = { n100: ok('A') && ok('B'), positiveA: (t.A.group.mean || 0) > 0 && (t.A.group.tMonth || 0) >= 2, positiveB: (t.B.group.mean || 0) > 0 && (t.B.group.tMonth || 0) >= 2,
      betterThanRestA: (t.A.vsRest.diff || 0) > 0, betterThanRestB: (t.B.vsRest.diff || 0) > 0, holm: t.holm < 0.05 };
    t.checks = checks; t.verdict = !checks.n100 ? 'FAIL (too few to judge)' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  // F2 against F1-not-F2
  const mid = pk.filter((r) => inF1(r) && !inF2(r)), f2 = pk.filter(inF2);
  tests.F2.vsMid = { A: welch(f2.filter((r) => inWin(r, A)), mid.filter((r) => inWin(r, A))), B: welch(f2.filter((r) => inWin(r, Bw)), mid.filter((r) => inWin(r, Bw))), midA: stats(mid.filter((r) => inWin(r, A))), midB: stats(mid.filter((r) => inWin(r, Bw))) };
  // reported, no verdict
  const all = { A: stats(prim.filter((r) => inWin(r, A))), B: stats(prim.filter((r) => inWin(r, Bw))) };
  const alone = {}; for (const [k, f] of [['weeklyAgrees', (r) => r.withWeekly === true], ['er20AtLeast0.2', (r) => r.er20 >= 0.2], ['er20AtLeast0.35', (r) => r.er20 >= 0.35]]) alone[k] = block(pk.filter(f), pk.filter((r) => !f(r)));
  const byMarket = {}; for (const mk of MARKETS) { const m = rows.filter((r) => r.market === mk && known(r)); if (!m.length) continue; byMarket[mk] = { primary: PRIMARY.includes(mk), F1: block(m.filter(inF1), m.filter((r) => !inF1(r))), F2: block(m.filter(inF2), m.filter((r) => !inF2(r))) }; }
  const bySteps = {}; for (const st of ['1d', '4h', '1h', '30m', '15m']) { const m = pk.filter((r) => r.h === st); if (m.length) bySteps[st] = block(m.filter(inF1), m.filter((r) => !inF1(r))); }
  const passed = Object.keys(tests).filter((id) => tests[id].verdict === 'PASS'), F1 = tests.F1;
  const f = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  const verdict = passed.length ? 'PASS' : 'FAIL';
  const headline = `${verdict}, ${passed.length} of 2: weekly agrees and er20 >= 0.2 made ${f(F1.A.group.mean)}R a trade after costs in 2020-2023 (n ${F1.A.group.n}, month t ${F1.A.group.tMonth}) and ${f(F1.B.group.mean)}R from 2024 (n ${F1.B.group.n}, month t ${F1.B.group.tMonth}); the rest ${f(F1.A.rest.mean)}R and ${f(F1.B.rest.mean)}R.`;
  const out = { study: 'mosha-weekly-er', built: new Date().toISOString().slice(0, 10), verdict, headline,
    system: 'The Mosha desk\'s sequence entries (BO, VR, CF, EG entry; assets/mosha-sop.js sopTrades) with the weekly side agreeing and the 20-day efficiency ratio of Daily closes at or above 0.2 (0.35); gold, EUR/USD, GBP/USD pooled; OANDA mid M5; 2020-2023 and 2024 to the last candle; net of costs.',
    markets: { primary: PRIMARY, reported: REPORTED }, windows: { A: ['2020-01-01', '2023-12-31'], B: ['2024-01-01', last ? last.slice(0, 10) : null] },
    trades: { all: rows.length, primary: prim.length, primaryTagged: pk.length, primaryUntagged: prim.length - pk.length }, population: all, tests, alone, byMarket, bySteps };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  const L = [], line = (n, w, g) => `| ${n} | ${w} | ${g.n} | ${g.win ?? 'n/a'} | ${g.pf ?? 'n/a'} | ${f(g.gross)} | ${f(g.mean)} | ${g.tMonth ?? 'n/a'} | ${g.total ?? 'n/a'} |`;
  L.push('# The Mosha sequence entries with the weekly side and a trending Daily', '', `**Verdict: ${verdict}. ${headline.replace(/^(PASS|FAIL), /, '')}**`, '',
    `Built ${out.built}. Pre-registered (PREREGISTRATION.md, committed before any trade was computed). Paper research only: nothing live changed. Window B runs to ${out.windows.B[1]}. Population: the sequence's EG entry (sop-… and sop-i-… records), gold, EUR/USD, GBP/USD pooled; ${out.trades.primary} trades, ${out.trades.primaryUntagged} without both tags (left out of both sides).`, '',
    '## The two tests', '', '| Test | Window | n | win % | PF | R before costs | R after costs | month t | total R | rest n | rest R after costs | difference | Welch t |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const id of ['F1', 'F2']) for (const w of ['A', 'B']) { const x = tests[id][w], g = x.group; L.push(`| ${id} | ${w === 'A' ? '2020-2023' : '2024 on'} | ${g.n} | ${g.win} | ${g.pf} | ${f(g.gross)} | ${f(g.mean)} | ${g.tMonth} | ${g.total} | ${x.rest.n} | ${f(x.rest.mean)} | ${f(x.vsRest.diff)} | ${x.vsRest.t} |`); }
  L.push('', '| Test | p (larger of the windows, one-sided) | Holm p | Checks | Verdict |', '|---|---|---|---|---|');
  for (const id of ['F1', 'F2']) { const t = tests[id]; L.push(`| ${id}: ${t.what} | ${t.p} | ${t.holm} | ${Object.entries(t.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')} | ${t.verdict} |`); }
  const vm = tests.F2.vsMid;
  L.push('', `F2 against the F1 trades that are not in F2 (0.2 <= er20 < 0.35): 2020-2023 ${f(vm.A.diff)}R a trade (Welch t ${vm.A.t}; the middle group n ${vm.midA.n}, ${f(vm.midA.mean)}R), from 2024 ${f(vm.B.diff)}R (t ${vm.B.t}; n ${vm.midB.n}, ${f(vm.midB.mean)}R).`,
    '', `Every sequence entry (no filter): 2020-2023 n ${all.A.n}, ${f(all.A.mean)}R after costs (month t ${all.A.tMonth}, PF ${all.A.pf}); from 2024 n ${all.B.n}, ${f(all.B.mean)}R (month t ${all.B.tMonth}, PF ${all.B.pf}).`,
    '', '## Each condition alone (reported, no verdict)', '', '| Condition | Window | n | win % | PF | R before costs | R after costs | month t | total R |', '|---|---|---|---|---|---|---|---|---|');
  for (const [k, b] of Object.entries(alone)) for (const w of ['A', 'B']) L.push(line(k, w === 'A' ? '2020-2023' : '2024 on', b[w].group));
  L.push('', '## F1 by market (reported; USD/JPY and AUD/USD never in the verdict)', '', '| Market | Window | F1 n | F1 R after costs | month t | rest n | rest R | F2 n | F2 R after costs |', '|---|---|---|---|---|---|---|---|---|');
  for (const [mk, b] of Object.entries(byMarket)) for (const w of ['A', 'B']) L.push(`| ${mk}${b.primary ? '' : ' (reported)'} | ${w === 'A' ? '2020-2023' : '2024 on'} | ${b.F1[w].group.n} | ${f(b.F1[w].group.mean)} | ${b.F1[w].group.tMonth ?? 'n/a'} | ${b.F1[w].rest.n} | ${f(b.F1[w].rest.mean)} | ${b.F2[w].group.n} | ${f(b.F2[w].group.mean)} |`);
  L.push('', '## F1 by ladder step (the BO\'s timeframe; primary markets)', '', '| BO on | Window | F1 n | F1 R after costs | rest n | rest R |', '|---|---|---|---|---|---|');
  for (const [st, b] of Object.entries(bySteps)) for (const w of ['A', 'B']) L.push(`| ${st} | ${w === 'A' ? '2020-2023' : '2024 on'} | ${b[w].group.n} | ${f(b[w].group.mean)} | ${b[w].rest.n} | ${f(b[w].rest.mean)} |`);
  L.push('', '## What it means', '', passed.length ? 'A test passed its bar on years already read for this entry: a candidate mark on the desk\'s paper record, to be proposed to the owner with its own forward pre-registration. Not an edge on its own.' : 'Neither test passed. The two conditions are not made a filter on the Mosha desk and are not looked at again on these years. The figure quoted in the owner\'s notes is not reproduced by the desk\'s own reading of this entry on these candles; what a person adds by choosing which setups to take is not in any rule.', '',
    'Limits: OANDA mid candles; no one-minute history (an M5 VR\'s CF is read on M5, as the desk does when M1 is missing); costs as desk-rigor, today\'s for every year, no financing; R as the desk books it (stop first when one candle holds both). 2020-2025 was read by desk-rigor and 2026 by the desk\'s own records.');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n'); console.log(headline);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'market') market(a, b); else if (cmd === 'report') report(a);
