// Edge research · supported-book (PREREGISTRATION.md, committed first): the owner's two-system paper book (Gold trend +
// Gold daily engulf) run as a book, day by day, from the unit-level records of the committed gold-systems-oos engine, net of
// the flat round trip and of overnight financing on every unit (council/fills.mjs FIN and nights, imported).
//   node run.mjs legs <replay trades.json>   writes legs.json (the engine's units for gtrend, gtrend5, geg; engine not edited)
//   node run.mjs                             the gate against gold-systems-oos/result.json, then result.json
// Paper research: nothing here is read by the council, the mirror or the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const SYS = ['gtrend', 'geg', 'gtrend5'];
export const NAME = { gtrend: 'Gold trend (20-day)', geg: 'Gold daily engulf', gtrend5: 'Gold trend fast (5-day)' };
export const BOOKS = { S2: ['gtrend', 'geg'], S3: ['gtrend', 'geg', 'gtrend5'] };
export const COST = 0.30, RATE = FIN.xau.long, RISK = 0.0025, BAR = { t: 2 };
export const WINDOWS = {
  W1: { label: 'untouched 2006-07 to 2017-12', from: '2006-07-01', to: '2017-12-31', halves: [['2006-07-01', '2011-12-31'], ['2012-01-01', '2017-12-31']] },
  W2: { label: 'built on, 2018-01 to 2026-10', from: '2018-01-01', to: '2026-10-31', halves: [['2018-01-01', '2022-05-31'], ['2022-06-01', '2026-10-31']] },
  W3: { label: 'in sample, 2020-01 to 2026-10', from: '2020-01-01', to: '2026-10-31', halves: [['2020-01-01', '2023-05-31'], ['2023-06-01', '2026-10-31']] },
};
const DAY = 86400;
const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r1 = rN(1), r2 = rN(2), r3 = rN(3);

// ── days ──
export const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * DAY * 1000).toISOString().slice(0, 10);
export const roll = (d) => (dow(d) === 6 ? addDays(d, 2) : dow(d) === 0 ? addDays(d, 1) : d);   // Sat / Sun → Monday
export function weekdays(from, to) { const o = []; for (let d = from; d <= to; d = addDays(d, 1)) if (dow(d) !== 0 && dow(d) !== 6) o.push(d); return o; }
const endOf = (d) => Date.parse(d + 'T00:00:00Z') / 1000 + DAY;

// ── one unit, one position ──
// net R of a unit: gross − round trip − financing, each as a share of the unit's own risk
export function unitNet(u, { mult = 1, fin = 1 } = {}) {
  const cost = mult * COST / u.r0, nn = nights(u.t, u.c), f = fin * RATE * nn * u.e / u.r0;
  return { n: u.R - cost - f, cost, fin: f, nights: nn };
}
// positions = a first unit and its add; closed when its last unit closes
export function positions(legs, opt = {}, keep = () => true) {
  const by = new Map();
  for (const u of legs) { if (!keep(u)) continue; const k = u.of || u.id; if (!by.has(k)) by.set(k, []); by.get(k).push(u); }
  const out = [];
  for (const [id, L] of by) {
    const first = L.find((u) => !u.of); if (!first) continue;
    let n = 0, g = 0, fin = 0, cost = 0;
    for (const u of L) { const x = unitNet(u, opt); n += x.n; g += u.R; fin += x.fin; cost += x.cost; }
    out.push({ sys: first.sys, id, t: first.t, c: Math.max(...L.map((u) => u.c)), day: roll(dayOf(Math.max(...L.map((u) => u.c)))), n, g, fin, cost, units: L.length });
  }
  return out.sort((a, b) => a.c - b.c);
}

