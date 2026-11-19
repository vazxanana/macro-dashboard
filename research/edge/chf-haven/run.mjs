// chf-haven: the Swiss franc in the five trading days after a sharp S&P 500 fall (rules: PREREGISTRATION.md).
// node research/edge/chf-haven/run.mjs fetch <dir>   (git show from origin/council-data, no network)
// node research/edge/chf-haven/run.mjs full <dir>    (writes result.json and RESULT.md next to this file)
// Paper research only: imports nothing of the council but the cost helpers `nights` and `foldWeekend`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nights, foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KEYS = ['spx500', 'usdchf', 'eurchf', 'audchf'];
export const PAIRS = [
  { k: 'usdchf', test: 'T1', name: 'short USD/CHF', finNight: () => 0.0001314, fin: 'measured swap.short −1.314 pips a rollover' },
  { k: 'eurchf', test: 'T2', name: 'short EUR/CHF', finNight: (px) => px * 0.04 / 365, fin: 'assumed 4.0 % a year' },
  { k: 'audchf', test: 'T3', name: 'short AUD/CHF', finNight: (px) => px * 0.055 / 365, fin: 'assumed 5.5 % a year' },
];
export const P = { look: 60, k: 2, atrN: 20, stopAtr: 2, hold: 5, pip: 0.0001, spreadPips: 0.3, slipPips: 0.15, commRT: 0.000045 };
export const DECISIVE = Date.UTC(2016, 0, 1) / 1000;
export const SNB = Date.UTC(2015, 0, 15) / 1000;
export const SEEDS = 40;

export const toBars = (j) => j.rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));

