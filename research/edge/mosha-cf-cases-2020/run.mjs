// research/edge/mosha-cf-cases-2020/run.mjs - the Mosha sequence's CF-inside-the-VR case and the 50 % pullback before the CF
// (PREREGISTRATION.md, 23 Nov 2026). The desk's own sequence code, imported; nothing here changes a rule.
//   node research/edge/mosha-cf-cases-2020/run.mjs market <market> <dir>   that market's kept trades into <dir>/cf-<market>.json
//   node research/edge/mosha-cf-cases-2020/run.mjs cut <dir>                the cut test (gold) into <dir>/cut.json
//   node research/edge/mosha-cf-cases-2020/run.mjs report <dir>             result.json and RESULT.md
// Research only: reads the edgekit candle cache, writes only to <dir> and its own folder.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { loadFns } from '../../../council/mosha-desk.mjs';

const require = createRequire(import.meta.url), SOP = require('../../../assets/mosha-sop.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const START = T('2020-01-01'), SPLIT = T('2024-01-01'), WARM = '2019-01-01';
export const PRIMARY = ['xau', 'eurusd', 'gbpusd'];
export const OTHERS = ['usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', 'xag', 'gbpjpy', 'eurgbp', 'audjpy', 'cadjpy', 'euraud', 'nas100', 'spx500', 'de40'];
export const ALLM = [...PRIMARY, ...OTHERS];
const DEC = { nzdusd: 5, usdchf: 5, eurjpy: 3, gbpjpy: 3, eurgbp: 5, audjpy: 3, cadjpy: 3, euraud: 5 };
// markets outside the desk's own list: the desk's share-of-price buffer (pre-registered; the module object is extended in this process only)
for (const [k, d] of Object.entries(DEC)) if (!SOP.ALL[k]) SOP.ALL[k] = { name: k.toUpperCase(), dec: d };
export const KEEP = /^(?:[a-z0-9]+:)?sop-(c2-)?(i-)?(5m|15m|30m|1h|4h)-\d+$/;

const cv = (a) => a.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
function candles(mk, to) {
  const M5 = K.load(mk, '5m', { from: WARM, to });
  return { M5, B: { '5m': cv(M5), '15m': cv(K.resample(M5, 900)), '30m': cv(K.resample(M5, 1800)), '1h': cv(K.resample(M5, 3600)), '4h': cv(K.resample(M5, 14400)), '1d': cv(K.load(mk, '1d', { from: '2013-01-01', to })) } };
}
const first = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].t < t) lo = m + 1; else hi = m; } return lo; };

// pullback past the 50 % line between the 5-minute candle that made the VR's extreme and the close of the CF candle
export function deepBeforeCF(r, M5) {
  const m = r.marks || [], bo = m[0], vr = m[1], cf = m.find((x) => x.kind === 'zone'), p50 = m.find((x) => /^50%/.test(x.label || ''));
  if (!bo || !vr || !cf || !p50) return null;
  const d = r.side, x = r.target; let i = first(M5, bo.a), xi = -1;
  for (; i < M5.length && M5[i].t < vr.at; i++) { const v = d > 0 ? M5[i].h : M5[i].l; if (Math.abs(v - x) <= 1e-9 * Math.abs(x)) { xi = i; break; } }
  if (xi < 0) return null;
  for (let j = xi + 1; j < M5.length && M5[j].e <= cf.at; j++) if (d > 0 ? M5[j].l <= p50.p : M5[j].h >= p50.p) return true;
  return false;
}

export function rowsOf(mk, R, M5, X = []) {
  const inBad = (t) => X.some(([a, b]) => t >= a && t <= b);
  return R.filter((r) => KEEP.test(r.id) && (r.status === 'target' || r.status === 'stopped') && Number.isFinite(r.R) && r.r0 > 0 && r.t >= START && !inBad(r.t))
    .map((r) => ({ id: r.id, t: r.t, side: r.side, case: r.case, ibo: !!r.ibo, h: r.h, l: r.l, ll: r.ll || r.l, R: +r.R.toFixed(5), entry: r.entry, r0: r.r0,
      costR: +(COSTS[mk] / r.r0).toFixed(5), deepCF: deepBeforeCF(r, M5), deepRec: r.deep == null ? null : r.deep, status: r.status }));
}

