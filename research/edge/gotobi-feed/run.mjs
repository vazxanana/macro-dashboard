// Edge research · gotobi-feed: the gotobi study's T2 (sell USD/JPY at the 09:55 Tokyo fix on gotobi days, buy back at 15:00
// Tokyo) run unchanged on an independent feed, HistData USD/JPY M1 (council-data research/candles/USDJPY), against the same
// rule on OANDA mid M5 over the same days. The rule is frozen.mjs, a byte-for-byte copy of research/edge/gotobi-replicate/
// frozen.mjs; nothing of it is re-implemented here. The only new part is the candle loader (PREREGISTRATION.md).
//   node research/edge/gotobi-feed/run.mjs <candleDir>
//   (<candleDir>: usdjpy-oanda-5m.json.gz from fetch.mjs; the HistData M1 files are read with `git show origin/council-data:…`,
//   no network, and cached there as usdjpy-hist-5m.json.gz)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const LEG = 'fade';                                         // the original's T2 leg
export const ORIGINAL = { test: 'T2', pair: 'usdjpy', leg: 'fade' };
export const WINDOW_FROM = '2018-01-01';
export const T_BAR = F.T_BAR, CORR_BAR = 0.8;
export const HIST_DIR = 'research/candles/USDJPY';
export const KEEP_UNTIL = 7 * 3600;                                // candles that start 00:00-06:55 UTC, as gotobi-replicate

// ---- the loader: HistData M1 text -> UTC (council/histdata.mjs only) -> M5 rows [t, o, h, l, c] ---------------------------
// rows: one parsed M1 candle per line; a converted time already seen is dropped (the converter's header: the files repeat one
// hour on the last Sunday of October)
export function parseHist(text, seen = new Set()) {
  const out = [];
  for (const line of text.split('\n')) {
    if (line.length < 20) continue;
    const f = line.split(';');
    const t = histStampUtc(f[0]);
    if (!Number.isFinite(t) || seen.has(t)) continue;
    seen.add(t);
    out.push([t, +f[1], +f[2], +f[3], +f[4]]);
  }
  return out;
}
// M1 rows (any order) -> M5 rows on UTC 5-minute boundaries, only those starting before KEEP_UNTIL in the UTC day
export function toM5(m1, keepUntil = KEEP_UNTIL) {
  const rows = [...m1].sort((a, b) => a[0] - b[0]), out = [];
  let cur = null;
  for (const [t, o, h, l, c] of rows) {
    if (t % 86400 >= keepUntil) continue;
    const b = t - (t % 300);
    if (!cur || cur[0] !== b) { cur = [b, o, h, l, c]; out.push(cur); }
    else { cur[2] = Math.max(cur[2], h); cur[3] = Math.min(cur[3], l); cur[4] = c; }
  }
  return out;
}

const git = (args) => execFileSync('git', args, { cwd: path.resolve(HERE, '../../..'), maxBuffer: 1 << 30 });
export function histFiles() {
  return git(['ls-tree', '--name-only', 'origin/council-data', HIST_DIR + '/']).toString().split('\n').filter((p) => /USDJPY_M1_\d+\.csv\.gz$/.test(p)).sort();
}
export function loadHist(dir) {
  const cf = path.join(dir, 'usdjpy-hist-5m.json.gz');
  if (fs.existsSync(cf)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(cf)));
  const seen = new Set(), m1 = [], files = histFiles();
  for (const p of files) { for (const r of parseHist(zlib.gunzipSync(git(['show', `origin/council-data:${p}`])).toString(), seen)) m1.push(r); }
  const bars = toM5(m1);
  fs.writeFileSync(cf, zlib.gzipSync(JSON.stringify(bars)));
  return bars;
}

