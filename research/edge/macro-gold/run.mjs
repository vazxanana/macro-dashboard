// Edge research · macro-gold: can the Macro strategist's inputs (US 10y real yield, the dollar), known the day before, make a
// tradable gold rule? Pre-registration: preregistration.md (committed before any real-yield number was computed). Runs ONCE on
// GitHub Actions (.github/workflows/macro-gold.yml), where FRED answers; the research sandbox blocks it. Paper only: changes no rule.
//
//   node research/edge/macro-gold/run.mjs <outFile>
//   env: FRED_DIR=<dir with DFII10.csv, DTWEXBGS.csv>  (offline: fredgraph.csv files instead of fetching)
//        CANDLES=<xau-1d.json.gz, rows [t,o,h,l,c]>       (offline: OANDA daily candles instead of fetching)
//        GTREND=<gold-systems-oos result.json>            (default: research/edge/gold-systems-oos/result.json)
//
// Rule A: long gold from a weekday close to the next while the 20-observation change of DFII10 known at that close is < 0.
// Rule B: the live Gold trend N20 positions (#530 replay), each taken only if that change is < 0 at its entry minute.
// Costs as #530 ($0.30 / $0.60 a round trip). Every bar in the pre-registration is applied mechanically below.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const r4 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(4));
const r3 = (x) => (x == null || !isFinite(x) ? null : +(+x).toFixed(3));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) : NaN; };
const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
const isWeekday = (t) => { const w = new Date(t * 1000).getUTCDay(); return w >= 1 && w <= 5; };
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ─── pre-registered constants ─────────────────────────────────────────────────────────────────────────────────────────────
export const COST = { x1: 0.30, x2: 0.60 };   // $ per unit per round trip (#530)
export const LOOK = 20;
export const PERIODS = {
  oos: ['2006-07-03', '2017-12-29'], h1: ['2006-07-03', '2011-12-31'], h2: ['2012-01-01', '2017-12-29'], confirm: ['2018-01-02', '2026-11-06'],
};
export const POS_PERIODS = { oos: ['2006-07-01', '2018-01-01'], h1: ['2006-07-01', '2012-01-01'], h2: ['2012-01-01', '2018-01-01'], confirm: ['2018-01-01', '2026-11-07'] };
const BOOT = 10000, BLOCK = 20, PERM = 10000;
const FRED_FROM = '2003-01-01', GOLD_FROM = '2006-03-01', GOLD_TO = '2026-11-07';

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
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' };
const HEAD = [[{ 'User-Agent': 'macro-dashboard-council/1.0 (+https://meridianx.dev)', Accept: 'text/csv,*/*' }, 30000], [UA, 20000]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fred(id) {
  if (process.env.FRED_DIR) { const f = path.join(process.env.FRED_DIR, `${id}.csv`); return fs.existsSync(f) ? { obs: parseFredCsv(fs.readFileSync(f, 'utf8')), src: `file ${f}` } : { obs: [], src: `missing ${f}` }; }
  let err = 'empty';
  for (let k = 0; k < 3; k++) for (const [h, ms] of HEAD) {
    try { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&cosd=${FRED_FROM}`, { headers: h, signal: AbortSignal.timeout(ms) });
      if (r.ok) { const obs = parseFredCsv(await r.text()); if (obs.length) return { obs, src: 'FRED ok' }; err = 'empty'; } else err = `HTTP ${r.status}`; }
    catch (e) { err = String((e && e.message) || e).slice(0, 80); }
    await sleep(2000 * (k + 1));
  }
  return { obs: [], src: `FRED failed (${err})` };
}
async function gold() {
  if (process.env.CANDLES) return { bars: JSON.parse(zlib.gunzipSync(fs.readFileSync(process.env.CANDLES))), src: `file ${process.env.CANDLES}` };
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', m = new Map(), a0 = T(GOLD_FROM), b0 = T(GOLD_TO);
  for (let a = a0; a < b0;) {
    const b = Math.min(b0, a + 4999 * DAY); let j = null, err = null;
    for (let k = 0; k < 5 && !j; k++) {
      try { const r = await fetch(`${BASE}bars?sym=xau&tf=1d&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) }); const x = r.ok ? await r.json() : null;
        if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; }
      catch (e) { err = String(e.message || e); }
      if (!j) await sleep(1500 * (k + 1));
    }
    if (!j) return { bars: [], src: `OANDA failed ${iso(a)}: ${err}` };
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(150);
  }
  return { bars: [...m.values()].sort((p, q) => p[0] - q[0]), src: 'OANDA ok' };
}

