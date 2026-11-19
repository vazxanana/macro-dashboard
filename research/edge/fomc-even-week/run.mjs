// Edge research · fomc-even-week: US index returns in weeks 2, 4 and 6 of the FOMC cycle against weeks 1, 3 and 5, on the
// council's daily index candles, net of CFD costs. Rules, counting, costs, windows, placebo and pass bar: PREREGISTRATION.md
// (committed first, alone).
//   node research/edge/fomc-even-week/run.mjs fetch <dir>   (the three daily files from council-data with git show, no network)
//   node research/edge/fomc-even-week/run.mjs <dir>         (writes result.json and RESULT.md here)
// Pure pieces are exported for tests/fomc-even-week.test.mjs. Paper research only: nothing live reads this.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { scheduled, UNSCHEDULED, SOURCE } from './dates.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const MARKETS = ['spx500', 'nas100', 'us30'];
export const P = Object.freeze({
  ATR: 20, K: 2, FIN_YEAR: 0.06, COST: Object.freeze({ spx500: 1.0, nas100: 2.0, us30: 3.0 }), HOLE: 5,
  IS: ['2008-01-01', '2017-01-01'], OOS: ['2017-01-01', '2099-01-01'], FULL: ['2008-01-01', '2099-01-01'],
  SEEDS: 40, SHIFT: [5, 20], NEED: 38, T2: 2,
});
// week w = days [lo(w), hi(w)] after day 0; 'paper' = 5w-1 .. 5w+3 (primary), 'brief' = 5w .. 5w+4 (sensitivity S1)
export const WEEK = Object.freeze({ paper: (w) => [5 * w - 1, 5 * w + 3], brief: (w) => [5 * w, 5 * w + 4] });
export const EVEN = [2, 4, 6], ODD = [1, 3, 5];

