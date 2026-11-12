// Edge research · trend-breadth-h1 (PREREGISTRATION.md, committed first): the live Gold trend rule (close above the prior
// 20 daily highs, 2 ATR stop ratcheted on daily closes, one add, re-entries inside the day), unchanged, on hourly candles of
// thirteen other markets, net of costs and financing. Gold first, as the parity gate against gold-systems-oos.
//   node --use-env-proxy fetch.mjs <dir>     the candles (kept out of git)
//   node run.mjs full <dir>                  the gate, then result.json next to this file
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { stopFill, spotSkip, nights } from '../../../council/fills.mjs';
import { MARKETS, COST } from './markets.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = {
  N: 20, K: 2, ATR: 14, ADD: 1, PARITY: { n: 0.15, g: 0.15 },
  FIN_LONG: 0.00015, FIN_FX: 0.00004, FIN_GOLD: 0.000148,
  REP_FROM: '2005-01-01', REP_FROM_LATE: '2007-01-01', CONF_FROM: '2020-01-01', CONF_TO: '2026-10-31',
  GATE: [['2006-07-01', '2018-01-01'], ['2018-01-01', '2026-11-01']], GOLD_FIRST: '2006-07-01',
};
const HOUR = 3600, DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r3 = (v) => (Number.isFinite(v) ? +v.toFixed(3) : null), r2 = (v) => (Number.isFinite(v) ? +v.toFixed(2) : null);

export function atr(D, i, n = P.ATR) {
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(D[j].high - D[j].low, Math.abs(D[j].high - D[j - 1].close), Math.abs(D[j].low - D[j - 1].close));
  return a / n;
}

// ── the rule on hourly candles. H = H1 candles, D = D1 candles (both ascending, { time, open, high, low, close }). ──
// A run at every H1 close sees only daily candles whose bucket has ended and H1 candles up to the one just closed; an entry
// or add fills at the open of the H1 candle starting at the run time. Returns units: { id, of, side, t, c, e, r0, R, why, end }.
export function simulate(H, D, { N = P.N, sides = 'long', spot = false, first = 0 } = {}) {
  const units = [], used = new Set();
  let pos = null;                                 // { id, side, stop, lastD, units: [{ ..., i }] , added }
  let nd = 0;
  const skip = spot ? H.map((b) => spotSkip(b.time)) : null;
  const shut = (side, j, px, why) => {
    for (const u of pos.units) { u.c = H[j].time; u.R = side * ((u.px ?? px) - u.e) / u.r0; u.why = why; delete u.px; delete u.i; units.push(u); }
    pos = null;
  };
  for (let j = 0; j < H.length; j++) {
    const b = H[j];
    // 1. manage the open units on the candle just closed
    if (pos && !(skip && skip[j])) {
      const s = pos.side, hit = s > 0 ? b.low <= pos.stop : b.high >= pos.stop;
      if (hit) {
        let gap = false;
        for (const u of pos.units) { u.px = stopFill(b, s < 0, pos.stop, j > u.i); if (u.px !== pos.stop) gap = true; }
        shut(s, j, pos.stop, gap ? 'gap' : 'stop');
      }
    }
    const c = b.time + HOUR, now = c + 240;
    while (nd < D.length && D[nd].time + DAY <= c) nd++;
    if (nd < N + P.ATR + 2) continue;
    const last = D[nd - 1], nx = H[j + 1], can = !!nx && nx.time === c && c >= first, price = can ? nx.open : null;
    if (pos) {
      // 2. once per newly closed day: the ratchet (never loosens), then the add
      if (last.time > pos.lastD) {
        const s = pos.side, ns = last.close - s * P.K * atr(D, nd - 1);
        if (s * (ns - pos.stop) > 0) pos.stop = ns;
        const f = pos.units[0];
        if (!pos.added && s * (last.close - f.e) >= P.ADD * f.r0 && can) {
          const rA = s * (price - pos.stop);
          if (rA > 0) { pos.units.push({ id: `${pos.id}-add`, of: pos.id, side: s, t: c, e: price, r0: rA, i: j + 1 }); pos.added = true; }
        }
        pos.lastD = last.time;
      }
    } else if (can && now - (last.time + DAY) < DAY) {
      // 3. a new entry on an unused breakout day
      let hi = -Infinity, lo = Infinity;
      for (let q = nd - 1 - N; q < nd - 1; q++) { if (D[q].high > hi) hi = D[q].high; if (D[q].low < lo) lo = D[q].low; }
      const A = atr(D, nd - 1), side = last.close > hi ? 1 : sides === 'both' && last.close < lo ? -1 : 0, id = `${last.time}`;
      if (side && A > 0 && !used.has(id)) {
        used.add(id);
        const r0 = P.K * A;
        pos = { id, side, stop: price - side * r0, lastD: last.time, added: false, units: [{ id, side, t: c, e: price, r0, i: j + 1 }] };
      }
    }
  }
  if (pos) { const j = H.length - 1; for (const u of pos.units) u.end = true; shut(pos.side, j, H[j].close, 'end'); }
  return units;
}

