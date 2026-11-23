// The Mosha desk's barrier entries at 1R, 3R and 6R targets on gold 2010-2019 (PREREGISTRATION.md, 23 Nov 2026).
// The desk's own code, imported; nothing here changes a rule. Candles from the edgekit cache (EDGE_DATA, outside git).
//   node research/edge/mosha-barrier-6r/run.mjs year <Y> <outDir>     that year's entries into <outDir>/y<Y>.json
//   node research/edge/mosha-barrier-6r/run.mjs cut <Y> <outDir>      the cut test on year Y (look-ahead check)
//   node research/edge/mosha-barrier-6r/run.mjs report <outDir>       result.json and RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const RRS = [1, 3, 6];
export const COST = 0.30;                  // COSTS.xau of research/edge/combo-grid-2/run.mjs (= edgekit COSTS.xau), a round trip
export const YEARS = [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019];
export const HALVES = { discovery: [2010, 2014], confirmation: [2015, 2019] };
const T = (y) => Date.UTC(y, 0, 1) / 1000, DAY = 86400, TAIL = 183 * DAY;

const toDesk = (b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c });
// UTC buckets from 5-minute candles; the last bucket is dropped while it could still be forming
export function group(M5, sec) {
  const out = [];
  for (const b of M5) { const t = b.time - (b.time % sec), q = out[out.length - 1];
    if (q && q.time === t) { if (b.high > q.high) q.high = b.high; if (b.low < q.low) q.low = b.low; q.close = b.close; }
    else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); }
  const last = M5.length ? M5[M5.length - 1].time + 300 : 0;
  if (out.length && out[out.length - 1].time + sec > last) out.pop();
  return out;
}
export function candles(Y, end = T(Y + 1) + TAIL) {
  const back = (tf) => T(Y) - SOP.BACK[tf] * DAY;
  const B = {};
  B['1d'] = K.load('xau', '1d', { from: back('1d'), to: Math.min(end, T(Y + 1)) }).map(toDesk).filter((b) => b.time + DAY <= end);
  const M5 = K.load('xau', '5m', { from: back('4h'), to: end }).map(toDesk);
  B['5m'] = M5.filter((b) => b.time >= back('5m'));
  for (const [tf, sec] of [['15m', 900], ['30m', 1800], ['1h', 3600], ['4h', 14400]]) B[tf] = group(M5.filter((b) => b.time >= back(tf)), sec);
  B['1m'] = K.load('xau', '1m', { from: back('1m'), to: end }).map(toDesk);
  return B;
}
const cut = (B, t) => Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.filter((b) => b.time + SOP.SEC[k] <= t)]));
export const keyOf = (r) => [r.side, r.t, (+r.entry).toPrecision(10), (+r.stop).toPrecision(10)].join('|');

// the desk's 6R reading (deskTrades): one-candle structure, CF / VR zones from sopTrades, fixed-target barrier entries
export function entries(B, F, Y, rr, until = T(Y + 1)) {
  const F1 = SOP.oneCandle(F), c1 = [];
  SOP.sopTrades(cut(B, until), F1, { from: T(Y), market: 'xau', cfOut: c1 });
  return SOP.uniq(SOP.barrierTrades(B, F1, { from: T(Y), market: 'xau', extra: c1, rr, until }))
    .filter((r) => Math.abs(Math.abs(r.target - r.entry) / r.r0 - rr) < 1e-6 && r.t >= T(Y) && r.t < until);
}
// the same entry with its side flipped (stop and target mirrored at the same R), through the desk's own outcome
export function placebo(r, B) {
  const fine = B['1m'].length && B['1m'][0].time <= r.t ? B['1m'] : B['5m'];
  const p = { side: -r.side, entry: r.entry, stop: 2 * r.entry - r.stop, target: 2 * r.entry - r.target };
  return SOP.outcome(p, fine, r.t, !r.mkt);
}

