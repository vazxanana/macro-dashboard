// Edge research · gold-systems-oos: statistics and the pre-registered verdicts (preregistration.md).
//   node analyze.mjs <replay trades.json> [control.json] > result.json
// A position = the first unit plus its add (trend legs); R summed over legs; costs 0.30 per unit round trip (x1) or 0.60 (x2),
// charged as cost / r0 on every leg. Positions are dated by entry (the fill for a limit order); expired / missed orders are not
// positions. Max drawdown on the closed-position equity curve (ordered by close).
import fs from 'node:fs';

const [REP, CTL] = process.argv.slice(2);
const legs = JSON.parse(fs.readFileSync(REP, 'utf8'));
const control = CTL && fs.existsSync(CTL) ? JSON.parse(fs.readFileSync(CTL, 'utf8')) : null;
const SYS = ['gtrend', 'gtrend5', 'gtl', 'geg'];
const D = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const P = { oos: [D('2006-07-01'), D('2018-01-01')], h1: [D('2006-07-01'), D('2012-01-01')], h2: [D('2012-01-01'), D('2018-01-01')], cal: [D('2018-01-01'), D('2026-11-07')],
  s2019_22: [D('2019-01-01'), D('2023-01-01')], s2023_24: [D('2023-01-01'), D('2025-01-01')], s2025_26: [D('2025-01-01'), D('2026-11-07')] };
const yearOf = (t) => new Date(t * 1000).getUTCFullYear(), monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);

// positions
const byRoot = new Map();
for (const x of legs) { if (x.status === 'expired' || x.status === 'missed') continue; const r = x.addOf || x.id; if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(x); }
const pos = [];
for (const [id, L] of byRoot) {
  const first = L.find((x) => !x.addOf); if (!first) continue;
  const cost = (m) => L.reduce((a, x) => a + (x.R - m * 0.30 / x.r0) * (x.size || 1), 0);
  pos.push({ sys: first.k, id, t: first.filled ?? first.opened, c: Math.max(...L.map((x) => x.closed)), g: cost(0), n: cost(1), n2: cost(2), add: L.length > 1, atEnd: L.some((x) => x.atEnd),
    r0: first.r0, exit: first.exit });
}
pos.sort((a, b) => a.t - b.t);

const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
function stats(rows, key = 'n') {
  const a = rows.slice().sort((x, y) => x.c - y.c), v = a.map((x) => x[key]), n = v.length;
  if (!n) return { n: 0 };
  const R = v.reduce((p, x) => p + x, 0), mean = R / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
  return { n, win: r3(v.filter((x) => x > 0).length / n), mean: r3(mean), R: r2(R), t: n > 1 && sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, maxDD: r2(dd) };
}
const inP = (rows, [a, b]) => rows.filter((x) => x.t >= a && x.t < b);
// deterministic bootstrap (LCG) of the mean: positions, and calendar-month blocks (months with a position, by entry)
function boot(rows, key, blocks = false, B = 10000) {
  let s = 987654321; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const units = blocks ? [...rows.reduce((m, x) => m.set(monthOf(x.t), [...(m.get(monthOf(x.t)) || []), x[key]]), new Map()).values()] : rows.map((x) => [x[key]]);
  const k = units.length; if (k < 2) return null;
  const means = [];
  for (let b = 0; b < B; b++) { let sum = 0, cnt = 0; for (let i = 0; i < k; i++) { const u = units[Math.floor(rnd() * k)]; for (const v of u) { sum += v; cnt++; } } means.push(sum / cnt); }
  means.sort((x, y) => x - y);
  return { lo: r3(means[Math.floor(0.025 * B)]), hi: r3(means[Math.floor(0.975 * B)]), pLE0: r3(means.filter((m) => m <= 0).length / B), units: k };
}