// ---- statistics around the frozen ones ----------------------------------------------------------------------------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sdv = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
export function pearson(x, y) {
  const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
  for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
  return a / Math.sqrt(b * c);
}
// the frozen summary, plus the 2 x cost figure (the gotobi-replicate definition)
export function summ(trades) {
  const s = F.summary(trades);
  if (!s.n) return s;
  const x2 = trades.map((t) => t.R - 2 * t.costR), m = new Map();
  for (const t of trades) { const k = t.day.slice(0, 7); m.set(k, (m.get(k) || 0) + t.R - 2 * t.costR); }
  const v = [...m.values()];
  return { ...s, netR2x: r4(mean(x2)), t2x: v.length >= 3 ? r2(mean(v) / (sdv(v) / Math.sqrt(v.length))) : null };
}
const byYear = (trades) => {
  const y = {}; for (const t of trades) (y[t.day.slice(0, 4)] ||= []).push(t);
  return Object.fromEntries(Object.entries(y).sort().map(([k, a]) => { const s = F.summary(a); return [k, { n: s.n, netR: s.netR, totalR: s.totalR, t: s.t }]; }));
};

// one feed: the frozen runPair loop, the gotobi trades of the window, and why the other gotobi days have none
export function runFeed(bars, lastDay) {
  const { G, days, all } = F.runPair(bars, LEG, lastDay);
  const ix = F.index(bars), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, LEG, d)); return moves.get(d); };
  const inW = (d) => d >= WINDOW_FROM && d <= lastDay;
  const gdays = days.filter((d) => G.has(d) && inW(d)), got = gdays.filter((d) => all.has(d)).map((d) => all.get(d));
  const why = { noEntry: [], noExit: [], noLookback: [] };
  for (const d of gdays) {
    if (all.has(d)) continue;
    const { entry, exit } = F.legTimes(LEG, d);
    if (!F.entryPx(ix, entry)) why.noEntry.push(d); else if (F.exitPx(ix, exit) == null) why.noExit.push(d); else if (F.stopDist(moveOf, d) == null) why.noLookback.push(d);
  }
  return { gotobiDays: gdays.length, got, why };
}

const PIPS = (v) => v / F.PIP;
export function compare(H, O) {
  const om = new Map(O.map((t) => [t.day, t])), pairs = H.filter((t) => om.has(t.day)).map((h) => [h, om.get(h.day)]);
  const dist = (f) => { const d = pairs.map(([h, o]) => PIPS(f(h) - f(o))), a = d.map(Math.abs); return { medianAbs: r2(quant(a, 0.5)), p95Abs: r2(quant(a, 0.95)), maxAbs: r2(Math.max(...a)), medianSigned: r2(quant(d, 0.5)) }; };
  const hn = pairs.map(([h]) => h.net), on = pairs.map(([, o]) => o.net);
  const hm = pairs.map(([h]) => PIPS(h.exit - h.entry)), omv = pairs.map(([, o]) => PIPS(o.exit - o.entry));
  const stopH = pairs.filter(([h, o]) => h.how !== 'time' && o.how === 'time').length, stopO = pairs.filter(([h, o]) => h.how === 'time' && o.how !== 'time').length;
  return {
    days: pairs.length, onlyHist: H.filter((t) => !om.has(t.day)).map((t) => t.day), onlyOanda: O.filter((t) => !H.some((h) => h.day === t.day)).map((t) => t.day),
    corrNetR: r4(pearson(hn, on)), corrMovePips: r4(pearson(hm, omv)),
    sameSign: r4(pairs.filter(([h, o]) => Math.sign(h.net) === Math.sign(o.net)).length / pairs.length),
    stopOnlyHist: stopH, stopOnlyOanda: stopO,
    diffPips: { entry: dist((t) => t.entry), exit: dist((t) => t.exit), move: dist((t) => t.exit - t.entry), stopD: dist((t) => t.D) },
    hist: summ(pairs.map(([h]) => h)), oanda: summ(pairs.map(([, o]) => o)),
    largest: (() => { const [h, o] = pairs.reduce((b, p) => (Math.abs(p[0].exit - p[1].exit) > Math.abs(b[0].exit - b[1].exit) ? p : b)); return { day: h.day, exitPips: r2(PIPS(Math.abs(h.exit - o.exit))), exitHist: h.exit, exitOanda: o.exit, howHist: h.how, howOanda: o.how, stopHist: r4(h.stop), stopOanda: r4(o.stop) }; })(),
  };
}