// ── statistics ──
const sum = (a) => a.reduce((s, x) => s + x, 0), mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const tOf = (a) => { const s = sd(a); return s > 0 ? mean(a) / s * Math.sqrt(a.length) : null; };
export function corr(a, b) { const ma = mean(a), mb = mean(b); let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; } return aa && bb ? ab / Math.sqrt(aa * bb) : null; }
// worst drawdown of a series of daily changes (v) or of an equity path (eq), the peak floored at 0, with its length in days:
// from the peak to the day the peak is regained (or to the end: regained false); and the longest stretch under a peak
export function drawdown(v, { equity = false } = {}) {
  let c = 0, pk = 0, pkI = -1, dd = 0, at = null, longest = 0;
  const eq = [];
  for (let i = 0; i < v.length; i++) {
    c = equity ? v[i] : c + v[i]; eq.push(c);
    if (c >= pk) { pk = c; pkI = i; }
    else { longest = Math.max(longest, i - pkI); if (pk - c > dd) { dd = pk - c; at = { peak: pkI, trough: i, level: pk }; } }
  }
  let len = 0, regained = true;
  if (at) { let j = at.trough; while (j < eq.length && eq[j] < at.level) j++; regained = j < eq.length; len = (regained ? j : eq.length - 1) - at.peak; }
  return { dd, len, regained, longest, peak: at ? at.peak : null, trough: at ? at.trough : null };
}
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// month-block bootstrap of one or more daily series (the same draw of months for each): fn(seriesList) → number
export function bootstrap(days, list, fn, draws = 2000, seed = 1) {
  const months = [...new Set(days.map((d) => d.slice(0, 7)))], byM = new Map(months.map((k) => [k, []]));
  days.forEach((d, i) => byM.get(d.slice(0, 7)).push(i));
  const rnd = mulberry32(seed), out = [];
  for (let k = 0; k < draws; k++) {
    const idx = []; for (let j = 0; j < months.length; j++) for (const i of byM.get(months[Math.floor(rnd() * months.length)])) idx.push(i);
    out.push(fn(list.map((v) => idx.map((i) => v[i]))));
  }
  const s = out.filter(Number.isFinite).sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { lo: q(0.05), mid: q(0.5), hi: q(0.95), pGt0: out.filter((x) => x > 0).length / out.length };
}
const yearsOf = (from, to) => (Date.parse(to) - Date.parse(from)) / 86400e3 / 365.25 + 1 / 365.25;

// ── a book over a window ──
export function daily(pos, days) { const ix = new Map(days.map((d, i) => [d, i])), v = new Array(days.length).fill(0); let n = 0; for (const p of pos) { const i = ix.get(p.day); if (i != null) { v[i] += p.n; n++; } } return { v, n }; }
// open units at each day's close, and the marked equity path: closed net to date + Σ open units (close − entry) / r0
export function marked(legs, days, closes, v) {
  const open = new Array(days.length).fill(0), eq = new Array(days.length).fill(0); let c = 0, last = null;
  const U = legs.slice().sort((a, b) => a.t - b.t);
  for (let i = 0; i < days.length; i++) {
    c += v[i]; const e = endOf(days[i]); if (closes.has(days[i])) last = closes.get(days[i]);
    let m = 0;
    for (const u of U) { if (u.t >= e) break; if (u.c >= e) { open[i]++; if (last != null) m += (last - u.e) / u.r0; } }
    eq[i] = c + m;
  }
  return { open, eq };
}
export function bookStats(legs, systems, W, opt, closes) {
  const days = weekdays(W.from, W.to), yrs = yearsOf(W.from, W.to), L = legs.filter((u) => systems.includes(u.sys));
  const pos = positions(L, opt).filter((p) => p.day >= W.from && p.day <= W.to);
  const per = Object.fromEntries(systems.map((s) => [s, daily(pos.filter((p) => p.sys === s), days).v]));
  const v = days.map((_, i) => sum(systems.map((s) => per[s][i])));
  const total = sum(v), d = drawdown(v), pn = pos.map((p) => p.n);
  const M = new Map(), Y = new Map(); days.forEach((dd, i) => { M.set(dd.slice(0, 7), (M.get(dd.slice(0, 7)) || 0) + v[i]); Y.set(dd.slice(0, 4), (Y.get(dd.slice(0, 4)) || 0) + v[i]); });
  const mv = [...M.values()], ys = [...Y].map(([y, x]) => [y, x]), worst = ys.slice().sort((a, b) => a[1] - b[1])[0];
  const mk = closes ? marked(L, days, closes, v) : null, md = mk ? drawdown(mk.eq, { equity: true }) : null;
  const monthly = (s) => { const m = new Map(); days.forEach((dd, i) => m.set(dd.slice(0, 7), (m.get(dd.slice(0, 7)) || 0) + per[s][i])); return [...m.values()]; };
  const pairs = {}; for (let i = 0; i < systems.length; i++) for (let j = i + 1; j < systems.length; j++) pairs[`${systems[i]}~${systems[j]}`] = { daily: r2(corr(per[systems[i]], per[systems[j]])), monthly: r2(corr(monthly(systems[i]), monthly(systems[j]))) };
  const openBy = closes ? Object.fromEntries(systems.map((s) => [s, marked(L.filter((u) => u.sys === s), days, closes, per[s]).open])) : null;
  const out = {
    positions: pos.length, units: sum(pos.map((p) => p.units)), total: r1(total), perYear: r2(total / yrs), years: r2(yrs),
    perPosition: r3(mean(pn)), tPosition: r2(tOf(pn)), tDaily: r2(tOf(v)), tMonthly: r2(tOf(mv)), days: days.length,
    maxDD: r1(d.dd), ddDays: d.len, ddRegained: d.regained, ddFrom: d.peak != null ? (d.peak < 0 ? W.from : days[d.peak]) : null, ddTo: d.trough != null ? days[d.trough] : null, longestUnder: d.longest,
    retDD: d.dd > 0 ? r2(total / d.dd) : null, worstYear: worst ? { year: worst[0], R: r1(worst[1]) } : null, posYears: `${ys.filter((y) => y[1] > 0).length}/${ys.length}`,
    posMonths: r2(mv.filter((x) => x > 0).length / mv.length), byYear: Object.fromEntries(ys.map(([y, x]) => [y, r1(x)])),
    halves: W.halves.map(([a, b]) => { const hv = v.filter((_, i) => days[i] >= a && days[i] <= b); return { from: a, to: b, total: r1(sum(hv)), tDaily: r2(tOf(hv)), maxDD: r1(drawdown(hv).dd) }; }),
    financing: r1(sum(pos.map((p) => p.fin))), financingPerYear: r2(sum(pos.map((p) => p.fin)) / yrs), cost: r1(sum(pos.map((p) => p.cost))), gross: r1(sum(pos.map((p) => p.g))),
    bySystem: Object.fromEntries(systems.map((s) => { const q = pos.filter((p) => p.sys === s), a = q.map((p) => p.n); return [s, { positions: q.length, total: r1(sum(a)), perPosition: r3(mean(a)), tPosition: r2(tOf(a)), tDaily: r2(tOf(per[s])), maxDD: r1(drawdown(per[s]).dd), financing: r1(sum(q.map((p) => p.fin))) }]; })),
    corr: pairs,
  };
  if (mk) {
    out.marked = { maxDD: r1(md.dd), ddDays: md.len, ddRegained: md.regained, ddFrom: md.peak != null && md.peak >= 0 ? days[md.peak] : W.from, ddTo: md.trough != null ? days[md.trough] : null, longestUnder: md.longest, retDD: md.dd > 0 ? r2(total / md.dd) : null };
    out.inMarket = { share: r3(mk.open.filter((x) => x > 0).length / days.length), meanUnits: r2(mean(mk.open)), maxUnits: Math.max(...mk.open),
      bySystem: Object.fromEntries(systems.map((s) => [s, r3(openBy[s].filter((x) => x > 0).length / days.length)])),
      all: r3(days.filter((_, i) => systems.every((s) => openBy[s][i] > 0)).length / days.length) };
  }
  return { out, days, v, per, yrs };
}

