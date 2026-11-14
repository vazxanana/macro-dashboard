// Edge research · gold-pre-holiday-replicate: the gold-pre-holiday study's T1 / T2 (long on the last one / two 17:00 New York
// trading days before an NYSE holiday), unchanged, on data it did not read: R1 gold priced in euros (OANDA mid XAU/EUR), R2 a
// second XAU/USD feed (HistData M1). As fixed in PREREGISTRATION.md (pushed alone first). Every rule function comes from
// original.mjs, a verbatim copy of the original's run.mjs; this file only loads candles, sets each feed's cost and windows,
// and writes the report.
//   node research/edge/gold-pre-holiday-replicate/run.mjs fetch-hist <dir>          (git show origin/council-data, no network;
//                                                                                  writes <dir>/xau-hd-h1.json.gz, out of git)
//   node research/edge/gold-pre-holiday-replicate/run.mjs run <dir> <xaueur-5m.json.gz>  (OANDA mid M5 XAU/EUR [t,o,h,l,c,v])
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';
import * as O from './original.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = 86400;
export const ORIG_SHA = '8b5586c0302b99e8949ff1cde11be7345f541063f7e25d2df860d86463c62825';
export const EUR_COST_PCT = 0.00016, SEEDS = 40, OOS_END = '2026-10-31';
export const FEEDS = {
  R1: { name: 'XAU/EUR (OANDA mid)', years: [2007, 2026], holFrom: 2006, halves: [[2007, 2016], [2017, 2026]] },
  R2: { name: 'XAU/USD (HistData M1, bid)', years: [2018, 2026], holFrom: 2017, halves: [[2018, 2021], [2022, 2026]] },
};
export const FORWARD = [['Thanksgiving Day', '2026-11-26'], ['Christmas Day', '2026-12-25'], ["New Year's Day", '2027-01-01'],
  ['Martin Luther King Day', '2027-01-18'], ["Presidents' Day", '2027-02-15'], ['Good Friday', '2027-03-26'], ['Memorial Day', '2027-05-31'],
  ['Juneteenth', '2027-06-18'], ['Independence Day', '2027-07-05'], ['Labor Day', '2027-09-06']];
export const HIST_DIR = 'research/candles/xau-histdata';
const ymd = (d) => new Date(d * D * 1000).toISOString().slice(0, 10);
const dayOf = (s) => Date.parse(s) / 1000 / D;
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000), r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);

// ─── loaders ───
// rows [t,o,h,l,c,...] (any finer step) -> H1 rows [t,o,h,l,c] on UTC hour boundaries
export function toH1(rows) {
  const s = [...rows].sort((a, b) => a[0] - b[0]), out = []; let cur = null;
  for (const [t, o, h, l, c] of s) { const b = t - (t % 3600);
    if (!cur || cur[0] !== b) { cur = [b, o, h, l, c]; out.push(cur); } else { cur[2] = Math.max(cur[2], h); cur[3] = Math.min(cur[3], l); cur[4] = c; } }
  return out;
}
// HistData M1 text -> UTC (council/histdata.mjs only) -> M1 rows; a repeated converted time is dropped
export function parseHist(text, seen = new Set()) {
  const out = [];
  for (const line of text.split('\n')) { if (line.length < 20) continue;
    const f = line.split(';'), t = histStampUtc(f[0]); if (!Number.isFinite(t) || seen.has(t)) continue; seen.add(t); out.push([t, +f[1], +f[2], +f[3], +f[4]]); }
  return out;
}
// the holidays a future reader judges (R3): the original's holidays() between two dates
export function forwardHolidays(from = '2026-11-15', to = '2027-11-14') {
  const out = []; for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) out.push(...O.holidays(y).filter((h) => h.date >= from && h.date <= to));
  return out.map((h) => [h.name, h.date]);
}