export function study(hBars, oBars) {
  const lastDay = F.addD(new Date(hBars.at(-1)[0] * 1000).toISOString().slice(0, 10), -1);   // the frozen rule's last whole day
  const h = runFeed(hBars, lastDay), o = runFeed(oBars, lastDay), c = compare(h.got, o.got);
  const H1 = { netPositive: summ(h.got).netR > 0, monthT: summ(h.got).t != null && summ(h.got).t >= T_BAR };
  const H2 = { corr: c.corrNetR >= CORR_BAR };
  const pass = H1.netPositive && H1.monthT && H2.corr;
  const failed = [!H1.netPositive && 'H1 net R > 0', !H1.monthT && 'H1 month t >= 2', !H2.corr && 'H2 correlation >= 0.80'].filter(Boolean);
  return {
    lastDay, window: [WINDOW_FROM, lastDay],
    hist: { gotobiDays: h.gotobiDays, all: summ(h.got), byYear: byYear(h.got), noTrade: Object.fromEntries(Object.entries(h.why).map(([k, v]) => [k, v.length])), noTradeDays: h.why },
    oanda: { gotobiDays: o.gotobiDays, all: summ(o.got), byYear: byYear(o.got), noTrade: Object.fromEntries(Object.entries(o.why).map(([k, v]) => [k, v.length])), noTradeDays: o.why },
    common: c, checks: { H1, H2 }, pass, failed,
    verdict: pass ? 'FEED-ROBUST' : `NOT FEED-ROBUST (${failed.join('; ')})`,
    shorterWindow: !pass && !H1.monthT && H2.corr && H1.netPositive && summ(o.got).t != null && summ(o.got).t < T_BAR,
  };
}

