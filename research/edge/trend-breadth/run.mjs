// Edge research · trend-breadth (PREREGISTRATION.md, committed first).
//   Part A: financing of the gold systems' recorded positions (research/edge/gold-systems-oos/result.json), no rule tested.
//   Part B: the live Gold trend rule (close above the prior N daily highs, 2 ATR stop ratcheted on daily closes, one add),
//           unchanged, on other markets' daily candles, net of costs and financing.
//   node run.mjs fetch <dir>   copies the council's daily candle cache out of the council-data branch (git show, no network)
//   node run.mjs full <dir>    writes result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const P = {
  K: 2, ATR: 14, ADD: 1, MIN_BARS: 60,
  PARITY: { n: 0.15, g: 0.15 },
  FIN_GOLD: 0.000148,          // of price a night: the broker's XAUUSD long swap (5.903 pips of 0.1 at about 3,987)
  FIN_LONG: 0.00015, FIN_FX: 0.00004,
  REP_FROM: '2007-01-01', CONF_FROM: '2020-01-01', CONF_TO: '2026-10-31',
};
export const COST = { fx: 0.00015, index: 0.0003, mid: 0.001, wide: 0.002 };
export const TESTS = [
  { id: 'B1', name: 'Other metals', sides: 'long', markets: { xag: 'mid', xpt: 'wide', xpd: 'wide', xcu: 'mid' } },
  { id: 'B2', name: 'Equity indices', sides: 'long', markets: Object.fromEntries('au200 ch20 cn50 de40 es35 eu50 fr40 hk33 in50 jp225 nas100 nl25 sg30 spx500 uk100 us2000 us30'.split(' ').map((k) => [k, 'index'])) },
  { id: 'B3', name: 'Energies and agriculturals', sides: 'long', markets: { bco: 'mid', wtico: 'mid', natgas: 'mid', corn: 'wide', wheat: 'wide', soybn: 'wide', sugar: 'wide' } },
  { id: 'B4', name: 'Currency majors', sides: 'both', markets: Object.fromEntries('eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf'.split(' ').map((k) => [k, 'fx'])) },
];
const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null);

// ── indicators ──
export function atr(D, i, n = P.ATR) {
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}
const nextDay = (D, i) => i + 1 < D.length && D[i + 1].time === D[i].time + DAY;

// ── the rule on daily candles. side +1 = the live buy rule, −1 = its mirror. Returns positions (first unit + its add). ──
// Nothing at index i reads a candle after i: a signal on candle i fills at candle i+1's open.
export function simulate(D, N, { sides = 'long', first = P.MIN_BARS } = {}) {
  const out = [];
  let pos = null;                               // { side, units: [{ entry, r0, i }], stop, sig }
  const close = (i, px, why, atEnd) => {
    const legs = pos.units.map((u) => ({ entry: u.entry, r0: u.r0, i: u.i, R: pos.side * (px - u.entry) / u.r0, nights: Math.round((D[i].time - D[u.i].time) / DAY) }));
    out.push({ side: pos.side, t: D[pos.units[0].i].time, c: D[i].time, exit: px, why, legs, g: legs.reduce((a, l) => a + l.R, 0), atEnd: atEnd || undefined });
    pos = null;
  };
  let pending = null;                           // { kind: 'entry' | 'add', side, A } decided on candle i-1's close
  for (let i = Math.max(first, N + P.ATR + 1); i < D.length; i++) {
    const b = D[i];
    if (pending) {
      const ok = D[i].time === D[i - 1].time + DAY;
      if (ok && pending.kind === 'entry' && !pos) {
        const entry = b.open, r0 = P.K * pending.A;
        if (r0 > 0) pos = { side: pending.side, stop: entry - pending.side * r0, units: [{ entry, r0, i }] };
      } else if (ok && pending.kind === 'add' && pos && pos.units.length === 1) {
        const rA = pos.side * (b.open - pos.stop);
        if (rA > 0) pos.units.push({ entry: b.open, r0: rA, i });
      }                                         // an add lost to a gap in the calendar is tried again on a later close, as live
      pending = null;
    }
    if (pos) {
      const s = pos.side;
      if (s * (b.open - pos.stop) <= 0) close(i, b.open, 'gap');
      else if (s > 0 ? b.low <= pos.stop : b.high >= pos.stop) close(i, pos.stop, 'stop');
    }
    if (pos) {                                  // after the candle closes: ratchet, then the add
      const s = pos.side, ns = b.close - s * P.K * atr(D, i);
      if (s * (ns - pos.stop) > 0) pos.stop = ns;
      if (pos.units.length === 1 && s * (b.close - pos.units[0].entry) >= P.ADD * pos.units[0].r0) pending = { kind: 'add' };
    } else {
      let hi = -Infinity, lo = Infinity;
      for (let j = i - N; j < i; j++) { if (D[j].high > hi) hi = D[j].high; if (D[j].low < lo) lo = D[j].low; }
      const A = atr(D, i);
      if (A > 0 && b.close > hi) pending = { kind: 'entry', side: 1, A };
      else if (A > 0 && sides === 'both' && b.close < lo) pending = { kind: 'entry', side: -1, A };
    }
  }
  if (pos) close(D.length - 1, D[D.length - 1].close, 'end', true);
  return out;
}

