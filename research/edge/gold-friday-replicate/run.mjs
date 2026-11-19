// Edge research · gold-friday-replicate: does gold-weekday's T2 (long every Friday 17:00-New-York session) replicate?
// PREREGISTRATION.md (pushed alone first). Every trading function comes from original.mjs, a verbatim copy of branch
// gold-weekday's run.mjs (sha256 pinned in the test); this file loads candles, splits trades and writes the report.
//   node research/edge/gold-friday-replicate/run.mjs fetch <dir>                       HistData M1 from origin/council-data (git show, no network)
//   node research/edge/gold-friday-replicate/run.mjs run <xau-h1.json> <dir> <xaueur-5m.json.gz>
// Candle caches stay out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';
import { HISTORY, EVENTS } from '../../../council/events.mjs';
import { FIN } from '../../../council/fills.mjs';
import { days } from '../gold-drd-long/run.mjs';
import * as O from './original.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const H = 3600, DAY = 86400;
export const ORIG_SHA = '7cc7253fe685f8912422743571e61e31a69a2b2435d374443b08526066a85c68';
export const FRI = 5, SIDE = 1;
export const G0 = { n: 500, nTol: 3, net: 0.060, netTol: 0.003 };
export const W2 = ['2018-01-01', '2026-10-31'];
export const EUR_COST = 0.00016;            // 0.016 % of the entry price a round trip (assumed)
export const R1_T = 1.5, T_BAR = 2, HOLM_BAR = 0.05;
export const HIST_DIR = 'research/candles/xau-histdata';
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);
const pad = (n) => String(n).padStart(2, '0');
const ymdMs = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

// ─── payroll release dates ───
// before 2022: the BLS rule as written in branch gold-pre-nfp-replicate dates.mjs (copied, derived, not checked on bls.gov)
export function holidays(y) {
  const obs = (m, d) => { const t = Date.UTC(y, m, d), w = new Date(t).getUTCDay(); return ymdMs(w === 6 ? t - DAY * 1e3 : w === 0 ? t + DAY * 1e3 : t); };
  return new Set([obs(0, 1), obs(6, 4), obs(11, 25), ymdMs(Date.UTC(y + 1, 0, 1) - (new Date(Date.UTC(y + 1, 0, 1)).getUTCDay() === 6 ? DAY * 1e3 : 0))]);
}
export function derive(y, m) {
  const D = DAY * 1e3, t12 = Date.UTC(y, m, 12), sat = t12 + (6 - new Date(t12).getUTCDay()) * D;
  let fri = sat + 20 * D;
  const f = new Date(fri);
  if (f.getUTCMonth() === 0 && f.getUTCDate() <= 3) fri += 7 * D;
  const d = ymdMs(fri);
  return holidays(new Date(fri).getUTCFullYear()).has(d) ? ymdMs(fri - D) : d;
}
export const EXCEPTIONS = { '2013-09': '2013-10-22', '2013-10': '2013-11-08' };
export function payrollDates() {
  const s = new Set();
  for (let y = 2005; y <= 2021; y++) for (let m = 0; m < 12; m++) { const d = EXCEPTIONS[`${y}-${pad(m + 1)}`] || derive(y, m); if (d < '2022-01-01') s.add(d); }
  for (const e of [...HISTORY, ...EVENTS]) if (e.type === 'NFP') s.add(e.local.slice(0, 10));
  return s;
}
export const dayYmd = (d) => ymdMs(d * DAY * 1000);                     // a 17:00 New York day's closing date
export const proxyPayroll = (ymd) => +ymd.slice(8, 10) <= 7;            // ict/tracker.mjs fallback (Friday dated 1st-7th)

// ─── candles -> UTC H1 [{ time, open, high, low, close }] ───
export function toH1(rows) {
  const s = [...rows].sort((a, b) => a[0] - b[0]), out = [];
  let cur = null;
  for (const [t, o, h, l, c] of s) {
    const b = t - (t % H);
    if (!cur || cur.time !== b) { cur = { time: b, open: o, high: h, low: l, close: c }; out.push(cur); }
    else { cur.high = Math.max(cur.high, h); cur.low = Math.min(cur.low, l); cur.close = c; }
  }
  return out;
}
export function parseHist(text, seen = new Set()) {
  const out = [];
  for (const line of text.split('\n')) {
    if (line.length < 20) continue;
    const f = line.split(';'), t = histStampUtc(f[0]);
    if (!Number.isFinite(t) || seen.has(t)) continue;
    seen.add(t); out.push([t, +f[1], +f[2], +f[3], +f[4]]);
  }
  return out;
}

