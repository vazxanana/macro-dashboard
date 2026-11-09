// Edge research · cot-positioning: the pre-registered test (preregistration.md) of whether large-speculator positioning in the
// CFTC COT predicts 1- and 4-week returns for gold, the seven FX majors and the Nasdaq-100 / S&P 500 futures.
//   node research/edge/cot-positioning/run.mjs <council-data dir> [out.json]
// <council-data dir> holds macro/cot-raw.json (the council's CFTC pull) and research/daily/<sym>.json (OANDA daily candles).
// Features, release timing (`knownAt`), late-published weeks (`isLate`) and weekday candles come from council/cot.mjs, so the desk
// and the study read the data the same way. Paper research only: nothing live is changed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MARKETS, features, knownAt, isLate, weekdays, entryIdx, overlapT, LATE } from '../../../council/cot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [DIR, OUT = path.join(HERE, 'result.json')] = process.argv.slice(2);
if (!DIR) throw new Error('usage: node run.mjs <council-data dir> [out.json]');

const DAY = 86400, iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const IS = ['2020-01-01', '2023-12-31'], OOS_FROM = '2024-01-01';
const H = [5, 20], LAG = { 5: 2, 20: 6 }, HN = { 5: '1w', 20: '4w' };
const MK = MARKETS.filter((m) => m.k !== 'silver');   // gold, the seven majors, NQ, ES
const PRIOR_GOLD_IC = 0.01;

// ---------- data ----------
const rawPath = path.join(DIR, 'macro', 'cot-raw.json'), rawBuf = fs.readFileSync(rawPath), raw = JSON.parse(rawBuf);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const sources = { 'macro/cot-raw.json': { sha256: sha(rawBuf), fetched: raw.at, src: raw.src } }, coverage = {};
const S = {};   // per market: weekly records
let commRows = 0, allRows = 0;
for (const m of MK) {
  const rows = (raw.rows[m.code] || []).slice().sort((a, b) => a.t - b.t);
  const pf = path.join(DIR, 'research', 'daily', m.px + '.json'), pb = fs.readFileSync(pf), pj = JSON.parse(pb);
  sources[`research/daily/${m.px}.json`] = { sha256: sha(pb), src: pj.src };
  const px = weekdays(pj.rows.filter((r) => r && r[4] > 0).map((r) => ({ t: r[0], v: +r[4] })));
  coverage[m.k] = `${rows.length} reports ${iso(rows[0].t)} → ${iso(rows.at(-1).t)}; ${px.length} weekday closes ${iso(px[0].t)} → ${iso(px.at(-1).t)}`;
  allRows += rows.length; commRows += rows.filter((r) => r.cL != null && r.cS != null).length;
  const F = features(rows), recs = [];
  F.forEach((f, i) => {
    const k = entryIdx(px, f.t), fr = {};
    for (const h of H) fr[h] = k >= 0 && k + h < px.length ? m.sign * (px[k + h].v / px[k].v - 1) : null;
    // OI-normalised 3-year percentile (diagnostic 2)
    let p3oi = null;
    if (i >= 156 && f.oi > 0) { const hist = rows.slice(i - 156, i).filter((x) => x.oi > 0).map((x) => x.net / x.oi); if (hist.length >= 150) p3oi = Math.round(hist.filter((x) => x <= f.net / f.oi).length / hist.length * 100); }
    // the desk's previous timing (diagnostic 3): as-of + 6 days for every report, raw candles (Sunday stubs counted), late weeks kept
    const pxRaw = pj.rows.filter((r) => r && r[4] > 0), old = {};
    { const t0 = f.t + 6 * DAY, j = pxRaw.findIndex((o) => o[0] > t0); old[20] = j >= 0 && j + 20 < pxRaw.length ? m.sign * (pxRaw[j + 20][4] / pxRaw[j][4] - 1) : null; old.j = j; }
    recs.push({ t: f.t, d: iso(f.t), wk: iso(knownAt(f.t)), late: isLate(f.t), k, r: fr, old,
      P1: f.pct1y, P3: f.pctWeeks >= 156 ? f.pct : null, Z: f.zWeeks >= 52 ? f.z : null, C3: f.pctWeeks >= 156 ? f.cpct : null, P3oi: p3oi });
  });
  S[m.k] = recs;
}
const commShare = allRows ? commRows / allRows : 0, H5_RUN = commShare >= 0.9;