// net R of a position: every unit pays its round trip and its financing, each as a share of its own risk
export function net(p, costPct, finPct, { mult = 1, shortPays = false } = {}) {
  let n = 0, cost = 0, fin = 0;
  for (const l of p.legs) {
    const c = mult * costPct * l.entry / l.r0, f = (p.side > 0 || shortPays ? finPct : 0) * l.nights * l.entry / l.r0;
    cost += c; fin += f; n += l.R - c - f;
  }
  return { n, cost, fin };
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
// t on calendar-month sums (positions booked in the month they close; empty months count 0)
export function monthly(rows, from, to) {
  const key = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const a = key(from), b = key(to), m = new Array(b - a + 1).fill(0);
  for (const r of rows) { const k = key(r.c); if (k >= a && k <= b) m[k - a] += r.n; }
  return { ...stat(m), months: m.length };
}
export function normP(t) {                      // one-sided upper tail of the standard normal
  if (t == null) return 1;
  const x = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return t >= 0 ? (1 - erf) / 2 : (1 + erf) / 2;
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let run = 0;
  o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export function maxDD(xs) { let c = 0, pk = 0, dd = 0; for (const x of xs) { c += x; if (c > pk) pk = c; if (pk - c > dd) dd = pk - c; } return dd; }

// rollovers between two times: Monday-Friday 22:00 UTC, Wednesday counts three
export function nights(t, c) {
  let n = 0;
  for (let d = Math.floor(t / DAY) * DAY + 22 * 3600; d < c; d += DAY) {
    if (d <= t) continue;
    const w = new Date(d * 1000).getUTCDay();
    if (w >= 1 && w <= 5) n += w === 3 ? 3 : 1;
  }
  return n;
}

export function verdictOf(t) {
  const c1 = t.conf.mean > 0 && t.conf.tM >= 2 && t.holm < 0.05, c2 = t.rep.mean > 0 && t.rep.tM >= 1, c3 = t.confX2 > 0;
  return { pass: !!(c1 && c2 && c3), c1: !!c1, c2: !!c2, c3: !!c3 };
}

// ── files ──
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ALL = ['xau', ...TESTS.flatMap((t) => Object.keys(t.markets))];
function load(dir, k) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'));
  return j.rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
}
function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const k of ALL) {
    const f = path.join(dir, `${k}.json`);
    if (fs.existsSync(f)) continue;
    fs.writeFileSync(f, execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('saved', k);
  }
}

