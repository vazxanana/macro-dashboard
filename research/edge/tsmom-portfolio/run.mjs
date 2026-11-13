// Edge research · tsmom-portfolio (PREREGISTRATION.md, committed first).
// The published diversified time-series momentum rule (12-month sign, 40 % volatility a market, monthly rebalance), unchanged,
// on 20 OANDA markets of the council's daily candle cache, with a 3 x ATR(20) catastrophe stop, net of costs and financing.
//   node run.mjs fetch <dir>   copies the daily candle cache out of the council-data branch (git show, no network)
//   node run.mjs full <dir>    writes result.json and RESULT.md next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights, FIN } from '../../../council/fills.mjs';

export const CLASSES = {
  Metals: ['xau', 'xag'],
  'Equity indices': ['nas100', 'spx500', 'us30', 'de40', 'uk100', 'jp225'],
  Energies: ['wtico', 'bco', 'natgas'],
  Bonds: ['usb10y', 'de10yb', 'uk10yb'],
  'Forex majors': ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf'],
};
export const KEYS = Object.values(CLASSES).flat();
export const classOf = (k) => Object.keys(CLASSES).find((c) => CLASSES[c].includes(k));
export const P = {
  TARGET: 0.40, L: 10, GROSS: 3, COM: 60, ANN: 261, MIN_RET: 260, LOOK: 12, STOP_ATR: 3, ATR: 20, STALE_D: 5,
  MARKUP: 0.025 / 365, LATEST_START: '2008-01-01',
  CONF: ['2008-01', '2017-12'], POST: ['2018-01', '2026-10'],
};
// round trip as a fraction of price (PREREGISTRATION.md "Costs")
export const RT = { xau: 0.0003, xag: 0.001, wtico: 0.001, bco: 0.001, natgas: 0.002, usb10y: 0.001, de10yb: 0.001, uk10yb: 0.001 };
export const rtOf = (k) => RT[k] ?? (classOf(k) === 'Forex majors' ? 0.0002 : 0.0003);
const DAY = 86400;
const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
const r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

// ── per-market inputs read at a month-end close i (nothing after i) ──
// annualised EWMA volatility at candle i from returns up to i only (a series computed once per array; entry i reads j <= i)
const VOL = new WeakMap();
export function ewmaVol(D, i, com = P.COM) {
  if (com === P.COM) {
    let a = VOL.get(D);
    if (!a || a.len !== D.length) { a = { len: D.length, v: ewmaSeries(D, com) }; VOL.set(D, a); }
    return a.v[i] ?? null;
  }
  return ewmaSeries(D, com)[i] ?? null;
}
function ewmaSeries(D, com) {
  const d = com / (com + 1), out = [null];
  let m = 0, v = 0, n = 0;
  for (let j = 1; j < D.length; j++) {
    const r = D[j].close / D[j - 1].close - 1;
    if (n === 0) { m = r; v = 0; } else { const dm = r - m; m = d * m + (1 - d) * r; v = d * v + (1 - d) * dm * dm; }
    n++;
    out.push(n >= P.MIN_RET ? Math.sqrt(v * P.ANN) : null);
  }
  return out;
}
export function atrAt(D, i, n = P.ATR) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}
// month-end index of every calendar month the market has candles in
export function monthEnds(D) {
  const out = new Map();
  D.forEach((b, i) => out.set(ym(b.time), i));
  return out;
}
const addMonths = (k, n) => { const [y, m] = k.split('-').map(Number), z = y * 12 + (m - 1) + n; return `${Math.floor(z / 12)}-${String(z % 12 + 1).padStart(2, '0')}`; };
const monthEndDay = (k) => { const [y, m] = k.split('-').map(Number); return Date.UTC(y, m, 0) / 1000; };