const out = { note: 'net R per position; x1 = 0.30 per unit round trip, x2 = 0.60; OOS = entries 2006-07-01 .. 2017-12-31; calibration = 2018-01-01 .. 2026-11-06', systems: {} };
for (const k of SYS) {
  const rows = pos.filter((x) => x.sys === k), o = inP(rows, P.oos);
  const S = { periods: {}, years: {}, boot: {} };
  for (const [pk, rg] of Object.entries(P)) { const r = inP(rows, rg); S.periods[pk] = { x1: stats(r), x2: stats(r, 'n2'), gross: stats(r, 'g') }; }
  for (let y = 2006; y <= 2026; y++) { const r = rows.filter((x) => yearOf(x.t) === y); S.years[y] = { x1: stats(r), x2: stats(r, 'n2') }; }
  S.boot = { oos_x1: boot(o, 'n'), oos_x2: boot(o, 'n2'), oos_x1_months: boot(o, 'n', true), oos_x2_months: boot(o, 'n2', true), cal_x1: boot(inP(rows, P.cal), 'n'), cal_x1_months: boot(inP(rows, P.cal), 'n', true) };
  S.adds = { oos: o.filter((x) => x.add).length };
  S.medianStop = { oos: r2(o.map((x) => x.r0).sort((a, b) => a - b)[Math.floor(o.length / 2)] || 0), cal: r2(inP(rows, P.cal).map((x) => x.r0).sort((a, b) => a - b)[Math.floor(inP(rows, P.cal).length / 2)] || 0) };
  // ── pre-registered verdict ──
  const po = S.periods.oos, cal = S.periods.cal.x1, yrs = Object.entries(S.years).filter(([y, v]) => +y >= 2006 && +y <= 2017 && v.x1.n);
  const tests = {
    'x1 mean > 0': po.x1.mean > 0, 'x2 mean > 0': po.x2.mean > 0,
    '1 t >= 2.0': (po.x1.t ?? 0) >= 2,
    '2 bootstrap CI lower > 0': (S.boot.oos_x1?.lo ?? -1) > 0,
    '3 both halves > 0': (S.periods.h1.x1.mean ?? -1) > 0 && (S.periods.h2.x1.mean ?? -1) > 0,
    '4 >= half of years positive': yrs.filter(([, v]) => v.x1.R > 0).length >= yrs.length / 2,
    '5 maxDD within 2x calibration': po.x1.maxDD >= 2 * cal.maxDD,
  };
  const fails = !tests['x1 mean > 0'] || !tests['x2 mean > 0'];
  const robust = !fails && ['1 t >= 2.0', '2 bootstrap CI lower > 0', '3 both halves > 0', '4 >= half of years positive', '5 maxDD within 2x calibration'].every((t) => tests[t]);
  S.verdict = { tests, yearsPositive: `${yrs.filter(([, v]) => v.x1.R > 0).length}/${yrs.length}`, verdict: fails ? 'fails' : robust ? 'robust' : 'regime-bound',
    missed: Object.entries(tests).filter(([, v]) => !v).map(([t]) => t), bullOnly: (S.periods.h1.x1.mean ?? 0) > 0 && !((S.periods.h2.x1.mean ?? 0) > 0) };
  out.systems[k] = S;
}