function partA() {
  const J = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-systems-oos/result.json'), 'utf8'));
  const G = JSON.parse(fs.readFileSync(path.join(HERE, '../honest-book/gold-1d.json'), 'utf8')).bars;
  const px = (t) => { let lo = 0, hi = G.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (G[m][0] <= t) lo = m; else hi = m - 1; } return G[lo][1]; };
  const W = [['untouched 2006-07 to 2017-12', T('2006-07-01'), T('2018-01-01')], ['2018-01 to 2026-10', T('2018-01-01'), T('2026-11-01')], ['2020-01 to 2026-10', T('2020-01-01'), T('2026-11-01')]];
  const out = [];
  for (const sys of ['gtrend', 'gtrend5', 'geg', 'gtl']) for (const [w, a, b] of W) {
    const rows = J.positions.filter((p) => p.sys === sys).map((p) => ({ ...p, T: Date.parse(p.t + ':00Z') / 1000, C: Date.parse(p.c + ':00Z') / 1000 })).filter((p) => p.T >= a && p.T < b);
    const calc = rows.map((p) => { const nn = nights(p.T, p.C), f = nn * P.FIN_GOLD * px(p.T) / p.r0; return { nn, f, n: p.n }; });
    const before = stat(calc.map((x) => x.n)), f1 = stat(calc.map((x) => x.n - x.f)), fh = stat(calc.map((x) => x.n - x.f / 2));
    out.push({ sys, window: w, n: rows.length, nights: r3(stat(calc.map((x) => x.nn)).mean), before: r3(before.mean), tBefore: r3(before.t), fin: r3(stat(calc.map((x) => x.f)).mean),
      afterF1: r3(f1.mean), tF1: r3(f1.t), afterHalf: r3(fh.mean), tHalf: r3(fh.t), sumBefore: r3(before.sum), sumF1: r3(f1.sum),
      survives: w.startsWith('untouched') ? f1.mean > 0 && f1.t >= 1 : undefined });
  }
  return out;
}

function summarize(rows, a, b) {
  const R = rows.filter((p) => p.t >= a && p.t < b), s = stat(R.map((p) => p.n)), m = monthly(R, a, b - 1), yrs = (b - a) / (365.25 * DAY);
  return { n: s.n, mean: r3(s.mean), sum: r3(s.sum), t: r3(s.t), tM: r3(m.t), months: m.months, perYear: r3(s.n / yrs), win: r3(R.filter((p) => p.n > 0).length / (s.n || 1)),
    dd: r3(maxDD([...R].sort((x, y) => x.c - y.c).map((p) => p.n))), gross: r3(stat(R.map((p) => p.g)).mean), noFin: r3(stat(R.map((p) => p.n + p.fin)).mean), fin: r3(stat(R.map((p) => p.fin)).mean), cost: r3(stat(R.map((p) => p.cost)).mean) };
}