async function year(Y, dir) {
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), B = candles(Y), rows = [], t0 = Date.now();
  if (!B['1m'].length) console.log(Y, 'no M1 candles: M1 confirmations read on M5');
  for (const rr of RRS) {
    for (const r of entries(B, F, Y, rr)) { const p = placebo(r, B);
      rows.push({ rr, key: keyOf(r), id: r.id, t: r.t, side: r.side, entry: r.entry, stop: r.stop, target: r.target, r0: r.r0, h: r.h, l: r.l, withDir: r.withDir ?? null,
        status: r.status, R: r.R, endT: r.endT, Rp: p.R, pStatus: p.status }); }
    console.log(Y, rr + 'R', rows.filter((x) => x.rr === rr).length, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `y${Y}.json`), JSON.stringify({ year: Y, m1: B['1m'].length > 0, rows }));
}

// cut test: the entries before a moment do not change when every candle after it is removed
async function cutTest(Y, dir) {
  const { loadFns } = await import('../../../council/mosha-desk.mjs');
  const F = loadFns(), at = T(Y) + 120 * DAY, Bf = candles(Y, at + 40 * DAY), Bc = cut(Bf, at), out = {};
  for (const rr of RRS) {
    const full = entries(Bf, F, Y, rr, at).filter((r) => r.t + 3600 <= at), short = entries(Bc, F, Y, rr, at).filter((r) => r.t + 3600 <= at);
    const sig = (r) => keyOf(r) + '|' + (+r.target).toPrecision(10), a = full.map(sig).sort(), b = short.map(sig).sort();
    out[rr] = { full: a.length, cut: b.length, same: a.length === b.length && a.every((x, i) => x === b[i]) };
    console.log('cut', Y, rr + 'R', out[rr]);
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `cut${Y}.json`), JSON.stringify({ year: Y, at: new Date(at * 1000).toISOString(), byRR: out }));
}

// ─── statistics ───
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();
export function monthT(rows, key) {
  const m = new Map(); for (const r of rows) m.set(monthOf(r.t), (m.get(monthOf(r.t)) || 0) + r[key]);
  const v = [...m.values()]; if (v.length < 2) return { months: v.length, t: null };
  const mm = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mm) ** 2, 0) / (v.length - 1));
  return { months: v.length, t: sd > 0 ? +(mm / (sd / Math.sqrt(v.length))).toFixed(2) : null };
}
export function stats(rows, key = 'R') {
  const n = rows.length; if (!n) return { n: 0, mean: null, t: null };
  const sum = rows.reduce((s, r) => s + r[key], 0); let eq = 0, pk = 0, dd = 0;
  for (const r of [...rows].sort((a, b) => a.t - b.t)) { eq += r[key]; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, mean: +(sum / n).toFixed(4), total: +sum.toFixed(2), win: +(100 * rows.filter((r) => r[key] > 0).length / n).toFixed(1), dd: +dd.toFixed(1), ...monthT(rows, key) };
}
export const pOne = (t) => { if (t == null) return 1; const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z), erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z); const p = 0.5 * (1 - erf); return t > 0 ? p : 1 - p; };
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = +run.toFixed(4); }); return out; }
const inHalf = (r, h) => { const y = yearOf(r.t); return y >= HALVES[h][0] && y <= HALVES[h][1]; };
const halfPass = (s) => s.n > 0 && s.mean > 0 && (s.t ?? 0) >= 2;