const dstr = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// fold Saturday / Sunday candles into the next weekday: first weekend open, merged high / low, the weekday's own close
export function fold(rows) {
  const out = []; let w = null;
  for (const [t, o, h, l, c] of rows) {
    const wd = new Date(t * 1000).getUTCDay();
    if (wd === 0 || wd === 6) { w = w ? { o: w.o, h: Math.max(w.h, h), l: Math.min(w.l, l) } : { o, h, l }; continue; }
    out.push(w ? { t, d: dstr(t), o: w.o, h: Math.max(w.h, h), l: Math.min(w.l, l), c } : { t, d: dstr(t), o, h, l, c });
    w = null;
  }
  return out;
}
// first trading-day index whose date is on or after `date` (days.length when none)
export function firstOnOrAfter(days, date) {
  let lo = 0, hi = days.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (days[m].d < date) lo = m + 1; else hi = m; }
  return lo;
}
// ATR(n) of the days up to and including index i (true range with the prior close); null if too few
export function atrAt(days, i, n = P.ATR) {
  if (i < n) return null;
  let s = 0;
  for (let j = i - n + 1; j <= i; j++) { const d = days[j], pc = days[j - 1].c; s += Math.max(d.h - d.l, Math.abs(d.h - pc), Math.abs(d.l - pc)); }
  return s / n;
}
// the windows of every cycle: { meet, w, even, entry, start, end } (indices into days); dropped ones counted by reason
export function windows(days, meets, { count = 'paper', unsched = UNSCHEDULED } = {}) {
  const ban = new Set();
  for (const u of unsched) { const k = firstOnOrAfter(days, u); for (let j = k - 1; j <= k + 3; j++) ban.add(j); }
  const out = [], drop = { noDay0: [], cut: 0, data: 0, hole: 0, unscheduled: 0 };
  const ms = [...new Set(meets)].sort();
  for (let j = 0; j < ms.length; j++) {
    const i0 = firstOnOrAfter(days, ms[j]);
    if (i0 >= days.length || days[i0].d !== ms[j]) { drop.noDay0.push(ms[j]); continue; }
    const b = j + 1 < ms.length ? firstOnOrAfter(days, ms[j + 1]) - 1 : Infinity;   // day -1 of the next meeting: first day NOT in this cycle
    for (const w of [1, 2, 3, 4, 5, 6]) {
      const [lo, hi] = WEEK[count](w), start = i0 + lo, end = i0 + hi, entry = start - 1;
      if (end >= b) { drop.cut++; continue; }
      if (end >= days.length) { drop.data++; continue; }
      let hole = false;
      for (let k = entry + 1; k <= end; k++) if (days[k].t - days[k - 1].t > P.HOLE * DAY) hole = true;
      if (hole) { drop.hole++; continue; }
      let bad = false;
      for (let k = entry; k <= end; k++) if (ban.has(k)) bad = true;
      if (bad) { drop.unscheduled++; continue; }
      out.push({ meet: ms[j], w, even: w % 2 === 0, entry, start, end });
    }
  }
  return { list: out, drop };
}
// rollovers crossed between two times: 22:00 UTC on a weekday, Friday three (pre-fomc-drift's rule)
export function rollovers(t, c) {
  let n = 0;
  for (let d = Math.floor(t / DAY) * DAY + 22 * 3600; d < c; d += DAY) {
    if (d <= t) continue;
    const w = new Date(d * 1000).getUTCDay();
    if (w >= 1 && w <= 5) n += w === 5 ? 3 : 1;
  }
  return n;
}
// one window's long: buy at the entry day's close, stop entry - K x ATR(20), out at the end day's close or at the stop
export function trade(days, win, sym, mult = 1) {
  const e = days[win.entry].c, A = atrAt(days, win.entry);
  if (!(A > 0)) return null;
  const stop = e - P.K * A;
  let exit = days[win.end].c, why = 'time', exitT = days[win.end].t + DAY;
  for (let k = win.start; k <= win.end; k++) {
    const d = days[k];
    if (d.o <= stop) { exit = d.o; why = 'gap'; exitT = d.t; break; }
    if (d.l <= stop) { exit = stop; why = 'stop'; exitT = d.t + DAY / 2; break; }
  }
  const nN = rollovers(days[win.entry].t + DAY, exitT);
  const gross = (exit - e) / e * 100, cost = mult * (P.COST[sym] / e * 100 + nN * P.FIN_YEAR / 365 * 100);
  return { ...win, entryPx: e, stop, exit, why, nights: nN, gross, cost, net: gross - cost, perDay: (gross - cost) / 5, grossDay: gross / 5, exitDate: days[win.end].d };
}
// ── statistics ──
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, x) => a + x, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
// per cycle: mean even per-day minus mean odd per-day (cycles with both sides only)
export function cycleD(trs, key = 'perDay') {
  const by = new Map();
  for (const x of trs) { const c = by.get(x.meet) || { e: [], o: [] }; (x.even ? c.e : c.o).push(x[key]); by.set(x.meet, c); }
  const out = [];
  for (const [meet, c] of by) if (c.e.length && c.o.length) out.push({ meet, D: stat(c.e).mean - stat(c.o).mean });
  return out.sort((a, b) => (a.meet < b.meet ? -1 : 1));
}
export function monthSums(trs, key = 'net') {
  const m = new Map();
  for (const x of trs) m.set(x.exitDate.slice(0, 7), (m.get(x.exitDate.slice(0, 7)) || 0) + x[key]);
  return [...m.values()];
}
export function phi(x) {   // standard normal CDF (Abramowitz-Stegun 26.2.17)
  const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), m = ps.length, adj = new Array(m);
  let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run; });
  return adj;
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// the scheduled calendar moved: every meeting by its own ±5..±20 trading days
export function shifted(days, meets, seed) {
  const r = rng(seed), [a, b] = P.SHIFT, vals = [];
  for (let s = a; s <= b; s++) vals.push(s, -s);
  const out = [];
  for (const m of meets) {
    const i0 = firstOnOrAfter(days, m); if (i0 >= days.length || days[i0].d !== m) continue;
    const k = i0 + vals[Math.floor(r() * vals.length)];
    if (k >= 0 && k < days.length) out.push(days[k].d);
  }
  return [...new Set(out)].sort();
}
const inWin = (meet, w) => meet >= w[0] && meet < w[1];
export function trades(days, meets, sym, opts = {}, mult = 1) {
  const { list, drop } = windows(days, meets, opts);
  const trs = [];
  for (const w of list) { const x = trade(days, w, sym, mult); if (x) trs.push(x); }
  return { trs, drop };
}
const r4 = (x, d = 4) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
export function block(trs) {
  const D = cycleD(trs), Dg = cycleD(trs, 'grossDay'), sD = stat(D.map((x) => x.D)), sG = stat(Dg.map((x) => x.D));
  const side = (even) => {
    const xs = trs.filter((x) => x.even === even), s = stat(xs.map((x) => x.perDay)), g = stat(xs.map((x) => x.grossDay)), ms = stat(monthSums(xs));
    return { windows: xs.length, netDay: r4(s.mean), grossDay: r4(g.mean), monthT: r4(ms.t, 2), months: ms.n, stops: xs.filter((x) => x.why !== 'time').length };
  };
  return { cycles: sD.n, Dnet: r4(sD.mean), tNet: r4(sD.t, 2), Dgross: r4(sG.mean), tGross: r4(sG.t, 2), even: side(true), odd: side(false) };
}
function byWindow(trs, w) { return trs.filter((x) => inWin(x.meet, w)); }