function full(dir) {
  const A = T(P.REP_FROM), B = T(P.CONF_FROM), C = T(P.CONF_TO) + DAY;
  const data = Object.fromEntries(ALL.map((k) => [k, load(dir, k)]));
  // parity gate on gold
  const J = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-systems-oos/result.json'), 'utf8'));
  const gold = (N) => simulate(data.xau, N).map((p) => { const x = net(p, 0, P.FIN_GOLD); const flat = p.legs.reduce((a, l) => a + 0.30 / l.r0, 0); return { ...p, n: p.g - flat - x.fin, fin: x.fin, cost: flat }; });
  const g20 = gold(20), g5 = gold(5);
  const PW = [['2006-07 to 2017-12', T('2006-07-01'), T('2018-01-01')], ['2018-01 to 2026-10', T('2018-01-01'), T('2026-11-01')]];
  const parity = [];
  for (const [sys, mine] of [['gtrend', g20], ['gtrend5', g5]]) for (const [w, a, b] of PW) {
    const ref = J.positions.filter((p) => p.sys === sys).filter((p) => { const t = Date.parse(p.t + ':00Z') / 1000; return t >= a && t < b; });
    const me = mine.filter((p) => p.t >= a && p.t < b), rg = stat(ref.map((p) => p.g)).mean, mg = stat(me.map((p) => p.g)).mean;
    parity.push({ sys, window: w, refN: ref.length, n: me.length, refG: r3(rg), g: r3(mg), ok: Math.abs(me.length - ref.length) <= P.PARITY.n * ref.length && Math.abs(mg - rg) <= P.PARITY.g });
  }
  const parityOk = parity.filter((p) => p.sys === 'gtrend').every((p) => p.ok);
  const goldRows = [];
  for (const [N, rows] of [[20, g20], [5, g5]]) for (const [w, a, b] of [...PW, ['2020-01 to 2026-10', B, C]]) goldRows.push({ N, window: w, ...summarize(rows, a, b) });

  const run = (N) => TESTS.map((t) => {
    const fin = t.sides === 'both' ? P.FIN_FX : P.FIN_LONG, per = {}, rows = [], rows2 = [];
    for (const [k, grp] of Object.entries(t.markets)) {
      const D = data[k], ps = simulate(D, N, { sides: t.sides }).filter((p) => p.t >= A && p.t < C);
      const mk = (mult) => ps.map((p) => { const x = net(p, COST[grp], fin, { mult, shortPays: t.sides === 'both' }); return { k, t: p.t, c: p.c, side: p.side, g: p.g, n: x.n, fin: x.fin, cost: x.cost }; });
      const r1 = mk(1); rows.push(...r1); rows2.push(...mk(2));
      per[k] = { first: new Date(D[0].time * 1000).toISOString().slice(0, 10), rep: summarize(r1, A, B), conf: summarize(r1, B, C) };
    }
    const rep = summarize(rows, A, B), conf = summarize(rows, B, C), confX2 = summarize(rows2, B, C).mean, repX2 = summarize(rows2, A, B).mean;
    const sidesSplit = t.sides === 'both' ? { long: summarize(rows.filter((p) => p.side > 0), B, C), short: summarize(rows.filter((p) => p.side < 0), B, C) } : undefined;
    return { id: t.id, name: t.name, sides: t.sides, markets: Object.keys(t.markets), rep, conf, confX2, repX2, p: normP(conf.tM), per, sidesSplit };
  });
  const main = run(20), hp = holm(main.map((t) => t.p));
  main.forEach((t, i) => { t.p = +t.p.toFixed(4); t.holm = +hp[i].toFixed(4); Object.assign(t, { verdict: verdictOf(t) }); });
  const n5 = run(5).map((t) => ({ id: t.id, name: t.name, rep: t.rep, conf: t.conf, confX2: t.confX2 }));
  const pass = main.filter((t) => t.verdict.pass).map((t) => t.id);
  const a = partA();
  const sg = (v) => `${v >= 0 ? '+' : ''}${v}R`;
  const u = (sys) => a.find((x) => x.sys === sys && x.window.startsWith('untouched'));
  const vA = 'Part A (financing, today\'s broker rate, untouched 2006-17): ' + ['gtrend', 'gtrend5', 'geg', 'gtl'].map((k) => { const x = u(k); return `${k} ${sg(x.before)} -> ${sg(x.afterF1)} a position (n ${x.n}, t ${x.tBefore} -> ${x.tF1}${x.survives ? '' : ', does not survive'})`; }).join('; ') + '.';
  const vB = !parityOk ? 'Part B (breadth): harness not validated, the parity gate on gold missed, so no breadth number is interpreted.'
    : `Part B (breadth): ${pass.length ? 'PASS' : 'FAIL'}, ${pass.length} of 4 tests pass${pass.length ? ' (' + pass.join(', ') + ')' : ''}. ` +
      main.map((t) => `${t.id} ${t.name.toLowerCase()} ${sg(t.conf.mean)} a position net in 2020-26 (n ${t.conf.n}, monthly t ${t.conf.tM}); 2007-19 ${sg(t.rep.mean)} (n ${t.rep.n}, t ${t.rep.tM})`).join('; ') + '.';
  const verdict = `${parityOk ? (pass.length ? 'PASS' : 'FAIL') : 'INCONCLUSIVE'}. ${vA} ${vB}`;
  const breadth = parityOk ? { tests: main, n5 } : { uninterpreted: { why: 'the parity gate missed: by the pre-registration these figures are not a finding in either direction', tests: main, n5 } };
  const out = { topic: 'trend-breadth', built: '2026-11-11', title: 'Trend breadth and financing',
    system: 'The financing cost of the gold systems\' recorded positions; and the live Gold trend rule (close above the prior 20 daily highs, 2 ATR stop ratcheted on daily closes, one add), unchanged, on OANDA daily candles of other metals, equity indices, energies and agriculturals, and currency majors, net of costs and financing',
    window: { replication: [P.REP_FROM, '2019-12-31'], confirmation: [P.CONF_FROM, P.CONF_TO] }, params: P, costs: COST,
    verdict, partA: a, parity, parityOk, gold: goldRows, ...breadth };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(verdict); console.table(parity); console.table(a);
  console.table(main.map((t) => ({ id: t.id, repN: t.rep.n, rep: t.rep.mean, repT: t.rep.tM, confN: t.conf.n, conf: t.conf.mean, confT: t.conf.tM, x2: t.confX2, holm: t.holm, pass: t.verdict.pass })));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchAll(dir);
  else if (mode === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch <dir> | full <dir>'); process.exit(1); }
}