export function judge(all) {
  const done = all.filter((r) => r.R != null), byRR = (rr) => done.filter((r) => r.rr === rr).map((r) => ({ ...r, net: r.R - COST / r.r0, Rp: r.Rp }));
  const sets = Object.fromEntries(RRS.map((rr) => [rr, byRR(rr)]));
  const read = (rows, key) => ({ all: stats(rows, key), discovery: stats(rows.filter((r) => inHalf(r, 'discovery')), key), confirmation: stats(rows.filter((r) => inHalf(r, 'confirmation')), key) });
  // T2 pairs: entries present (and finished) under both 6R and 1R
  const one = new Map(sets[1].map((r) => [r.key, r])), pairs = sets[6].filter((r) => one.has(r.key)).map((r) => ({ t: r.t, d: r.R - one.get(r.key).R, dn: r.net - one.get(r.key).net }));
  const tests = {
    T1: { what: '6R reading: R a trade before costs', rows: sets[6], key: 'R', net: 'net', placebo: true },
    T2: { what: '6R minus 1R, paired by entry', rows: pairs, key: 'd', net: 'dn' },
    T3: { what: '3R reading: R a trade before costs', rows: sets[3], key: 'R', net: 'net', placebo: true } };
  const out = {};
  for (const [id, x] of Object.entries(tests)) {
    const g = read(x.rows, x.key), net = read(x.rows, x.net), pl = x.placebo ? read(x.rows.filter((r) => r.Rp != null), 'Rp') : null;
    out[id] = { what: x.what, gross: g, net, placebo: pl, p: +pOne(g.all.t).toFixed(4) };
  }
  const H = holm(Object.values(out).map((o) => o.p)); Object.values(out).forEach((o, i) => { o.holm = H[i]; });
  for (const o of Object.values(out)) {
    o.checks = { discovery: halfPass(o.gross.discovery), confirmation: halfPass(o.gross.confirmation), holm: o.holm < 0.05 };
    o.pass = Object.values(o.checks).every(Boolean);
    if (o.placebo) o.placeboFlag = (halfPass(o.placebo.discovery) && halfPass(o.placebo.confirmation)) || (o.placebo.all.mean ?? -Infinity) >= (o.gross.all.mean ?? Infinity);
  }
  const few = ['discovery', 'confirmation'].some((h) => out.T1.gross[h].n < 100);
  let verdict;
  if (few) verdict = 'INCONCLUSIVE';
  else if (out.T1.pass && !out.T1.placeboFlag) verdict = 'PASS';
  else if (!out.T1.pass && !out.T2.pass && !out.T3.pass) verdict = 'FAIL';
  else verdict = 'INCONCLUSIVE';
  return { verdict, tests: out, sets, pairs };
}
function split(rows, fn) { const m = {}; for (const r of rows) { const k = fn(r); (m[k] ||= []).push(r); } return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { gross: stats(v, 'R'), net: stats(v, 'net') }])); }