// ---------- statistics ----------
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function ranks(a) {   // average ranks for ties
  const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length);
  for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; const av = (i + j) / 2 + 1; for (let q = i; q <= j; q++) r[o[q][1]] = av; i = j + 1; }
  return r;
}
const zs = (a) => { const m = mean(a), s = Math.sqrt(a.reduce((q, x) => q + (x - m) ** 2, 0) / a.length) || 1; return a.map((x) => (x - m) / s); };
// Newey-West (Bartlett) t of the mean of a series in time order
function nwT(u, L) {
  const n = u.length; if (n < 8) return null;
  const m = mean(u), d = u.map((x) => x - m); let v = d.reduce((s, x) => s + x * x, 0) / n;
  for (let l = 1; l <= L && l < n; l++) { let g = 0; for (let i = l; i < n; i++) g += d[i] * d[i - l]; v += 2 * (1 - l / (L + 1)) * g / n; }
  return v > 0 ? m / Math.sqrt(v / n) : null;
}
const r3 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(3)), r2 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(2));
const inWin = (rec, w) => !rec.late && (w === 'is' ? rec.d >= IS[0] && rec.d <= IS[1] : w === 'oos' ? rec.d >= OOS_FROM : rec.d >= IS[0]);

// per market: the standardized rank products u for one feature / horizon / window
function products(recs, feat, h, w) {
  const ok = recs.filter((x) => inWin(x, w) && x[feat] != null && x.r[h] != null);
  if (ok.length < 8) return { n: ok.length, rows: [] };
  const zx = zs(ranks(ok.map((x) => x[feat]))), zr = zs(ranks(ok.map((x) => x.r[h])));
  return { n: ok.length, rows: ok.map((x, i) => ({ wk: x.wk, u: zx[i] * zr[i] })) };
}
function icCell(recs, feat, h, w) {
  const p = products(recs, feat, h, w); if (!p.rows.length) return { n: p.n, ic: null, t: null };
  return { n: p.n, ic: r3(mean(p.rows.map((x) => x.u))), t: r2(nwT(p.rows.map((x) => x.u), LAG[h])) };
}
function pooledIc(feat, h, w, keys = MK.map((m) => m.k)) {
  const by = new Map();
  for (const k of keys) for (const x of products(S[k], feat, h, w).rows) { const a = by.get(x.wk) || []; a.push(x.u); by.set(x.wk, a); }
  const wks = [...by.keys()].sort(), c = wks.map((wk) => mean(by.get(wk)));
  return { weeks: c.length, ic: c.length ? r3(mean(c)) : null, t: r2(nwT(c, LAG[h])) };
}
const sigH4 = (x) => (x.P3 == null ? 0 : x.P3 >= 90 ? -1 : x.P3 <= 10 ? 1 : 0);
const sigH5 = (x) => (x.P3 == null || x.C3 == null ? 0 : x.P3 >= 90 && x.C3 <= 10 ? -1 : x.P3 <= 10 && x.C3 >= 90 ? 1 : 0);
function events(recs, sig, h, w) {
  const ev = recs.filter((x) => inWin(x, w) && x.r[h] != null && sig(x)).map((x) => ({ wk: x.wk, k: x.k, v: sig(x) * x.r[h] }));
  const n = ev.length; if (!n) return { n: 0, hit: null, mean: null, t: null, ev };
  return { n, hit: r3(ev.filter((e) => e.v > 0).length / n), mean: r2(mean(ev.map((e) => e.v)) * 100), t: r2(overlapT(ev.map((e) => e.v), ev.map((e) => e.k), h)), ev };
}
function pooledEvents(sig, h, w) {
  const by = new Map(); for (const m of MK) for (const e of events(S[m.k], sig, h, w).ev) { const a = by.get(e.wk) || []; a.push(e.v); by.set(e.wk, a); }
  const wks = [...by.keys()].sort(), c = wks.map((wk) => mean(by.get(wk))), all = [...by.values()].flat();
  return { events: all.length, weeks: c.length, hit: all.length ? r3(all.filter((v) => v > 0).length / all.length) : null, mean: c.length ? r2(mean(c) * 100) : null, t: r2(nwT(c, LAG[h])) };
}
const strip = ({ ev, ...o }) => o;