// ─── the study on one feed: the original's events, trade and statistics; this feed's cost and windows ───
export const costFn = (feed) => feed === 'R1' ? (entry) => EUR_COST_PCT * entry : () => O.COST;
export function events(h1raw, feed, { lastDay = OOS_END } = {}) {
  const F = FEEDS[feed], cost = costFn(feed);
  const h1 = h1raw.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
  const ds = O.buildDays(h1), hols = [];
  for (let y = F.holFrom; y <= F.years[1]; y++) hols.push(...O.holidays(y));
  const holSet = new Set(hols.map((h) => h.d)), lastD = dayOf(lastDay);
  const tr = (a, b) => O.trade(h1, ds, a, b, { cost: cost(ds[a].open) });
  const ev = { T1: [], T2: [] }, skipped = { T1: 0, T2: 0 }, near = new Set();
  for (const h of hols) { const e = O.eventDays(ds, h, holSet); if (e) for (const i of [e.pre1, e.pre2, e.post]) if (i != null) near.add(ds[i].d); }
  for (const h of hols) {
    const yr = +h.date.slice(0, 4); if (yr < F.years[0] || h.d > lastD) continue;
    const e = O.eventDays(ds, h, holSet);
    const add = (k, a, b) => { const t = a == null || b == null ? null : tr(a, b); if (!t) { skipped[k]++; return; }
      ev[k].push({ ...t, holiday: h.name, date: h.date, year: yr, day: ymd(ds[a].d) }); };
    add('T1', e && e.pre1, e && e.pre1); add('T2', e && e.pre2, e && e.pre1);
  }
  const ordinary = []; ds.forEach((x, i) => { if (!holSet.has(x.d) && !near.has(x.d) && i > O.ATR_N) ordinary.push(i); });
  return { h1, ds, ev, skipped, ordinary, tr, lastD };
}
export function placebo(S, k, rows) {
  const { ds, ordinary, tr, lastD } = S, ordSet = new Set(ordinary), yearOf = (i) => +ymd(ds[i].d).slice(0, 4);
  const perYear = new Map(); for (const r of rows) perYear.set(r.year, (perYear.get(r.year) || 0) + 1);
  const pool = new Map(); for (const i of ordinary) { const y = yearOf(i); if (!perYear.has(y) || ds[i].d > lastD) continue;
    if (k === 'T2' && !(ordSet.has(i + 1) && ds[i + 1].d - ds[i].d <= 4)) continue; (pool.get(y) || pool.set(y, []).get(y)).push(i); }
  const means = [];
  for (let s = 1; s <= SEEDS; s++) { const R = O.rng(s), net = [];
    for (const [y, c] of perYear) { const P = (pool.get(y) || []).slice();
      for (let j = 0; j < c && P.length; j++) { const i = P.splice(Math.floor(R() * P.length), 1)[0]; const t = tr(i, k === 'T2' ? i + 1 : i); if (t) net.push(t.net); } }
    means.push(O.st(net).mean); }
  return means;
}
export function pearson(a, b) { const n = a.length; if (n < 3) return null; const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); }
// per-holiday comparison with the original's XAU/USD trades (net R and % move matched by holiday date)
export function versus(rows, orig) {
  const m = new Map(orig.map((t) => [t.date, t])), a = [], b = [], pa = [], pb = []; let same = 0;
  for (const r of rows) { const o = m.get(r.date); if (!o || o.net == null) continue; a.push(r.net); b.push(o.net);
    pa.push((r.exit - r.entry) / r.entry); pb.push((o.exit - o.entry) / o.entry); if (Math.sign(r.net) === Math.sign(o.net)) same++; }
  return { n: a.length, corrNet: r2(pearson(a, b)), corrPct: r2(pearson(pa, pb)), sameSign: a.length ? r2(100 * same / a.length) : null };
}