// ─── the frozen rule on a candle set ───
export function setup(h1) { const ds = O.enrich(days(h1)), idx = O.dayIndex(h1); return { h1, ds, idx }; }
export const fridays = (S) => O.runWeekday(S.h1, S.idx, S.ds, FRI, SIDE);
// another round-trip cost as a fraction of price (R3); financing as the original
export const recost = (x, frac) => { const cost = frac * x.entry / x.risk; return { ...x, cost, net: x.gross - cost - x.fin, net2: x.gross - 2 * cost - 2 * x.fin }; };
// the original's placebo, with an optional cost change (identity = the original; checked in the test)
export function placeboWith(S, real, adj = (x) => x, seeds = 40) {
  const { h1, idx, ds } = S, byYear = new Map();
  ds.forEach((x, i) => { if (!(x.atr > 0)) return; const y = O.ymd(x.t).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(i); });
  const means = [];
  for (let s = 1; s <= seeds; s++) { const r = O.rng(2000 + s), T = [];
    for (const x of real) { const pool = byYear.get(O.ymd(x.entryT).slice(0, 4)); let tr = null;
      for (let k = 0; k < 20 && !tr; k++) tr = O.simulate(h1, idx, ds, pool[Math.floor(r() * pool.length)], x.side);
      if (tr) T.push(adj(tr).net); }
    means.push(T.reduce((a, b) => a + b, 0) / T.length); }
  return means;
}
export function plSum(means, real) {
  const s = [...means].sort((a, b) => a - b), m = real.reduce((a, x) => a + x.net, 0) / real.length;
  return { beaten: means.filter((v) => m > v).length, of: means.length, p5: r3(s[1]), median: r3(s[19]), p95: r3(s[37]) };
}
export function splitPayroll(T, ds, isPay) {
  const pay = [], other = [];
  for (const x of T) (isPay(dayYmd(ds[x.i].d)) ? pay : other).push(x);
  return { pay, other };
}
export const pOf = (t) => 1 - O.phi(t || 0);

// ─── HistData fetch (git show, no network) ───
const git = (args) => execFileSync('git', args, { cwd: path.resolve(HERE, '../../..'), maxBuffer: 1 << 30 });
function fetchHist(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const files = git(['ls-tree', '--name-only', 'origin/council-data', HIST_DIR + '/']).toString().split('\n').filter((p) => /XAUUSD_M1_\d+\.csv\.gz$/.test(p)).sort();
  for (const f of files) fs.writeFileSync(path.join(dir, path.basename(f)), git(['show', `origin/council-data:${f}`]));
  console.log(`${files.length} files -> ${dir}`);
}
function loadHist(dir) {
  const seen = new Set(), rows = [];
  for (const f of fs.readdirSync(dir).filter((p) => /XAUUSD_M1_\d+\.csv\.gz$/.test(p)).sort())
    for (const r of parseHist(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString(), seen)) rows.push(r);
  return toH1(rows);
}