// ---------- hypotheses ----------
const HYP = [
  { id: 'H1', feat: 'P1', sign: -1, name: '1-year crowding (contrarian)' },
  { id: 'H2', feat: 'P3', sign: -1, name: '3-year crowding (contrarian)' },
  { id: 'H3', feat: 'Z', sign: 1, name: 'weekly flow (follow)' },
];
const EVH = [{ id: 'H4', sig: sigH4, name: 'extreme 90/10 of 3 years (contrarian)' }, { id: 'H5', sig: sigH5, name: 'extreme with commercials opposite (contrarian)', run: H5_RUN }];

const primary = [];
for (const hy of HYP) for (const h of H) {
  const is = pooledIc(hy.feat, h, 'is'), oos = pooledIc(hy.feat, h, 'oos'), all = pooledIc(hy.feat, h, 'all');
  const c1 = is.ic != null && Math.sign(is.ic) === hy.sign && is.t != null && Math.abs(is.t) >= 2;
  const c2 = oos.ic != null && Math.sign(oos.ic) === hy.sign && oos.t != null && Math.abs(oos.t) >= 1.65 && Math.abs(oos.ic) >= 0.03;
  primary.push({ id: `${hy.id}-${HN[h]}`, hyp: hy.id, name: hy.name, horizon: HN[h], expected: hy.sign > 0 ? 'IC > 0' : 'IC < 0', is, oos, all, checks: { isSignificant: c1, oosConfirms: c2 }, verdict: c1 && c2 ? 'PASS' : 'FAIL' });
}
const pooledEv = [];
for (const e of EVH) for (const h of H) {
  if (e.run === false) { pooledEv.push({ id: `${e.id}-${HN[h]}`, hyp: e.id, name: e.name, horizon: HN[h], verdict: 'NOT RUN', why: `commercial positions are in ${(commShare * 100).toFixed(0)}% of the cached weeks (needs 90%); runs on the next full CFTC re-fetch` }); continue; }
  const is = pooledEvents(e.sig, h, 'is'), oos = pooledEvents(e.sig, h, 'oos');
  const pass = is.t != null && is.t >= 2 && oos.mean != null && oos.mean > 0 && oos.t != null && oos.t >= 1.65;
  pooledEv.push({ id: `${e.id}-${HN[h]}`, hyp: e.id, name: e.name, horizon: HN[h], is, oos, verdict: pass ? 'PASS' : 'FAIL' });
}

// per market cells
const markets = {}, desk = {};
for (const m of MK) {
  const R = S[m.k], cells = [], passed = [];
  for (const hy of HYP) for (const h of H) {
    const is = icCell(R, hy.feat, h, 'is'), oos = icCell(R, hy.feat, h, 'oos'), all = icCell(R, hy.feat, h, 'all');
    const ok1 = is.ic != null && Math.sign(is.ic) === hy.sign && Math.abs(is.t || 0) >= 2 && Math.abs(is.ic) >= 0.05;
    const ok2 = oos.ic != null && Math.sign(oos.ic) === hy.sign && Math.abs(oos.t || 0) >= 1.65 && Math.abs(oos.ic) >= 0.05;
    const c = { id: `${hy.id}-${HN[h]}`, is, oos, all, pass: ok1 && ok2, isPass: ok1 }; cells.push(c);
    if (c.pass) passed.push({ id: c.id, label: `${hy.name}, ${HN[h]}: OOS IC ${oos.ic} (t ${oos.t}, ${oos.n} weeks)` });
  }
  for (const e of EVH) for (const h of H) {
    if (e.run === false) { cells.push({ id: `${e.id}-${HN[h]}`, notRun: true }); continue; }
    const is = strip(events(R, e.sig, h, 'is')), oos = strip(events(R, e.sig, h, 'oos'));
    const ok1 = is.n >= 15 && is.hit >= 0.55 && is.t != null && is.t >= 2, ok2 = oos.n >= 8 && oos.mean > 0 && oos.hit >= 0.55;
    const c = { id: `${e.id}-${HN[h]}`, is, oos, pass: ok1 && ok2, isPass: ok1 }; cells.push(c);
    if (c.pass) passed.push({ id: c.id, label: `${e.name}, ${HN[h]}: OOS ${oos.n} cases, ${Math.round(oos.hit * 100)}% right, ${oos.mean}% a case` });
  }
  const base = {}; for (const h of H) { const rr = R.filter((x) => inWin(x, 'all') && x.r[h] != null).map((x) => x.r[h]); base[HN[h]] = rr.length ? r3(rr.filter((v) => v > 0).length / rr.length) : null; }
  markets[m.k] = { name: m.name, who: m.ds === 'dis' ? 'managed money' : 'leveraged funds', quote: m.sign < 0 ? `returns in the futures' direction (${m.name} inverted)` : null, base, cells };
  const g = (id) => cells.find((c) => c.id === id);
  desk[m.k] = { passed, ic: { p1_4w: { is: g('H1-4w').is.ic, oos: g('H1-4w').oos.ic }, p3_4w: { is: g('H2-4w').is.ic, oos: g('H2-4w').oos.ic }, z_1w: { is: g('H3-1w').is.ic, oos: g('H3-1w').oos.ic } } };
}