export function study(feedsH1, origTrades = {}) {
  const tests = {}, ps = [], keys = [];
  for (const feed of ['R1', 'R2']) { if (!feedsH1[feed]) continue;
    const S = events(feedsH1[feed], feed), F = FEEDS[feed];
    for (const k of ['T1', 'T2']) { const rows = S.ev[k], id = `${feed}-${k}`;
      const whole = O.summary(rows), h = F.halves.map(([a, b]) => O.summary(rows.filter((r) => r.year >= a && r.year <= b)));
      const means = placebo(S, k, rows), beat = means.filter((m) => whole.netR > m).length;
      const byHol = {}; for (const r of rows) (byHol[r.holiday] ||= []).push(r.net);
      const sm = [...means].sort((x, y) => x - y);
      tests[id] = { feed, test: k, whole, halves: { [F.halves[0].join('-')]: h[0], [F.halves[1].join('-')]: h[1] }, skipped: S.skipped[k],
        placebo: { beat, of: SEEDS, min: r3(sm[0]), median: r3(sm[20]), max: r3(sm.at(-1)) },
        vsOriginal: origTrades[k] ? versus(rows, origTrades[k]) : null,
        byHoliday: Object.fromEntries(Object.entries(byHol).sort().map(([n, v]) => [n, { n: v.length, netR: r3(O.st(v).mean), t: r2(O.st(v).t) }])),
        trades: rows.map((r) => ({ date: r.date, holiday: r.holiday, day: r.day, entry: r2(r.entry), exit: r2(r.exit), atr: r2(r.atr), stopped: r.stopped, nights: r.nights, gross: r3(r.gross), net: r3(r.net) })),
        data: { from: ymd(S.ds[0].d), to: ymd(S.ds.at(-1).d), days: S.ds.length, h1: S.h1.length } };
      ps.push(O.pOne(whole.netT, whole.n - 1)); keys.push(id); } }
  const adj = O.holm(ps);
  keys.forEach((id, j) => { const r = tests[id], hv = Object.values(r.halves); r.pOne = r4(ps[j]); r.pHolm = r4(adj[j]);
    r.checks = { t: r.whole.netT >= 2 && adj[j] < 0.05, halves: hv.every((x) => x.netR > 0), cost2x: r.whole.net2x > 0, placebo: r.placebo.beat >= 38 };
    r.pass = Object.values(r.checks).every(Boolean); });
  const passed = keys.filter((id) => tests[id].pass);
  return { study: 'gold-pre-holiday-replicate', built: '2026-11-14', original: 'gold-pre-holiday', originalSha256: ORIG_SHA,
    verdict: passed.length ? 'PASS' : 'FAIL', passed, costs: { R1: { roundTripPct: EUR_COST_PCT * 100, finLong: 0.000148 }, R2: { roundTrip: O.COST, finLong: 0.000148 } },
    tests, forward: { holidays: FORWARD, passLine: 'T1 mean net R over these ten events > 0 (original.mjs unchanged, OANDA mid H1 XAU/USD); T2 reported only' } };
}