// ── costs and positions ──
export function unitNet(u, m, { mult = 1, fin = 1 } = {}) {
  const cost = mult * COST[m.cost] * u.e / u.r0;
  const rate = m.gold ? P.FIN_GOLD : m.group === 'forex' ? P.FIN_FX : u.side > 0 ? P.FIN_LONG : 0;
  const f = fin * rate * nights(u.t, u.c) * u.e / u.r0;
  return { n: u.R - cost - f, cost, fin: f };
}
export function positions(units, m) {
  const by = new Map();
  for (const u of units) { const k = u.of || u.id; if (!by.has(k)) by.set(k, []); by.get(k).push(u); }
  const out = [];
  for (const [id, L] of by) {
    const f = L.find((u) => !u.of); if (!f) continue;
    const s = (o) => L.reduce((a, u) => a + unitNet(u, m, o).n, 0);
    out.push({ id, side: f.side, t: f.t, c: Math.max(...L.map((u) => u.c)), g: L.reduce((a, u) => a + u.R, 0), n: s({}), n2: s({ mult: 2 }), n0: s({ fin: 0 }), fin: L.reduce((a, u) => a + unitNet(u, m).fin, 0), units: L.length, end: L.some((u) => u.end) || undefined });
  }
  out.sort((a, b) => a.t - b.t);
  for (let i = 1; i < out.length; i++) if (out[i].t - out[i - 1].c < DAY) out[i].re = true;   // bought again within a day of the last exit
  return out;
}