// ── run ──
function makeLegs(file) {
  const T = J(file), out = [];
  for (const x of T) { if (!SYS.includes(x.k) || x.status !== 'closed') continue;
    out.push({ sys: x.k, id: x.id, ...(x.addOf ? { of: x.addOf } : {}), t: x.filled ?? x.opened, c: x.closed, e: x.entry, r0: +x.r0.toFixed(4), R: x.R, ...(x.atEnd ? { end: true } : {}) }); }
  fs.writeFileSync(path.join(HERE, 'legs.json'), JSON.stringify({ note: 'units of gtrend, gtrend5 and geg from research/edge/gold-systems-oos/replay.mjs (not edited), run on the same OANDA gold candles; t / c unix seconds (fill, close), e entry, r0 initial risk, R gross as booked, of = the first unit of an add', units: out }));
  console.log('legs.json', out.length);
}
export function gate(legs, ref) {
  const mine = new Map(positions(legs, { mult: 0, fin: 0 }).map((p) => [p.id, p])), want = ref.filter((p) => SYS.includes(p.sys));
  let bad = 0; for (const p of want) { const m = mine.get(p.id); if (!m || Math.abs(m.g - p.g) > 0.002 || new Date(m.c * 1000).toISOString().slice(0, 16) !== p.c) bad++; }
  return { reference: want.length, mine: mine.size, mismatched: bad, ok: bad === 0 && mine.size === want.length };
}
export function verdict(w1) {
  const a = w1.x1F1, tests = { t: a.tDaily, tPass: a.tDaily != null && a.tDaily >= BAR.t, halves: a.halves.map((h) => h.total), halvesPass: a.halves.every((h) => h.total > 0), x2: w1.x2F1.total, x2Pass: w1.x2F1.total > 0 };
  return { pass: tests.tPass && tests.halvesPass && tests.x2Pass, positive: a.total > 0, tests };
}
function main() {
  const legs = J(path.join(HERE, 'legs.json')).units, ref = J(path.join(HERE, '../gold-systems-oos/result.json')).positions;
  const g = gate(legs, ref);
  if (!g.ok) { console.error('gate failed', g); process.exit(1); }
  const closes = new Map(J(path.join(HERE, '../honest-book/gold-1d.json')).bars.map(([t, c]) => [dayOf(t), c]).filter(([d]) => dow(d) !== 0 && dow(d) !== 6));
  const VAR = { x1F1: { mult: 1, fin: 1 }, x1Fh: { mult: 1, fin: 0.5 }, x1F0: { mult: 1, fin: 0 }, x2F1: { mult: 2, fin: 1 } };
  const out = { built: '2026-11-11', prereg: 'research/edge/supported-book/PREREGISTRATION.md', rule: 'paper research only: no live rule, size, filter, stop or config changes',
    costs: { roundTrip: COST, financingRate: RATE, financingSrc: FIN.xau.src, risk: RISK }, gate: g, books: BOOKS, windows: {} };
  for (const [wk, W] of Object.entries(WINDOWS)) {
    const w = (out.windows[wk] = { label: W.label, from: W.from, to: W.to });
    for (const [bk, systems] of Object.entries(BOOKS)) {
      w[bk] = {};
      for (const [vk, opt] of Object.entries(VAR)) {
        const b = bookStats(legs, systems, W, opt, closes); w[bk][vk] = b.out;
        if (vk === 'x1F1') {
          const perYear = bootstrap(b.days, [b.v], ([v]) => sum(v) / b.yrs), rd = bootstrap(b.days, [b.v], ([v]) => { const d = drawdown(v).dd; return d > 0 ? sum(v) / d : NaN; });
          w[bk].bootstrap = { draws: 2000, perYear: { lo: r1(perYear.lo), mid: r1(perYear.mid), hi: r1(perYear.hi), pGt0: r3(perYear.pGt0) }, retDD: { lo: r2(rd.lo), mid: r2(rd.mid), hi: r2(rd.hi) } };
          const o = b.out;
          w[bk].aYear = { risk: '0.25 % of the account a unit', pct: r2(o.perYear * RISK * 100), pctLo: r2(perYear.lo * RISK * 100), pctHi: r2(perYear.hi * RISK * 100), ddPct: r2(o.maxDD * RISK * 100), ddMarkedPct: r2(o.marked.maxDD * RISK * 100) };
        }
      }
    }
  }
  const v = verdict(out.windows.W1.S2), a = out.windows.W1.S2.x1F1;
  out.verdictDetail = v;
  out.verdict = `${v.pass ? 'PASS' : 'FAIL'}: on untouched 2006-17, after costs and financing on every unit, the two-system book made ${a.total > 0 ? '+' : ''}${a.total}R (${a.perYear > 0 ? '+' : ''}${a.perYear}R a year, ${a.positions} positions, t ${a.tDaily} on daily book R), worst drawdown ${a.maxDD}R closed and ${a.marked.maxDD}R marked to market`;
  out.sizingStudy = { run: a.total > 0, why: a.total > 0 ? 'S2 is positive on W1 at x1, F1: the pre-registered add on / off comparison follows (research/edge/book-sizing)' : 'S2 is not positive on W1: no sizing study' };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
  console.log(out.verdict); console.log(JSON.stringify(v));
  for (const wk of Object.keys(WINDOWS)) for (const bk of Object.keys(BOOKS)) { const o = out.windows[wk][bk]; for (const vk of Object.keys(VAR)) { const x = o[vk]; console.log(wk, bk, vk, 'n', x.positions, 'tot', x.total, '/yr', x.perYear, 'tD', x.tDaily, 'tM', x.tMonthly, 'tP', x.tPosition, 'DD', x.maxDD, x.ddDays, x.ddRegained, 'mDD', x.marked.maxDD, x.marked.ddDays, 'worst', JSON.stringify(x.worstYear), x.posYears, 'halves', x.halves.map((h) => h.total).join('/'), 'fin', x.financing); }
    console.log('   ', JSON.stringify(o.bootstrap), JSON.stringify(o.aYear), JSON.stringify(o.x1F1.corr), JSON.stringify(o.x1F1.inMarket)); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { if (process.argv[2] === 'legs') makeLegs(process.argv[3]); else main(); }