// ─── signals with publication lags ────────────────────────────────────────────────────────────────────────────────────────
// knownAt(d) for H.15 DFII10: 24:00 UTC of the lagWd-th weekday after d. For H.10 DTWEXBGS: 24:00 UTC of d + 10 days.
export function addWeekdays(t, n) { let x = t; while (n > 0) { x += DAY; if (isWeekday(x)) n--; } return x; }
export const knownH15 = (lagWd) => (t) => addWeekdays(t, lagWd) + DAY;
export const knownH10 = (t) => t + 11 * DAY;
// a series view: change over k observations, as known at time T (null when not enough history)
export function changer(obs, knownAt) {
  const ka = obs.map((o) => knownAt(o.t));
  for (let i = 1; i < ka.length; i++) if (ka[i] < ka[i - 1]) throw new Error('knownAt not monotone');
  const lastIdx = (Tm) => { let lo = 0, hi = ka.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ka[m] <= Tm) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
  return { at: (Tm, k) => { const i = lastIdx(Tm); return i >= k ? obs[i].v - obs[i - k].v : null; }, lastIdx, obs };
}

// ─── Rule A machinery ─────────────────────────────────────────────────────────────────────────────────────────────────────
// days: weekday closes; day j earns r_j = c_j / c_{j-1} − 1 with the position set at close j−1 (signal sig[j−1])
function dailyRows(days, sig) {
  const rows = [];
  for (let j = 1; j < days.length; j++) rows.push({ t: days[j].t, d: days[j].d, r: days[j].c / days[j - 1].c - 1, s: sig[j - 1], pc: days[j - 1].c, c: days[j].c });
  return rows;
}
const inP = (d, [a, b]) => d >= a && d <= b;
// net daily returns of a position path inside one period: enter at the first day's previous close if long, exit at the end
function netPath(rows, cost, key = 's') {
  const out = []; let prev = 0;
  for (let i = 0; i < rows.length; i++) {
    const w = rows[i], s = w[key] ? 1 : 0; let x = s * w.r;
    if (s !== prev) x -= (cost / 2) / w.pc;   // switch at the previous close (fraction of that close)
    if (i === rows.length - 1 && s) x -= (cost / 2) / w.c;   // close out at the period end
    out.push(x); prev = s;
  }
  return out;
}
function pathStats(rows, net, key = 's') {
  const n = net.length, m = mean(net), s = sd(net);
  let eq = 1, pk = 1, dd = 0; for (const x of net) { eq *= 1 + x; pk = Math.max(pk, eq); dd = Math.min(dd, eq / pk - 1); }
  let sw = 0, prev = 0; for (const w of rows) { const v = w[key] ? 1 : 0; if (v && !prev) sw++; prev = v; }
  const mo = monthly(rows, net);
  return { days: n, inMkt: r3(rows.filter((w) => w[key]).length / n), entries: sw, meanBp: r3(m * 1e4), annRet: r4(m * 252), annVol: r4(s * Math.sqrt(252)), sharpe: r3(m / s * Math.sqrt(252)),
    total: r4(eq - 1), maxDD: r4(dd), monthT: r3(mean(mo.v) / sd(mo.v) * Math.sqrt(mo.v.length)), months: mo.v.length };
}
function monthly(rows, net) { const m = new Map(); rows.forEach((w, i) => { const k = w.d.slice(0, 7); m.set(k, (m.get(k) ?? 1) * (1 + net[i])); }); return { k: [...m.keys()], v: [...m.values()].map((x) => x - 1) }; }
// regime spread: mean gross return on long days minus flat days; circular block bootstrap of (r, s) pairs
function spread(rows, key = 's', seed = 7, boot = BOOT) {
  const on = rows.filter((w) => w[key]).map((w) => w.r), off = rows.filter((w) => !w[key]).map((w) => w.r);
  if (on.length < 2 || off.length < 2) return { nOn: on.length, nOff: off.length, diffBp: null, p: null };
  const diff = mean(on) - mean(off), va = sd(on) ** 2 / on.length, vb = sd(off) ** 2 / off.length, welchT = diff / Math.sqrt(va + vb);
  const n = rows.length, R = rng(seed); let le = 0; const ds = [];
  for (let b = 0; b < boot; b++) {
    let s1 = 0, n1 = 0, s0 = 0, n0 = 0;
    for (let i = 0; i < n;) { const st = Math.floor(R() * n); for (let k = 0; k < BLOCK && i < n; k++, i++) { const w = rows[(st + k) % n]; if (w[key]) { s1 += w.r; n1++; } else { s0 += w.r; n0++; } } }
    const d = n1 && n0 ? s1 / n1 - s0 / n0 : 0; ds.push(d); if (d <= 0) le++;
  }
  ds.sort((a, b) => a - b);
  return { nOn: on.length, nOff: off.length, onBp: r3(mean(on) * 1e4), offBp: r3(mean(off) * 1e4), diffBp: r3(diff * 1e4), welchT: r3(welchT),
    ci95Bp: [r3(ds[Math.floor(boot * 0.025)] * 1e4), r3(ds[Math.floor(boot * 0.975)] * 1e4)], p: r4(le / boot) };
}
function ruleAPeriod(rows, P, key = 's', boot = BOOT) {
  const w = rows.filter((x) => inP(x.d, P)), out = { from: w[0].d, to: w.at(-1).d };
  for (const [ck, c] of Object.entries(COST)) {
    out[ck] = { rule: pathStats(w, netPath(w, c, key), key), long: pathStats(w, netPath(w, c, 'one'), 'one'), twin: pathStats(w, netPath(w, c, 'tw'), 'tw') };
  }
  out.gross = { rule: pathStats(w, netPath(w, 0, key), key), long: pathStats(w, netPath(w, 0, 'one'), 'one') };
  out.spread = spread(w, key, 7, boot);
  return out;
}