function market(mk, dir) {
  const t0 = Date.now(), { M5, B } = candles(mk);
  const R = SOP.sopTrades(B, loadFns(), { from: START, market: mk, nest: false, cfLimit: false });
  const X = exclusions(mk), rows = rowsOf(mk, R, M5, X);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `cf-${mk}.json`), JSON.stringify({ market: mk, records: R.length, kept: rows.length, excluded: X.length, last: M5.length ? M5[M5.length - 1].e : null, rows }));
  console.log(mk, R.length, 'records', rows.length, 'kept', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}

// gold run to 2020-07-01, cut at 2020-06-01: every kept record filled by the cut must be the same in both
function cut(dir) {
  const CUT = T('2020-06-01'), F = loadFns(), sig = (r) => [r.id, r.side, r.entry, r.stop, r.target, r.case].join('|');
  const run = (to) => { const { B } = candles('xau', to); return SOP.sopTrades(B, F, { from: START, market: 'xau', nest: false, cfLimit: false }).filter((r) => KEEP.test(r.id) && r.t <= CUT); };
  const a = run('2020-07-01').map(sig).sort(), b = run('2020-06-01').map(sig).sort();
  const same = a.length === b.length && a.every((x, i) => x === b[i]);
  const out = { market: 'xau', cut: '2020-06-01', long: a.length, short: b.length, ok: same, onlyLong: a.filter((x) => !b.includes(x)).length, onlyShort: b.filter((x) => !a.includes(x)).length };
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'cut.json'), JSON.stringify(out)); console.log(out);
}

// ─── statistics ───
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const vari = (v) => { const m = mean(v); return v.length > 1 ? v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1) : null; };
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null, df: null, p: null };
  const va = vari(a) / a.length, vb = vari(b) / b.length, se = Math.sqrt(va + vb), diff = mean(a) - mean(b);
  if (!(se > 0)) return { diff, t: null, df: null, p: null };
  const t = diff / se, df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { diff, t, df, p: K.pFromT(t, df) };
}
const monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthDiff(A, B, key) {
  const m = new Map(); for (const [rows, k] of [[A, 'a'], [B, 'b']]) for (const r of rows) { const x = m.get(monthOf(r.t)) || { a: [], b: [] }; x[k].push(r[key]); m.set(monthOf(r.t), x); }
  const d = [...m.values()].filter((x) => x.a.length && x.b.length).map((x) => mean(x.a) - mean(x.b));
  if (d.length < 2) return { months: d.length, diff: d.length ? d[0] : null, t: null };
  const mm = mean(d), v = vari(d); return { months: d.length, diff: mm, t: v > 0 ? mm / Math.sqrt(v / d.length) : null };
}
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(4)), r2 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(2));
function one(rows, key = 'net') {
  if (!rows.length) return { n: 0, mean: null, win: null, total: null, tMonth: null, months: 0 };
  const s = K.stats(rows.map((r) => ({ t: r.t, Rnet: r[key] })), { key: 'Rnet', time: 't' });
  return { n: s.n, mean: r4(s.meanR), win: +(100 * s.wins / s.n).toFixed(1), total: r2(s.total), tMonth: r2(s.tMonth), months: s.months, pMonth: s.pMonth == null ? null : +s.pMonth.toFixed(4) };
}
const disc = (x) => x.filter((r) => r.t < SPLIT), conf = (x) => x.filter((r) => r.t >= SPLIT);
function compare(A, B) {
  const w = (a, b, key) => { const x = welch(a.map((r) => r[key]), b.map((r) => r[key])); return { diff: r4(x.diff), t: r2(x.t), df: r2(x.df), p: x.p == null ? null : +x.p.toFixed(5) }; };
  return { disc: { a: one(disc(A)), b: one(disc(B)), ...w(disc(A), disc(B), 'net'), net2: w(disc(A), disc(B), 'net2'), gross: w(disc(A), disc(B), 'R') },
    conf: { a: one(conf(A)), b: one(conf(B)), ...w(conf(A), conf(B), 'net'), net2: w(conf(A), conf(B), 'net2'), gross: w(conf(A), conf(B), 'R'), month: (() => { const m = monthDiff(conf(A), conf(B), 'net'); return { months: m.months, diff: r4(m.diff), t: r2(m.t) }; })() } };
}
function single(A) { return { disc: { net: one(disc(A)), net2: one(disc(A), 'net2'), gross: one(disc(A), 'R') }, conf: { net: one(conf(A)), net2: one(conf(A), 'net2'), gross: one(conf(A), 'R') } }; }
const T1 = (rows) => compare(rows.filter((r) => r.case === 2), rows.filter((r) => r.case === 1));
const T2 = (rows) => compare(rows.filter((r) => r.deepCF === true), rows.filter((r) => r.deepCF === false));
const T3 = (rows) => single(rows.filter((r) => r.case === 1));

