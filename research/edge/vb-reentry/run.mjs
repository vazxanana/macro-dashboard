// Edge research · vb-reentry: after the T1 volatility breakout's first fill is stopped back at the open, the SAME side again
// when price crosses the same trigger a second time (same stop, out at 21:00 UTC, one re-entry a day), on gold and USD/JPY,
// as fixed in PREREGISTRATION.md. The base rule is imported unchanged; only the re-entry walk is new.
//   node research/edge/vb-reentry/run.mjs        (candles: research/edge/_lib/edgekit.mjs cache, out of git)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../index-vol-breakout/original.mjs';
import { load } from '../_lib/edgekit.mjs';
import { charge as fxCharge } from '../fx-vol-breakout/run.mjs';
import { costFrac } from '../gold-vol-breakout-hourcost/run.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const K = 0.5, SLIP = 0.05, SEEDS = 40, LAST_START = 20 * 3600 + 50 * 60;
export const WINDOWS = { DISC: ['2005-01-01', '2014-12-31'], CONF: ['2015-01-01', '2099-12-31'] };
export const MARKETS = ['xau', 'usdjpy'];
export const GATES = { xau: [['2007-01-01', '2015-12-31', 1657, 0.111, 3.19]], usdjpy: [['2005-01-04', '2015-12-31', 2089, 0.079, 2.95], ['2016-01-01', '2026-11-19', 2079, 0.063, 2.5]] };
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// the original's walk (not exported there), byte for byte in behaviour; returns the exit candle index too
export function walk(bars, j, side, stop) {
  for (let i = j; i < bars.length; i++) {
    const b = bars[i];
    if (side * (b.o - stop) <= 0) return { exit: b.o, how: 'stop', i };
    if (side > 0 ? b.l <= stop : b.h >= stop) return { exit: stop, how: 'stop', i };
  }
  return { exit: bars.at(-1).c, how: 'time', i: bars.length - 1 };
}
// one position from its fill candle f (stop checked in the fill candle, worst case), as vbTrade books it
export function position(bars, f, side, entry, stop) {
  const b = bars[f];
  const x = (side > 0 ? b.l <= stop : b.h >= stop) ? { exit: stop, how: 'stop', i: f } : walk(bars, f + 1, side, stop);
  const r = Math.abs(entry - stop);
  return { side, entry, stop, r, exit: x.exit, how: x.how, R: side * (x.exit - entry) / r, f, xi: x.i };
}
// the T1 trade of a day with its fill and exit candle indices (null when no fill)
export function t1(d) {
  const x = O.vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
  if (x.skip) return null;
  const f = d.bars.findIndex((b) => b.t === x.fillT), p = position(d.bars, f, x.side, x.entry, x.open);
  return { x, p, O: x.open, up: x.up, dn: x.dn };
}
// the same-side re-entry after a stopped T1 trade, from the candle after the stop-out candle (null = none)
export function reentry(bars, T) {
  if (!T || T.p.how !== 'stop') return null;
  const side = T.p.side, lvl = side > 0 ? T.up : T.dn;
  for (let i = T.p.xi + 1; i < bars.length; i++) {
    const b = bars[i];
    if (!(side > 0 ? b.h >= lvl : b.l <= lvl)) continue;
    const entry = side > 0 ? Math.max(lvl, b.o) : Math.min(lvl, b.o);
    return position(bars, i, side, entry, T.O);
  }
  return null;
}
// costs: net and net at 2x, per market
export function charger(mk, cost) {
  if (mk === 'usdjpy') return (x) => { const c = fxCharge('usdjpy', x); return { net: c.net, net2: c.net2 }; };
  return (x, bars) => {
    const hour = Math.floor((bars[x.f].t % DAY) / 3600), M = medRange(bars, x.f);
    const c = (costFrac(cost.profile, hour, 'frac', cost.commission) * x.entry + SLIP * M) / x.r;
    return { net: x.R - c, net2: x.R - 2 * c };
  };
}
// control: a same-side market entry at a random later candle open, stop the real re-entry's distance away
export function controlTrade(bars, T, real, rand) {
  const lo = T.p.xi + 1, cand = [];
  for (let i = lo; i < bars.length; i++) if (bars[i].t % DAY <= LAST_START) cand.push(i);
  if (!cand.length) return null;
  const f = cand[Math.floor(rand() * cand.length)], entry = bars[f].o, stop = entry - real.side * real.r;
  const p = walk(bars, f, real.side, stop), r = real.r;
  return { side: real.side, entry, stop, r, exit: p.exit, how: p.how, R: real.side * (p.exit - entry) / r, f, xi: p.i };
}
export function stat(tr) {
  const mt = O.monthT(tr), m2 = O.monthT(tr, 'net2'), g = O.monthT(tr, 'R');
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), grossR: r3(mean(tr.map((x) => x.R))), netR: r3(mean(tr.map((x) => x.net))),
    net2R: r3(mean(tr.map((x) => x.net2))), total: r2(tr.reduce((s, x) => s + x.net, 0)), months: mt.months, t: r2(mt.t), tRaw: mt.t, grossT: r2(g.t), t2x: r2(m2.t),
    stops: tr.filter((x) => x.how === 'stop').length, time: tr.filter((x) => x.how === 'time').length,
    buys: tr.filter((x) => x.side > 0).length, sells: tr.filter((x) => x.side < 0).length };
}