// ─── report ───
const sg = (v, d = 3) => v == null ? 'n/a' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
export function report(R) {
  const T = R.tests, L = [], g = (id) => T[id];
  const verdictWhy = R.verdict === 'PASS' ? `${R.passed.join(', ')} meet every condition` : 'none of the four tests meets every condition';
  const t1 = g('R1-T1'), t2 = g('R2-T1');
  L.push('# Result: does the gold pre-holiday long replicate on other data? (14 Nov 2026)', '');
  L.push(`**Verdict: ${R.verdict}: ${verdictWhy}; T1 net ${sg(t1.whole.netR)}R in euros (n ${t1.whole.n}, t ${sg(t1.whole.netT, 2)}) and ${sg(t2.whole.netR)}R on HistData (n ${t2.whole.n}, t ${sg(t2.whole.netT, 2)}); not independent of the original's years.**`, '');
  L.push('Judged on the pre-registered bar (PREREGISTRATION.md, pushed alone before any return was computed). The rule is the original');
  L.push('`gold-pre-holiday` code byte for byte (`original.mjs`, sha256 pinned); only the candles, the cost per feed and the windows');
  L.push('are this study\'s. **R1 and R2 cannot be independent of the original**: they read the same holidays in the same years on');
  L.push('gold (XAU/EUR is gold over EUR/USD; HistData is another feed of the same market). They check that the original\'s figure');
  L.push('is not one feed\'s artefact or the dollar\'s own holiday move. The independent test is R3, the forward check below, with');
  L.push('nothing computed now. Nothing live changed; not a gold-book system or a gate on one (owner item 44).', '');
  L.push(`Data: R1 OANDA mid M5 XAU/EUR grouped to H1, ${t1.data.from} to ${t1.data.to} (${t1.data.h1} H1 candles, ${t1.data.days} days); R2 HistData`);
  L.push(`XAU/USD M1 (bid, labels to UTC by \`council/histdata.mjs\`), ${t2.data.from} to ${t2.data.to} (${t2.data.h1} H1 candles). Costs: R1 0.016 % of`);
  L.push('price a round trip, R2 $0.60 an ounce; both the original\'s financing `nights` x `FIN.xau.long` (assumed for XAU/EUR). Judged');
  L.push('holidays up to 31 Oct 2026: R1 2007-26, R2 2018-26 (the original\'s out-of-sample years; the HistData files start in 2018).', '');
  L.push('## The four tests (R a trade, t per event; month-sum t beside it, not judged)', '');
  L.push('| Test | window | n | gross R | gross t | net R | net t | month-sum t | net R 2x | won | stops | skipped |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(T)) { const r = T[id];
    const row = (w, s, sk) => `| ${id} | ${w} | ${s.n} | ${sg(s.grossR)} | ${sg(s.grossT, 2)} | ${sg(s.netR)} | ${sg(s.netT, 2)} | ${sg(s.monthT, 2)} (${s.months}) | ${sg(s.net2x)} | ${s.won} % | ${s.stops} | ${sk} |`;
    L.push(row('whole', r.whole, r.skipped)); for (const [w, s] of Object.entries(r.halves)) L.push(row(w, s, '')); }
  L.push('', '## The bar', '', '| Test | net t | one-sided p | Holm p | both halves positive | net R 2x | placebo (beat) | passes |', '|---|---|---|---|---|---|---|---|');
  for (const id of Object.keys(T)) { const r = T[id];
    L.push(`| ${id} | ${sg(r.whole.netT, 2)} | ${r.pOne} | ${r.pHolm} | ${r.checks.halves ? 'yes' : 'no'} | ${sg(r.whole.net2x)} | ${r.placebo.beat} of 40 (seed means ${sg(r.placebo.min)} to ${sg(r.placebo.max)}, median ${sg(r.placebo.median)}) | ${r.pass ? '**yes**' : 'no'} |`); }
  { const h1a = Object.entries(t1.halves), h2a = Object.entries(t2.halves);
    L.push('', `Reading: the same fragility as the original shows on both feeds. In euros T1's first half (${h1a[0][0]}) is ${sg(h1a[0][1].netR)}R, t ${sg(h1a[0][1].netT, 2)},`);
    L.push(`against ${sg(h1a[1][1].netR)}R, t ${sg(h1a[1][1].netT, 2)} in ${h1a[1][0]}; on HistData T1 is ${sg(h2a[0][1].netR)}R (t ${sg(h2a[0][1].netT, 2)}) in ${h2a[0][0]} and ${sg(h2a[1][1].netR)}R`);
    L.push(`(t ${sg(h2a[1][1].netT, 2)}) in ${h2a[1][0]}. The figure is not one feed's artefact, nor the dollar's own move (it holds, if anything`);
    L.push('larger, priced in euros), but it is still the same holidays of the same years: the bar passing here adds no independent');
    L.push('evidence that the effect is real or lasting. R3 does.'); }
  L.push('', '## Against the original\'s XAU/USD trades (same holidays; reported only)', '');
  L.push('| Test | holidays matched | correlation of net R | correlation of % move | same sign |', '|---|---|---|---|---|');
  for (const id of Object.keys(T)) { const v = T[id].vsOriginal; if (v) L.push(`| ${id} | ${v.n} | ${sg(v.corrNet, 2)} | ${sg(v.corrPct, 2)} | ${v.sameSign} % |`); }
  L.push('', 'High correlations are what "not independent" means in numbers: R1 and R2 re-read the original\'s days.', '');
  L.push('## By holiday (net R, whole window, reported only)', '', '| Holiday | R1-T1 n | net R | t | R1-T2 net R | R2-T1 n | net R | t | R2-T2 net R |', '|---|---|---|---|---|---|---|---|---|');
  const names = [...new Set(Object.values(T).flatMap((r) => Object.keys(r.byHoliday)))].sort();
  for (const n of names) { const a = T['R1-T1'].byHoliday[n] || {}, b = T['R1-T2'].byHoliday[n] || {}, c = T['R2-T1'].byHoliday[n] || {}, d = T['R2-T2'].byHoliday[n] || {};
    L.push(`| ${n} | ${a.n ?? 0} | ${sg(a.netR)} | ${sg(a.t, 2)} | ${sg(b.netR)} | ${c.n ?? 0} | ${sg(c.netR)} | ${sg(c.t, 2)} | ${sg(d.netR)} |`); }
  L.push('', '## R3: the forward check (pre-registered, nothing computed)', '');
  L.push('The next twelve months of NYSE full holidays (`ict/calendar.mjs` `cmeYear`, 15 Nov 2026 to 14 Nov 2027; 3 July, the day');
  L.push('after Thanksgiving and Christmas Eve stay trading days, as in the original):', '', '| # | Holiday | Date |', '|---|---|---|');
  R.forward.holidays.forEach(([n, d], i) => L.push(`| ${i + 1} | ${n} | ${d} |`));
  L.push('', '**Pass line for a future reader**: run the original\'s T1 unchanged (`original.mjs`, the same sha256) on OANDA mid H1 XAU/USD');
  L.push('for exactly these ten events, net of its costs. **T1 passes the forward check if its mean net R over the ten is above 0.**');
  L.push('T2 is reported beside it, not judged. Ten events give no t worth judging (about t 0.8 at the original\'s mean and spread):');
  L.push('the line only asks whether the sign holds on data nobody had seen. A fail sends T1 back to "not shown"; a pass is one');
  L.push('more year of the same sign, not a proven edge.', '');
  L.push('## To repeat', '');
  L.push('`node research/edge/gold-pre-holiday-replicate/run.mjs fetch-hist <dir>` (git show from `origin/council-data`, no network), then');
  L.push('`… run <dir> <xaueur-5m.json.gz>` with OANDA mid M5 XAU/EUR rows `[t,o,h,l,c,v]` from the candle proxy (kept out of git). The');
  L.push('original\'s trades for the comparison are read from `origin/gold-pre-holiday` (`git show`).');
  return L.join('\n') + '\n';
}

