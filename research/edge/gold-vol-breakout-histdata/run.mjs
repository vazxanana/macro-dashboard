// Edge research · gold-vol-breakout-histdata: the gold-vol-breakout study's T1 (UTC open ± 0.5 × the previous folded day's
// range, stop back at the open, out at 21:00 UTC), unchanged, on an independent feed: HistData XAU/USD M1 (bid), against the
// OANDA mid M5 record on the same days. As fixed in PREREGISTRATION.md. Every trading function comes from original.mjs, a
// verbatim copy of the original study's run.mjs; this file only loads the HistData candles (council/histdata.mjs for the
// clock, nothing else), applies the one data guard to both feeds, matches the days and writes the report.
//   node research/edge/gold-vol-breakout-histdata/run.mjs fetch <dir>              (git show origin/council-data, no network;
//                                                                                  writes <dir>/xau-hd-5m.json.gz, out of git)
//   node research/edge/gold-vol-breakout-histdata/run.mjs run <dir> <oanda.json.gz> (OANDA mid M5 rows [t,o,h,l,c], out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';
import * as O from './original.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const T1 = O.TESTS.T1;
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const W = ['2018-01-01', '2026-10-31'];
export const SPLIT = { A: ['2018-01-01', '2020-12-31'], B: ['2021-01-01', '2026-10-31'] };
export const PREV_GAP_DAYS = 4, GAP_MIN = 30, SAME_SIDE_BAR = 0.70, T_BAR = 2;
export const HIST_DIR = 'research/candles/xau-histdata';
export const ymdOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ─── the loader: HistData M1 text -> UTC (council/histdata.mjs only) -> M1 rows; a repeated converted time is dropped ───
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
// M1 rows (any order) -> M5 rows [t,o,h,l,c] on UTC 5-minute boundaries
export function toM5(m1) {
  const rows = [...m1].sort((a, b) => a[0] - b[0]), out = [];
  let cur = null;
  for (const [t, o, h, l, c] of rows) {
    const b = t - (t % 300);
    if (!cur || cur[0] !== b) { cur = [b, o, h, l, c]; out.push(cur); }
    else { cur[2] = Math.max(cur[2], h); cur[3] = Math.min(cur[3], l); cur[4] = c; }
  }
  return out;
}
// per UTC weekday: M1 minutes present 00:00-20:59 and the longest gap (minutes) between them, incl. from 00:00 and to 21:00
export function coverage(m1) {
  const by = new Map();
  for (const [t] of m1) { const d0 = Math.floor(t / DAY) * DAY, s = t - d0; if (s >= 21 * 3600) continue; if (!by.has(d0)) by.set(d0, []); by.get(d0).push(s / 60); }
  const out = {};
  for (const [d0, ms] of by) {
    ms.sort((a, b) => a - b); let g = ms[0], prev = ms[0];
    for (const m of ms) { g = Math.max(g, m - prev - 1); prev = m; }
    g = Math.max(g, 21 * 60 - 1 - prev);
    out[ymdOf(d0)] = [ms.length, g];
  }
  return out;
}

// ─── days: the original's builder, plus the one data guard (previous folded day more than 4 calendar days back) ───
export function daysOf(rows) {
  const s = [...rows].sort((a, b) => a[0] - b[0]);
  // buildDays returns one entry per folded D1 in order, so the entry before is the previous folded day
  const days = O.buildDays(s), out = [];
  let prevD0 = null;
  for (const d of days) { out.push({ ...d, prevGapDays: prevD0 == null ? null : (d.d0 - prevD0) / DAY }); prevD0 = d.d0; }
  return out;
}
export function skipOf(d) { return O.daySkip(d) || (d.prevGapDays != null && d.prevGapDays > PREV_GAP_DAYS ? 'prevgap' : null); }