// ── statistics ──
export function stat(a) {
  const n = a.length; if (!n) return { n: 0, mean: null, t: null, sum: 0 };
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: m, sum: m * n, t: sd > 0 ? m / (sd / Math.sqrt(n)) : null };
}
// t on calendar-month sums of rows booked by close inside [from, to] (empty months count 0)
export function monthly(rows, from, to, key = 'n') {
  const k = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const a = k(from), b = k(to), m = new Array(b - a + 1).fill(0);
  for (const r of rows) if (r.c >= from && r.c <= to) m[k(r.c) - a] += r[key];
  return { ...stat(m), months: m.length };
}
export function normP(t) {
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
export function windowStats(rows, from, to) {
  const w = rows.filter((r) => r.c >= from && r.c <= to), mo = monthly(rows, from, to), yrs = (to - from) / DAY / 365.25;
  const s = stat(w.map((r) => r.n));
  return { n: w.length, perPos: r3(s.mean), tPos: r2(s.t), total: r2(s.sum), tMonthly: r2(mo.t), months: mo.months, perYear: r2(w.length / yrs), rPerYear: r2(s.sum / yrs),
    x2: r3(stat(w.map((r) => r.n2)).mean), noFin: r3(stat(w.map((r) => r.n0)).mean), gross: r3(stat(w.map((r) => r.g)).mean), reEntries: w.filter((r) => r.re).length, withAdd: w.filter((r) => r.units > 1).length };
}
export function verdictOf(t) {
  const c1 = t.conf.perPos > 0 && t.conf.tMonthly != null && t.conf.tMonthly >= 2 && t.holm < 0.05, c2 = t.rep.perPos > 0 && t.rep.tMonthly != null && t.rep.tMonthly >= 1, c3 = t.conf.x2 > 0;
  return { pass: !!(c1 && c2 && c3), confirmation: !!c1, replication: !!c2, x2: !!c3 };
}
// the gate: gold on this harness against gold-systems-oos gtrend, positions dated by entry
export function parity(gold, ref) {
  const rows = P.GATE.map(([a, b]) => {
    const A = T(a), B = T(b), mine = gold.filter((p) => p.t >= A && p.t < B), want = ref.filter((p) => { const t = Date.parse(p.t + ':00Z') / 1000; return t >= A && t < B; });
    const gm = stat(mine.map((p) => p.g)).mean, gw = stat(want.map((p) => p.g)).mean;
    const ok = Math.abs(mine.length - want.length) <= P.PARITY.n * want.length && Math.abs(gm - gw) <= P.PARITY.g;
    return { from: a, to: b, refN: want.length, n: mine.length, refGross: r3(gw), gross: r3(gm), ok };
  });
  return { rows, ok: rows.every((r) => r.ok) };
}

// ── run ──
const load = (dir, sym, tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${sym}-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const GOLD = { name: 'Gold', group: 'metals', cost: 'gold', sides: 'long', spot: true, gold: true };
function main(dir) {
  COST.gold = 0;                                                    // gold's own cost is the flat $0.30 a unit, added below
  const ref = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-systems-oos/result.json'), 'utf8')).positions.filter((p) => p.sys === 'gtrend');
  const gU = simulate(load(dir, 'xau', '1h'), load(dir, 'xau', '1d'), { spot: true, first: T(P.GOLD_FIRST) });
  const gold = positions(gU, GOLD), gate = parity(gold, ref);
  const out = { built: '2026-11-11', prereg: 'research/edge/trend-breadth-h1/PREREGISTRATION.md', rule: 'paper research only: no live rule, size, filter, stop or config changes',
    params: { N: P.N, K: P.K, ATR: P.ATR, ADD: P.ADD, finLong: P.FIN_LONG, finFx: P.FIN_FX, cost: { fx: COST.fx, index: COST.index, mid: COST.mid } }, gate };
  console.log('gate', JSON.stringify(gate));
  // gold on this harness with its own costs ($0.30 a unit) and financing, by entry window (reported)
  const gNet = (p, us) => us.filter((u) => (u.of || u.id) === p.id).reduce((a, u) => a + u.R - 0.30 / u.r0 - P.FIN_GOLD * nights(u.t, u.c) * u.e / u.r0, 0);
  out.gold = P.GATE.map(([a, b]) => { const w = gold.filter((p) => p.t >= T(a) && p.t < T(b)), s = stat(w.map((p) => gNet(p, gU))); return { from: a, to: b, n: w.length, perPos: r3(s.mean), tPos: r2(s.t), reEntries: w.filter((p) => p.re).length }; });
  const CF = T(P.CONF_FROM), CT = T(P.CONF_TO) + DAY - 1, tests = [], all = [], groups = {};
  for (const [k, m] of Object.entries(MARKETS)) {
    const H = load(dir, k, '1h'), D = load(dir, k, '1d'), pos = positions(simulate(H, D, { sides: m.sides, spot: !!m.spot }), m);
    const RF = T(H[0].time > T('2005-06-01') ? P.REP_FROM_LATE : P.REP_FROM), RT = CF - 1;
    for (const p of pos) { p.m = k; all.push(p); (groups[m.group] = groups[m.group] || []).push(p); }
    tests.push({ id: k, name: m.name, group: m.group, sides: m.sides, firstCandle: new Date(H[0].time * 1000).toISOString().slice(0, 10), repFrom: new Date(RF * 1000).toISOString().slice(0, 10), rep: windowStats(pos, RF, RT), conf: windowStats(pos, CF, CT) });
    console.log(k, pos.length);
  }
  const RF = T(P.REP_FROM);
  tests.push({ id: 'pool', name: 'All thirteen markets, pooled', group: 'pool', rep: windowStats(all, RF, CF - 1), conf: windowStats(all, CF, CT) });
  const ps = tests.map((t) => normP(t.conf.tMonthly)), hs = holm(ps);
  tests.forEach((t, i) => { t.p = +ps[i].toPrecision(3); t.holm = +hs[i].toPrecision(3); t.verdict = verdictOf(t); });
  out.groups = Object.fromEntries(Object.entries(groups).map(([g, rows]) => [g, { rep: windowStats(rows, RF, CF - 1), conf: windowStats(rows, CF, CT) }]));
  const passed = tests.filter((t) => t.verdict.pass);
  if (gate.ok) { out.tests = tests; out.passed = passed.map((t) => t.id); }
  else out.uninterpreted = { note: 'the parity gate missed: by the pre-registration no breadth number is interpreted', tests };
  const pool = tests.at(-1), pos = tests.slice(0, -1).filter((t) => t.conf.perPos > 0).length;
  out.verdict = !gate.ok ? 'INCONCLUSIVE: harness not validated (the hourly harness missed the parity gate on gold); no breadth number is interpreted'
    : passed.length ? `PASS: ${passed.map((t) => t.name).join(', ')} passed the pre-registered bar (a candidate for a forward paper shadow, not a live rule)`
    : `FAIL: the Gold trend rule does not carry to other markets: 0 of 14 tests pass; pooled over thirteen markets ${pool.conf.perPos > 0 ? '+' : ''}${pool.conf.perPos}R a position net on 2020-26 (n ${pool.conf.n}, monthly t ${pool.conf.tMonthly}) and ${pool.rep.perPos > 0 ? '+' : ''}${pool.rep.perPos}R on 2005-19 (n ${pool.rep.n}, t ${pool.rep.tMonthly}); ${pos} of 13 markets positive on 2020-26`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
  console.log(out.verdict); console.log('gold', JSON.stringify(out.gold));
  for (const t of tests) console.log(t.id.padEnd(7), 'rep', t.rep.n, t.rep.perPos, 't', t.rep.tMonthly, '| conf', t.conf.n, t.conf.perPos, 't', t.conf.tMonthly, 'x2', t.conf.x2, 'noFin', t.conf.noFin, 'gross', t.conf.gross, 're', t.conf.reEntries, 'p', t.p, 'holm', t.holm, t.verdict.pass ? 'PASS' : 'fail');
  for (const [g, x] of Object.entries(out.groups)) console.log('group', g, 'rep', x.rep.n, x.rep.perPos, x.rep.tMonthly, 'conf', x.conf.n, x.conf.perPos, x.conf.tMonthly);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { if (process.argv[2] === 'full' && process.argv[3]) main(process.argv[3]); else console.log('usage: node run.mjs full <candle dir>'); }