// ---------- diagnostics ----------
const diag = {};
diag.oiNormalisedP3_4w = { pooled: { is: pooledIc('P3oi', 20, 'is'), oos: pooledIc('P3oi', 20, 'oos') }, markets: Object.fromEntries(MK.map((m) => [m.k, { is: icCell(S[m.k], 'P3oi', 20, 'is'), oos: icCell(S[m.k], 'P3oi', 20, 'oos') }])) };
{ // old timing, H4 4w, whole 2020+ incl. late weeks, naive t (what the desk used to do) vs the new timing on the same rule
  const per = {}, allOld = [], allNew = [];
  for (const m of MK) {
    const ev = S[m.k].filter((x) => x.d >= IS[0] && x.old[20] != null && sigH4(x)), xs = ev.map((x) => sigH4(x) * x.old[20]);
    const nw = S[m.k].filter((x) => inWin(x, 'all') && x.r[20] != null && sigH4(x)), ys = nw.map((x) => sigH4(x) * x.r[20]);
    const sdv = (a) => { const mm = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - mm) ** 2, 0) / (a.length - 1)); };
    per[m.k] = { old: xs.length > 2 ? { n: xs.length, hit: r3(xs.filter((v) => v > 0).length / xs.length), mean: r2(mean(xs) * 100), naiveT: r2(mean(xs) / (sdv(xs) / Math.sqrt(xs.length))) } : { n: xs.length },
      new: ys.length > 2 ? { n: ys.length, hit: r3(ys.filter((v) => v > 0).length / ys.length), mean: r2(mean(ys) * 100), t: r2(overlapT(ys, nw.map((x) => x.k), 20)) } : { n: ys.length } };
    allOld.push(...xs); allNew.push(...ys);
  }
  diag.oldTimingH4_4w = { note: 'old = as-of + 6 days for every report, Sunday stubs counted as days, late weeks kept, naive t; new = this study (3-year percentile only when 156 reports exist, in both)', markets: per };
}
{ // quintiles of P3, pooled 4w, IS + OOS
  const q = [[], [], [], [], []];
  for (const m of MK) for (const x of S[m.k]) if (inWin(x, 'all') && x.P3 != null && x.r[20] != null) q[Math.min(4, Math.floor(x.P3 / 20))].push(x.r[20]);
  diag.p3Quintiles4w = q.map((a, i) => ({ q: `${i * 20}-${i * 20 + 20}`, n: a.length, meanPct: a.length ? r2(mean(a) * 100) : null, up: a.length ? r3(a.filter((v) => v > 0).length / a.length) : null }));
}
{ // gold by year, H2 4w
  const g = S.gold, ys = [...new Set(g.filter((x) => inWin(x, 'all')).map((x) => x.d.slice(0, 4)))];
  diag.goldByYearH2_4w = ys.map((y) => { const ok = g.filter((x) => inWin(x, 'all') && x.d.slice(0, 4) === y && x.P3 != null && x.r[20] != null); if (ok.length < 10) return { year: y, n: ok.length, ic: null };
    const zx = zs(ranks(ok.map((x) => x.P3))), zr = zs(ranks(ok.map((x) => x.r[20]))); return { year: y, n: ok.length, ic: r3(mean(zx.map((v, i) => v * zr[i]))) }; });
}