// ─── Rule B machinery ─────────────────────────────────────────────────────────────────────────────────────────────────────
function rStats(ps, k = 'n') {
  const rs = ps.map((p) => p[k]), n = rs.length; if (!n) return { n: 0 };
  const m = mean(rs), s = sd(rs);
  let eq = 0, pk = 0, dd = 0; for (const p of ps.slice().sort((a, b) => (a.c < b.c ? -1 : 1))) { eq += p[k]; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, win: r3(rs.filter((x) => x > 0).length / n), mean: r3(m), total: r3(eq), t: n > 1 && s > 0 ? r3(m / s * Math.sqrt(n)) : null, maxDD: r3(dd), retDD: dd < 0 ? r3(eq / -dd) : null };
}
function permP(kept, skip, seed = 11) {
  const all = [...kept, ...skip].map((p) => p.n), nk = kept.length, obs = mean(kept.map((p) => p.n)) - mean(skip.map((p) => p.n));
  if (!kept.length || !skip.length) return { diff: null, p: null };
  const R = rng(seed); let ge = 0; const a = all.slice();
  for (let b = 0; b < PERM; b++) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const d = mean(a.slice(0, nk)) - mean(a.slice(nk)); if (d >= obs - 1e-12) ge++;
  }
  return { diff: r3(obs), p: r4(ge / PERM) };
}
const posIn = (p, [a, b]) => p.t >= a && p.t < b;