// the decision of month k for one market: { s, sigma, atr, close, i } or null (not valid)
export function decide(D, ends, k) {
  const i = ends.get(k), j = ends.get(addMonths(k, -P.LOOK));
  if (i == null || j == null) return null;
  if (D[i].time < monthEndDay(k) - P.STALE_D * DAY) return null;
  const sigma = ewmaVol(D, i), atr = atrAt(D, i);
  if (!sigma || !atr) return null;
  const ret = D[i].close / D[j].close - 1;
  return { s: ret > 0 ? 1 : ret < 0 ? -1 : 0, ret, sigma, atr, close: D[i].close, i };
}
// weights for one holding month from the decisions of the month before
export function weights(dec) {
  const ks = Object.keys(dec).filter((k) => dec[k]), N = ks.length, w = {};
  if (!N) return w;
  for (const k of ks) w[k] = dec[k].s * Math.min(P.TARGET / dec[k].sigma, P.L) / N;
  const g = ks.reduce((a, k) => a + Math.abs(w[k]), 0);
  if (g > P.GROSS) for (const k of ks) w[k] *= P.GROSS / g;
  return w;
}
// one market through one holding month. bars = its candles of that month; prev = last close before; wOld = weight held at
// the end of the previous month (0 if stopped or flat). Returns daily rows { t, ret, cost, fin } and the weight at the end.
export function holdMonth(k, bars, prevClose, wOld, w, s, stop, { costX = 1, finX = 1 } = {}) {
  const one = rtOf(k) / 2 * costX, rows = [];
  let pos = w, stopped = false, prev = prevClose;
  bars.forEach((b, n) => {
    let ret = 0, cost = 0;
    if (n === 0) {
      if (Number.isFinite(prev)) ret += wOld * (b.open / prev - 1);
      cost += Math.abs(w - wOld) * one;
      prev = b.open;
    }
    let exit = null;
    if (pos && s && Number.isFinite(stop)) {
      if (s > 0 ? b.open <= stop : b.open >= stop) exit = b.open;
      else if (s > 0 ? b.low <= stop : b.high >= stop) exit = stop;
    }
    const held = pos;
    ret += pos * ((exit ?? b.close) / prev - 1);
    const rate = k === 'xau' ? (held > 0 ? FIN.xau.long : FIN.xau.short) : P.MARKUP;
    const fin = Math.abs(held) * rate * nights(b.time, b.time + DAY) * finX;
    if (exit != null) { cost += Math.abs(pos) * one; pos = 0; stopped = true; }
    prev = b.close;
    rows.push({ t: b.time, ret, cost, fin });
  });
  return { rows, wEnd: pos, stopped };
}

// ── the portfolio ──
export function simulate(data, opt = {}) {
  const ends = {}, daily = new Map(), bump = (t, k, v) => { const d = daily.get(t) || { all: 0, cls: {}, gross: 0 }; d.all += v; d.cls[classOf(k)] = (d.cls[classOf(k)] || 0) + v; daily.set(t, d); };
  const starts = {};
  for (const k of Object.keys(data)) { ends[k] = monthEnds(data[k]); starts[k] = new Map(); data[k].forEach((b, i) => { const y = ym(b.time); if (!starts[k].has(y)) starts[k].set(y, i); }); }
  const months = [...new Set(Object.values(data).flatMap((D) => D.map((b) => ym(b.time))))].sort();
  const held = {}, log = [];
  let stops = 0;
  for (let mi = 1; mi < months.length; mi++) {
    const h = months[mi], m = addMonths(h, -1), dec = {};
    for (const k of Object.keys(data)) dec[k] = decide(data[k], ends[k], m);
    const w = weights(dec);
    let gross = 0;
    for (const k of Object.keys(data)) {
      const D = data[k], a = starts[k].get(h), bars = a == null ? [] : D.slice(a, ends[k].get(h) + 1);
      const wk = w[k] || 0, wOld = held[k] || 0;
      if (!bars.length) { held[k] = wOld; continue; }
      const i0 = a, prevClose = i0 > 0 ? D[i0 - 1].close : NaN;
      const d = dec[k], stop = d && d.s && !opt.noStop ? bars[0].open - d.s * P.STOP_ATR * d.atr : null;
      const r = holdMonth(k, bars, prevClose, wOld, wk, d ? d.s : 0, stop, opt);
      for (const x of r.rows) bump(x.t, k, x.ret - x.cost - x.fin);
      if (r.stopped) stops++;
      held[k] = r.wEnd;
      gross += Math.abs(wk);
    }
    log.push({ m: h, n: Object.keys(w).length, gross, long: Object.values(w).filter((x) => x > 0).length, short: Object.values(w).filter((x) => x < 0).length });
  }
  const monthly = {};
  for (const [t, d] of daily) {
    const k = ym(t), o = monthly[k] || (monthly[k] = { all: 0, cls: {} });
    o.all += d.all;
    for (const c in d.cls) o.cls[c] = (o.cls[c] || 0) + d.cls[c];
  }
  return { monthly, daily: [...daily.entries()].sort((a, b) => a[0] - b[0]).map(([t, d]) => [t, d.all]), log, stops };
}

