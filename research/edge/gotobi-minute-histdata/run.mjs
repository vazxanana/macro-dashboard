// Edge research · gotobi-minute-histdata: gotobi-timing's entry-minute grid (#908) repeated on the independent HistData USD/JPY
// M1 feed, to see whether the 00:55 spike OANDA shows is fix behaviour or an artefact of one feed. A sensitivity report on the
// frozen rule (PREREGISTRATION.md), never used to pick a time. The rule's functions come from frozen.mjs (byte copy of
// gotobi-feed's, sha256 pinned in the test). The HistData loader is gotobi-feed's and the M1 trade is gotobi-timing's, copied
// (never imported across branches); HistData labels go to UTC through council/histdata.mjs only.
//   node research/edge/gotobi-minute-histdata/run.mjs <cacheDir> [<oandaM1.json.gz> <oandaM5.json.gz>]
//   (<cacheDir> receives usdjpy-hist-1m-0007.json.gz, read once from `git show origin/council-data:…`; keep it out of git)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';
import * as F from './frozen.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2018-01-01';
export const HIST_DIR = 'research/candles/USDJPY';
export const KEEP_UNTIL = 7 * 3600;                              // candles that start 00:00-06:59 UTC
export const BASE = { entry: 55, exit: 360 };                    // 00:55 and 06:00 UTC, in minutes
export const ENTRIES = [53, 54, 55, 56, 57, 58, 60];
export const GRACE_M1 = F.EXIT_GRACE / 60;                       // the frozen 15-minute exit grace, in M1 candles
export const GATE = { n: 623, netR: 0.1265, nTol: 6, rTol: 0.010, openShare: 0.99, lastDay: '2026-10-29' };
export const READ = { margin: 0.020, lateShare: 0.5 };
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ---- the loader (gotobi-feed's parseHist / toM5, copied) ----------------------------------------------------------------
export function parseHist(text, seen = new Set(), keepUntil = KEEP_UNTIL) {
  const out = [];
  for (const line of text.split('\n')) {
    if (line.length < 20) continue;
    const f = line.split(';');
    const t = histStampUtc(f[0]);
    if (!Number.isFinite(t) || seen.has(t)) continue;
    seen.add(t);
    if (t % 86400 >= keepUntil) continue;
    out.push([t, +f[1], +f[2], +f[3], +f[4]]);
  }
  return out;
}
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
export function loadHistM1(dir) {
  const cf = path.join(dir, 'usdjpy-hist-1m-0007.json.gz');
  if (fs.existsSync(cf)) return JSON.parse(zlib.gunzipSync(fs.readFileSync(cf)));
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Set(), m1 = [];
  for (const p of histFiles()) for (const r of parseHist(zlib.gunzipSync(git(['show', `origin/council-data:${p}`])).toString(), seen)) m1.push(r);
  m1.sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(cf, zlib.gzipSync(JSON.stringify(m1)));
  return m1;
}

// ---- the M1 trade (gotobi-timing's tradeM1, copied unchanged) -----------------------------------------------------------
export function tradeM1(ix, ymd, D, entryMin, exitMin) {
  if (!(D > 0)) return null;
  const day0 = Date.parse(ymd + 'T00:00:00Z') / 1000, entry = day0 + entryMin * 60, exit = day0 + exitMin * 60;
  const ei = ix.at.get(entry); if (ei == null) return null;
  let xp = null; const xi = ix.at.get(exit);
  if (xi != null) xp = ix.bars[xi][1];
  else for (let k = 1; k <= GRACE_M1; k++) { const j = ix.at.get(exit - 60 * k); if (j != null) { xp = ix.bars[j][4]; break; } }
  if (xp == null) return null;
  const side = -1, epx = ix.bars[ei][1], stop = epx - side * D;
  let out = xp, how = 'time';
  for (let i = ei; i < ix.bars.length && ix.bars[i][0] < exit; i++) {
    const [, o, h] = ix.bars[i];
    if (o >= stop) { out = o; how = 'gap'; break; }
    if (h >= stop) { out = stop; how = 'stop'; break; }
  }
  const R = side * (out - epx) / D, cR = F.costPx(epx) / D;
  return { day: ymd, entryT: entry, exitT: exit, entry: epx, stop, D, exit: out, how, R, costR: cR, net: R - cR };
}

export function gotobiDays(from, to) {
  const G = F.gotobiSet(+from.slice(0, 4) - 1, +to.slice(0, 4));
  return [...G].filter((d) => d >= from && d <= to).sort();
}
// the frozen stop distance of every gotobi day of the window, from a feed's M5 candles (the base window, as #908), and the
// frozen M5 trade of that day
export function frozenD(m5, from, to) {
  const ix = F.index(m5), moves = new Map();
  const moveOf = (d) => { if (!moves.has(d)) moves.set(d, F.windowMove(ix, 'fade', d)); return moves.get(d); };
  const D = new Map(), base = new Map();
  for (const d of gotobiDays(from, to)) {
    if (!F.isTokyoBusinessDay(d)) continue;
    const dd = F.stopDist(moveOf, d); if (!(dd > 0)) continue;
    D.set(d, dd);
    const t = F.trade(ix, 'fade', d, dd); if (t) base.set(d, t);
  }
  return { D, base, ix };
}
export function runGrid(ix1, D) {
  return ENTRIES.map((e) => {
    const trades = [], missing = [];
    for (const [d, dd] of D) { const t = tradeM1(ix1, d, dd, e, BASE.exit); if (t) trades.push(t); else missing.push(d); }
    return { entry: hhmm(e), exit: hhmm(BASE.exit), base: e === BASE.entry, noTrade: missing.length, ...F.summary(trades), trades };
  });
}

// ---- statistics ---------------------------------------------------------------------------------------------------------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
export function pearson(x, y) {
  if (x.length < 3) return null;
  const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
  for (let i = 0; i < x.length; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
  return a / Math.sqrt(b * c);
}

// the pre-registered reading on the seven rows
export function reading(rows) {
  const base = rows.find((r) => r.entry === hhmm(BASE.entry)), late = rows.find((r) => r.entry === hhmm(BASE.entry + 1));
  const others = rows.filter((r) => r !== base);
  const runnerUp = others.reduce((b, r) => (r.netR > b.netR ? r : b));
  const a = base.netR > 0 && others.every((r) => base.netR - r.netR >= READ.margin - 1e-12);
  const b = base.netR > 0 && late.netR < READ.lateShare * base.netR;
  const failed = [!a && `00:55 is not the clear maximum (00:55 ${base.netR}, highest other ${runnerUp.entry} ${runnerUp.netR})`, !b && `00:56 keeps ${base.netR > 0 ? r4(late.netR / base.netR) : 'n/a'} of 00:55 (needs < ${READ.lateShare})`].filter(Boolean);
  return { word: a && b ? 'FEED-CONFIRMED' : 'FEED-DIFFERENT', clearMax: a, lateHalf: b, margin: r4(base.netR - runnerUp.netR), runnerUp: runnerUp.entry, lateShare: base.netR > 0 ? r4(late.netR / base.netR) : null, failed };
}

export function compareRows(hRows, oRows) {
  return hRows.map((h) => {
    const o = oRows.find((x) => x.entry === h.entry), om = new Map(o.trades.map((t) => [t.day, t]));
    const pairs = h.trades.filter((t) => om.has(t.day)).map((t) => [t, om.get(t.day)]);
    const dE = pairs.map(([a, b]) => Math.abs(a.entry - b.entry) / F.PIP);
    return {
      entry: h.entry, days: pairs.length,
      corrNetR: r4(pearson(pairs.map(([a]) => a.net), pairs.map(([, b]) => b.net))),
      corrMovePips: r4(pearson(pairs.map(([a]) => (a.exit - a.entry) / F.PIP), pairs.map(([, b]) => (b.exit - b.entry) / F.PIP))),
      sameSign: pairs.length ? r4(pairs.filter(([a, b]) => Math.sign(a.net) === Math.sign(b.net)).length / pairs.length) : null,
      entryDiffPips: { medianAbs: r2(quant(dE, 0.5)), p95Abs: r2(quant(dE, 0.95)) },
      hist: F.summary(pairs.map(([a]) => a)), oanda: F.summary(pairs.map(([, b]) => b)),
    };
  });
}

const strip = ({ trades, ...r }) => r;
export function study(histM1, oanda) {
  const m5 = toM5(histM1);
  const lastDay = F.addD(new Date(histM1.at(-1)[0] * 1000).toISOString().slice(0, 10), -1);
  const { D, base, ix: ix5 } = frozenD(m5, FROM, lastDay), ix1 = F.index(histM1);
  const rows = runGrid(ix1, D), baseM1 = rows.find((r) => r.base);
  let both = 0, same = 0; const mism = [];
  for (const d of D.keys()) {
    const t = Date.parse(d + 'T00:00:00Z') / 1000 + BASE.entry * 60, a = ix1.at.get(t), b = ix5.at.get(t);
    if (a == null || b == null) continue;
    both++; if (Math.abs(ix1.bars[a][1] - ix5.bars[b][1]) < 1e-9) same++; else mism.push({ day: d, m1: ix1.bars[a][1], m5: ix5.bars[b][1] });
  }
  const m5Base = F.summary([...base.values()]);
  const m5Days = new Set(base.keys()), m1Days = new Set(baseM1.trades.map((t) => t.day));
  const gate = {
    lastDay, m5: m5Base, m1: strip(baseM1),
    tolerance: { n: GATE.nTol, netR: GATE.rTol, openShare: GATE.openShare },
    onlyM5: [...m5Days].filter((d) => !m1Days.has(d)), onlyM1: [...m1Days].filter((d) => !m5Days.has(d)),
    open: { days: both, equal: same, share: both ? Math.round(same / both * 1e4) / 1e4 : 0, mismatches: mism },
  };
  gate.checks = {
    reproducesFeed: lastDay === GATE.lastDay && m5Base.n === GATE.n && Math.abs(m5Base.netR - GATE.netR) < 5e-5,
    n: Math.abs(baseM1.n - GATE.n) <= GATE.nTol,
    netR: Math.abs(baseM1.netR - GATE.netR) <= GATE.rTol,
    open: both > 0 && same / both >= GATE.openShare,
  };
  gate.pass = Object.values(gate.checks).every(Boolean);
  const read = gate.pass ? reading(rows) : null;
  const out = { lastDay, window: [FROM, lastDay], days: D.size, gate, grid: rows.map(strip), reading: read };
  if (oanda) {
    const od = frozenD(oanda.m5, FROM, lastDay), oRows = runGrid(F.index(oanda.m1), od.D);
    out.oanda = { available: true, days: od.D.size, grid: oRows.map(strip), compare: compareRows(rows, oRows) };
  } else out.oanda = { available: false };
  return out;
}

// ---- report -------------------------------------------------------------------------------------------------------------
const fmt = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const gridRow = (r) => `| ${r.base ? '**00:55 (the rule)**' : r.entry} | ${r.n} | ${fmt(r.netR, 4)} | ${fmt(r.grossR, 4)} | ${r.costR.toFixed(4)} | ${fmt(r.totalR, 1)} | ${fmt(r.t, 2)} | ${(r.win * 100).toFixed(1)} | ${(r.stopShare * 100).toFixed(1)} | ${r.noTrade} |`;
const GH = ['| Entry (UTC), exit 06:00 | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % | No trade (no candle at the entry or exit) |', '|---|---|---|---|---|---|---|---|---|---|'];
export function report(o) {
  const L = [], g = o.gate, rd = o.reading, H = Object.fromEntries(o.grid.map((r) => [r.entry, r]));
  L.push('# Gotobi fade: the entry-minute grid on HistData M1 (is the 00:55 spike a feed artefact?)', '');
  if (!g.pass) L.push('**Verdict: not interpretable (the gate failed); no reading is given.**', '');
  else {
    const why = rd.word === 'FEED-CONFIRMED'
      ? `on HistData too the 00:55 entry is the clear maximum (${fmt(H['00:55'].netR)}R a trade, ${fmt(rd.margin)}R above the next row, ${rd.runnerUp}) and one minute late keeps ${(rd.lateShare * 100).toFixed(0)} % of it (${fmt(H['00:56'].netR)}R)`
      : `on HistData ${rd.failed.join('; ')}`;
    L.push(`**Verdict: ${rd.word}: ${why}.**`, '');
  }
  L.push(`**A sensitivity report, not a test and not a choice.** The frozen gotobi fade (T2 of #878: sell USD/JPY at 00:55 UTC on gotobi days, buy back at 06:00 UTC) with the entry moved minute by minute, as #908 did on OANDA M1, on the independent HistData USD/JPY M1 feed (bid; labels to UTC through council/histdata.mjs only). The day list, the stop distance D (from this feed's own M5 base window), the side and the costs are frozen; nothing is chosen from the grid, and nothing here is a verdict about an edge. Pre-registered in PREREGISTRATION.md (first commit of the branch). Paper research only; nothing live changed.`, '');
  L.push(`**Gate: ${g.pass ? 'PASSED' : 'FAILED'}.** The frozen code on this loader's M5 candles gives n ${g.m5.n}, ${fmt(g.m5.netR, 4)}R a trade over ${o.window[0]} to ${o.window[1]} (#894: 623, +0.1265, to 2026-10-29). The HistData M1 00:55 row gives n ${g.m1.n} (tolerance ±${g.tolerance.n}) and ${fmt(g.m1.netR, 4)}R a trade (tolerance ±${g.tolerance.netR.toFixed(3)}R), month t ${fmt(g.m1.t, 2)}. The M1 open at 00:55 equals the M5 open at 00:55 on ${g.open.equal} of ${g.open.days} days (${(g.open.share * 100).toFixed(2)} %; required ${(g.tolerance.openShare * 100).toFixed(0)} %). Days traded on M5 only: ${g.onlyM5.length ? g.onlyM5.join(', ') : 'none'}; on M1 only: ${g.onlyM1.length ? g.onlyM1.join(', ') : 'none'}; open mismatches: ${g.open.mismatches.length ? g.open.mismatches.map((m) => `${m.day} (M1 ${m.m1}, M5 ${m.m5})`).join('; ') : 'none'}.`, '');
  L.push(`## HistData M1 (bid), ${o.window[0]} to ${o.window[1]}, ${o.days} gotobi days with a frozen D`, '', ...GH);
  for (const r of o.grid) L.push(gridRow(r));
  if (o.oanda.available) {
    L.push('', `## OANDA M1 (mid, #908's file), same window, ${o.oanda.days} gotobi days with a frozen D`, '', ...GH);
    for (const r of o.oanda.grid) L.push(gridRow(r));
    L.push('', '## The two feeds, day by day, at each entry minute (days both feeds trade)', '');
    L.push('| Entry (UTC) | Common days | Corr. net R | Corr. move (pips) | Same sign % | Entry diff, median abs (pips) | Entry diff, 95th pct abs (pips) | HistData net R | OANDA net R |', '|---|---|---|---|---|---|---|---|---|');
    for (const c of o.oanda.compare) L.push(`| ${c.entry} | ${c.days} | ${c.corrNetR == null ? 'n/a' : c.corrNetR.toFixed(4)} | ${c.corrMovePips == null ? 'n/a' : c.corrMovePips.toFixed(4)} | ${(c.sameSign * 100).toFixed(1)} | ${c.entryDiffPips.medianAbs} | ${c.entryDiffPips.p95Abs} | ${fmt(c.hist.netR, 4)} | ${fmt(c.oanda.netR, 4)} |`);
  } else L.push('', '## OANDA comparison', '', "#908's OANDA M1 file was not available in this session; no per-day correlation is given.");
  if (rd) {
    L.push('', '## The pre-registered reading', '', '| Condition | Value | Holds |', '|---|---|---|');
    L.push(`| 00:55 net R a trade > 0 and at least ${READ.margin.toFixed(3)}R above every other row | ${fmt(H['00:55'].netR, 4)}; next highest ${rd.runnerUp} ${fmt(H[rd.runnerUp].netR, 4)} (margin ${fmt(rd.margin, 4)}) | ${rd.clearMax ? 'yes' : 'no'} |`);
    L.push(`| 00:56 net R a trade < ${READ.lateShare} x 00:55 | ${fmt(H['00:56'].netR, 4)} = ${rd.lateShare == null ? 'n/a' : (rd.lateShare * 100).toFixed(1) + ' %'} of 00:55 | ${rd.lateHalf ? 'yes' : 'no'} |`);
  }
  L.push('', '## Notes', '');
  for (const n of o.notes || []) L.push(`- ${n}`);
  return L.join('\n') + '\n';
}

export function load(f) { return JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); }

async function main() {
  const [dir, om1, om5] = process.argv.slice(2);
  if (!dir) throw new Error('usage: node run.mjs <cacheDir> [<oandaM1.json.gz> <oandaM5.json.gz>]');
  const m1 = loadHistM1(dir);
  const oanda = om1 && om5 && fs.existsSync(om1) && fs.existsSync(om5) ? { m1: load(om1), m5: load(om5) } : null;
  const res = study(m1, oanda);
  const first = new Date(m1[0][0] * 1000).toISOString().slice(0, 16).replace('T', ' '), last = new Date(m1.at(-1)[0] * 1000).toISOString().slice(0, 16).replace('T', ' ');
  const out = {
    study: 'gotobi-minute-histdata', built: '2026-11-14', kind: 'sensitivity report (no verdict about an edge, nothing chosen)',
    verdict: res.gate.pass ? res.reading.word : 'not interpretable (gate failed)',
    rule: 'Frozen T2 of research/edge/gotobi (#878): on gotobi days sell USD/JPY at 00:55 UTC, buy back at 06:00 UTC; stop 1.5 x the 20-business-day median absolute move of that window (M5 of the same feed); net of 0.3 pip spread, USD 22.5 per million a side and 0.5 pip slippage a side. Here the entry minute moves, as #908.',
    frozen: { file: 'frozen.mjs', from: 'origin/gotobi-feed:research/edge/gotobi-feed/frozen.mjs', sha256: '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32' },
    data: {
      hist: { source: 'HistData USD/JPY M1 (bid), council-data research/candles/USDJPY, git show', clock: 'council/histdata.mjs histStampUtc', files: histFiles().length, first, last, m1: m1.length, kept: '00:00-06:59 UTC' },
      oanda: oanda ? { source: "OANDA mid M1 (#908's file, 00:40-06:15 UTC on each gotobi day) and OANDA mid M5 (#878's file) for D", m1: oanda.m1.length } : null,
    },
    bar: { gate: GATE, reading: { clearMaxMargin: READ.margin, lateShareBelow: READ.lateShare } },
    ...res,
  };
  const G = Object.fromEntries(res.grid.map((r) => [r.entry, r])), f = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  out.notes = [
    'D, the day list, the side and the costs are frozen; the stop sits D above the actual (shifted) fill. D comes from the HistData M5 base window (00:55 -> 06:00 UTC), as #908 took D from its own feed\'s M5; on the OANDA side D is #878\'s, from the OANDA M5 file.',
    'HistData is bid, OANDA mid: the entry prices differ by about half a spread; the move and the stop distance are not affected by a constant offset. Costs are the frozen model at every minute.',
    'Month t is on calendar-month sums of net R (frozen monthT): a measure of each row\'s noise, not a test. No Holm, no placebo: nothing here is judged as an edge.',
    'Entry at 00:53 / 00:54 is shown only to see whether the effect sits on the fix minute itself; no minute is an option.',
    `Plain reading, after the gate: on HistData ${['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00'].map((k) => `${k} ${f(G[k].netR)}R`).join(', ')}.`,
  ];
  if (out.oanda.available) {
    const O = Object.fromEntries(out.oanda.grid.map((r) => [r.entry, r]));
    out.notes.push(
      'On the shared 2018-26 window the minutes before the fix keep more of the 00:55 figure than #908 showed on 2016-26 (HistData 00:54 keeps about four fifths, OANDA about three quarters, against about half on #908\'s longer window); after the fix both feeds drop at once. The reading condition is about 00:55 against every other row and 00:56 against 00:55 only.',
      'Per-day net R correlates at 0.99 or more between the two feeds at every minute, so the minute profile is not a print of one feed. Whether it is the fix flow itself is not something a feed comparison can show; it only rules out an OANDA-only artefact.',
    );
    out.notes.push(`OANDA on the same window: ${['00:53', '00:54', '00:55', '00:56', '00:57', '00:58', '01:00'].map((k) => `${k} ${f(O[k].netR)}R`).join(', ')} (#908 over 2016-01-01 to 2026-11-11: 00:55 +0.148R, 00:56 +0.048R).`);
  }
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  console.log('gate', res.gate.pass, JSON.stringify(res.gate.checks), res.gate.m5.n, res.gate.m5.netR, res.gate.m1.n, res.gate.m1.netR, res.gate.open.share);
  for (const r of res.grid) console.log('H', r.entry, r.n, r.netR, r.t);
  if (out.oanda.available) for (const c of out.oanda.compare) console.log('C', c.entry, c.days, c.corrNetR, c.oanda.netR);
  console.log(JSON.stringify(res.reading));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