export function run(dir) {
  const meets = scheduled(), out = { study: 'fomc-even-week', built: '2026-11-14', preregistration: 'research/edge/fomc-even-week/PREREGISTRATION.md',
    source: SOURCE, meetings: meets.length, unscheduled: UNSCHEDULED,
    rule: 'long from the close before each week of the FOMC cycle to the close of its last day (week w = days 5w-1..5w+3 after the statement day), stop entry - 2 x ATR(20); weeks 2, 4, 6 against weeks 1, 3, 5; week 0 not used',
    costs: { points: P.COST, financingYear: P.FIN_YEAR }, units: '% of price a day', markets: {} };
  const D = {};
  for (const sym of MARKETS) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, `${sym}.json`), 'utf8')), days = fold(j.rows);
    D[sym] = days;
    const base = trades(days, meets, sym), x2 = trades(days, meets, sym, {}, 2), s1 = trades(days, meets, sym, { count: 'brief' }), s2 = trades(days, meets, sym, { unsched: [] });
    const m = { from: days[0].d, to: days[days.length - 1].d, days: days.length, updated: j.updated, drop: base.drop, windows: {} };
    for (const [k, w] of [['IS', P.IS], ['OOS', P.OOS], ['FULL', P.FULL]]) {
      m.windows[k] = { ...block(byWindow(base.trs, w)), x2: block(byWindow(x2.trs, w)), S1: block(byWindow(s1.trs, w)), S2: block(byWindow(s2.trs, w)) };
    }
    const yr = {};
    for (const c of cycleD(byWindow(base.trs, P.FULL))) (yr[c.meet.slice(0, 4)] ||= []).push(c.D);
    m.byYear = Object.fromEntries(Object.entries(yr).map(([y, xs]) => [y, { cycles: xs.length, Dnet: r4(stat(xs).mean) }]));
    out.markets[sym] = m;
  }
  // Holm over the three OOS net tests (one-sided)
  const ps = MARKETS.map((s) => { const t = out.markets[s].windows.OOS.tNet; return t == null ? 1 : 1 - phi(t); }), adj = holm(ps);
  MARKETS.forEach((s, i) => { out.markets[s].windows.OOS.p = r4(ps[i], 5); out.markets[s].windows.OOS.pHolm = r4(adj[i], 5); });
  // placebo on SPX500 OOS
  const days = D.spx500, pm = [];
  for (let seed = 1; seed <= P.SEEDS; seed++) pm.push(block(byWindow(trades(days, shifted(days, meets, seed), 'spx500').trs, P.OOS)).Dnet);
  const S = out.markets.spx500.windows, real = S.OOS.Dnet, beaten = pm.filter((x) => real > x).length;
  out.placebo = { seeds: P.SEEDS, shift: P.SHIFT, means: pm, mean: r4(stat(pm).mean), max: r4(Math.max(...pm)), beaten };
  const crit = 1 - phi(P.T2);
  const checks = {
    oos: S.OOS.Dnet > 0 && S.OOS.pHolm <= crit,
    isSign: S.IS.Dnet > 0,
    x2: S.OOS.x2.Dnet > 0 && S.OOS.x2.even.netDay > 0,
    placebo: beaten >= P.NEED,
  };
  out.checks = checks; out.pHolmBar = r4(crit, 5);
  out.verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  out.confirm = Object.fromEntries(['nas100', 'us30'].map((s) => [s, out.markets[s].windows.OOS.Dnet > 0 && out.markets[s].windows.OOS.pHolm <= crit]));
  return out;
}