function loadRows(dir, markets) {
  let rows = []; const meta = {};
  for (const mk of markets) { const f = path.join(dir, `cf-${mk}.json`); if (!fs.existsSync(f)) continue; const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    meta[mk] = { records: j.records, kept: j.kept, last: j.last }; rows = rows.concat(j.rows.map((r) => ({ ...r, market: mk, net: r.R - r.costR, net2: r.R - 2 * r.costR }))); }
  return { rows: rows.sort((a, b) => a.t - b.t), meta };
}

function report(dir) {
  const { rows, meta } = loadRows(dir, ALLM), P = rows.filter((r) => PRIMARY.includes(r.market));
  const cutT = JSON.parse(fs.readFileSync(path.join(dir, 'cut.json'), 'utf8'));
  const tests = { T1: { what: 'CF inside the VR (case 2) minus CF clear of it (case 1)', ...T1(P) }, T2: { what: 'pullback past 50 % before the CF minus not', ...T2(P) }, T3: { what: 'the clear-CF (case 1) sequence alone', ...T3(P) } };
  // Holm over T1-T3: T1 / T2 two-sided Welch p in confirmation, T3 one-sided month-sum p in confirmation
  const pT3 = tests.T3.conf.net.tMonth == null ? 1 : tests.T3.conf.net.tMonth > 0 ? tests.T3.conf.net.pMonth / 2 : 1 - tests.T3.conf.net.pMonth / 2;
  const ps = [tests.T1.conf.p ?? 1, tests.T2.conf.p ?? 1, pT3], H = K.holm(ps);
  ['T1', 'T2', 'T3'].forEach((id, i) => { tests[id].p = +ps[i].toFixed(5); tests[id].holm = +H[i].toFixed(5); });
  for (const id of ['T1', 'T2']) { const t = tests[id], sg = Math.sign(t.disc.diff || 0);
    const few = t.disc.a.n < 100 || t.disc.b.n < 100 || t.conf.a.n < 50 || t.conf.b.n < 50;
    t.checks = { nDiscovery100Each: t.disc.a.n >= 100 && t.disc.b.n >= 100, discoveryAbsT2: Math.abs(t.disc.t || 0) >= 2, nConfirmation50Each: t.conf.a.n >= 50 && t.conf.b.n >= 50,
      confirmationSameSign: sg !== 0 && Math.sign(t.conf.diff || 0) === sg, holmBelow05: t.holm < 0.05, monthPairedSameSign: sg !== 0 && Math.sign(t.conf.month.diff || 0) === sg,
      sameSignAt2xCost: sg !== 0 && Math.sign(t.disc.net2.diff || 0) === sg && Math.sign(t.conf.net2.diff || 0) === sg };
    t.better = sg > 0 ? 'first' : sg < 0 ? 'second' : 'none';
    t.verdict = few ? 'INCONCLUSIVE (a side under its n)' : Object.values(t.checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  { const t = tests.T3; t.checks = { nDiscovery100: t.disc.net.n >= 100, discoveryMeanPositive: (t.disc.net.mean || 0) > 0, discoveryTMonth2: (t.disc.net.tMonth || 0) >= 2,
      nConfirmation50: t.conf.net.n >= 50, confirmationMeanPositive: (t.conf.net.mean || 0) > 0, confirmationTMonth2: (t.conf.net.tMonth || 0) >= 2, holmBelow05: t.holm < 0.05,
      positiveAt2xCost: (t.disc.net2.mean || 0) > 0 && (t.conf.net2.mean || 0) > 0 };
    t.verdict = t.disc.net.n < 100 || t.conf.net.n < 50 ? 'INCONCLUSIVE (under its n)' : Object.values(t.checks).every(Boolean) ? 'PASS' : 'FAIL'; }
  const inconc = ['T1', 'T2'].some((id) => /^INCONCLUSIVE/.test(tests[id].verdict)) || /^INCONCLUSIVE/.test(tests.T3.verdict);
  const verdict = !cutT.ok ? 'INVALID' : tests.T3.verdict === 'PASS' ? 'PASS' : inconc ? 'INCONCLUSIVE' : 'FAIL';
  // reported, not tested
  const per = {}; for (const mk of ALLM) { const x = rows.filter((r) => r.market === mk); if (!meta[mk]) continue;
    const t1 = T1(x), t2 = T2(x), t3 = T3(x);
    per[mk] = { kept: x.length, case1: x.filter((r) => r.case === 1).length, case2: x.filter((r) => r.case === 2).length, deep: x.filter((r) => r.deepCF === true).length, notDeep: x.filter((r) => r.deepCF === false).length,
      T1: { disc: { diff: t1.disc.diff, t: t1.disc.t }, conf: { diff: t1.conf.diff, t: t1.conf.t } }, T2: { disc: { diff: t2.disc.diff, t: t2.disc.t }, conf: { diff: t2.conf.diff, t: t2.conf.t } },
      T3: { disc: { n: t3.disc.net.n, mean: t3.disc.net.mean, tMonth: t3.disc.net.tMonth }, conf: { n: t3.conf.net.n, mean: t3.conf.net.mean, tMonth: t3.conf.net.tMonth } } }; }
  const pool18 = { T1: T1(rows), T2: T2(rows), T3: T3(rows) };
  const splitBy = (f) => { const g = {}; for (const r of P) (g[f(r)] ||= []).push(r); return Object.fromEntries(Object.entries(g).sort().map(([k, v]) => [k, { case1: one(v.filter((r) => r.case === 1)), case2: one(v.filter((r) => r.case === 2)) }])); };
  const splits = { byPair: splitBy((r) => `${r.h}>${r.l}>${r.ll}`), byBo: splitBy((r) => (r.ibo ? 'internal BO' : 'major BO')), byMarket: splitBy((r) => r.market),
    deepRecord: compare(P.filter((r) => r.deepRec === true), P.filter((r) => r.deepRec === false)),
    deepByCase: { case1: compare(P.filter((r) => r.case === 1 && r.deepCF === true), P.filter((r) => r.case === 1 && r.deepCF === false)), case2: compare(P.filter((r) => r.case === 2 && r.deepCF === true), P.filter((r) => r.case === 2 && r.deepCF === false)) },
    noLine: P.filter((r) => r.deepCF == null).length, allSequence: single(P) };
  const f = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  const t1 = tests.T1, t2 = tests.T2, t3 = tests.T3;
  const headline = `T1 case 2 minus case 1 ${f(t1.conf.diff)}R (confirmation n ${t1.conf.a.n} / ${t1.conf.b.n}, Welch t ${t1.conf.t}); T2 past 50 % minus not ${f(t2.conf.diff)}R (n ${t2.conf.a.n} / ${t2.conf.b.n}, t ${t2.conf.t}); T3 clear-CF sequence ${f(t3.conf.net.mean)}R a trade after costs in confirmation (n ${t3.conf.net.n}, month t ${t3.conf.net.tMonth}), ${f(t3.disc.net.mean)}R in discovery (n ${t3.disc.net.n}, month t ${t3.disc.net.tMonth})`;
  const lastT = Math.max(...Object.values(meta).map((m) => m.last || 0));
  const out = { study: 'mosha-cf-cases-2020', built: new Date().toISOString().slice(0, 10), verdict, headline,
    system: 'The Mosha desk\'s sequence (BO, VR, CF, pullback, EG) as assets/mosha-sop.js sopTrades reads it on 23 Nov 2026 (six-candle structure, nest and CF-limit readings off); EG entries of the main sequence; OANDA mid 5m from the edgekit cache; after the combo-grid-2 costs.',
    markets: { primary: PRIMARY, reported: OTHERS }, windows: { discovery: ['2020-01-01', '2023-12-31'], confirmation: ['2024-01-01', new Date(lastT * 1000).toISOString().slice(0, 10)] },
    cutTest: cutT, meta, trades: { primary: P.length, all: rows.length }, tests, perMarket: per, pool18: { T1: { conf: pool18.T1.conf, disc: pool18.T1.disc }, T2: { conf: pool18.T2.conf, disc: pool18.T2.disc }, T3: pool18.T3 }, splits };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  const L = [];
  L.push('# Mosha sequence: the CF inside the VR, and the 50 % pullback before the CF', '',
    `**Verdict: ${verdict}. ${headline}.**`, '',
    `Built ${out.built}. Pre-registered (PREREGISTRATION.md, committed before any trade was computed). Paper research only; nothing live changed.`,
    `Gold, EUR/USD and GBP/USD (primary); discovery 2020-2023, confirmation 2024 to ${out.windows.confirmation[1]}; R a trade after the round-trip cost; ${P.length} closed sequence entries in the primary pool, ${rows.length} on all 18 markets.`,
    `Cut test (gold, cut at 2020-06-01): ${cutT.ok ? 'passed' : 'FAILED'} (${cutT.short} records filled by the cut, identical in both runs: ${cutT.ok}).`, '',
    '## T1 and T2: does one subset do better? (difference of mean net R a trade, Welch t)', '',
    '| Test | Window | first n | first R | second n | second R | difference | Welch t | at 2x cost | Holm p | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const id of ['T1', 'T2']) { const t = tests[id]; for (const [w, x] of [['discovery', t.disc], ['confirmation', t.conf]])
    L.push(`| ${id} ${w === 'discovery' ? t.what : ''} | ${w} | ${x.a.n} | ${f(x.a.mean)} | ${x.b.n} | ${f(x.b.mean)} | ${f(x.diff)} | ${x.t ?? 'n/a'} | ${f(x.net2.diff)} | ${w === 'confirmation' ? t.holm : ''} | ${w === 'confirmation' ? t.verdict : ''} |`); }
  L.push('', `Month-paired difference in confirmation: T1 ${f(t1.conf.month.diff)} (${t1.conf.month.months} months, t ${t1.conf.month.t ?? 'n/a'}), T2 ${f(t2.conf.month.diff)} (${t2.conf.month.months} months, t ${t2.conf.month.t ?? 'n/a'}).`,
    `T1 checks: ${Object.entries(t1.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}.`, `T2 checks: ${Object.entries(t2.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}.`, '',
    '## T3: the clear-CF sequence alone, against the common bar', '', '| Window | n | win % | net R a trade | month t | before costs | at 2x cost |', '|---|---|---|---|---|---|---|');
  for (const [w, x] of [['discovery', t3.disc], ['confirmation', t3.conf]]) L.push(`| ${w} | ${x.net.n} | ${x.net.win} | ${f(x.net.mean)} | ${x.net.tMonth ?? 'n/a'} | ${f(x.gross.mean)} | ${f(x.net2.mean)} |`);
  L.push('', `Holm p ${t3.holm}. Checks: ${Object.entries(t3.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}. Verdict ${t3.verdict}.`, '',
    '## Reported, not tested: each market (net R a trade; confirmation unless said)', '', '| Market | kept | case 1 / case 2 | T1 diff (t) | T2 diff (t) | T3 discovery n, R, month t | T3 confirmation n, R, month t |', '|---|---|---|---|---|---|---|');
  for (const [mk, x] of Object.entries(per)) L.push(`| ${mk} | ${x.kept} | ${x.case1} / ${x.case2} | ${f(x.T1.conf.diff)} (${x.T1.conf.t ?? 'n/a'}) | ${f(x.T2.conf.diff)} (${x.T2.conf.t ?? 'n/a'}) | ${x.T3.disc.n}, ${f(x.T3.disc.mean)}, ${x.T3.disc.tMonth ?? 'n/a'} | ${x.T3.conf.n}, ${f(x.T3.conf.mean)}, ${x.T3.conf.tMonth ?? 'n/a'} |`);
  const q = pool18;
  L.push('', `18-market pool, descriptive: T1 confirmation ${f(q.T1.conf.diff)} (n ${q.T1.conf.a.n} / ${q.T1.conf.b.n}, t ${q.T1.conf.t}), T2 ${f(q.T2.conf.diff)} (n ${q.T2.conf.a.n} / ${q.T2.conf.b.n}, t ${q.T2.conf.t}), clear-CF sequence ${f(q.T3.conf.net.mean)}R (n ${q.T3.conf.net.n}, month t ${q.T3.conf.net.tMonth}) in confirmation and ${f(q.T3.disc.net.mean)}R (n ${q.T3.disc.net.n}, month t ${q.T3.disc.net.tMonth}) in discovery.`, '',
    '## Splits of the primary pool, descriptive (net R a trade, whole window)', '', '| Split | case 1 n | case 1 R | case 2 n | case 2 R |', '|---|---|---|---|---|');
  for (const [nm, g] of [['', splits.byPair], ['', splits.byBo], ['', splits.byMarket]]) for (const [k, v] of Object.entries(g)) L.push(`| ${nm}${k} | ${v.case1.n} | ${f(v.case1.mean)} | ${v.case2.n} | ${f(v.case2.mean)} |`);
  const dr = splits.deepRecord, dc = splits.deepByCase;
  L.push('', `The record's own "reached 50 % by the entry" flag, confirmation: ${dr.conf.a.n} past vs ${dr.conf.b.n} not, difference ${f(dr.conf.diff)} (t ${dr.conf.t ?? 'n/a'}). T2 within case 1 (confirmation): ${f(dc.case1.conf.diff)} (n ${dc.case1.conf.a.n} / ${dc.case1.conf.b.n}, t ${dc.case1.conf.t ?? 'n/a'}); within case 2: ${f(dc.case2.conf.diff)} (n ${dc.case2.conf.a.n} / ${dc.case2.conf.b.n}, t ${dc.case2.conf.t ?? 'n/a'}). Records with no 50 % line (left out of T2): ${splits.noLine}.`,
    `Whole sequence (both cases), primary pool: discovery ${f(splits.allSequence.disc.net.mean)}R (n ${splits.allSequence.disc.net.n}, month t ${splits.allSequence.disc.net.tMonth}), confirmation ${f(splits.allSequence.conf.net.mean)}R (n ${splits.allSequence.conf.net.n}, month t ${splits.allSequence.conf.net.tMonth}).`, '',
    '## Reading', '', 'A difference between two subsets is not an edge; the whole-sequence and clear-CF figures above are what a trader of this reading would have had. No variant was run after the result.');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n') + '\n'); console.log(verdict, headline);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') market(a, b); else if (cmd === 'cut') cut(a); else if (cmd === 'report') report(a);
  else console.log('usage: run.mjs market <m> <dir> | cut <dir> | report <dir>');
}