function report(dir) {
  const files = YEARS.map((y) => JSON.parse(fs.readFileSync(path.join(dir, `y${y}.json`), 'utf8')));
  const all = files.flatMap((f) => f.rows), open = Object.fromEntries(RRS.map((rr) => [rr, all.filter((r) => r.rr === rr && r.R == null).length]));
  const J = judge(all), te = J.tests;
  const byTf = {}, byDir = {}, byYear = {};
  const D = (v) => (v === true ? 'with' : v === false ? 'against' : 'none');
  for (const rr of RRS) { byTf[rr] = split(J.sets[rr], (r) => r.h); byDir[rr] = split(J.sets[rr], (r) => D(r.withDir)); byYear[rr] = split(J.sets[rr], (r) => yearOf(r.t)); }
  const cuts = YEARS.map((y) => path.join(dir, `cut${y}.json`)).filter((f) => fs.existsSync(f)).map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const pairInfo = { sixR: J.sets[6].length, paired: J.pairs.length, oneR: J.sets[1].length };
  const t1 = te.T1.gross.all, headline = `6R barrier entries on gold 2010-2019: n ${t1.n}, ${f(t1.mean)}R a trade before costs, month t ${t1.t} (discovery ${f(te.T1.gross.discovery.mean)}R t ${te.T1.gross.discovery.t}; confirmation ${f(te.T1.gross.confirmation.mean)}R t ${te.T1.gross.confirmation.t}); after costs ${f(te.T1.net.all.mean)}R`;
  const strip = (o) => { const { rows, ...rest } = o; return rest; };
  const res = { study: 'mosha-barrier-6r', built: new Date().toISOString().slice(0, 10), verdict: J.verdict, headline,
    system: 'The Mosha desk\'s barrier entries (assets/mosha-sop.js, one-candle structure, as the 6R reading of deskTrades) with fixed 1R, 3R and 6R targets; gold OANDA mid M1 / M5 / D1; 2010-2014 discovery, 2015-2019 confirmation; judged before costs, month-sum t, Holm over three.',
    market: 'xau', years: YEARS, cost: COST, m1Years: files.filter((x) => x.m1).map((x) => x.year), open, pairing: pairInfo,
    tests: Object.fromEntries(Object.entries(te).map(([k, v]) => [k, strip(v)])), byTimeframe: byTf, byDirection: byDir, byYear, cutTest: cuts };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const L = [];
  L.push('# The Mosha desk\'s barrier entries at 1R, 3R and 6R targets, gold 2010-2019', '',
    `**Verdict: ${J.verdict}. ${headline}.**`, '',
    `Built ${res.built}. Pre-registered (PREREGISTRATION.md, committed alone before any run). Paper research only; nothing live changed.`, '',
    '## Tests (before costs; R a trade; t on calendar-month sums)', '',
    '| Test | What | n | R a trade | month t | 2010-14 n / R / t | 2015-19 n / R / t | after costs | Holm p | Pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [id, o] of Object.entries(te)) { const g = o.gross, h = (s) => `${s.n} / ${f(s.mean)} / ${s.t ?? 'n/a'}`;
    L.push(`| ${id} | ${o.what} | ${g.all.n} | ${f(g.all.mean)} | ${g.all.t ?? 'n/a'} | ${h(g.discovery)} | ${h(g.confirmation)} | ${f(o.net.all.mean)} | ${o.holm} | ${o.pass ? 'yes' : 'no'} |`); }
  L.push('', '## Placebo (the same entries, side flipped)', '', '| Test | n | R a trade | month t | 2010-14 R / t | 2015-19 R / t |', '|---|---|---|---|---|---|');
  for (const id of ['T1', 'T3']) { const p = te[id].placebo; L.push(`| ${id} | ${p.all.n} | ${f(p.all.mean)} | ${p.all.t ?? 'n/a'} | ${f(p.discovery.mean)} / ${p.discovery.t ?? 'n/a'} | ${f(p.confirmation.mean)} / ${p.confirmation.t ?? 'n/a'} |`); }
  L.push('', '## Each target, whole window', '', '| Target | n | win % | R a trade (before) | month t | after costs | worst drawdown R | still open, left out |', '|---|---|---|---|---|---|---|---|');
  for (const rr of RRS) { const g = stats(J.sets[rr], 'R'), n = stats(J.sets[rr], 'net'); L.push(`| ${rr}R | ${g.n} | ${g.win} | ${f(g.mean)} | ${g.t ?? 'n/a'} | ${f(n.mean)} | ${g.dd} | ${open[rr]} |`); }
  L.push('', `Pairing: ${pairInfo.paired} of ${pairInfo.sixR} 6R entries are the same entry (side, time, entry, stop) as a 1R entry (${pairInfo.oneR} 1R entries).`);
  const tbl = (title, m, order) => { L.push('', `## ${title} (R a trade before costs, n)`, '', '| | ' + RRS.map((r) => r + 'R').join(' | ') + ' | 6R after costs |', '|---|' + RRS.map(() => '---').join('|') + '|---|');
    for (const k of order.filter((k) => RRS.some((rr) => m[rr][k]))) L.push(`| ${k} | ` + RRS.map((rr) => m[rr][k] ? `${f(m[rr][k].gross.mean)} (${m[rr][k].gross.n}, t ${m[rr][k].gross.t ?? 'n/a'})` : 'n/a').join(' | ') + ` | ${m[6][k] ? f(m[6][k].net.mean) : 'n/a'} |`); };
  tbl('By barrier timeframe', byTf, ['1d', '4h', '1h', '30m', '15m']);
  tbl('With / against the direction of the timeframe above the barrier', byDir, ['with', 'against', 'none']);
  tbl('By year', byYear, YEARS.map(String));
  L.push('', '## Notes', '',
    `- M1 candles on file for ${res.m1Years.length} of ${YEARS.length} years (${res.m1Years.join(', ') || 'none'}); a year without them reads its M1 confirmations on M5.`,
    `- Cost: $${COST} a round trip (COSTS.xau), R − ${COST} / r0.`,
    '- Several barrier entries can be open at once (the desk records every one); month sums carry that clustering.',
    `- Cut test: ${cuts.length ? cuts.map((c) => `${c.year} at ${c.at.slice(0, 10)}: ` + RRS.map((rr) => `${rr}R ${c.byRR[rr].full} entries, ${c.byRR[rr].same ? 'identical' : 'DIFFERENT'}`).join('; ')).join(' · ') : 'not run'}.`,
    '- No variant is tested on these years after this run.');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n');
  console.log(J.verdict, headline);
}
function f(v, d = 3) { return v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d); }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'year') await year(+a, b); else if (cmd === 'cut') await cutTest(+a, b); else if (cmd === 'report') report(a);
}