// ─── main ───
const git = (args) => execFileSync('git', args, { cwd: path.resolve(HERE, '../../..'), maxBuffer: 1 << 30 });
function fetchHist(dir) {
  const files = git(['ls-tree', '--name-only', 'origin/council-data', HIST_DIR + '/']).toString().split('\n').filter((p) => /XAUUSD_M1_\d+\.csv\.gz$/.test(p)).sort();
  const seen = new Set(); let m1 = [];
  for (const f of files) m1 = m1.concat(parseHist(zlib.gunzipSync(git(['show', 'origin/council-data:' + f])).toString(), seen));
  const h1 = toH1(m1); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'xau-hd-h1.json.gz'), zlib.gzipSync(JSON.stringify(h1)));
  console.log({ files: files.length, m1: m1.length, h1: h1.length });
}
function main(dir, eurFile) {
  const R1 = toH1(JSON.parse(zlib.gunzipSync(fs.readFileSync(eurFile))));
  const R2 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-hd-h1.json.gz'))));
  let orig = {}; try { orig = JSON.parse(git(['show', 'origin/gold-pre-holiday:research/edge/gold-pre-holiday/result.json']).toString()).tests; } catch { orig = {}; }
  const res = study({ R1, R2 }, { T1: orig.T1?.trades, T2: orig.T2?.trades });
  res.planSha256 = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  for (const [id, r] of Object.entries(res.tests)) console.log(id, JSON.stringify({ whole: r.whole, halves: r.halves, pHolm: r.pHolm, placebo: r.placebo, vs: r.vsOriginal, checks: r.checks }));
  console.log(res.verdict, res.passed);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'fetch-hist') fetchHist(a); else if (cmd === 'run') main(a, b); else console.log('usage: run.mjs fetch-hist <dir> | run <dir> <xaueur-5m.json.gz>');
}