// ── statistics on monthly returns ──
export function stats(xs) {
  const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / (n || 1);
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  let c = 0, pk = 0, dd = 0;
  for (const x of xs) { c += x; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); }
  return { n, mean, sd, sharpe: sd ? mean / sd * Math.sqrt(12) : null, t: sd ? mean / (sd / Math.sqrt(n)) : null, total: c, annRet: mean * 12, annVol: sd * Math.sqrt(12), maxDD: dd, pos: xs.filter((x) => x > 0).length / (n || 1) };
}
const inW = (k, [a, b]) => k >= a && k <= b;
const rng = ([a, b]) => { const out = []; for (let k = a; k <= b; k = addMonths(k, 1)) out.push(k); return out; };
const round = (s) => ({ n: s.n, meanPct: r4(s.mean * 100), sharpe: r2(s.sharpe), t: r2(s.t), totalPct: r2(s.total * 100), annRetPct: r2(s.annRet * 100), annVolPct: r2(s.annVol * 100), maxDDPct: r2(s.maxDD * 100), posShare: r2(s.pos) });
export function windowStats(sim, W) {
  const ks = rng(W), all = ks.map((k) => sim.monthly[k]?.all || 0);
  const out = { months: `${W[0]} to ${W[1]}`, ...round(stats(all)) };
  let c = 0, pk = 0, dd = 0;
  for (const [t, v] of sim.daily) if (inW(ym(t), W)) { c += v; pk = Math.max(pk, c); dd = Math.min(dd, c - pk); }
  out.maxDDDailyPct = r2(dd * 100);
  const lg = sim.log.filter((x) => inW(x.m, W));
  out.grossMean = r2(lg.reduce((a, x) => a + x.gross, 0) / (lg.length || 1));
  out.byClass = Object.fromEntries(Object.keys(CLASSES).map((c) => [c, round(stats(ks.map((k) => sim.monthly[k]?.cls[c] || 0)))]));
  return out;
}
export function verdictOf(conf, post) {
  const c1 = conf.sharpe > 0.4, c2 = conf.t >= 2, c3 = post.totalPct > 0;
  return { pass: !!(c1 && c2 && c3), c1: !!c1, c2: !!c2, c3: !!c3 };
}
export const CRISIS = { '2008 crash (Sep-Dec 2008)': ['2008-09', '2008-12'], '2020 Covid (Feb-Apr 2020)': ['2020-02', '2020-04'], '2022 (whole year)': ['2022-01', '2022-12'] };
function crisis(sim) {
  return Object.fromEntries(Object.entries(CRISIS).map(([name, W]) => [name, rng(W).map((k) => ({ m: k, pct: r2((sim.monthly[k]?.all || 0) * 100),
    byClass: Object.fromEntries(Object.keys(CLASSES).map((c) => [c, r2((sim.monthly[k]?.cls[c] || 0) * 100)])) }))]));
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
export function load(dir, k) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
  return foldWeekend(j.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })));
}
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of KEYS) {
    const f = path.join(dir, `${k}.json`);
    if (fs.existsSync(f)) continue;
    fs.writeFileSync(f, execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('saved', k);
  }
}