// T1 on every day of window w; trades keyed by day
export function trades(days, w = W) {
  const tr = [], skips = {};
  for (const d of days) {
    if (!inW(d.day, w)) continue;
    const s = skipOf(d); if (s) { skips[s] = (skips[s] || 0) + 1; continue; }
    const x = O.vbTrade(d.bars, { ...T1, prevRange: d.prevRange });
    if (x.skip) skips[x.skip] = (skips[x.skip] || 0) + 1; else tr.push({ day: d.day, ...x });
  }
  return { tr, skips };
}
export function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
export function agreement(hd, oa) {
  const H = new Map(hd.map((x) => [x.day, x])), A = new Map(oa.map((x) => [x.day, x])), both = [];
  for (const [d, h] of H) if (A.has(d)) both.push([h, A.get(d)]);
  const same = both.filter(([h, a]) => h.side === a.side), absq = (v) => r2(O.quantile(v.map(Math.abs), 0.5)), p95 = (v) => r2(O.quantile(v.map(Math.abs), 0.95));
  const ss = same, fillMin = ss.map(([h, a]) => (h.fillT - a.fillT) / 60), entry = ss.map(([h, a]) => h.entry - a.entry);
  return {
    both: both.length, histOnly: [...H.keys()].filter((d) => !A.has(d)).length, oandaOnly: [...A.keys()].filter((d) => !H.has(d)).length,
    sameSide: same.length, sameSideShare: r3(same.length / (both.length || 1)),
    corrNet: r3(pearson(both.map(([h]) => h.net), both.map(([, a]) => a.net))), corrGross: r3(pearson(both.map(([h]) => h.R), both.map(([, a]) => a.R))),
    sameSignNet: r3(both.filter(([h, a]) => Math.sign(h.net) === Math.sign(a.net)).length / (both.length || 1)),
    stopOnlyHist: same.filter(([h, a]) => h.how === 'stop' && a.how !== 'stop').length, stopOnlyOanda: same.filter(([h, a]) => h.how !== 'stop' && a.how === 'stop').length,
    fillMinAbs: { median: absq(fillMin), p95: p95(fillMin) }, entryAbs: { median: absq(entry), p95: p95(entry) },
    entrySignedMedian: r2(O.quantile(entry, 0.5)),
    commonHist: O.summary(both.map(([h]) => h)), commonOanda: O.summary(both.map(([, a]) => a)),
  };
}
export function decide(hd, ag) {
  const checks = { netPos: hd.netR > 0, grossT2: hd.grossT >= T_BAR, sameSide70: ag.sameSideShare >= SAME_SIDE_BAR };
  return { checks, pass: Object.values(checks).every(Boolean) };
}
function placebo(days) {
  const pool = days.filter((d) => inW(d.day, W) && !skipOf(d)), grid = (O.PLACEBO.to - O.PLACEBO.from) / 300 + 1, res = [];
  for (let seed = 1; seed <= O.SEEDS; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const d of pool) {
      const startT = d.d0 + O.PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
      const x = O.placeboTrade(d.bars, { startT, side, dist: T1.k * d.prevRange }); if (x) tr.push(x);
    }
    res.push(r3(mean(tr.map((x) => x.net))));
  }
  return res;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const s2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictLine(R) {
  const h = R.feeds.hist.W, a = R.agreement, c = R.decision.checks;
  const why = R.decision.pass ? 'all three checks hold' : 'failed: ' + [!c.netPos && 'net ≤ 0', !c.grossT2 && 'gross month t < 2', !c.sameSide70 && 'same side < 70 %'].filter(Boolean).join(', ');
  return `${R.decision.pass ? 'PASS, not an OANDA artifact' : 'FAIL, feed-dependent'} (${why}): T1 on HistData 2018-26 ${sg(h.netR)}R net (n ${h.n}, gross month t ${s2(h.grossT)}); same side as OANDA on ${(a.sameSideShare * 100).toFixed(1)} % of ${a.both} common days`;
}
function row(name, x) { return `| ${name} | ${x.n} | ${(x.win * 100).toFixed(1)} % | ${sg(x.netR)} | ${sg(x.grossR)} | ${sg(x.costR)} | ${sg(x.net2R)} | ${s2(x.total)} | ${s2(x.t)} | ${s2(x.grossT)} | ${s2(x.t2x)} | ${x.stops} / ${x.time} | ${s2(x.maxDD)} | ${x.medianStop} | ${x.buys.n} ${sg(x.buys.netR)} / ${x.sells.n} ${sg(x.sells.netR)} |`; }
export function report(R) {
  const L = [], F = R.feeds, A = R.agreement, yn = (b) => (b ? 'yes' : 'no');
  L.push('# Gold volatility breakout, feed check: the frozen T1 on HistData XAU/USD M1', '');
  L.push('Paper research only. A stand-alone intraday rule, never a gate, exit, entry or size of the live gold book (owner decision 44 concerns that book; none of its records were read). Nothing live changed, no proposal. The test, window and bar were pushed first (`PREREGISTRATION.md`, sha256 in `result.json`). The rule is `gold-vol-breakout` T1, imported unchanged from `original.mjs` (sha256 in `result.json`). This page is written by `run.mjs` from `result.json`.', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push('## The two feeds, 2018-01-01 → 2026-10-31', '');
  const H = '| Feed · window | n | Win | Net R/trade | Gross R/trade | Cost R/trade | Net at 2x cost | Total net R | Month t (net) | Gross month t | Month t at 2x | Stops / time | Max DD R | Median stop $ | Buys / sells (n, net R) |';
  L.push(H, '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, lab] of [['hist', 'HistData'], ['oanda', 'OANDA']]) for (const [w, wl] of [['W', '2018 → 2026-10'], ['A', '2018-2020'], ['B', '2021 → 2026-10']]) L.push(row(`${lab} · ${wl}`, F[k][w]));
  L.push('', '## Decision', '');
  L.push('| HistData net > 0 | HistData gross month t ≥ 2 | same side ≥ 70 % of common days | verdict |', '|---|---|---|---|');
  const c = R.decision.checks; L.push(`| ${yn(c.netPos)} (${sg(F.hist.W.netR)}) | ${yn(c.grossT2)} (${s2(F.hist.W.grossT)}) | ${yn(c.sameSide70)} (${(A.sameSideShare * 100).toFixed(1)} %) | **${R.decision.pass ? 'not an OANDA artifact' : 'feed-dependent'}** |`);
  L.push('', '## Do the two feeds take the same trades?', '');
  L.push(`- Days traded by both: ${A.both}; by HistData only: ${A.histOnly}; by OANDA only: ${A.oandaOnly}.`);
  L.push(`- Same side: ${A.sameSide} of ${A.both} (${(A.sameSideShare * 100).toFixed(1)} %). Correlation of daily net R ${A.corrNet}, of gross R ${A.corrGross}; same sign of net R on ${(A.sameSignNet * 100).toFixed(1)} % of the common days.`);
  L.push(`- On same-side days: stopped on HistData only ${A.stopOnlyHist}, on OANDA only ${A.stopOnlyOanda}; |fill time difference| median ${A.fillMinAbs.median} min, 95th percentile ${A.fillMinAbs.p95} min; |entry difference| median $${A.entryAbs.median}, 95th percentile $${A.entryAbs.p95} (HistData minus OANDA, signed median $${A.entrySignedMedian}: HistData is bid, OANDA mid).`);
  L.push('', '| Common days only | n | Net R/trade | Gross R/trade | Month t (net) | Gross month t |', '|---|---|---|---|---|---|');
  for (const [lab, x] of [['HistData', A.commonHist], ['OANDA', A.commonOanda]]) L.push(`| ${lab} | ${x.n} | ${sg(x.netR)} | ${sg(x.grossR)} | ${s2(x.t)} | ${s2(x.grossT)} |`);
  L.push('', '## By year (net R a trade, n)', '');
  L.push('| Year | HistData | OANDA |', '|---|---|---|');
  for (const y of Object.keys(F.hist.W.byYear).concat(Object.keys(F.oanda.W.byYear)).filter((v, i, a) => a.indexOf(v) === i).sort()) {
    const h = F.hist.W.byYear[y], o = F.oanda.W.byYear[y];
    L.push(`| ${y} | ${h ? `${sg(h.netR)} (${h.n})` : '—'} | ${o ? `${sg(o.netR)} (${o.n})` : '—'} |`);
  }
  L.push('', '## Placebo on HistData (2018 → 2026-10, 40 seeds, reported only)', '', 'The original study\'s placebo: every day T1 could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop 0.5 × the previous day\'s range away, out at 21:00 UTC or the stop, the same costs.', '');
  const p = R.placebo; L.push('| Real net R a trade | Placebo median | Placebo 95th percentile | Placebo min / max | Seeds beaten |', '|---|---|---|---|---|');
  L.push(`| ${sg(F.hist.W.netR)} | ${sg(p.median)} | ${sg(p.p95)} | ${sg(p.min)} / ${sg(p.max)} | ${p.beaten} of ${p.seeds} |`);
  L.push('', '## Data coverage and holes', '');
  const cv = R.coverage;
  L.push(`- HistData: ${R.data.hist.files} files, first M1 candle ${R.data.hist.first}, last ${R.data.hist.last}; ${R.data.hist.m1} M1 candles after dropping ${R.data.hist.dupes} repeated converted times, ${R.data.hist.m5} M5 candles.`);
  L.push(`- Weekdays in the window: ${cv.weekdays}. With no HistData M1 candle 00:00-20:59 UTC: ${cv.noData} (${cv.noDataDays.join(', ') || 'none'}). With no OANDA candle: ${cv.noDataOanda} (${cv.noDataOandaDays.join(', ') || 'none'}).`);
  L.push(`- On the weekdays HistData has: ${cv.missingMin} of ${cv.expectedMin} M1 minutes 00:00-20:59 missing (${(cv.missingMin / cv.expectedMin * 100).toFixed(2)} %); days with an intraday gap over ${GAP_MIN} minutes: ${cv.gapDays}; the longest gap in a day ${cv.maxGapMin} minutes (${cv.maxGapDay}). Longest hole in the file over the window: ${cv.longestHoleDays} days (${cv.longestHole}).`);
  L.push(`- Days without a trade, HistData: ${Object.entries(F.hist.skips).map(([a, b]) => `${a} ${b}`).join(', ')}; OANDA: ${Object.entries(F.oanda.skips).map(([a, b]) => `${a} ${b}`).join(', ')}. \`prevgap\` is the pre-registered guard (previous folded day more than ${PREV_GAP_DAYS} calendar days back), applied to both feeds; \`thin\` = fewer than 200 M5 candles 00:00-20:55. No exit crosses a hole: every trade closes by 21:00 UTC the same day.`);
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Data and method', '');
  L.push(`- ${R.data.text}`);
  L.push(`- Rule: ${R.rule}`);
  L.push(`- Costs: $${R.cost.toFixed(2)} a round trip per ounce on both feeds, 2x reported; financing \`FIN.xau.long\` × \`nights\` on buys (no trade crosses the 22:00 UTC rollover: 0). Month t on calendar-month sums. One frozen rule on one more feed: no Holm, the placebo is reported only.`);
  L.push('- To repeat: `node research/edge/gold-vol-breakout-histdata/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `… run <dir> <oanda.json.gz>` with OANDA mid M5 XAU/USD rows `[t,o,h,l,c]` from the candle proxy (kept out of git).');
  return L.join('\n') + '\n';
}

const thinOf = (sk) => sk.thin || 0;
const thin2023 = (cov) => Object.entries(cov).filter(([d, v]) => d >= '2023-02-20' && d <= '2023-07-31' && v[0] < 1000 && new Date(d).getUTCDay() % 6).length;

// ─── main ───
const git = (args) => execFileSync('git', args, { cwd: path.resolve(HERE, '../../..'), maxBuffer: 1 << 30 });
function fetchHist(dir) {
  const files = git(['ls-tree', '--name-only', 'origin/council-data', HIST_DIR + '/']).toString().split('\n').filter((p) => /XAUUSD_M1_\d+\.csv\.gz$/.test(p)).sort();
  const seen = new Set(); let m1 = [], lines = 0;
  for (const f of files) { const txt = zlib.gunzipSync(git(['show', 'origin/council-data:' + f])).toString(); lines += txt.split('\n').filter((l) => l.length >= 20).length; m1 = m1.concat(parseHist(txt, seen)); }
  m1.sort((a, b) => a[0] - b[0]);
  const meta = { files: files.length, first: new Date(m1[0][0] * 1000).toISOString().slice(0, 16), last: new Date(m1.at(-1)[0] * 1000).toISOString().slice(0, 16), m1: m1.length, dupes: lines - m1.length };
  const m5 = toM5(m1); meta.m5 = m5.length;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'xau-hd-5m.json.gz'), zlib.gzipSync(JSON.stringify({ meta, cov: coverage(m1), m5 })));
  console.log(meta);
}
function main(dir, oandaFile) {
  const hd = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-hd-5m.json.gz'))));
  const oa = JSON.parse(zlib.gunzipSync(fs.readFileSync(oandaFile))).filter((r) => ymdOf(r[0]) <= '2026-11-05');   // window + a margin; days after W never trade
  const dH = daysOf(hd.m5), dO = daysOf(oa), feeds = {}, trs = {};
  for (const [k, days] of [['hist', dH], ['oanda', dO]]) {
    const { tr, skips } = trades(days, W); trs[k] = tr;
    feeds[k] = { skips, W: O.summary(tr), A: O.summary(tr.filter((x) => inW(x.day, SPLIT.A))), B: O.summary(tr.filter((x) => inW(x.day, SPLIT.B))) };
  }
  const ag = agreement(trs.hist, trs.oanda), pl = placebo(dH);
  // coverage
  const weekdays = [], oaDays = new Set(dO.filter((d) => d.bars.length).map((d) => d.day));
  for (let t = Date.parse(W[0]) / 1000; ymdOf(t) <= W[1]; t += DAY) { const g = new Date(t * 1000).getUTCDay(); if (g >= 1 && g <= 5) weekdays.push(ymdOf(t)); }
  const noData = weekdays.filter((d) => !hd.cov[d]), noDataO = weekdays.filter((d) => !oaDays.has(d) || !dO.find((x) => x.day === d)?.bars.length);
  let missing = 0, expected = 0, gapDays = 0, maxGap = 0, maxGapDay = null;
  for (const d of weekdays) { const c = hd.cov[d]; if (!c) continue; expected += 21 * 60; missing += 21 * 60 - c[0]; if (c[1] > GAP_MIN) gapDays++; if (c[1] > maxGap) { maxGap = c[1]; maxGapDay = d; } }
  const ts = hd.m5.map((r) => r[0]).filter((t) => inW(ymdOf(t), W)); let hole = 0, holeAt = '';
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > hole) { hole = ts[i] - ts[i - 1]; holeAt = `${new Date(ts[i - 1] * 1000).toISOString().slice(0, 16)} → ${new Date(ts[i] * 1000).toISOString().slice(0, 16)} UTC`; }
  const coverageOut = { weekdays: weekdays.length, noData: noData.length, noDataDays: noData, noDataOanda: noDataO.length, noDataOandaDays: noDataO, missingMin: missing, expectedMin: expected, gapDays, maxGapMin: maxGap, maxGapDay, longestHoleDays: r2(hole / DAY), longestHole: holeAt };
  const dec = decide(feeds.hist.W, ag);
  const plan = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const orig = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'original.mjs'))).digest('hex');
  if (orig !== ORIG_SHA) throw new Error('original.mjs changed');
  const h = feeds.hist.W, o = feeds.oanda.W, bt = pl.filter((v) => h.netR > v).length;
  const reading = [
    dec.pass ? `On HistData the rule keeps its sign and its strength before costs (gross month t ${s2(h.grossT)}) and the two feeds take the same side on ${(ag.sameSideShare * 100).toFixed(1)} % of the days both trade, so the result is a property of gold's price path, not of the OANDA candles or fills.`
      : `The pre-registered bar is not met (${verdictLine({ feeds, agreement: ag, decision: dec }).split('(')[1].split(')')[0]}).`,
    `Over the same 2018 → 2026-10 days OANDA gives ${sg(o.netR)}R net a trade (n ${o.n}, month t ${s2(o.t)}, gross t ${s2(o.grossT)}) and HistData ${sg(h.netR)}R (n ${h.n}, month t ${s2(h.t)}, gross t ${s2(h.grossT)}); at 2x costs HistData ${sg(h.net2R)}R, OANDA ${sg(o.net2R)}R.`,
    `On the ${ag.both} common days the daily net R correlates ${ag.corrNet} and the common-day means are ${sg(ag.commonHist.netR)}R (HistData) and ${sg(ag.commonOanda.netR)}R (OANDA).`,
    `By split: 2018-20 HistData ${sg(feeds.hist.A.netR)}R, OANDA ${sg(feeds.oanda.A.netR)}R; 2021 → 2026-10 HistData ${sg(feeds.hist.B.netR)}R, OANDA ${sg(feeds.oanda.B.netR)}R. The net month t on HistData over the window is ${s2(h.t)}: this check asks whether the feed carries the effect, not whether 2018-26 alone is an edge (the original's 2016-20 net was flat; the 2007-15 replication carries the evidence).`,
    `HistData misses ${thinOf(feeds.hist.skips)} days as too thin (fewer than 200 M5 candles), ${thin2023(hd.cov)} of them in the file's 2023 hole (20 Feb to 28 Jul 2023, about 15 of every 21 hours present; XAU/USD 2023 is UNCERTIFIED in the clock audit research/edge/histdata-clock): the original's own thin rule skips them, so HistData has ${o.n - h.n} fewer trades than OANDA, nearly all in 2023. Where both feeds trade, the fill candle is the same (median fill time difference ${ag.fillMinAbs.median} min), which also confirms the converted clock.`,
    `The placebo on HistData: the real ${sg(h.netR)}R beats ${bt} of 40 seeds (median ${sg(r3(O.quantile(pl, 0.5)))}R).`,
    'Not an edge to trade and not a council rule; nothing live changes and no proposal is written.',
  ].join(' ');
  const result = { study: 'gold-vol-breakout-histdata', built: '2026-11-14', preregistration: 'research/edge/gold-vol-breakout-histdata/PREREGISTRATION.md', planSha256: plan, originalSha256: orig,
    claim: 'the gold-vol-breakout T1 result is a property of gold, not of the OANDA feed (feed check, no new rule)',
    system: 'gold-vol-breakout T1 (stand-alone research rule, not live)',
    rule: 'O = open of the first M5 candle 00:00-00:55 UTC; prevRange = high − low of the previous weekend-folded UTC D1; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange live 00:00-20:55 UTC, first filled wins; stop back at O; out at the 20:55 candle close (gold-vol-breakout T1, unchanged); data guard on both feeds: skip a day whose previous folded day is more than 4 calendar days back',
    data: { text: `HistData XAU/USD M1 (bid) from council-data ${HIST_DIR} via git show, labels converted with council/histdata.mjs histStampUtc only, aggregated to UTC M5; OANDA mid M5 XAU/USD from the candle proxy (cache out of git). Window ${W[0]} → ${W[1]} (the last full month in the HistData files).`, hist: hd.meta },
    window: W, cost: O.COST, verdict: '', decision: dec, feeds, agreement: ag, coverage: coverageOut,
    placebo: { seeds: O.SEEDS, means: pl, min: Math.min(...pl), max: Math.max(...pl), median: r3(O.quantile(pl, 0.5)), p95: r3(O.quantile(pl, 0.95)), beaten: bt },
    reading };
  result.verdict = verdictLine(result);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(result));
  console.log(result.verdict);
  for (const k of ['hist', 'oanda']) for (const w of ['W', 'A', 'B']) { const x = feeds[k][w]; console.log(k, w, x.n, x.netR, x.grossR, x.t, x.grossT, x.net2R, x.t2x); }
  console.log(JSON.stringify({ ...ag, commonHist: undefined, commonOanda: undefined }), feeds.hist.skips, feeds.oanda.skips, coverageOut.noData, coverageOut.longestHole);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir, oanda] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) fetchHist(dir);
  else if (cmd === 'run' && dir && oanda) main(dir, oanda);
  else throw new Error('usage: run.mjs fetch <dir> | run.mjs run <dir> <oanda.json.gz>');
}