const f = (x, d = 4) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const NAME = { spx500: 'US500 (SPX500)', nas100: 'NAS100', us30: 'US30' };
export function headline(r) {
  const S = r.markets.spx500.windows;
  const why = r.verdict === 'PASS' ? 'all four checks met' : `even minus odd weeks ${f(S.OOS.Dnet, 3)} % a day net 2017-26, t ${f(S.OOS.tNet, 2)}, ${S.OOS.cycles} cycles; above ${r.placebo.beaten} of 40 placebos`;
  return `**Verdict: ${r.verdict}, US500 ${why}.**`;
}
export function report(r) {
  const S = r.markets.spx500.windows, L = [];
  L.push('# The FOMC cycle: US index returns in weeks 2, 4 and 6 against weeks 1, 3 and 5: result', '');
  L.push(headline(r), '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (committed and pushed alone before \`run.mjs\` existed). Meetings: ${r.meetings} scheduled FOMC statements 2008 → Dec 2026 (${r.source}); unscheduled ${r.unscheduled.join(', ')} never start a cycle and the windows touching their days −1..+3 are dropped. Rule: ${r.rule}. Costs: round trip US500 1.0, NAS100 2.0, US30 3.0 index points plus 6 % a year financing per rollover (Friday three; an assumed rate). Data: OANDA mid UTC daily candles from council-data \`research/daily\` (to ${r.markets.spx500.to}), weekends folded into Monday. Units: % of price a day. D = per FOMC cycle, mean net % a day of its even-week longs minus that of its odd-week longs; t across cycles.`, '');
  L.push('## The decisive figures (US500)', '');
  L.push(`- **OOS 2017 → now**: ${S.OOS.cycles} cycles, D net ${f(S.OOS.Dnet)} % a day, t ${f(S.OOS.tNet, 2)} (one-sided p ${S.OOS.p}, Holm over three markets ${S.OOS.pHolm}; bar ${r.pHolmBar}); gross ${f(S.OOS.Dgross)}, t ${f(S.OOS.tGross, 2)}.`);
  L.push(`- **IS 2008-2016**: ${S.IS.cycles} cycles, D net ${f(S.IS.Dnet)} % a day, t ${f(S.IS.tNet, 2)}; gross ${f(S.IS.Dgross)}, t ${f(S.IS.tGross, 2)}.`);
  L.push(`- **Full 2008 → now**: ${S.FULL.cycles} cycles, D net ${f(S.FULL.Dnet)}, t ${f(S.FULL.tNet, 2)}.`);
  L.push(`- **2 x costs, OOS**: D ${f(S.OOS.x2.Dnet)}, even-week long alone ${f(S.OOS.x2.even.netDay)} % a day.`);
  L.push(`- **Placebo** (40 seeds, every meeting moved by its own ±5..±20 trading days): OOS D net mean ${f(r.placebo.mean)}, max ${f(r.placebo.max)}; the real calendar is above ${r.placebo.beaten} of 40 (38 needed).`, '');
  L.push('Checks: ' + Object.entries(r.checks).map(([k, v]) => `${k} ${v ? 'met' : 'not met'}`).join(' · ') + '.', '');
  L.push('## Every market and window', '', '| market | window | cycles | D net % a day | t | D gross | t gross | even windows | even net % a day | even month-sum t | odd windows | odd net % a day | odd month-sum t | Holm p |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of MARKETS) for (const w of ['IS', 'OOS', 'FULL']) {
    const x = r.markets[s].windows[w];
    L.push(`| ${NAME[s]} | ${w === 'IS' ? '2008-2016' : w === 'OOS' ? '2017 → now' : '2008 → now'} | ${x.cycles} | ${f(x.Dnet)} | ${f(x.tNet, 2)} | ${f(x.Dgross)} | ${f(x.tGross, 2)} | ${x.even.windows} | ${f(x.even.netDay)} | ${f(x.even.monthT, 2)} | ${x.odd.windows} | ${f(x.odd.netDay)} | ${f(x.odd.monthT, 2)} | ${w === 'OOS' ? x.pHolm : '·'} |`);
  }
  L.push('', `NAS100 ${r.confirm.nas100 ? 'confirms' : 'does not confirm'} and US30 ${r.confirm.us30 ? 'confirms' : 'does not confirm'} (OOS, after Holm). Gross even-week longs, OOS: US500 ${f(S.OOS.even.grossDay)} % a day against odd ${f(S.OOS.odd.grossDay)}.`, '');
  L.push('## Sensitivity (reported, not judged)', '');
  for (const s of MARKETS) {
    const o = r.markets[s].windows.OOS, i = r.markets[s].windows.IS;
    L.push(`- ${NAME[s]}: S1, the brief's counting (week w = days 5w..5w+4): OOS D ${f(o.S1.Dnet)} (t ${f(o.S1.tNet, 2)}), IS ${f(i.S1.Dnet)} (t ${f(i.S1.tNet, 2)}). S2, unscheduled not excluded: OOS ${f(o.S2.Dnet)} (t ${f(o.S2.tNet, 2)}), IS ${f(i.S2.Dnet)} (t ${f(i.S2.tNet, 2)}).`);
  }
  L.push('', '## By year, US500 (mean D net % a day, cycles)', '');
  L.push(Object.entries(r.markets.spx500.byYear).map(([y, x]) => `${y} ${f(x.Dnet, 3)} (${x.cycles})`).join(' · '), '');
  const dr = r.markets.spx500.drop;
  L.push('## Windows dropped (US500)', '', `No candle on the statement day: ${dr.noDay0.join(', ') || 'none'}. Cut by the next meeting: ${dr.cut}. Past the data: ${dr.data}. Holes: ${dr.hole}. Unscheduled: ${dr.unscheduled}.`, '');
  L.push('## What this means', '');
  if (r.verdict === 'PASS') L.push('The even-week effect is present on US500 after costs in the deciding window and beats the placebo. It is a lead for a forward paper shadow and a replication on other indices, not an edge. Nothing live changed.');
  else L.push('The pre-registered bar is not met on US500, so the FOMC-cycle even weeks are not an edge on the council\'s index feeds after costs. No proposal is written and nothing live changed. Week 0 (the meeting days) was left out on purpose: `pre-fomc-drift` tested it. Any other version (another counting, week 0 included, other indices, a filter) would need its own pre-registration on data not used here.');
  L.push('', 'To repeat: `node research/edge/fomc-even-week/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/fomc-even-week/run.mjs <dir>`. Tests: `tests/fomc-even-week.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2);
  if (a === 'fetch') {
    if (!b) throw new Error('usage: node run.mjs fetch <dir>');
    fs.mkdirSync(b, { recursive: true });
    for (const s of MARKETS) fs.writeFileSync(path.join(b, `${s}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${s}.json`], { maxBuffer: 1 << 28 }));
    console.log('saved', MARKETS.join(', '), 'to', b);
  } else {
    if (!a) throw new Error('usage: node run.mjs <dir>');
    const r = run(a);
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(r, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(r));
    for (const s of MARKETS) for (const w of ['IS', 'OOS', 'FULL']) { const x = r.markets[s].windows[w]; console.log(s, w, x.cycles, x.Dnet, x.tNet, x.Dgross, x.tGross, 'even', x.even.netDay, x.even.monthT, 'odd', x.odd.netDay, w === 'OOS' ? x.pHolm : ''); }
    console.log('placebo', r.placebo.mean, r.placebo.max, r.placebo.beaten, r.checks, r.verdict);
    console.log(headline(r).length, headline(r));
  }
}