// ── correlation: monthly net R (x1) by close month over every OOS calendar month ──
const months = []; for (let y = 2006; y <= 2017; y++) for (let m = 1; m <= 12; m++) { const s = `${y}-${String(m).padStart(2, '0')}`; if (s >= '2006-07') months.push(s); }
const monthly = (k, key = 'n') => { const m = new Map(months.map((x) => [x, 0])); for (const p of pos.filter((x) => x.sys === k && x.t >= P.oos[0] && x.t < P.oos[1])) { const mo = monthOf(Math.min(p.c, P.oos[1] - 1)); if (m.has(mo)) m.set(mo, m.get(mo) + p[key]); } return months.map((x) => m.get(x)); };
const corr = (a, b) => { const n = a.length, ma = a.reduce((p, x) => p + x, 0) / n, mb = b.reduce((p, x) => p + x, 0) / n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return r2(sab / Math.sqrt(saa * sbb)); };
const M = Object.fromEntries(SYS.map((k) => [k, monthly(k)]));
out.correlation = { months: months.length, pairs: {} };
for (let i = 0; i < SYS.length; i++) for (let j = i + 1; j < SYS.length; j++) out.correlation.pairs[`${SYS[i]}~${SYS[j]}`] = corr(M[SYS[i]], M[SYS[j]]);
// overlap in time: share of each system's OOS positions entered while another system had a position open
const openAt = (k, t) => pos.some((p) => p.sys === k && p.t <= t && p.c > t);
out.overlap = {}; for (const a of SYS) { const o = pos.filter((p) => p.sys === a && p.t >= P.oos[0] && p.t < P.oos[1]); out.overlap[a] = Object.fromEntries(SYS.filter((b) => b !== a).map((b) => [b, r2(o.filter((p) => openAt(b, p.t)).length / Math.max(1, o.length))])); }
// equal-weight books (1 unit of risk per position in each system): monthly R
function book(ks) {
  const s = months.map((_, i) => ks.reduce((a, k) => a + M[k][i], 0)), n = s.length, mean = s.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(s.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of s) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { R: r2(eq), monthlyMean: r3(mean), tMonthly: r2(mean / sd * Math.sqrt(n)), maxDD: r2(dd), retPerDD: dd < 0 ? r2(eq / -dd) : null, posMonths: r3(s.filter((x) => x > 0).length / n) };
}
out.books = { all4: book(SYS), ...Object.fromEntries(SYS.map((k) => [k, book([k])])), trendPair: book(['gtrend', 'gtrend5']), gtrend_geg: book(['gtrend', 'geg']), gtrend_gtl: book(['gtrend', 'gtl']) };
if (control) out.control = control;
// ── diagnostics (not part of the verdict) ──
// trend legs without the add: the first unit alone (the add never changes the first unit's exit)
out.diagnostics = { firstUnitOnly: {} };
for (const k of ['gtrend', 'gtrend5']) {
  const rows = legs.filter((x) => x.k === k && !x.addOf).map((x) => ({ t: x.filled ?? x.opened, c: x.closed, n: x.R - 0.30 / x.r0, n2: x.R - 0.60 / x.r0, g: x.R }));
  out.diagnostics.firstUnitOnly[k] = Object.fromEntries(['oos', 'h1', 'h2', 'cal'].map((p) => [p, { x1: stats(inP(rows, P[p])), x2: stats(inP(rows, P[p]), 'n2') }]));
}
// gold's own calendar-year change (OANDA D1 closes) next to each system's year, and their correlation over 2006-2017
if (process.env.CANDLES) {
  const zlib = await import('node:zlib'), path = await import('node:path');
  const D1 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-1d.json.gz'))));
  const yc = {}; for (const r of D1) { const y = yearOf(r[0]); (yc[y] = yc[y] || { first: r[1], last: r[4] }).last = r[4]; }
  const gy = {}; for (let y = 2006; y <= 2026; y++) if (yc[y]) gy[y] = r3((yc[y].last / (yc[y - 1] ? yc[y - 1].last : yc[y].first) - 1));
  out.diagnostics.goldYear = gy;
  const ys = Array.from({ length: 12 }, (_, i) => 2006 + i);
  out.diagnostics.corrWithGoldYear = Object.fromEntries(SYS.map((k) => [k, corr(ys.map((y) => out.systems[k].years[y].x1.R || 0), ys.map((y) => gy[y]))]));
}
out.positions = pos.map((p) => ({ sys: p.sys, id: p.id, t: new Date(p.t * 1000).toISOString().slice(0, 16), c: new Date(p.c * 1000).toISOString().slice(0, 16), g: r3(p.g), n: r3(p.n), n2: r3(p.n2), add: p.add, r0: r2(p.r0), atEnd: p.atEnd || undefined }));
console.log(JSON.stringify(out, null, 1));