export function build(dir) {
  const data = {}, starts = {}, dropped = [];
  for (const k of KEYS) {
    const D = load(dir, k), s = new Date(D[0].time * 1000).toISOString().slice(0, 10);
    starts[k] = s;
    if (s > P.LATEST_START) { dropped.push(k); continue; }
    data[k] = D;
  }
  const last = Math.max(...Object.values(data).map((D) => D.at(-1).time));
  const run = (o) => { const s = simulate(data, o); return { conf: windowStats(s, P.CONF), post: windowStats(s, P.POST), sim: s }; };
  const base = run({}), x2 = run({ costX: 2, finX: 2 }), nofin = run({ finX: 0 });
  // post-hoc diagnostics (not pre-registered, never deciding): where the return went
  const gross = run({ costX: 0, finX: 0 }), noStopGross = run({ costX: 0, finX: 0, noStop: true }), noStopNet = run({ noStop: true }), noStopNoFin = run({ noStop: true, finX: 0 });
  return {
    study: 'tsmom-portfolio', built: new Date(last * 1000).toISOString().slice(0, 10),
    rule: '12-month sign, 40 % annual volatility a market (60-day centre-of-mass EWMA, cap 10x), equal weight over N, gross cap 3x, monthly rebalance at the next open, 3 x ATR(20) catastrophe stop',
    universe: CLASSES, starts, dropped, lastCandle: new Date(last * 1000).toISOString().slice(0, 10),
    costs: { roundTrip: Object.fromEntries(KEYS.map((k) => [k, rtOf(k)])), goldLongPerNight: FIN.xau.long, goldShortPerNight: FIN.xau.short, markupPerNight: r4(P.MARKUP * 1e4) / 1e4 },
    confirmation: base.conf, post: base.post, verdict: verdictOf(base.conf, base.post),
    stops: base.sim.stops, holdingMonths: base.sim.log.length,
    sensitivity: { costsX2: { confirmation: pick(x2.conf), post: pick(x2.post) }, noFinancing: { confirmation: pick(nofin.conf), post: pick(nofin.post) } },
    postHoc: { grossNoCosts: { confirmation: pick(gross.conf), post: pick(gross.post) }, noStopGross: { confirmation: pick(noStopGross.conf), post: pick(noStopGross.post) },
      noStopNoFinancing: { confirmation: pick(noStopNoFin.conf), post: pick(noStopNoFin.post) }, noStopNet: { confirmation: pick(noStopNet.conf), post: pick(noStopNet.post) } },
    financingDrag: { confirmationPctYear: r2(nofin.conf.annRetPct - base.conf.annRetPct), postPctYear: r2(nofin.post.annRetPct - base.post.annRetPct) },
    costDrag: { confirmationPctYear: r2(gross.conf.annRetPct - nofin.conf.annRetPct), postPctYear: r2(gross.post.annRetPct - nofin.post.annRetPct) },
    crisis: crisis(base.sim),
    monthlyPct: Object.fromEntries(rng([P.CONF[0], P.POST[1]]).map((k) => [k, r2((base.sim.monthly[k]?.all || 0) * 100)])),
  };
}
const pick = (w) => ({ sharpe: w.sharpe, t: w.t, annRetPct: w.annRetPct, totalPct: w.totalPct, maxDDPct: w.maxDDPct });