function main(oandaFile, histDir, eurFile) {
  const out = { built: '2026-11-14', original: { branch: 'gold-weekday', file: 'research/edge/gold-weekday/run.mjs', sha256: ORIG_SHA },
    rule: 'long every Friday 17:00 New York session: first H1 open -> last H1 close, stop 1 x ATR(20) checked on H1; $0.60 a round trip + FIN.xau.long on longs (original.mjs)', windows: { is: O.WIN.is, oos: O.WIN.oos, r2: W2 } };
  // G0: reproduce the original on OANDA
  const oa = setup(JSON.parse(fs.readFileSync(oandaFile, 'utf8')).map(([time, open, high, low, close]) => ({ time, open, high, low, close })));
  const allO = fridays(oa), oosO = O.inWin(allO, O.WIN.oos), isO = O.inWin(allO, O.WIN.is), g = O.summary(oosO, O.WIN.oos);
  out.data = { oanda: { src: 'OANDA mid H1 XAU_USD (gold-weekday fetch.mjs request; cache out of git)', from: O.ymd(oa.h1[0].time), to: O.ymd(oa.h1.at(-1).time), h1: oa.h1.length } };
  out.g0 = { n: g.n, net: g.net, t: g.t, pass: Math.abs(g.n - G0.n) <= G0.nTol && Math.abs(g.net - G0.net) <= G0.netTol, original: { n: 500, net: 0.060, t: 2.10 } };
  if (!out.g0.pass) { out.verdict = 'STOPPED'; write(out); return; }
  out.original = { ...out.original, oos: g, is: O.summary(isO, O.WIN.is) };

  // R1: payroll split
  const pays = payrollDates(), isPay = (d) => pays.has(d);
  const sp = (T, f, w) => { const s = splitPayroll(T, oa.ds, f); return { pay: O.summary(s.pay, w), other: O.summary(s.other, w), otherT: s.other }; };
  const r1o = sp(oosO, isPay, O.WIN.oos), r1i = sp(isO, isPay, O.WIN.is), r1p = sp(oosO, proxyPayroll, O.WIN.oos);
  out.R1 = { def: 'payroll Friday = closing date is a US Employment Situation release (events.mjs from 2022, BLS rule before)', bar: `other Fridays OOS net > 0 and month t >= ${R1_T}`,
    oos: { pay: r1o.pay, other: r1o.other }, is: { pay: r1i.pay, other: r1i.other }, proxy: { oos: { pay: r1p.pay, other: r1p.other } },
    placeboOther: plSum(placeboWith(oa, r1o.otherT), r1o.otherT) };
  out.R1.survives = r1o.other.net > 0 && r1o.other.t >= R1_T;

  // R2: HistData
  const hd = setup(loadHist(histDir)), allH = fridays(hd), r2T = O.inWin(allH, W2), r2 = O.summary(r2T, W2);
  out.data.histdata = { src: 'HistData XAU/USD M1 bid (council-data research/candles/xau-histdata, council/histdata.mjs histStampUtc) -> UTC H1', from: O.ymd(hd.h1[0].time), to: O.ymd(hd.h1.at(-1).time), h1: hd.h1.length };
  out.R2 = { window: W2, histdata: r2, oandaSameWindow: O.summary(O.inWin(allO, W2), W2), placebo: plSum(placeboWith(hd, r2T), r2T), p: +pOf(r2.t).toFixed(4) };
  // matched sessions (both feeds), deciding nothing
  const keyO = new Map(O.inWin(allO, W2).map((x) => [oa.ds[x.i].d, x])), both = r2T.filter((x) => keyO.has(hd.ds[x.i].d));
  out.R2.agreement = { histdata: r2T.length, oanda: keyO.size, both: both.length, sameSign: both.filter((x) => Math.sign(x.gross) === Math.sign(keyO.get(hd.ds[x.i].d).gross)).length };

  // R3: XAU/EUR
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(eurFile)));
  const eu = setup(toH1(rows)), adj = (x) => recost(x, EUR_COST), allE = fridays(eu).map(adj);
  const oosE = O.inWin(allE, O.WIN.oos), isE = O.inWin(allE, O.WIN.is), r3o = O.summary(oosE, O.WIN.oos);
  out.data.xaueur = { src: 'OANDA mid M5 XAU_EUR via the site proxy (cache out of git) -> UTC H1', from: O.ymd(eu.h1[0].time), to: O.ymd(eu.h1.at(-1).time), h1: eu.h1.length, m5: rows.length };
  out.R3 = { cost: `${EUR_COST * 100} % of the entry price a round trip (assumed)`, financing: FIN.xau.long, oos: r3o, is: O.summary(isE, O.WIN.is), placebo: plSum(placeboWith(eu, oosE, adj), oosE), p: +pOf(r3o.t).toFixed(4) };

  const [h2, h3] = O.holm([out.R2.p, out.R3.p]);
  out.R2.holm = +h2.toFixed(4); out.R3.holm = +h3.toFixed(4);
  out.R2.pass = r2.net > 0 && r2.t >= T_BAR && out.R2.holm < HOLM_BAR && r2.net2x > 0;
  out.R3.pass = r3o.net > 0 && r3o.t >= T_BAR && out.R3.holm < HOLM_BAR;
  // by year, deciding nothing
  const yr = (T) => { const y = {}; for (const x of T) (y[O.ymd(x.entryT).slice(0, 4)] ||= []).push(x.net); return Object.fromEntries(Object.entries(y).filter(([k]) => k >= '2007' && k <= '2026').map(([k, v]) => [k, { n: v.length, net: r3(v.reduce((a, b) => a + b, 0) / v.length) }])); };
  out.years = { oanda: yr(allO), histdata: yr(allH), xaueur: yr(allE) };
  out.R4 = { line: 'next 52 Friday sessions from the one closing 20 Nov 2026, frozen rule on OANDA mid H1 XAU_USD, $0.60 + FIN.xau.long: mean net R > 0', computed: false };
  const broke = [!out.R1.survives && 'R1 (non-payroll Fridays)', !out.R2.pass && 'R2 (HistData)', !out.R3.pass && 'R3 (gold in euros)'].filter(Boolean);
  out.verdict = broke.length ? 'FAIL' : 'REPLICATES';
  out.broke = broke;
  write(out);
}
function write(out) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out, null, 1)); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'fetch' && a) fetchHist(a);
  else if (cmd === 'run' && a && b && c) main(a, b, c);
  else throw new Error('usage: run.mjs fetch <dir> | run.mjs run <xau-h1.json> <histdir> <xaueur-5m.json.gz>');
}
