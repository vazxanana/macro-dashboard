// Edge research · macroscore-overlay: the Gold Macro Score (council/macroscore.mjs, #592) as the macro-agent-demo skill's
// sizing rule ("half risk normally, full planned risk when the score is above +0.25") on the council's long-only gold systems,
// on gold they never saw. Pre-registration: preregistration.md, committed before this ran. Runs ONCE on GitHub Actions
// (.github/workflows/macroscore-overlay.yml), where FRED answers; the research sandbox blocks it. Paper only: changes no rule.
//
//   node research/edge/macroscore-overlay/run.mjs <outFile>
//   env: FRED_DIR=<dir with DFII10.csv, DGS2.csv, DGS10.csv>   (offline: fredgraph.csv files instead of fetching)
//        DAILY_DIR=<dir with eurusd.json ... xau.json>           (default data/research/daily, the council-data daily cache)
//        POS_DIR=<research/edge>                                 (default: this file's parent; gold-systems-oos + mosha-oos result.json)
// The score itself comes from council/macroscore.mjs (weeklyFrame / expandingZ, the same raw diffs as goldMacroScore) and is
// self-checked against goldMacroScore({ asOf: friday }) at every week. Every bar in the pre-registration is applied below.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { goldMacroScore, weeklyFrame, expandingZ, dxyDaily, dailyRows, FROM, MIN_OBS, CLIP, isoDay } from '../../../council/macroscore.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), EDGE = process.env.POS_DIR || path.join(HERE, '..');
const DAY = 86400;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const r1 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(1)), r2 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(2));
const r3 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(3)), r4 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(4));
const sum = (a) => a.reduce((s, x) => s + x, 0), mean = (a) => (a.length ? sum(a) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : NaN; };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ─── pre-registered constants ─────────────────────────────────────────────────────────────────────────────────────────────
export const THRESH = 0.25, HALF = 0.5;
export const LAG = { primary: 5, sens: 2 };            // days after the Friday label before a week's score is usable
export const WINDOWS = {
  U: { label: 'untouched 2006-07 .. 2017-12', from: '2006-07-01', to: '2017-12-31', halves: [['2006-07-01', '2011-12-31'], ['2012-01-01', '2017-12-31']] },
  B: { label: 'built-on 2018-01 .. 2026-10', from: '2018-01-01', to: '2026-10-31', halves: [['2018-01-01', '2022-12-31'], ['2023-01-01', '2026-10-31']] },
  R: { label: 'recent 2023-01 .. 2026-10', from: '2023-01-01', to: '2026-10-31', halves: [['2023-01-01', '2024-11-30'], ['2024-12-01', '2026-10-31']] },
};
export const H0 = { from: '2007-01-05', periods: { '2007-14': ['2007-01-01', '2014-12-31'], '2015-21': ['2015-01-01', '2021-12-31'], '2022-26': ['2022-01-01', '2026-12-31'] }, icTarget: 0.15, icTol: 0.05, tMin: 2, nwLags: 3 };
export const LONG_SYS = ['gtrend', 'gtrend5', 'geg', 'gtl', 'mosha-bo'];
export const BOOKS = { B: ['gtrend', 'geg', 'mosha-bo', 'gtl'], C: ['gtrend', 'geg', 'mosha-bo', 'gtl', 'gtrend5'] };
const NAME = { gtrend: 'Gold trend N20', gtrend5: 'Gold trend fast N5', geg: 'Gold daily engulf', gtl: 'Gold H4 trendline', 'mosha-bo': 'Mosha BO' };
const BOOT = 2000, PERM = 10000, FRED_FROM = '2003-01-01', S2_FROM = '2003-06-01';