// ---- the report ---------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const row = (feed, win, s) => `| ${feed} | ${win} | ${s.n} | ${fmt(s.netR)} | ${fmt(s.grossR)} | ${s.costR.toFixed(3)} | ${fmt(s.totalR, 1)} | ${fmt(s.t, 2)} | ${s.months} | ${(s.win * 100).toFixed(1)} | ${(s.stopShare * 100).toFixed(1)} | ${s.stopPips} | ${fmt(s.netR2x)} | ${fmt(s.t2x, 2)} |`;
export function report(o) {
  const L = [], H = o.hist.all, O = o.oanda.all, C = o.common, W = `${o.window[0]} to ${o.window[1]}`;
  L.push('# Gotobi feed check: the frozen T2 fade on HistData USD/JPY M1 against OANDA, same days', '');
  const lead = o.pass
    ? `On HistData USD/JPY (bid, M1 aggregated to M5) the frozen T2 makes ${fmt(H.netR)}R a trade net over ${W} (n ${H.n}, month t ${fmt(H.t, 2)}), and per-trade net R correlates ${C.corrNetR.toFixed(2)} with OANDA on the ${C.days} common days.`
    : `Failed: ${o.failed.join('; ')}. On HistData USD/JPY the frozen T2 makes ${fmt(H.netR)}R a trade net over ${W} (n ${H.n}, month t ${fmt(H.t, 2)}); OANDA on the same window ${fmt(O.netR)}R (n ${O.n}, month t ${fmt(O.t, 2)}); per-trade net R correlation ${C.corrNetR.toFixed(2)} on ${C.days} common days.`;
  L.push(`**Verdict: ${o.verdict}.** ${lead} The rule is the gotobi study's T2, frozen byte for byte (frozen.mjs); only the candle loader is new (HistData labels to UTC with council/histdata.mjs). Pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.`, '');
  if (o.shorterWindow) L.push('Read beside the verdict, as pre-registered: H2 holds and OANDA on the same window also has month t under 2, so the shortfall on H1 is the shorter window, not the feed.', '');
  L.push('## Results', '');
  L.push('| Feed | Window | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Months | Win % | Stopped % | Median stop (pips) | Net R at 2 x cost | Month t at 2 x cost |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  L.push(row('**HistData M1 (bid)**', W, H), row('OANDA mid M5', W, O), row('HistData, common days', 'same', C.hist), row('OANDA, common days', 'same', C.oanda));
  L.push('', '## The pre-registered conditions', '');
  L.push('| Condition | Value | Holds |', '|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  L.push(`| H1: HistData net R a trade > 0 | ${fmt(H.netR)} | ${yn(o.checks.H1.netPositive)} |`);
  L.push(`| H1: HistData month t >= 2 | ${fmt(H.t, 2)} | ${yn(o.checks.H1.monthT)} |`);
  L.push(`| H2: per-trade net R correlation with OANDA on common days >= 0.80 | ${C.corrNetR.toFixed(4)} (${C.days} days) | ${yn(o.checks.H2.corr)} |`);
  L.push('', '## The two feeds, trade by trade (common days)', '');
  L.push(`Common days: ${C.days}. Only on HistData: ${C.onlyHist.length}; only on OANDA: ${C.onlyOanda.length}. Correlation of the window move in pips ${C.corrMovePips.toFixed(4)}; same sign of net R on ${(C.sameSign * 100).toFixed(1)} % of days; stopped on HistData only ${C.stopOnlyHist}, on OANDA only ${C.stopOnlyOanda}.`, '');
  L.push('HistData minus OANDA, in pips (0.01). HistData is bid and OANDA mid, so a small negative signed offset in prices is expected; it cancels in the move.', '');
  L.push('| Quantity | Median abs. difference | 95th pct abs. difference | Max abs. difference | Median signed difference |', '|---|---|---|---|---|');
  for (const [k, n] of [['entry', 'Entry price (00:55 UTC open)'], ['exit', 'Exit price (06:00 UTC open, or stop)'], ['move', 'Move, exit − entry'], ['stopD', 'Stop distance D']]) {
    const d = C.diffPips[k]; L.push(`| ${n} | ${d.medianAbs} | ${d.p95Abs} | ${d.maxAbs} | ${d.medianSigned} |`);
  }
  L.push('', '## By year (net R total, gotobi trades)', '');
  const ys = [...new Set([...Object.keys(o.hist.byYear), ...Object.keys(o.oanda.byYear)])].sort();
  L.push(`| Feed | ${ys.join(' | ')} |`, `|---|${ys.map(() => '---').join('|')}|`);
  for (const [n, b] of [['HistData', o.hist.byYear], ['OANDA', o.oanda.byYear]]) L.push(`| ${n} | ${ys.map((y) => (b[y] ? `${fmt(b[y].totalR, 1)} (${b[y].n})` : '')).join(' | ')} |`);
  L.push('', '## Notes', '');
  for (const n of o.notes || []) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

function NOTES(o) {
  const n = [], h = o.hist, a = o.oanda;
  n.push(`Data: HistData USD/JPY M1 (${o.data.hist.files} files in council-data ${HIST_DIR}, read with git show, bid prices) converted to UTC with council/histdata.mjs histStampUtc only (a repeated converted time dropped), aggregated to UTC M5 candles 00:00-06:55; first candle ${o.data.hist.first}, last ${o.data.hist.last}. OANDA mid M5 from the /md/bars proxy (fetch.mjs), first ${o.data.oanda.first}, last ${o.data.oanda.last}. Both are judged through ${o.lastDay}, the frozen rule's last whole day on the HistData file.`);
  n.push(`Gotobi days in the window: ${h.gotobiDays}. No trade on HistData: ${h.noTrade.noEntry} without a 00:55 UTC candle, ${h.noTrade.noExit} without an exit candle, ${h.noTrade.noLookback} without 15 of the 20 lookback days (${[...h.noTradeDays.noEntry, ...h.noTradeDays.noExit, ...h.noTradeDays.noLookback].join(', ')}; the lookback ones are the start of the file). On OANDA: ${a.noTrade.noEntry} without a 00:55 candle (${a.noTradeDays.noEntry.join(', ')}: Christmas Day, which the HistData files do carry), ${a.noTrade.noExit} without an exit, ${a.noTrade.noLookback} without the lookback. The 2023 HistData hole (20 Feb to 30 Jul, too few bars for the clock audit's weekly reading) still holds the 00:55 and 06:00 UTC candles: both feeds trade the same 32 gotobi days in it.`);
  const big = o.common.largest;
  n.push(`The largest exit difference, ${big.exitPips} pips on ${big.day}: HistData exits by ${big.howHist} at ${big.exitHist}, OANDA by ${big.howOanda} at ${big.exitOanda} (stop ${big.stopHist} / ${big.stopOanda}). Exit differences over 5 pips are days stopped on one feed and not the other (${o.common.stopOnlyHist} stopped on HistData only, ${o.common.stopOnlyOanda} on OANDA only); where both feeds stop, the two stops sit up to a few pips apart because D differs; the 95th percentile of the exit difference is ${o.common.diffPips.exit.p95Abs} pip.`);
  n.push('In the clock audit (research/edge/histdata-clock) USD/JPY 2019 and 2023 are UNCERTIFIED (2019: the first bar after the US spring change; 2023: the file hole). They are kept, as pre-registered; the by-year table shows them.');
  n.push('Costs are the frozen model on both feeds (0.3 pip spread, 0.5 pip slippage a side, USD 22.5 per million a side). HistData bid prices carry no spread of their own; the bid/mid offset cancels in the move.');
  n.push('Month t is on calendar-month sums of net R (the frozen monthT). No placebo or Holm: one frozen rule on one more feed.');
  return n;
}

async function main() {
  const [dir] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs <candleDir>');
  const hBars = loadHist(dir);
  const oBars = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'usdjpy-oanda-5m.json.gz'))));
  const res = study(hBars, oBars);
  const day = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const out = {
    study: 'gotobi-feed', built: '2026-11-14', verdict: res.verdict, pass: res.pass, failed: res.failed, shorterWindow: res.shorterWindow,
    rule: 'The gotobi study\'s T2, frozen (frozen.mjs, sha256 645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32): on gotobi days sell USD/JPY at the open of the 00:55 UTC M5 candle, buy back at 06:00 UTC; stop 1.5 x the 20-business-day median of the same window\'s absolute move; net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side.',
    data: {
      hist: { source: `HistData USD/JPY M1 (bid), council-data ${HIST_DIR}, git show`, files: histFiles().length, clock: 'council/histdata.mjs histStampUtc', first: day(hBars[0][0]), last: day(hBars.at(-1)[0]), m5: hBars.length },
      oanda: { source: 'OANDA mid M5 through the /md/bars proxy (fetch.mjs)', first: day(oBars[0][0]), last: day(oBars.at(-1)[0]), m5: oBars.length },
    },
    window: res.window, lastDay: res.lastDay,
    bar: { H1: { netR: '> 0', monthT: T_BAR }, H2: { corrNetR: CORR_BAR } },
    checks: res.checks, hist: res.hist, oanda: res.oanda, common: res.common,
  };
  out.notes = NOTES(out);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log(JSON.stringify({ verdict: out.verdict, hist: out.hist.all, oanda: out.oanda.all, corr: out.common.corrNetR, diff: out.common.diffPips }, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