// ---------- verdict ----------
const anyPass = primary.some((p) => p.verdict === 'PASS') || pooledEv.some((p) => p.verdict === 'PASS');
const marketsPassed = Object.entries(desk).filter(([, d]) => d.passed.length).map(([k, d]) => `${markets[k].name} (${d.passed.map((p) => p.id).join(', ')})`);
const gold = markets.gold.cells, gH2 = gold.find((c) => c.id === 'H2-4w'), gH1 = gold.find((c) => c.id === 'H1-4w');
const lastAsOf = Math.max(...MK.map((m) => S[m.k].filter((x) => x.r[20] != null).at(-1).t));
const window = `IS 2020-23, OOS 2024-${iso(lastAsOf).slice(0, 4)}`;
const verdict = {
  verdict: anyPass ? 'PASS' : 'FAIL',
  headline: anyPass
    ? `PASS: ${[...primary, ...pooledEv].filter((p) => p.verdict === 'PASS').map((p) => p.id).join(', ')} passed in and out of sample.`
    : `FAIL: no pooled positioning signal (crowding, flow or extremes) passed in and out of sample at 1 or 4 weeks${marketsPassed.length ? `; single-market cells that passed: ${marketsPassed.join('; ')}` : '; no single market passed either'}. Gold 3-year crowding 4-week IC ${gH2.is.ic} in sample, ${gH2.oos.ic} out of sample (prior ${PRIOR_GOLD_IC > 0 ? '+' : ''}${PRIOR_GOLD_IC}).`,
};

// the lab page's candidate table: the primary pooled tests and the pooled event tests (n = weeks or events, t, hit rate)
const candidates = [
  ...primary.map((p) => ({ rule: `${p.hyp} ${p.name}, ${p.horizon}, pooled: IC ${p.is.ic} IS / ${p.oos.ic} OOS`, verdict: p.verdict, is: { n: p.is.weeks, t: p.is.t }, oos: { n: p.oos.weeks, t: p.oos.t } })),
  ...pooledEv.map((p) => p.verdict === 'NOT RUN' ? { rule: `${p.hyp} ${p.name}, ${p.horizon}: not run (${p.why})`, verdict: 'NOT RUN' }
    : { rule: `${p.hyp} ${p.name}, ${p.horizon}, pooled: ${p.is.mean}% / ${p.oos.mean}% a week with an event`, verdict: p.verdict, is: { n: p.is.events, t: p.is.t, wr: p.is.hit }, oos: { n: p.oos.events, t: p.oos.t, wr: p.oos.hit } }),
];

const out = {
  topic: 'cot-positioning', title: 'COT positioning: does large-speculator positioning predict 1- and 4-week returns?',
  built: new Date().toISOString(), preregistration: 'research/edge/cot-positioning/preregistration.md', status: 'ok',
  system: 'CFTC COT (TFF leveraged funds; Disaggregated managed money for gold), council-data macro/cot-raw.json 2019-2026; OANDA daily closes',
  variantsTried: HYP.length * H.length + EVH.length * H.length,
  window, split: { is: IS, oos: [OOS_FROM, iso(lastAsOf)], lateExcluded: LATE }, timing: 'known from 00:00 UTC of the first Monday after the as-of date; entry at the next weekday close; 1w = 5, 4w = 20 weekday closes; futures direction',
  sources, coverage, commercialsShare: r3(commShare), verdict, primary, pooledEvents: pooledEv, markets, desk, diagnostics: diag, candidates,
  prior: { goldCrowdingIc: PRIOR_GOLD_IC, gold: { 'H2-4w': { is: gH2.is, oos: gH2.oos }, 'H1-4w': { is: gH1.is, oos: gH1.oos } } },
  notes: 'Paper research only. IC t-stats are Newey-West (lag 2 for 1w, 6 for 4w); event t allows for overlapping windows. History is 2019+ (what the council caches); a long-history replication needs a run where CFTC resolves.',
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ verdict, window, commShare: r3(commShare) }, null, 1));
for (const p of primary) console.log(p.id, 'IS', JSON.stringify(p.is), 'OOS', JSON.stringify(p.oos), p.verdict);
for (const p of pooledEv) console.log(p.id, p.verdict === 'NOT RUN' ? 'NOT RUN' : `IS ${JSON.stringify(p.is)} OOS ${JSON.stringify(p.oos)} ${p.verdict}`);
for (const m of MK) console.log(m.k, markets[m.k].cells.filter((c) => !c.notRun).map((c) => `${c.id}:${c.is.ic ?? c.is.mean}/${c.oos.ic ?? c.oos.mean}${c.isPass ? '*' : ''}${c.pass ? 'P' : ''}`).join(' '));
