// Edge research · book-sizing (PREREGISTRATION.md, committed first): the supported two-system book with the Gold trend
// pyramid add (as live) against the same book without it, on untouched 2006-17, net of costs and financing on every unit.
// Reads research/edge/supported-book/legs.json through that study's own functions (imported, not edited). No network.
//   node run.mjs      writes result.json next to this file
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WINDOWS, bookStats, bootstrap, drawdown, unitNet, tOf, dayOf } from '../supported-book/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d)), r2 = rN(2), r3 = rN(3);
export const BAR = { hi: 0.95, lo: 0.05 };
export const BOOK = { S2: ['gtrend', 'geg'], S3: ['gtrend', 'geg', 'gtrend5'] };
// OFF = every add unit left out (only the trend legs have one)
export const noAdd = (legs) => legs.filter((u) => !u.of);
const sum = (a) => a.reduce((s, x) => s + x, 0);
export const retDD = (v) => { const d = drawdown(v).dd; return d > 0 ? sum(v) / d : NaN; };

export function compare(legs, systems, W, opt, closes) {
  const on = bookStats(legs, systems, W, opt, closes), off = bookStats(noAdd(legs), systems, W, opt, closes);
  const half = (b, [a, z]) => retDD(b.v.filter((_, i) => b.days[i] >= a && b.days[i] <= z));
  const boot = bootstrap(on.days, [on.v, off.v], ([a, b]) => retDD(b) - retDD(a));
  const pick = (o) => ({ positions: o.positions, units: o.units, total: o.total, perYear: o.perYear, tDaily: o.tDaily, maxDD: o.maxDD, ddDays: o.ddDays, ddRegained: o.ddRegained, retDD: o.retDD, marked: o.marked, financing: o.financing, worstYear: o.worstYear, halves: o.halves, trend: o.bySystem.gtrend });
  return { on: pick(on.out), off: pick(off.out), D: r2(retDD(off.v) - retDD(on.v)), halves: W.halves.map((h) => r2(half(off, h) - half(on, h))),
    bootstrap: { draws: 2000, pGt0: r3(boot.pGt0), lo: r2(boot.lo), mid: r2(boot.mid), hi: r2(boot.hi) } };
}
export function reading(x1, x2) {
  const t = { p: x1.bootstrap.pGt0, D: x1.D, halves: x1.halves, x2: x2.D };
  const off = t.p >= BAR.hi && t.halves.every((d) => d > 0) && t.x2 > 0, on = t.p <= BAR.lo && t.halves.every((d) => d < 0) && t.x2 < 0;
  return { reading: off ? 'OFF is better, beyond noise' : on ? 'ON is better, beyond noise' : 'within noise', tests: t };
}
function main() {
  const legs = J(path.join(HERE, '../supported-book/legs.json')).units;
  const closes = new Map(J(path.join(HERE, '../honest-book/gold-1d.json')).bars.map(([t, c]) => [dayOf(t), c]).filter(([d]) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w !== 0 && w !== 6; }));
  const VAR = { x1F1: { mult: 1, fin: 1 }, x2F1: { mult: 2, fin: 1 }, x1Fh: { mult: 1, fin: 0.5 }, x1F0: { mult: 1, fin: 0 } };
  const out = { built: '2026-11-11', prereg: 'research/edge/book-sizing/PREREGISTRATION.md', rule: 'paper research only: no live rule, size, filter, stop or config changes', windows: {} };
  for (const [wk, W] of Object.entries(WINDOWS)) { out.windows[wk] = { label: W.label }; for (const bk of Object.keys(BOOK)) { out.windows[wk][bk] = {}; for (const [vk, opt] of Object.entries(VAR)) out.windows[wk][bk][vk] = compare(legs, BOOK[bk], W, opt, closes); } }
  // the add units by themselves, W1 by close day
  out.adds = {};
  for (const s of ['gtrend', 'gtrend5']) for (const [wk, W] of Object.entries(WINDOWS)) {
    const A = legs.filter((u) => u.sys === s && u.of && dayOf(u.c) >= W.from && dayOf(u.c) <= W.to), x = A.map((u) => unitNet(u)), n = x.map((y) => y.n);
    (out.adds[s] = out.adds[s] || {})[wk] = { n: A.length, total: r2(sum(n)), mean: r3(sum(n) / A.length), t: r2(tOf(n)), gross: r2(sum(A.map((u) => u.R))), financing: r2(sum(x.map((y) => y.fin))), win: r2(n.filter((y) => y > 0).length / A.length) };
  }
  const w = out.windows.W1.S2, rd = reading(w.x1F1, w.x2F1);
  out.readingDetail = rd;
  out.verdict = `${rd.reading === 'OFF is better, beyond noise' ? 'PASS' : 'FAIL'}: ${rd.reading}${rd.reading === 'OFF is better, beyond noise' ? '' : ' (no proposal, the live rule stays)'}. On untouched 2006-17 after costs and financing the book with the Gold trend add made ${w.x1F1.on.total}R on a ${w.x1F1.on.maxDD}R drawdown (return ÷ drawdown ${w.x1F1.on.retDD}), without it ${w.x1F1.off.total}R on ${w.x1F1.off.maxDD}R (${w.x1F1.off.retDD}); difference ${w.x1F1.D}, bootstrap P(off better) ${w.x1F1.bootstrap.pGt0}`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
  console.log(out.verdict); console.log(JSON.stringify(rd)); console.log(JSON.stringify(out.adds));
  for (const wk of Object.keys(WINDOWS)) for (const bk of Object.keys(BOOK)) for (const vk of Object.keys(VAR)) { const c = out.windows[wk][bk][vk]; console.log(wk, bk, vk, 'ON', c.on.total, c.on.perYear, c.on.tDaily, c.on.maxDD, c.on.retDD, 'mk', c.on.marked.maxDD, 'OFF', c.off.total, c.off.perYear, c.off.tDaily, c.off.maxDD, c.off.retDD, 'mk', c.off.marked.maxDD, 'D', c.D, c.halves.join('/'), JSON.stringify(c.bootstrap), 'trend', JSON.stringify(c.on.trend), JSON.stringify(c.off.trend)); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