// ── the report (RESULT.md is this function's output; the test regenerates it from result.json) ──
export function report(R) {
  const v = R.verdict, C = R.confirmation, Q = R.post, f = (x) => (x == null ? 'n/a' : (x > 0 ? '+' : '') + x);
  const row = (name, s) => `| ${name} | ${s.n} | ${f(s.meanPct)} | ${f(s.sharpe)} | ${f(s.t)} | ${f(s.totalPct)} | ${f(s.maxDDPct)} |`;
  const L = [];
  L.push('# Diversified time-series momentum portfolio: result', '');
  L.push(`**Verdict: ${v.pass ? 'PASS' : 'FAIL'}** (pre-registered bar: 2008-17 Sharpe > 0.4 ${v.c1 ? 'met' : 'missed'}, t >= 2 ${v.c2 ? 'met' : 'missed'}; 2018-26 total > 0 ${v.c3 ? 'met' : 'missed'}).`, '');
  L.push(`2008-01 to 2017-12 (120 months): Sharpe ${f(C.sharpe)}, t ${f(C.t)}, ${f(C.annRetPct)} % a year at ${C.annVolPct} % volatility, worst drawdown ${C.maxDDPct} % (monthly) / ${C.maxDDDailyPct} % (daily), ${Math.round(C.posShare * 100)} % of months positive.`);
  L.push(`2018-01 to 2026-10 (${Q.n} months, after both publications): Sharpe ${f(Q.sharpe)}, t ${f(Q.t)}, total ${f(Q.totalPct)} %, ${f(Q.annRetPct)} % a year at ${Q.annVolPct} % volatility, worst drawdown ${Q.maxDDPct} % (monthly) / ${Q.maxDDDailyPct} % (daily).`, '');
  L.push('Net of the pre-registered trading costs, gold-long financing (`council/fills.mjs` `FIN`) and an assumed 2.5 % a year broker markup on every other position. Returns are summed on a constant equity of 1 (not compounded). Paper research: no live rule, size, filter, stop or council member changed.', '');
  L.push('## Setup', '');
  L.push(`Rule: ${R.rule}. 20 markets, none dropped (every history starts before 2008: latest ${Object.entries(R.starts).sort((a, b) => b[1].localeCompare(a[1]))[0].join(' ')}). Data: council-data \`research/daily/<key>.json\`, OANDA mid daily candles to ${R.lastCandle}, weekend stubs folded into Monday. Mean gross notional ${C.grossMean}x equity (2008-17) and ${Q.grossMean}x (2018-26). Catastrophe stops hit: ${R.stops} over ${R.holdingMonths} holding months x 20 markets.`, '');
  L.push('**What out of sample means.** The 2008-17 window overlaps the samples of the two published papers (to 2009 and to 2016); it is out of this repository\'s sample only (nothing fitted). 2018 onward is after both publications.', '');
  L.push('## Portfolio and asset classes', '');
  for (const [name, W] of [['2008-01 to 2017-12', C], ['2018-01 to 2026-10', Q]]) {
    L.push(`### ${name}`, '', '| Stream | Months | Mean % a month | Sharpe | t | Total % | Worst drawdown % |', '|---|---|---|---|---|---|---|');
    L.push(row('**Portfolio**', W));
    for (const c of Object.keys(W.byClass)) L.push(row(`${c} (contribution)`, W.byClass[c]));
    L.push('');
  }
  L.push('A class row is the sum of its markets\' returns inside the portfolio (same weights), so the class rows add up to the portfolio; descriptive.', '');
  L.push('## Sensitivities (never deciding)', '', '| Variant | Window | Sharpe | t | % a year | Total % | Worst drawdown % |', '|---|---|---|---|---|---|---|');
  for (const [name, s] of [['As pre-registered', { confirmation: C, post: Q }], ['Costs x2 (trading and financing)', R.sensitivity.costsX2], ['No financing at all', R.sensitivity.noFinancing]])
    for (const [w, x] of [['2008-17', s.confirmation], ['2018-26', s.post]]) L.push(`| ${name} | ${w} | ${f(x.sharpe)} | ${f(x.t)} | ${f(x.annRetPct)} | ${f(x.totalPct)} | ${f(x.maxDDPct)} |`);
  L.push('');
  L.push('### Post-hoc diagnostics (added after the result was seen; never deciding)', '', '| Variant | Window | Sharpe | t | % a year | Total % | Worst drawdown % |', '|---|---|---|---|---|---|---|');
  for (const [name, s] of [['No trading costs, no financing', R.postHoc.grossNoCosts], ['No catastrophe stop, no costs, no financing', R.postHoc.noStopGross], ['No catastrophe stop, trading costs, no financing', R.postHoc.noStopNoFinancing], ['No catastrophe stop, all costs', R.postHoc.noStopNet]])
    for (const [w, x] of [['2008-17', s.confirmation], ['2018-26', s.post]]) L.push(`| ${name} | ${w} | ${f(x.sharpe)} | ${f(x.t)} | ${f(x.annRetPct)} | ${f(x.totalPct)} | ${f(x.maxDDPct)} |`);
  L.push('', `Financing took ${R.financingDrag.confirmationPctYear} % a year in 2008-17 and ${R.financingDrag.postPctYear} % in 2018-26 (almost all of it the assumed markup on about ${C.grossMean}x gross notional); trading costs ${R.costDrag.confirmationPctYear} % and ${R.costDrag.postPctYear} % a year.`, '');
  L.push('## Crisis months (descriptive)', '', `| Month | Portfolio % | ${Object.keys(CLASSES).join(' | ')} |`, `|---|---|${Object.keys(CLASSES).map(() => '---|').join('')}`);
  for (const [name, rows] of Object.entries(R.crisis)) {
    L.push(`| **${name}** | ${f(+rows.reduce((a, r) => a + r.pct, 0).toFixed(2))} | ${Object.keys(CLASSES).map((c) => f(+rows.reduce((a, r) => a + r.byClass[c], 0).toFixed(2))).join(' | ')} |`);
    for (const r of rows) L.push(`| ${r.m} | ${f(r.pct)} | ${Object.keys(CLASSES).map((c) => f(r.byClass[c])).join(' | ')} |`);
  }
  L.push('');
  L.push('## Reading', '');
  L.push(...NOTES(R));
  L.push('', '## What this is not', '');
  L.push('- Not the futures-based return of the papers: the OANDA mid is a spot price, so the carry a futures position embeds (interest differentials, dividends, commodity roll) is not in these returns, and the cash rate a CFD broker charges or credits is not modelled beyond the assumed 2.5 % markup (PREREGISTRATION.md "Financing").');
  L.push('- 20 markets, not the papers\' 58 (or 67): the published diversification is larger. Commodities other than metals and energies are absent.');
  L.push('- Not an edge in the council: no forward record exists. Never call it one without n, t and a forward record.');
  L.push('', 'To repeat: `node research/edge/tsmom-portfolio/run.mjs fetch <dir>`, then `node research/edge/tsmom-portfolio/run.mjs full <dir>`. Tests: `tests/tsmom-portfolio.test.mjs`.', '');
  return L.join('\n');
}
// the reading, written from the figures (post-hoc wording around pre-registered numbers)
function NOTES(R) {
  const C = R.confirmation, Q = R.post, out = [];
  const best = (W) => Object.entries(W.byClass).sort((a, b) => b[1].totalPct - a[1].totalPct);
  out.push(`- Largest contributor 2008-17: ${best(C)[0][0]} (${best(C)[0][1].totalPct} %); smallest: ${best(C).at(-1)[0]} (${best(C).at(-1)[1].totalPct} %). 2018-26: ${best(Q)[0][0]} (${best(Q)[0][1].totalPct} %) and ${best(Q).at(-1)[0]} (${best(Q).at(-1)[1].totalPct} %).`);
  out.push(`- At the bar's t of 2, 120 months need a Sharpe of about 0.63; the 2008-17 Sharpe is ${C.sharpe}.`);
  const g = R.postHoc.noStopGross;
  out.push(`- The bar is missed before any cost too (post-hoc): with no stop, no trading cost and no financing the rule makes Sharpe ${g.confirmation.sharpe} (t ${g.confirmation.t}) in 2008-17 and ${g.post.sharpe} (t ${g.post.t}) in 2018-26. The pre-registered catastrophe stop costs about ${r2(g.confirmation.annRetPct - R.postHoc.grossNoCosts.confirmation.annRetPct)} % a year in 2008-17 (hit ${R.stops} times; a stopped market stays flat to the month end), and financing at the assumed markup about ${R.financingDrag.confirmationPctYear} % a year: on CFDs at about ${C.grossMean}x gross notional, a 2.5 % markup alone takes more than the rule earned gross.`);
  if (!R.verdict.pass) out.push('- The pre-registered bar was not met: no proposal is written and nothing changes. Any variant (other look-backs, a volatility target on the portfolio, more markets, a carry adjustment) would be a new study with its own pre-registration, judged on data it was not chosen on.');
  else out.push('- The bar was met: a paper shadow book is proposed to the owner in `research/proposals/2026-11-13-tsmom-portfolio.md`; nothing is live.');
  return out;
}

function full(dir) {
  const R = build(dir);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(JSON.stringify({ verdict: R.verdict, conf: { s: R.confirmation.sharpe, t: R.confirmation.t, dd: R.confirmation.maxDDPct }, post: { s: R.post.sharpe, t: R.post.t, tot: R.post.totalPct, dd: R.post.maxDDPct } }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) fetchAll(dir);
  else if (cmd === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch|full <dir>'); process.exit(1); }
}