// signal days on the folded index: the day's return below -k x sd of the `look` returns BEFORE it
export function signals(idx, look = P.look, k = P.k) {
  const out = [];
  const r = idx.map((b, i) => (i ? b.close / idx[i - 1].close - 1 : NaN));
  for (let t = look + 1; t < idx.length; t++) {
    const w = r.slice(t - look, t);
    const m = w.reduce((a, b) => a + b, 0) / look;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (look - 1));
    out.push({ t: idx[t].time, r: r[t], sd, sig: r[t] < -k * sd });
  }
  return out;
}
export const entryIndex = (bars, t) => { for (let i = 0; i < bars.length; i++) if (bars[i].time > t) return i; return -1; };
// simple mean true range of the n candles before index i
export function atrBefore(bars, i, n = P.atrN) {
  if (i - n < 1) return NaN;
  let s = 0;
  for (let j = i - n; j < i; j++) { const b = bars[j], pc = bars[j - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); }
  return s / n;
}
// one short trade from candle i; null when the hold is not all on file or no ATR
export function tradeAt(bars, i, finNight, mult = 1) {
  const atr = atrBefore(bars, i);
  if (!(atr > 0) || i + P.hold - 1 >= bars.length) return null;
  const entry = bars[i].open, risk = P.stopAtr * atr, stop = entry + risk;
  let exit = null, k = i + P.hold - 1, how = 'time';
  for (let j = i; j < i + P.hold; j++) {
    const b = bars[j];
    if (b.open >= stop && j > i) { exit = b.open; k = j; how = 'gap'; break; }
    if (b.high >= stop) { exit = stop; k = j; how = 'stop'; break; }
  }
  if (exit == null) exit = bars[k].close;
  const n = nights(bars[i].time, bars[k].time + 86400);
  const fin = n * finNight(entry);
  const trade = (P.spreadPips + 2 * P.slipPips) * P.pip + P.commRT * entry;
  const gross = (entry - exit) / risk;
  return { t: bars[i].time, i, k, entry, stop, exit, how, atr, nights: n, gross,
    costR: mult * (trade + fin) / risk, finR: mult * fin / risk, net: gross - mult * (trade + fin) / risk, exitT: bars[k].time };
}
// all trades of a list of signal times, one position at a time
export function simulate(bars, sigTimes, finNight, mult = 1) {
  const out = []; let busy = -1, ignored = 0;
  for (const t of sigTimes) {
    const i = entryIndex(bars, t);
    if (i < 0) continue;
    if (i <= busy) { ignored++; continue; }
    const tr = tradeAt(bars, i, finNight, mult);
    if (!tr) continue;
    out.push({ ...tr, sigT: t }); busy = tr.k;
  }
  out.ignored = ignored;
  return out;
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export function tstat(a) {
  if (a.length < 2) return NaN;
  const m = mean(a), sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  return sd > 0 ? m / sd * Math.sqrt(a.length) : NaN;
}
const ym = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
// calendar-month sums over every month from `from` to `to` (zeros included)
export function monthly(trades, from, to, key = 'net') {
  const a = ym(from), b = ym(to), s = new Array(b - a + 1).fill(0);
  for (const x of trades) { const m = ym(x.t); if (m >= a && m <= b) s[m - a] += x[key]; }
  return s;
}
export function normP(z) { // one-sided upper p of a standard normal
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? q : 1 - q;
}
export function holm(ps) { // adjusted p, same order
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// placebo days: per year, as many as the real signals, drawn without replacement from that year's eligible days
export function sample(days, seed) {
  const r = rng(seed), byY = new Map();
  for (const d of days) { const y = new Date(d.t * 1000).getUTCFullYear(); if (!byY.has(y)) byY.set(y, { all: [], n: 0 }); const g = byY.get(y); g.all.push(d.t); if (d.sig) g.n++; }
  const out = [];
  for (const g of byY.values()) { const a = g.all.slice(); for (let j = 0; j < g.n; j++) { const q = j + Math.floor(r() * (a.length - j)); [a[j], a[q]] = [a[q], a[j]]; out.push(a[j]); } }
  return out.sort((x, y) => x - y);
}
export function stats(tr) {
  const net = tr.map((x) => x.net);
  return { n: tr.length, net: mean(net), t: tstat(net), gross: mean(tr.map((x) => x.gross)), cost: mean(tr.map((x) => x.costR)),
    fin: mean(tr.map((x) => x.finR)), netNoFin: mean(tr.map((x) => x.net + x.finR)),
    hit: tr.length ? tr.filter((x) => x.net > 0).length / tr.length : NaN, stopped: tr.length ? tr.filter((x) => x.how !== 'time').length / tr.length : NaN };
}
export function verdictOf(c) {
  const ok = { netDec: c.dec.net > 0, netRep: c.rep.net > 0, t: c.dec.t >= 2, monthT: c.monthT >= 2, holm: c.holmP < 0.05, n: c.dec.n >= 30, placebo: c.placeboBeaten >= 38 };
  return { ok, pass: Object.values(ok).every(Boolean) };
}

export function run(dir) {
  const raw = Object.fromEntries(KEYS.map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8'))]));
  const idx = foldWeekend(toBars(raw.spx500));
  const days = signals(idx);
  const sigT = days.filter((d) => d.sig).map((d) => d.t);
  const last = idx[idx.length - 1].time;
  const tests = [];
  for (const p of PAIRS) {
    const bars = foldWeekend(toBars(raw[p.k]));
    const end = Math.min(last, bars[bars.length - 1].time);
    const all = simulate(bars, sigT, p.finNight);
    const x2 = simulate(bars, sigT, p.finNight, 2);
    const dec = all.filter((x) => x.t >= DECISIVE), rep = all.filter((x) => x.t < DECISIVE);
    const snb = all.filter((x) => x.t <= SNB && x.exitT + 86400 > SNB);
    const ms = monthly(dec, DECISIVE, end);
    const placebo = [];
    for (let s = 1; s <= SEEDS; s++) placebo.push(mean(simulate(bars, sample(days, s), p.finNight).filter((x) => x.t >= DECISIVE).map((x) => x.net)));
    const decNet = mean(dec.map((x) => x.net));
    const byYear = {};
    for (const x of all) { const y = new Date(x.t * 1000).getUTCFullYear(); (byYear[y] ||= []).push(x.net); }
    tests.push({
      test: p.test, pair: p.k, name: p.name, financing: p.fin,
      first: all.length ? new Date(all[0].t * 1000).toISOString().slice(0, 10) : null, end: new Date(end * 1000).toISOString().slice(0, 10),
      ignored: all.ignored,
      dec: stats(dec), rep: stats(rep), repNoSnb: stats(rep.filter((x) => !snb.includes(x))),
      x2: { dec: stats(x2.filter((x) => x.t >= DECISIVE)), rep: stats(x2.filter((x) => x.t < DECISIVE)) },
      monthT: tstat(ms), months: ms.length,
      placebo: { means: placebo, p95: placebo.slice().sort((a, b) => a - b)[37], min: Math.min(...placebo), max: Math.max(...placebo) },
      placeboBeaten: placebo.filter((m) => decNet > m).length,
      snb: snb.map((x) => ({ entry: new Date(x.t * 1000).toISOString().slice(0, 10), exit: new Date(x.exitT * 1000).toISOString().slice(0, 10), how: x.how, gross: x.gross, net: x.net })),
      byYear: Object.fromEntries(Object.entries(byYear).map(([y, a]) => [y, { n: a.length, net: mean(a) }])),
    });
  }
  const adj = holm(tests.map((c) => normP(c.monthT)));
  tests.forEach((c, i) => { c.pMonth = normP(c.monthT); c.holmP = adj[i]; const v = verdictOf(c); c.ok = v.ok; c.pass = v.pass; });
  const decSig = days.filter((d) => d.sig && d.t >= DECISIVE).length;
  return {
    study: 'chf-haven', built: '2026-11-14', verdict: tests.some((c) => c.pass) ? 'PASS' : 'FAIL',
    passed: tests.filter((c) => c.pass).length, of: tests.length,
    data: { source: 'council-data research/daily (OANDA mid, UTC daily candles, weekends folded)', commit: raw.spx500.commit || null,
      spxFirst: new Date(idx[0].time * 1000).toISOString().slice(0, 10), spxLast: new Date(last * 1000).toISOString().slice(0, 10) },
    signals: { all: sigT.length, decisive: decSig, replication: sigT.length - decSig, eligibleDays: days.length },
    params: P, tests,
  };
}

const f = (x, d = 3) => (Number.isFinite(x) ? (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toFixed(d) : 'n/a');
const tf = (x) => f(x, 2);
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + ' %' : 'n/a');
const pf = (x) => x.toFixed(3);
export function report(R) {
  const L = [];
  const why = (c) => Object.entries(c.ok).filter(([, v]) => !v).map(([k]) => ({ netDec: 'net R not above 0', netRep: 'negative before 2016', t: 't under 2', monthT: 'month t under 2', holm: 'Holm p over 0.05', n: 'n under 30', placebo: 'placebo not beaten' })[k]).join(', ');
  L.push(`**Verdict: ${R.verdict}, ${R.passed} of ${R.of} tests.** ` + R.tests.map((c) => `${c.name} ${f(c.dec.net)}R a trade net on 2016-26 (n ${c.dec.n}, t ${tf(c.dec.t)}, month t ${tf(c.monthT)}${c.pass ? ', passes' : ', fails: ' + why(c)})`).join('; ') + '. The franc does not keep appreciating, in a tradeable way, over the five trading days after a sharp S&P 500 fall. Not an edge; no proposal, nothing live changed.');
  L.push('', '# The Swiss franc after a sharp S&P 500 fall (14 Nov 2026)', '');
  L.push('Paper research only. Rules fixed in `PREREGISTRATION.md` before any price was read. Claim tested: Ranaldo and Söderlind (2010, Review of Finance, "Safe haven currencies"): the franc appreciates when US stocks fall sharply. Question: is there a tradeable LAG over the following days, after costs?', '');
  L.push('## What was tested', '');
  L.push(`- OANDA mid UTC daily candles from council-data \`research/daily/\` (spx500, usdchf, eurchf, audchf; commit \`${(R.data.commit || '').slice(0, 9)}\`), weekends folded into Monday (\`council/fills.mjs\` \`foldWeekend\`). S&P 500 ${R.data.spxFirst} to ${R.data.spxLast}.`);
  L.push(`- Signal: the S&P 500's UTC daily close-to-close return below −2 × the standard deviation of the 60 returns before it: ${R.signals.all} signal days (${R.signals.decisive} from 2016) of ${R.signals.eligibleDays} eligible days.`);
  L.push('- Trade: short the pair (long the franc) at the next UTC daily open (00:00 UTC; after a Friday signal the Sunday reopen), stop 2 × ATR(20) of the pair\'s daily candles (a gap through it fills at the open), out at the close of the fifth trading day; one position per pair at a time.');
  L.push('- Costs: 0.3 pip spread + 0.15 pip slippage on entry and exit + 22.5 USD per million a side commission, plus overnight financing per rollover (`nights`): ' + R.tests.map((c) => `${c.pair} ${c.financing}`).join(', ') + '. Today\'s rates charged for every year.', '');
  L.push('## Results', '');
  L.push('| Test | window | n | gross R | net R a trade | t | month t | Holm p | net, 2x costs | net, no financing | cost R | hit | stopped |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R.tests) {
    L.push(`| ${c.test} ${c.name} | 2016-26 (decisive) | ${c.dec.n} | ${f(c.dec.gross)} | ${f(c.dec.net)} | ${tf(c.dec.t)} | ${tf(c.monthT)} | ${pf(c.holmP)} | ${f(c.x2.dec.net)} | ${f(c.dec.netNoFin)} | ${f(c.dec.cost)} | ${pc(c.dec.hit)} | ${pc(c.dec.stopped)} |`);
    L.push(`| ${c.test} ${c.name} | ${c.first.slice(0, 4)}-15 (replication) | ${c.rep.n} | ${f(c.rep.gross)} | ${f(c.rep.net)} | ${tf(c.rep.t)} | | | ${f(c.x2.rep.net)} | ${f(c.rep.netNoFin)} | ${f(c.rep.cost)} | ${pc(c.rep.hit)} | ${pc(c.rep.stopped)} |`);
  }
  L.push('', '## The bar, check by check', '');
  L.push('| Test | net > 0 (2016-26) | net > 0 (before 2016) | t ≥ 2 | month t ≥ 2 | Holm p < 0.05 | n ≥ 30 | placebo beaten (of 40, need 38) | pass |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const c of R.tests) L.push(`| ${c.test} ${c.name} | ${yn(c.ok.netDec)} | ${yn(c.ok.netRep)} | ${yn(c.ok.t)} (${tf(c.dec.t)}) | ${yn(c.ok.monthT)} (${tf(c.monthT)}) | ${yn(c.ok.holm)} (${pf(c.holmP)}) | ${yn(c.ok.n)} | ${c.placeboBeaten} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', '## Placebo (40 seeds, the same number of entry days per year drawn at random)', '');
  for (const c of R.tests) L.push(`- ${c.name}: placebo decisive means ${f(c.placebo.min)} to ${f(c.placebo.max)}R, 95th percentile ${f(c.placebo.p95)}R; real ${f(c.dec.net)}R beats ${c.placeboBeaten} of 40.`);
  L.push('', '## Descriptive (not part of the bar)', '');
  for (const c of R.tests) {
    L.push(`- **${c.pair}**: signals ignored while a trade was open: ${c.ignored}. By year (net R a trade, n): ` + Object.entries(c.byYear).map(([y, v]) => `${y} ${f(v.net, 2)} (${v.n})`).join(', ') + '.');
    L.push(`  SNB floor removal (15 Jan 2015): ${c.snb.length ? c.snb.map((s) => `trade ${s.entry} → ${s.exit} (${s.how}) gross ${f(s.gross)}R net ${f(s.net)}R`).join('; ') + `; replication without it ${f(c.repNoSnb.net)}R a trade (n ${c.repNoSnb.n})` : 'no trade spans it'}.`);
  }
  L.push('', '## What it means and does not mean', '');
  L.push('- Measured: a mechanical, daily-candle trade, long the franc for five trading days after a 2-sd S&P 500 fall, net of a raw-spread cost model and overnight financing. It does not test the same-day association the paper reports (that move happens before the next open and cannot be traded here), nor intraday entries, other horizons, or other haven pairs.');
  L.push('- Financing is today\'s (measured on USD/CHF, assumed on EUR/CHF and AUD/CHF) for every year; the "no financing" column shows the result without it. When Swiss rates were negative (2015-22) a franc long paid more than charged here.');
  L.push('- A FAIL is not evidence that the franc is no haven; it says the lag after the signal is not worth trading on these rules. Anything else (another threshold, holding period, a fade) would need its own pre-registration on other data.');
  L.push('', '## Related', '');
  L.push('`research/edge/risk-spill-jpy` (the yen after a strong S&P cash session, FAIL) and `research/edge/gold-haven-shock` (gold after equity shock days, FAIL), on other branches; neither covers the franc, and no code was shared.', '');
  L.push('To repeat: `node research/edge/chf-haven/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/chf-haven/run.mjs full <dir>`. Tests: `tests/chf-haven.test.mjs`.');
  return L.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    const commit = execFileSync('git', ['rev-parse', 'origin/council-data'], { encoding: 'utf8' }).trim();
    for (const k of KEYS) {
      const j = JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { encoding: 'utf8', maxBuffer: 64 << 20 }));
      j.commit = commit;
      fs.writeFileSync(path.join(dir, k + '.json'), JSON.stringify(j));
    }
    console.log('saved', KEYS.join(', '), 'from', commit);
  } else if (cmd === 'full') {
    const R = run(dir);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
    console.log(report(R).split('\n')[0]);
  } else console.log('usage: run.mjs fetch <dir> | full <dir>');
}