export function runMarket(mk, cost) {
  const rows = load(mk, '5m').map((b) => [b.t, b.o, b.h, b.l, b.c]), last = Math.floor(rows.at(-1)[0] / DAY) * DAY;
  const days = O.buildDays(rows.filter((r) => r[0] < last)), dataEnd = new Date((last - DAY) * 1000).toISOString().slice(0, 10);
  const ch = charger(mk, cost);
  // gates: published T1 figures, and the walker against vbTrade
  const gate = [];
  for (const [a, b, n, net, t] of GATES[mk]) {
    const tr = [];
    for (const d of days) { if (!inW(d.day, [a, b]) || O.daySkip(d)) continue; const x = O.vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
      tr.push({ day: d.day, net: mk === 'xau' ? x.R - x.finR - 0.6 / x.r : fxCharge('usdjpy', x).net }); }
    const got = [tr.length, r3(mean(tr.map((x) => x.net))), r2(O.monthT(tr).t)];
    gate.push({ window: [a, b], want: [n, net, t], got, ok: got[0] === n && got[1] === net && got[2] === t });
  }
  let walkerOk = true, walked = 0;
  const T1 = [], RE = [], stopped = [];
  for (const d of days) {
    if (O.daySkip(d)) continue;
    const T = t1(d); if (!T) continue;
    walked++; if (T.p.exit !== T.x.exit || T.p.how !== T.x.how || Math.abs(T.p.R - T.x.R) > 1e-12) walkerOk = false;
    const t1c = { day: d.day, mk, side: T.p.side, R: T.p.R, how: T.p.how, ...ch({ ...T.p, entry: T.p.entry, r: T.p.r }, d.bars) };
    T1.push(t1c);
    if (T.p.how !== 'stop') continue;
    const re = reentry(d.bars, T);
    stopped.push({ day: d.day, d, T, re, t1: t1c });
    if (re) RE.push({ day: d.day, mk, side: re.side, R: re.R, how: re.how, r: re.r, entry: re.entry, hour: Math.floor((d.bars[re.f].t % DAY) / 3600), ...ch(re, d.bars) });
  }
  // control trades per seed
  const ctrl = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rand = O.rng(seed), tr = [];
    for (const s of stopped) { if (!s.re) continue; const c = controlTrade(s.d.bars, s.T, s.re, rand); if (!c) continue; tr.push({ day: s.day, mk, side: c.side, R: c.R, how: c.how, ...ch(c, s.d.bars) }); }
    ctrl.push(tr);
  }
  const stoppedLite = stopped.map((s) => ({ day: s.day, t1: s.t1.net, t1R: s.t1.R, re: s.re ? RE.find((x) => x.day === s.day).net : 0 }));
  return { mk, dataEnd, gate, walkerOk, walked, T1, RE, stopped: stoppedLite, ctrl };
}

export function judge(markets) {
  const sets = { E1: ['xau'], E2: ['usdjpy'], E3: ['xau', 'usdjpy'] }, out = {};
  for (const [k, mks] of Object.entries(sets)) {
    const pick = (arr) => arr.filter((x) => mks.includes(x.mk));
    const all = markets.flatMap((m) => m.RE), win = {};
    for (const [w, range] of Object.entries(WINDOWS)) {
      const tr = pick(all).filter((x) => inW(x.day, range)), st = stat(tr);
      const ctrlMeans = [];
      for (let s = 0; s < SEEDS; s++) { const c = markets.flatMap((m) => m.ctrl[s]).filter((x) => mks.includes(x.mk) && inW(x.day, range)); ctrlMeans.push(mean(c.map((x) => x.net))); }
      const real = mean(tr.map((x) => x.net));
      const stoppedDays = markets.filter((m) => mks.includes(m.mk)).flatMap((m) => m.stopped).filter((s) => inW(s.day, range));
      win[w] = { ...st, ctrl: { meanNetR: r3(mean(ctrlMeans)), meanGrossR: null, beaten: ctrlMeans.filter((v) => real > v).length, p5: r3(O.quantile(ctrlMeans, 0.05)), p95: r3(O.quantile(ctrlMeans, 0.95)) },
        stoppedDays: stoppedDays.length, reentered: r3(st.n / (stoppedDays.length || 1)),
        perStoppedDay: { t1Only: r3(mean(stoppedDays.map((s) => s.t1))), withRe: r3(mean(stoppedDays.map((s) => s.t1 + s.re))) } };
    }
    out[k] = { markets: mks, ...win };
  }
  const ps = Object.values(out).map((v) => O.normP(v.CONF.tRaw)), adj = O.holm(ps);
  Object.values(out).forEach((v, i) => {
    v.p = r3(ps[i]); v.pHolm = r3(adj[i]);
    const c = v.CONF, d = v.DISC;
    v.checks = { discPos: d.netR > 0, confPos: c.netR > 0, t2: c.t >= 2, holm: adj[i] < 0.05, n200: c.n >= 200, cost2x: c.net2R > 0, control: c.ctrl.beaten >= 38 };
    v.pass = Object.values(v.checks).every(Boolean);
    for (const w of ['DISC', 'CONF']) delete v[w].tRaw;
  });
  return out;
}