// ─── data ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function parseFredCsv(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '') || v == null || v.trim() === '' || v.trim() === '.') continue;
    const x = +v; if (isFinite(x)) out.push({ t: T(d), v: x });
  }
  return out.sort((a, b) => a.t - b.t);
}
const HEAD = [[{ 'User-Agent': 'macro-dashboard-council/1.0 (+https://meridianx.dev)', Accept: 'text/csv,*/*' }, 30000],
  [{ 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' }, 20000]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fred(id) {
  if (process.env.FRED_DIR) { const f = path.join(process.env.FRED_DIR, `${id}.csv`); return fs.existsSync(f) ? { obs: parseFredCsv(fs.readFileSync(f, 'utf8')), src: `file ${f}` } : { obs: [], src: `missing ${f}` }; }
  let err = 'empty';
  for (let k = 0; k < 3; k++) for (const [h, ms] of HEAD) {
    try { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${FRED_FROM}`, { headers: h, signal: AbortSignal.timeout(ms) });
      if (r.ok) { const obs = parseFredCsv(await r.text()); if (obs.length) return { obs, src: `FRED ok, ${obs.length} obs to ${isoDay(obs[obs.length - 1].t)}` }; err = 'empty'; } else err = `HTTP ${r.status}`; }
    catch (e) { err = String((e && e.message) || e).slice(0, 80); }
    await sleep(2000 * (k + 1));
  }
  return { obs: [], src: `FRED failed (${err})` };
}
function readDaily(dir, k) { try { return dailyRows(JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), 'utf8'))); } catch (e) { return []; } }

// ─── the weekly score series (council/macroscore.mjs pieces; the same raw drivers as goldMacroScore) ─────────────────────
const diffN = (a, n, f = (x, y) => x - y) => a.map((v, i) => (i >= n && v != null && a[i - n] != null ? f(v, a[i - n]) : null));
export function scoreSeries(S, from = FROM) {
  const F = weeklyFrame({ ry: S.ry, y2: S.y2, y10: S.y10, dxy: S.dxy }, from), W = F.weeks, C = F.cols;
  const cv = C.y10.map((v, i) => (v != null && C.y2[i] != null ? v - C.y2[i] : null));
  const raw = { ry4w: diffN(C.ry, 4).map((v) => (v == null ? null : -v)), dxy4w: diffN(C.dxy, 4, (a, b) => -(Math.log(a) - Math.log(b))), y2_13w: diffN(C.y2, 13).map((v) => (v == null ? null : -v)), curve13w: diffN(cv, 13) };
  const z = Object.fromEntries(Object.entries(raw).map(([k, a]) => [k, expandingZ(a, MIN_OBS, CLIP)])), keys = Object.keys(raw);
  const score = W.map((_, i) => (keys.every((k) => z[k][i] != null) ? keys.reduce((s, k) => s + z[k][i], 0) / keys.length : null));
  return { weeks: W, score, z };
}
// every week's value must equal goldMacroScore evaluated as of that Friday (no look-ahead in the series)
export function selfCheck(S, series, from = FROM) {
  let checked = 0, bad = 0, first = null;
  for (let i = 0; i < series.weeks.length; i++) {
    if (series.score[i] == null) continue;
    const g = goldMacroScore(S, { from, asOf: series.weeks[i] });
    checked++;
    if (!g.ok || g.asOf !== isoDay(series.weeks[i]) || g.score !== r2(series.score[i])) { bad++; if (!first) first = { week: isoDay(series.weeks[i]), series: r2(series.score[i]), gold: g.ok ? g.score : g.why, asOf: g.asOf }; }
  }
  return { checked, bad, ok: checked > 0 && bad === 0, first };
}
// the score usable at time t: the latest week whose Friday + lag days <= t
export function scoreAt(series, t, lagDays) {
  const W = series.weeks; let lo = 0, hi = W.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (W[m] + lagDays * DAY <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  for (let i = r; i >= 0; i--) if (series.score[i] != null) return { score: series.score[i], week: isoDay(W[i]) };   // the latest week with a score
  return { score: null, week: null };
}

// ─── statistics ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function ranks(a) { const idx = a.map((v, i) => i).sort((i, j) => a[i] - a[j]), r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; }
// Spearman IC = slope of standardised ranks; Newey-West (Bartlett) t with L lags, plus the plain t
export function spearmanNW(x, y, L) {
  const n = x.length; if (n < 10) return { n, ic: null, tNW: null, t: null };
  const std = (a) => { const m = mean(a), s = sd(a); return a.map((v) => (v - m) / s); };
  const rx = std(ranks(x)), ry = std(ranks(y));
  const sxx = sum(rx.map((v) => v * v)), b = sum(rx.map((v, i) => v * ry[i])) / sxx, u = rx.map((v, i) => v * (ry[i] - b * v));
  let lrv = 0; for (let k = -L; k <= L; k++) { const w = 1 - Math.abs(k) / (L + 1); let g = 0; for (let t = Math.abs(k); t < n; t++) g += u[t] * u[t - Math.abs(k)]; lrv += w * g; }
  const tNW = b / Math.sqrt(lrv / (sxx * sxx)), t = b * Math.sqrt((n - 2) / (1 - b * b));
  return { n, ic: r4(b), tNW: r2(tNW), t: r2(t) };
}
export function welch(a, b) { if (a.length < 2 || b.length < 2) return null; const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length; return r2((mean(a) - mean(b)) / Math.sqrt(va + vb)); }
export function permP(a, b, draws = PERM, seed = 2) {   // P(permuted diff >= observed), labels shuffled
  if (!a.length || !b.length) return null; const all = a.concat(b), obs = mean(a) - mean(b), R = rng(seed); let ge = 0;
  for (let d = 0; d < draws; d++) { for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } const m1 = mean(all.slice(0, a.length)), m2 = mean(all.slice(a.length)); if (m1 - m2 >= obs) ge++; }
  return r4(ge / draws);
}
function group(ps, key) { const rs = ps.map((p) => p[key]); return { n: rs.length, win: rs.length ? r2(rs.filter((x) => x > 0).length / rs.length) : null, mean: r3(mean(rs)), total: r1(sum(rs)) }; }
export function splitStats(ps) {
  const hi = ps.filter((p) => p.s > THRESH), lo = ps.filter((p) => !(p.s > THRESH));
  return { n: ps.length, nAbove: hi.length, shareAbove: ps.length ? r3(hi.length / ps.length) : null,
    above: { x1: group(hi, 'n'), x2: group(hi, 'n2') }, below: { x1: group(lo, 'n'), x2: group(lo, 'n2') },
    welchX1: welch(hi.map((p) => p.n), lo.map((p) => p.n)), welchX2: welch(hi.map((p) => p.n2), lo.map((p) => p.n2)), permPX1: permP(hi.map((p) => p.n), lo.map((p) => p.n)) };
}

// ─── daily equity (research/edge/honest-book/run.mjs conventions) ────────────────────────────────────────────────────────
const dow = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const roll = (d) => (dow(d) === 6 ? addDays(d, 2) : dow(d) === 0 ? addDays(d, 1) : d);
function weekdays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) if (dow(d) !== 0 && dow(d) !== 6) out.push(d); return out; }
function maxDD(v) { let c = 0, pk = 0, dd = 0; for (const x of v) { c += x; if (c > pk) pk = c; if (pk - c > dd) dd = pk - c; } return dd; }
export function metrics(v, days) {
  const total = sum(v), dd = maxDD(v), m = mean(v), s = sd(v), N = v.length, M = new Map(), Y = new Map();
  days.forEach((d, i) => { const k = d.slice(0, 7), y = d.slice(0, 4); M.set(k, (M.get(k) || 0) + v[i]); Y.set(y, (Y.get(y) || 0) + v[i]); });
  const mv = [...M.values()], yv = [...Y.values()];
  return { total: r1(total), maxDD: r1(dd), retDD: dd > 0 ? r2(total / dd) : null, t: s > 0 ? r2((m / s) * Math.sqrt(N)) : null, days: N, posMonths: mv.length ? r2(mv.filter((x) => x > 0).length / mv.length) : null,
    posYears: `${yv.filter((x) => x > 0).length}/${yv.length}`, worstMonth: r1(Math.min(...mv)), byYear: Object.fromEntries([...Y].map(([y, x]) => [y, r1(x)])) };
}
// positions in a window (by entry day) booked on the close day at size(p) × R; the day list runs to the last close
function series(ps, days, cost, sizeFn) {
  const idx = new Map(days.map((d, i) => [d, i])), v = new Array(days.length).fill(0);
  for (const p of ps) { const i = idx.get(roll(p.c.slice(0, 10))); if (i != null) v[i] += sizeFn(p) * p[cost]; }
  return v;
}
function dayList(ps, from, to) { let last = to; for (const p of ps) { const d = roll(p.c.slice(0, 10)); if (d > last) last = d; } return weekdays(from, last); }
// paired month-block bootstrap of retDD and t differences (seed 1): P(diff > 0) and the 90 % band
function pairedBoot(a, b, days, draws = BOOT) {
  const months = [...new Set(days.map((d) => d.slice(0, 7)))], byM = Object.fromEntries(months.map((k) => [k, []]));
  days.forEach((d, i) => byM[d.slice(0, 7)].push(i));
  const R = rng(1), dR = [], dT = [];
  const st = (v) => { const tot = sum(v), dd = maxDD(v), s = sd(v); return [dd > 0 ? tot / dd : tot > 0 ? 1e9 : -1e9, s > 0 ? (mean(v) / s) * Math.sqrt(v.length) : 0]; };
  for (let k = 0; k < draws; k++) {
    const pick = []; for (let j = 0; j < months.length; j++) pick.push(months[Math.floor(R() * months.length)]);
    const va = [], vb = []; for (const mo of pick) for (const i of byM[mo]) { va.push(a[i]); vb.push(b[i]); }
    const [ra, ta] = st(va), [rb, tb] = st(vb); dR.push(ra - rb); dT.push(ta - tb);
  }
  const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  return { draws, months: months.length, retDD: { pGt0: r3(dR.filter((x) => x > 0).length / draws), lo90: r2(q(dR, 0.05)), hi90: r2(q(dR, 0.95)) }, t: { pGt0: r3(dT.filter((x) => x > 0).length / draws), lo90: r2(q(dT, 0.05)), hi90: r2(q(dT, 0.95)) } };
}
const inWin = (p, [from, to]) => p.t.slice(0, 10) >= from && p.t.slice(0, 10) <= to;
export const sizeOf = { fixed: () => 1, sized: (p) => (p.s > THRESH ? 1 : HALF), gate: (p) => (p.s > THRESH ? 1 : 0) };

// arms over one set of positions (with a score) on one window
function arms(ps, from, to, { boot = true } = {}) {
  const days = dayList(ps, from, to), out = { n: ps.length, nAbove: ps.filter((p) => p.s > THRESH).length, from, to, days: days.length, x1: {}, x2: {} };
  const avgSize = ps.length ? mean(ps.map(sizeOf.sized)) : 1;
  for (const cost of ['n', 'n2']) {
    const key = cost === 'n' ? 'x1' : 'x2', f = series(ps, days, cost, sizeOf.fixed), s = series(ps, days, cost, sizeOf.sized), g = series(ps, days, cost, sizeOf.gate);
    out[key] = { fixed: metrics(f, days), sized: metrics(s, days), gate: metrics(g, days), sizedNormTotal: r1(sum(s) / avgSize), avgSize: r3(avgSize) };
    for (const k of ['fixed', 'sized', 'gate']) delete out[key][k].byYear;
    if (boot && days.length > 40) out[key].boot = pairedBoot(s, f, days);
  }
  out.byYear = { fixed: metrics(series(ps, days, 'n', sizeOf.fixed), days).byYear, sized: metrics(series(ps, days, 'n', sizeOf.sized), days).byYear };
  out.split = splitStats(ps);
  return out;
}
const tests1 = (a) => a && a.x1.sized && a.x1.fixed ? { retDDx1: a.x1.sized.retDD > a.x1.fixed.retDD, retDDx2: a.x2.sized.retDD > a.x2.fixed.retDD, totalKept: a.x1.sized.total >= 0.9 * a.x1.fixed.total } : null;

// ─── run ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function run(outFile) {
  const out = { topic: 'macroscore-overlay', at: new Date().toISOString(), preregistration: 'research/edge/macroscore-overlay/preregistration.md', status: 'incomplete', problems: [], sources: {},
    rule: 'paper research only: a proposal for the owner at most; no live rule, size, filter, trader, replay or site code changes',
    system: 'Gold Macro Score (council/macroscore.mjs) as a sizing overlay on Gold trend N20 / fast N5, Gold daily engulf, Gold H4 trendline, Mosha BO longs' };
  const dailyDir = process.env.DAILY_DIR || path.join(process.cwd(), 'data', 'research', 'daily');
  const F = {}; for (const id of ['DFII10', 'DGS2', 'DGS10']) { const r = await fred(id); F[id] = r.obs; out.sources[id] = r.src; if (!r.obs.length) out.problems.push(`${id}: ${r.src}`); }
  const daily = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) { daily[k] = readDaily(dailyDir, k); if (!daily[k].length) out.problems.push(`daily ${k} missing`); }
  const dxy = dxyDaily(daily), gold = readDaily(dailyDir, 'xau');
  out.sources.dxy = dxy.length ? `${dxy.length} days ${isoDay(dxy[0].t)} .. ${isoDay(dxy[dxy.length - 1].t)} (ICE formula on the council daily cache)` : 'none';
  out.sources.gold = gold.length ? `${gold.length} days ${isoDay(gold[0].t)} .. ${isoDay(gold[gold.length - 1].t)} (council daily cache xau)` : 'none';
  if (!dxy.length) out.problems.push('no DXY'); if (!gold.length) out.problems.push('no gold');
  // positions
  let POS = [];
  try {
    const G = JSON.parse(fs.readFileSync(path.join(EDGE, 'gold-systems-oos/result.json'), 'utf8'));
    for (const p of G.positions) POS.push({ sys: p.sys, id: p.id, side: 'buy', t: p.t, c: p.c, n: p.n, n2: p.n2 });
    const M = JSON.parse(fs.readFileSync(path.join(EDGE, 'mosha-oos/result.json'), 'utf8'));
    for (const p of M.positions) POS.push({ sys: 'mosha-bo', id: p.id, side: p.side, t: p.t, c: p.c, n: p.n, n2: p.n2 });
    out.sources.positions = `gold-systems-oos ${G.positions.length} + mosha-oos ${M.positions.length} positions (as committed)`;
  } catch (e) { out.problems.push(`positions: ${e.message}`); }
  if (out.problems.length) { fs.writeFileSync(outFile, JSON.stringify(out, null, 1)); console.log('incomplete:', out.problems.join('; ')); return out; }

  const S = { ry: F.DFII10, y2: F.DGS2, y10: F.DGS10, dxy, gold };
  const SER = scoreSeries(S, FROM), SER2 = scoreSeries(S, S2_FROM);
  out.selfCheck = selfCheck(S, SER, FROM);
  if (!out.selfCheck.ok) out.problems.push(`self-check against goldMacroScore failed: ${JSON.stringify(out.selfCheck.first)}`);
  const firstIdx = SER.score.findIndex((v) => v != null);
  out.score = { from: FROM, weeks: SER.weeks.length, firstScoreWeek: firstIdx >= 0 ? isoDay(SER.weeks[firstIdx]) : null, lastWeek: isoDay(SER.weeks[SER.weeks.length - 1]), last: r2(SER.score[SER.score.length - 1]),
    shareAbove: r3(SER.score.filter((v) => v != null && v > THRESH).length / Math.max(1, SER.score.filter((v) => v != null).length)),
    series: SER.weeks.map((w, i) => [isoDay(w), r3(SER.score[i])]).filter(([, v]) => v != null), now: goldMacroScore(S) };

  // ── H0 calibration: weekly score vs the next 4-week gold return ──
  const GW = weeklyFrame({ g: gold }, '2006-03-01'), gmap = new Map(GW.weeks.map((w, i) => [w, GW.cols.g[i]]));
  const rows = [];
  for (let i = 0; i < SER.weeks.length; i++) { const w = SER.weeks[i], s = SER.score[i], g0 = gmap.get(w), g4 = gmap.get(w + 28 * DAY); if (s == null || g0 == null || g4 == null || isoDay(w) < H0.from) continue; rows.push({ w: isoDay(w), s, r: g4 / g0 - 1 }); }
  const bin = (f) => { const a = rows.filter(f).map((x) => x.r); return { n: a.length, meanPct: r2(mean(a) * 100), upRate: a.length ? r3(a.filter((x) => x > 0).length / a.length) : null, medianPct: a.length ? r2([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] * 100) : null }; };
  const h0 = { from: rows.length ? rows[0].w : null, to: rows.length ? rows[rows.length - 1].w : null, ...spearmanNW(rows.map((x) => x.s), rows.map((x) => x.r), H0.nwLags),
    above: bin((x) => x.s > THRESH), notAbove: bin((x) => !(x.s > THRESH)), below075: bin((x) => x.s < -0.75), all: bin(() => true), shareAbove: rows.length ? r3(rows.filter((x) => x.s > THRESH).length / rows.length) : null, periods: {} };
  for (const [k, [a, b]] of Object.entries(H0.periods)) { const R = rows.filter((x) => x.w >= a && x.w <= b); h0.periods[k] = { ...spearmanNW(R.map((x) => x.s), R.map((x) => x.r), H0.nwLags), above: bin((x) => x.w >= a && x.w <= b && x.s > THRESH), notAbove: bin((x) => x.w >= a && x.w <= b && !(x.s > THRESH)) }; }
  h0.tests = { icPositive: h0.ic > 0, tNW: h0.tNW >= H0.tMin, icNearSkill: h0.ic != null && Math.abs(h0.ic - H0.icTarget) <= H0.icTol + 1e-9, aboveBeatsRest: h0.above.n > 0 && h0.notAbove.n > 0 && h0.above.meanPct > h0.notAbove.meanPct };
  h0.pass = Object.values(h0.tests).every(Boolean);
  out.h0 = h0;

  // ── the score at each position ──
  const tOf = (s) => Date.parse(s.length === 16 ? s + ':00Z' : s) / 1000;
  for (const p of POS) { const t = tOf(p.t), a = scoreAt(SER, t, LAG.primary), b = scoreAt(SER, t, LAG.sens), c = scoreAt(SER2, t, LAG.primary); p.s = a.score; p.sWeek = a.week; p.s2d = b.score; p.sS2 = c.score; }
  out.positions = POS.map((p) => ({ sys: p.sys, id: p.id, side: p.side, t: p.t, c: p.c, n: p.n, n2: p.n2, s: r3(p.s), sWeek: p.sWeek, s2d: r3(p.s2d), sS2: r3(p.sS2) }));
  const longs = POS.filter((p) => p.side === 'buy' && LONG_SYS.includes(p.sys)), scored = longs.filter((p) => p.s != null);
  out.coverage = { longs: longs.length, scored: scored.length, unscored: longs.length - scored.length, unscoredUntouched: longs.filter((p) => p.s == null && inWin(p, [WINDOWS.U.from, WINDOWS.U.to])).length, sells: POS.filter((p) => p.side === 'sell').length };

  // ── H1 / H2 on the pooled longs, per window, halves, per system; the two sensitivities ──
  const withS = (ps, key) => ps.filter((p) => p[key] != null).map((p) => ({ ...p, s: p[key] }));
  out.windows = {};
  for (const [k, W] of Object.entries(WINDOWS)) {
    const ps = scored.filter((p) => inWin(p, [W.from, W.to]));
    const w = (out.windows[k] = { label: W.label, pooled: arms(ps, W.from, W.to), halves: W.halves.map(([a, b]) => ({ from: a, to: b, ...arms(ps.filter((p) => inWin(p, [a, b])), a, b, { boot: false }) })), perSystem: {}, sens: {} });
    for (const sys of LONG_SYS) { const q = ps.filter((p) => p.sys === sys); if (q.length) { w.perSystem[sys] = { name: NAME[sys], ...arms(q, W.from, W.to, { boot: false }) }; delete w.perSystem[sys].byYear; } }
    w.sens.lag2d = arms(withS(longs.filter((p) => inWin(p, [W.from, W.to])), 's2d'), W.from, W.to, { boot: false }); delete w.sens.lag2d.byYear;
    w.sens.from2003 = arms(withS(longs.filter((p) => inWin(p, [W.from, W.to])), 'sS2'), W.from, W.to, { boot: false }); delete w.sens.from2003.byYear;
    w.tests = tests1(w.pooled); w.halfTests = w.halves.map((h) => (h.x1.sized.retDD != null && h.x1.fixed.retDD != null ? h.x1.sized.retDD > h.x1.fixed.retDD : null));
    w.perSystemTests = Object.fromEntries(Object.entries(w.perSystem).map(([s, a]) => [s, tests1(a)]));
  }
  // ── H3 Mosha sells ──
  const sells = POS.filter((p) => p.side === 'sell' && p.s != null);
  out.h3 = Object.fromEntries(Object.entries(WINDOWS).map(([k, W]) => [k, splitStats(sells.filter((p) => inWin(p, [W.from, W.to])))]).concat([['all', splitStats(sells)]]));
  // ── book effect: honest-book books B and C, fixed vs longs sized (sells unchanged) ──
  out.book = {};
  for (const [bk, systems] of Object.entries(BOOKS)) {
    out.book[bk] = { systems, windows: {} };
    for (const [k, W] of Object.entries(WINDOWS)) {
      const ps = POS.filter((p) => systems.includes(p.sys) && inWin(p, [W.from, W.to]) && (p.side === 'sell' || p.s != null)), days = dayList(ps, W.from, W.to), r = { n: ps.length, x1: {}, x2: {} };
      const sz = (p) => (p.side === 'sell' ? 1 : sizeOf.sized(p));
      for (const cost of ['n', 'n2']) { const key = cost === 'n' ? 'x1' : 'x2', f = series(ps, days, cost, sizeOf.fixed), s = series(ps, days, cost, sz); r[key] = { fixed: metrics(f, days), sized: metrics(s, days) }; delete r[key].fixed.byYear; delete r[key].sized.byYear; if (days.length > 40) r[key].boot = pairedBoot(s, f, days); }
      out.book[bk].windows[k] = r;
    }
  }
  // ── verdict, mechanically from the pre-registered bars ──
  const U = out.windows.U, B = out.windows.B, t1 = U.tests || {}, h1Pass = !!(t1.retDDx1 && t1.retDDx2 && t1.totalKept && U.halfTests.every((x) => x === true));
  const confirmed = !!(B.tests && B.tests.retDDx1 && B.tests.totalKept), noise = U.pooled.x1.boot ? U.pooled.x1.boot.retDD.pGt0 : null;
  out.h1 = { pass: h1Pass, tests: t1, halves: U.halfTests, confirmed, confirmTests: B.tests, bootP: noise };
  const cls = !h0.pass ? 'VOID' : h1Pass ? 'PASS' : 'FAIL';
  out.verdict = `${cls}${cls === 'PASS' ? ` (${confirmed ? 'confirmed' : 'not confirmed'} on 2018-26; ${noise != null && noise >= 0.95 ? 'more than noise' : 'within noise'}, bootstrap P ${noise})` : cls === 'VOID' ? ' (H0 calibration failed: the score is not calibrated on this data)' : ''}`;
  out.status = out.problems.length ? 'incomplete' : 'ok';
  fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  print(out);
  return out;
}
function print(o) {
  const P = console.log, a = (x, k) => (x == null ? '—' : x);
  P(`status ${o.status}${o.problems.length ? ' · ' + o.problems.join('; ') : ''}`); P(JSON.stringify(o.sources)); P(`self-check ${JSON.stringify(o.selfCheck)}`);
  P(`score weeks ${o.score.weeks}, first ${o.score.firstScoreWeek}, last ${o.score.lastWeek} = ${o.score.last}, share > ${THRESH}: ${o.score.shareAbove}`);
  const h = o.h0; P(`H0 ${h.from}..${h.to} n ${h.n} IC ${h.ic} tNW ${h.tNW} t ${h.t} | > +0.25: n ${h.above.n} ${h.above.meanPct}% up ${h.above.upRate} | rest: n ${h.notAbove.n} ${h.notAbove.meanPct}% up ${h.notAbove.upRate} | < -0.75: n ${h.below075.n} ${h.below075.meanPct}% up ${h.below075.upRate} | pass ${h.pass} ${JSON.stringify(h.tests)}`);
  for (const [k, p] of Object.entries(h.periods)) P(`  ${k}: n ${p.n} IC ${p.ic} tNW ${p.tNW} | > +0.25 ${p.above.meanPct}% (n ${p.above.n}) vs ${p.notAbove.meanPct}%`);
  P(`coverage ${JSON.stringify(o.coverage)}`);
  for (const [k, w] of Object.entries(o.windows)) {
    const m = w.pooled; P(`\n${w.label}: n ${m.n}, above ${m.nAbove} (${m.split.shareAbove})`);
    P('| arm | x1 total | x1 DD | x1 ret/DD | x1 t | x2 total | x2 DD | x2 ret/DD | x2 t |'); P('|---|---|---|---|---|---|---|---|---|');
    for (const arm of ['fixed', 'sized', 'gate']) P(`| ${arm} | ${m.x1[arm].total} | -${m.x1[arm].maxDD} | ${a(m.x1[arm].retDD)} | ${a(m.x1[arm].t)} | ${m.x2[arm].total} | -${m.x2[arm].maxDD} | ${a(m.x2[arm].retDD)} | ${a(m.x2[arm].t)} |`);
    P(`sized at equal average risk: x1 total ${m.x1.sizedNormTotal} (avg size ${m.x1.avgSize}); boot ${m.x1.boot ? JSON.stringify(m.x1.boot.retDD) : '—'}; tests ${JSON.stringify(w.tests)} halves ${JSON.stringify(w.halfTests)}`);
    P(`positions > +0.25: n ${m.split.above.x1.n} mean ${m.split.above.x1.mean} win ${m.split.above.x1.win} | <= : n ${m.split.below.x1.n} mean ${m.split.below.x1.mean} win ${m.split.below.x1.win} | Welch ${m.split.welchX1} perm P ${m.split.permPX1}`);
    for (const [s, q] of Object.entries(w.perSystem)) P(`  ${q.name}: n ${q.n} above ${q.nAbove}; fixed ${q.x1.fixed.total} ret/DD ${a(q.x1.fixed.retDD)} | sized ${q.x1.sized.total} ret/DD ${a(q.x1.sized.retDD)} | gate ${q.x1.gate.total} ret/DD ${a(q.x1.gate.retDD)} | > ${q.split.above.x1.mean} (n ${q.split.above.x1.n}) vs ${q.split.below.x1.mean}`);
    P(`  sens lag 2d: fixed ret/DD ${a(w.sens.lag2d.x1.fixed.retDD)} sized ${a(w.sens.lag2d.x1.sized.retDD)} (n ${w.sens.lag2d.n}); from 2003: fixed ${a(w.sens.from2003.x1.fixed.retDD)} sized ${a(w.sens.from2003.x1.sized.retDD)} (n ${w.sens.from2003.n})`);
  }
  P(`\nH3 sells: ${JSON.stringify(o.h3.all)}`);
  for (const [bk, b] of Object.entries(o.book)) for (const [k, w] of Object.entries(b.windows)) P(`book ${bk} ${k}: fixed ${w.x1.fixed.total} DD -${w.x1.fixed.maxDD} ret/DD ${a(w.x1.fixed.retDD)} t ${a(w.x1.fixed.t)} | sized longs ${w.x1.sized.total} DD -${w.x1.sized.maxDD} ret/DD ${a(w.x1.sized.retDD)} t ${a(w.x1.sized.t)} | x2 ${a(w.x2.fixed.retDD)} -> ${a(w.x2.sized.retDD)} | P ${w.x1.boot ? w.x1.boot.retDD.pGt0 : '—'}`);
  P(`\nVerdict: ${o.verdict}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outFile = process.argv[2]; if (!outFile) { console.error('usage: node run.mjs <outFile>'); process.exit(2); }
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  run(outFile).catch((e) => { console.error(e); process.exit(1); });
}