// ─── main ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function main(outFile) {
  const res = { topic: 'macro-gold', at: new Date().toISOString(), preregistration: 'research/edge/macro-gold/preregistration.md', status: 'incomplete', sources: {}, coverage: {} };
  const write = () => { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, JSON.stringify(res, null, 1) + '\n'); };
  const F = {};
  for (const id of ['DFII10', 'DTWEXBGS']) { const r = await fred(id); F[id] = r.obs; res.sources[id] = r.src; res.coverage[id] = r.obs.length ? `${iso(r.obs[0].t)} → ${iso(r.obs.at(-1).t)} (${r.obs.length})` : 'none'; }
  const g = await gold(); res.sources.xau = g.src;
  const days = g.bars.filter((b) => isWeekday(b[0])).map((b) => ({ t: b[0], d: iso(b[0]), c: b[4] }));
  res.coverage.xau = days.length ? `${days[0].d} → ${days.at(-1).d} (${days.length} weekday closes)` : 'none';
  const gtPath = process.env.GTREND || path.join(HERE, '..', 'gold-systems-oos', 'result.json');
  const gt = fs.existsSync(gtPath) ? JSON.parse(fs.readFileSync(gtPath, 'utf8')).positions.filter((p) => p.sys === 'gtrend') : [];
  res.coverage.gtrend = `${gt.length} positions`;
  const need = [];
  if (!F.DFII10.length || iso(F.DFII10[0].t) > '2006-01-01' || iso(F.DFII10.at(-1).t) < '2026-10-30') need.push('DFII10 coverage');
  if (!F.DTWEXBGS.length) need.push('DTWEXBGS');   // diagnostic only, still required for a complete run
  if (!days.length || days[0].d > '2006-04-01' || days.at(-1).d < '2026-11-06') need.push('xau coverage');
  if (gt.length < 100) need.push('gtrend positions');
  if (need.length) { res.missing = need; write(); console.log(`incomplete: ${need.join(', ')}`); return res; }

  const RY = changer(F.DFII10, knownH15(2)), RY1 = changer(F.DFII10, knownH15(1)), DX = changer(F.DTWEXBGS, knownH10);
  const closeT = (j) => days[j].t + DAY;   // a weekday's close (24:00 UTC of its date)
  const sigs = {
    s: (j) => RY.at(closeT(j), LOOK),
    lag1: (j) => RY1.at(closeT(j), LOOK),
    k5: (j) => RY.at(closeT(j), 5),
    k60: (j) => RY.at(closeT(j), 60),
    dx: (j) => DX.at(closeT(j), LOOK),
    tw: (j) => (j >= LOOK ? days[j].c - days[j - LOOK].c : null),
  };
  const sig = {}; for (const k in sigs) sig[k] = days.map((_, j) => sigs[k](j));
  const rows = dailyRows(days, sig.s.map((x) => x != null && x < 0));
  rows.forEach((w, i) => {
    const j = i;   // rows[i] earns day i+1 with the signal of day i
    w.one = true; w.tw = sig.tw[j] != null && sig.tw[j] > 0; w.lag1 = sig.lag1[j] != null && sig.lag1[j] < 0;
    w.k5 = sig.k5[j] != null && sig.k5[j] < 0; w.k60 = sig.k60[j] != null && sig.k60[j] < 0; w.dx = sig.dx[j] != null && sig.dx[j] < 0; w.both = w.s && w.dx;
    w.dRaw = sig.s[j];
  });
  const oosRows = rows.filter((w) => inP(w.d, PERIODS.oos) || inP(w.d, PERIODS.confirm));
  const nulls = oosRows.filter((w) => w.dRaw == null).length; if (nulls) throw new Error(`${nulls} test days without a real-yield signal`);

  // Rule A
  const A = {}; for (const [k, P] of Object.entries(PERIODS)) A[k] = ruleAPeriod(rows, P);
  const tA = {
    A1: A.oos.x1.rule.sharpe > A.oos.x1.long.sharpe && A.oos.x2.rule.sharpe > A.oos.x2.long.sharpe,
    A2: A.oos.spread.diffBp > 0 && A.oos.spread.p < 0.05,
    A3: ['h1', 'h2'].every((h) => A[h].spread.diffBp > 0 && A[h].x1.rule.sharpe > A[h].x1.long.sharpe),
    A4: A.oos.x1.rule.sharpe > A.oos.x1.twin.sharpe,
    C1: A.confirm.spread.diffBp > 0,
    C2: A.confirm.x2.rule.sharpe >= A.confirm.x2.long.sharpe,
  };

  // Rule B
  const entryT = (p) => Date.parse(p.t + ':00Z') / 1000;
  for (const p of gt) { p.dRY = RY.at(entryT(p), LOOK); p.dRY1 = RY1.at(entryT(p), LOOK); p.keep = p.dRY != null && p.dRY < 0; p.keep1 = p.dRY1 != null && p.dRY1 < 0; }
  const B = {};
  for (const [k, P] of Object.entries(POS_PERIODS)) {
    const ps = gt.filter((p) => posIn(p, P)), kept = ps.filter((p) => p.keep), skip = ps.filter((p) => !p.keep);
    B[k] = { all: { x1: rStats(ps), x2: rStats(ps, 'n2') }, kept: { x1: rStats(kept), x2: rStats(kept, 'n2') }, skipped: { x1: rStats(skip), x2: rStats(skip, 'n2') }, perm: permP(kept, skip) };
  }
  const half = (h) => B[h].kept.x1.n >= 3 && B[h].skipped.x1.n >= 3 && B[h].kept.x1.mean > B[h].skipped.x1.mean;
  const tB = {
    B1: B.oos.kept.x1.mean > 0 && B.oos.kept.x2.mean > 0,
    B2: B.oos.perm.diff > 0 && B.oos.perm.p < 0.05,
    B3: half('h1') && half('h2'),
    B4: B.oos.kept.x1.retDD != null && B.oos.all.x1.retDD != null ? B.oos.kept.x1.retDD >= B.oos.all.x1.retDD : B.oos.kept.x1.maxDD === 0 && B.oos.kept.x1.total > 0,
    C1: B.confirm.kept.x1.mean > B.confirm.skipped.x1.mean,
    C2: B.confirm.kept.x2.mean > 0,
  };
  const verdict = (t, pre) => { const o = Object.keys(t).filter((k) => k.startsWith(pre)).every((k) => t[k]), c = t.C1 && t.C2;
    return o && c ? 'PASS' : o ? 'OOS ONLY' : c ? 'FAIL (recent only)' : 'FAIL'; };
  res.ruleA = { rule: 'long gold close-to-close while DFII10 20-obs change known at the prior close (2-weekday lag) < 0; flat otherwise', periods: A, tests: tA, verdict: verdict(tA, 'A') };
  res.ruleB = { rule: 'live Gold trend N20 positions (#530) taken only if DFII10 20-obs change known at entry < 0', periods: B, tests: tB, verdict: verdict(tB, 'B') };

  // ─── pre-declared diagnostics ───────────────────────────────────────────────────────────────────────────────────────────
  const D = {};
  const small = (key) => { const o = {}; for (const [k, P] of Object.entries(PERIODS)) { const x = ruleAPeriod(rows, P, key, 2000); o[k] = { sharpeX1: x.x1.rule.sharpe, sharpeX2: x.x2.rule.sharpe, longSharpe: x.x1.long.sharpe, annRetX1: x.x1.rule.annRet, maxDDX1: x.x1.rule.maxDD, inMkt: x.x1.rule.inMkt, entries: x.x1.rule.entries, diffBp: x.spread.diffBp, p: x.spread.p }; } return o; };
  D.lag1 = { ruleA: small('lag1'), ruleB: Object.fromEntries(Object.entries(POS_PERIODS).map(([k, P]) => { const ps = gt.filter((p) => posIn(p, P)); return [k, { kept: rStats(ps.filter((p) => p.keep1)), skipped: rStats(ps.filter((p) => !p.keep1)) }]; })) };
  D.k5 = small('k5'); D.k60 = small('k60'); D.dollar = small('dx'); D.realAndDollar = small('both'); D.twin = small('tw');
  D.twin2x2 = {}; for (const [k, P] of Object.entries(PERIODS)) { const w = rows.filter((x) => inP(x.d, P)); D.twin2x2[k] = { twinLong: spread(w.filter((x) => x.tw), 's', 7, 2000), twinFlat: spread(w.filter((x) => !x.tw), 's', 7, 2000) }; }
  // same-day link: gold's weekday return against the same date's DFII10 change, and against the last 1-obs change known at the prior close
  const ryBy = new Map(); F.DFII10.forEach((o, i) => { if (i) ryBy.set(iso(o.t), o.v - F.DFII10[i - 1].v); });
  D.sameDay = {}; for (const [k, P] of Object.entries(PERIODS)) {
    const w = rows.filter((x) => inP(x.d, P) && ryBy.has(x.d)), lagged = rows.map((x, i) => [x, RY.at(closeT(i), 1)]).filter(([x, v]) => inP(x.d, P) && v != null);
    D.sameDay[k] = { n: w.length, corrSameDay: r3(corr(w.map((x) => x.r), w.map((x) => ryBy.get(x.d)))), corrKnownPrior: r3(corr(lagged.map(([x]) => x.r), lagged.map(([, v]) => v))) };
  }
  // against Gold trend: monthly series over the verdict windows (Gold trend by close month, 0 for a month without a close)
  D.vsGoldTrend = {}; for (const [k, P] of Object.entries(PERIODS)) {
    const w = rows.filter((x) => inP(x.d, P)), ma = monthly(w, netPath(w, COST.x1)), ml = monthly(w, netPath(w, COST.x1, 'one'));
    // as #530: positions entered in the window, by close month, a close after the window counted in its last month
    const PP = POS_PERIODS[k], last = ma.k.at(-1), gin = gt.filter((p) => posIn(p, PP)).map((p) => ({ m: p.c.slice(0, 7) > last ? last : p.c.slice(0, 7), n: p.n }));
    const gm = ma.k.map((mk) => gin.filter((p) => p.m === mk).reduce((s, p) => s + p.n, 0));
    const tt = (v) => r3(mean(v) / sd(v) * Math.sqrt(v.length));
    D.vsGoldTrend[k] = { months: ma.k.length, monthT: { ruleA: tt(ma.v), longGold: tt(ml.v), goldTrendR: tt(gm) }, corrRuleAvsGoldTrend: r3(corr(ma.v, gm)), corrLongGoldvsGoldTrend: r3(corr(ml.v, gm)) };
  }
  // by year (calendar years of the daily rows; Rule B by entry year)
  D.byYear = {}; for (let y = 2006; y <= 2026; y++) {
    const P = [y === 2006 ? '2006-07-03' : `${y}-01-01`, y === 2026 ? '2026-11-06' : `${y}-12-31`], w = rows.filter((x) => inP(x.d, P));
    const tot = (net) => r4(net.reduce((e, x) => e * (1 + x), 1) - 1), ps = gt.filter((p) => p.t.slice(0, 4) === String(y));
    D.byYear[y] = { ruleA: tot(netPath(w, COST.x1)), longGold: tot(netPath(w, COST.x1, 'one')), twin: tot(netPath(w, COST.x1, 'tw')), inMkt: r3(w.filter((x) => x.s).length / w.length),
      gtKeptR: r3(ps.filter((p) => p.keep).reduce((s, p) => s + p.n, 0)), gtKeptN: ps.filter((p) => p.keep).length, gtSkippedR: r3(ps.filter((p) => !p.keep).reduce((s, p) => s + p.n, 0)), gtSkippedN: ps.filter((p) => !p.keep).length };
  }
  res.diagnostics = D;
  res.positions = gt.map((p) => ({ id: p.id, t: p.t, c: p.c, n: p.n, n2: p.n2, dRY: r3(p.dRY), keep: p.keep }));
  // the signal now (for a shadow, if one ever passes)
  const lastJ = days.length - 1; res.now = { asOfClose: days[lastJ].d, dRY20: r3(sig.s[lastJ]), long: sig.s[lastJ] != null && sig.s[lastJ] < 0 };
  res.status = 'ok';
  write();
  console.log(`Rule A: ${res.ruleA.verdict} ${JSON.stringify(tA)}\nRule B: ${res.ruleB.verdict} ${JSON.stringify(tB)}`);
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2]; if (!out) { console.error('usage: node run.mjs <outFile>'); process.exit(2); }
  main(out).catch((e) => { console.error(e); try { fs.writeFileSync(out, JSON.stringify({ topic: 'macro-gold', at: new Date().toISOString(), status: 'incomplete', error: String(e.stack || e).slice(0, 500) }, null, 1) + '\n'); } catch {} process.exit(0); });
}