function byYear(tr) { const y = {}; for (const x of tr) { const k = x.day.slice(0, 4); (y[k] ||= []).push(x); } return Object.fromEntries(Object.entries(y).map(([k, v]) => [k, { n: v.length, netR: r3(mean(v.map((x) => x.net))), total: r2(v.reduce((s, x) => s + x.net, 0)) }])); }

const sgn = (v) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m)));
const f3 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3)), f2 = (v) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2));
export function verdictOf(T) {
  const passed = Object.entries(T).filter(([, v]) => v.pass).map(([k]) => k), c = T.E3.CONF, d = T.E3.DISC;
  const fails = (k) => Object.entries(T[k].checks).filter(([, ok]) => !ok).map(([n]) => n).join(', ');
  return `${passed.length ? 'PASS' : 'FAIL'}, ${passed.length} of 3: the same-side re-entry after a T1 stop-out made ${f3(c.netR)}R a trade after costs in 2015 → now pooled (n ${c.n}, month t ${f2(c.t)}), ${f3(d.netR)}R in 2005-14 (n ${d.n}); gold ${f3(T.E1.CONF.netR)}R (n ${T.E1.CONF.n}, t ${f2(T.E1.CONF.t)}), USD/JPY ${f3(T.E2.CONF.netR)}R (n ${T.E2.CONF.n}, t ${f2(T.E2.CONF.t)}); E3 failed ${fails('E3') || 'nothing'}`;
}
export function report(R) {
  const T = R.tests, L = [];
  L.push('# The volatility breakout: the same side again after a stop-out', '', `**Verdict: ${R.verdict}**`, '');
  L.push('Paper research only. Rule, tests and bar fixed in `PREREGISTRATION.md` (pushed alone first). Nothing live changed, nothing is proposed. Both windows were read for T1 itself before; only the re-entry trades are new. This page is written by `run.mjs` from `result.json`.', '');
  L.push('## Harness gates', '');
  for (const m of R.markets) { for (const g of m.gate) L.push(`- ${m.mk} T1 ${g.window.join(' → ')}: got n ${g.got[0]}, net ${f3(g.got[1])}R, month t ${f2(g.got[2])} (published ${g.want[0]}, ${f3(g.want[1])}, ${f2(g.want[2])}): ${g.ok ? 'exact' : 'MISMATCH'}`); L.push(`- ${m.mk} walker against vbTrade on ${m.walked} T1 trades: ${m.walkerOk ? 'identical' : 'DIFFERENT'}`); }
  L.push('');
  L.push('## Re-entry trades, after costs', '');
  L.push('| Test | Window | Stopped days | Re-entered | n | Win | Gross R/trade | Net R/trade | Net at 2x | Total R | Month t | Gross t | Stops / time | Buys / sells | Control net R (mean of 40) | Control beaten |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(T)) for (const [w, lab] of [['DISC', '2005-14'], ['CONF', '2015 → now']]) {
    const s = v[w]; L.push(`| ${k} ${v.markets.join(' + ')} | ${lab} | ${s.stoppedDays} | ${(s.reentered * 100).toFixed(0)} % | ${s.n} | ${(s.win * 100).toFixed(1)} % | ${f3(s.grossR)} | ${f3(s.netR)} | ${f3(s.net2R)} | ${f2(s.total)} | ${f2(s.t)} | ${f2(s.grossT)} | ${s.stops} / ${s.time} | ${s.buys} / ${s.sells} | ${f3(s.ctrl.meanNetR)} | ${s.ctrl.beaten} of 40 |`);
  }
  L.push('', '## Decision (confirmation 2015 → now, Holm over E1-E3)', '');
  L.push('| Test | Month t | p | Holm p | Disc > 0 | Conf > 0 | t ≥ 2 | Holm < 0.05 | n ≥ 200 | 2x cost > 0 | Control ≥ 38 of 40 | Pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  const yn = (b) => (b ? 'yes' : 'no');
  for (const [k, v] of Object.entries(T)) { const c = v.checks; L.push(`| ${k} | ${f2(v.CONF.t)} | ${v.p} | ${v.pHolm} | ${yn(c.discPos)} | ${yn(c.confPos)} | ${yn(c.t2)} | ${yn(c.holm)} | ${yn(c.n200)} | ${yn(c.cost2x)} | ${yn(c.control)} | **${v.pass ? 'pass' : 'fail'}** |`); }
  L.push('', '## Per stopped day: T1 alone against T1 + the re-entry (net R a stopped day; reported)', '');
  L.push('| Test | Window | Stopped days | T1 alone | T1 + re-entry |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(T)) for (const [w, lab] of [['DISC', '2005-14'], ['CONF', '2015 → now']]) L.push(`| ${k} | ${lab} | ${v[w].stoppedDays} | ${f3(v[w].perStoppedDay.t1Only)} | ${f3(v[w].perStoppedDay.withRe)} |`);
  L.push('', '## By year (re-entry net R; reported)', '');
  L.push('| Year | Gold n | Gold net R/trade | USD/JPY n | USD/JPY net R/trade |', '|---|---|---|---|---|');
  const yrs = [...new Set(R.markets.flatMap((m) => Object.keys(m.byYear)))].sort();
  const gy = R.markets.find((m) => m.mk === 'xau').byYear, uy = R.markets.find((m) => m.mk === 'usdjpy').byYear;
  for (const y of yrs) L.push(`| ${y} | ${gy[y]?.n ?? 0} | ${f3(gy[y]?.netR ?? null)} | ${uy[y]?.n ?? 0} | ${f3(uy[y]?.netR ?? null)} |`);
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Caveats', '', '- Gold costs are the demo account\'s measured hourly spreads of November 2026 (route C1 of `gold-vol-breakout-hourcost`) charged on every past year as a share of price; USD/JPY costs are the 0.000045 commission + 0.5 pip every USD/JPY breakout study used. Neither is a historical measurement.', '- OANDA mid M5 candles; inside one 5-minute candle the order of prices is unknown, so a re-entry never fills in the stop-out candle and a fill candle that also reaches the open is booked as a stop.', `- Data to ${R.dataEnd}. Gold starts March 2006, so its discovery window is 2006-14.`, '- Both windows were read for T1 before this study; the re-entry rule itself was fixed before any re-entry figure was computed.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex');
  if (sha !== ORIG_SHA) throw new Error('original.mjs is not the pinned copy');
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gold-vol-breakout-hourcost', 'result.json'), 'utf8'));
  const cost = { profile: hc.profile, commission: hc.commission };
  const M = MARKETS.map((mk) => runMarket(mk, cost));
  const gatesOk = M.every((m) => m.walkerOk && m.gate.every((g) => g.ok));
  const base = { study: 'vb-reentry', built: new Date().toISOString().slice(0, 10), dataEnd: M.map((m) => m.dataEnd).sort()[0], costGold: { route: 'C1', commission: cost.commission, probe: hc.probe && hc.probe.commit }, windows: WINDOWS };
  const marketsOut = M.map((m) => ({ mk: m.mk, dataEnd: m.dataEnd, gate: m.gate, walkerOk: m.walkerOk, walked: m.walked, t1: { DISC: (() => { const s = stat(m.T1.filter((x) => inW(x.day, WINDOWS.DISC))); delete s.tRaw; return s; })(), CONF: (() => { const s = stat(m.T1.filter((x) => inW(x.day, WINDOWS.CONF))); delete s.tRaw; return s; })() }, byYear: byYear(m.RE) }));
  if (!gatesOk) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, markets: marketsOut, verdict: 'STOPPED: a harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const tests = judge(M), verdict = verdictOf(tests);
  const c = tests.E3.CONF;
  const reading = `Crossing the trigger again after being stopped back at the open gave ${f3(c.grossR)}R a trade before costs and ${f3(c.netR)}R after in 2015 → now (n ${c.n}); the random-time same-side control on the same days made ${f3(c.ctrl.meanNetR)}R (real beat it in ${c.ctrl.beaten} of 40 seeds). The control days are the days the price did cross the trigger again after the stop-out, so a random later entry on them is helped by knowing that move came (its level is inflated by that selection, as the pre-registration's design implies); the verdict does not rest on it: the confirmation month t is under 2 on every test. A before-cost tilt is not an edge; nothing changes on any desk or job.`;
  const R = { ...base, markets: marketsOut, tests, verdict, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(verdict);
}
