// Edge research · announcement-premium (PREREGISTRATION.md, pushed alone before this file): a long held over the UTC day of a US
// CPI or payrolls release, against the other non-FOMC NYSE weekdays, on SPX500, NAS100, US30, USB10Y and USB30Y CFDs.
//   node run.mjs fetch <dir>   copies the council's daily candles out of the council-data branch (git show, no network)
//   node --use-env-proxy run.mjs check   release-minute check of the 2008-09 payrolls rule dates (USB10Y M5 through the site's
//                              candle proxy) -> datecheck.json beside this file (reported only, drops nothing)
//   node run.mjs full <dir>    the study -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { zonedToUtc } from '../../../council/events.mjs';
import { releaseDays, fomcDates, cpiDates, nfpDates, nfpRuleDates, isTradingDay, CPI_FIRST_YEAR, CPI_MEMORY_DROPPED } from './dates.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const MARKETS = [
  { id: 'T1', key: 'spx500', name: 'SPX500 (US500)', cost: 0.04 },
  { id: 'T2', key: 'nas100', name: 'NAS100', cost: 0.05 },
  { id: 'T3', key: 'us30', name: 'US30', cost: 0.05 },
  { id: 'T4', key: 'usb10y', name: 'USB10Y (10-year Treasury CFD)', cost: 0.10 },
  { id: 'T5', key: 'usb30y', name: 'USB30Y (30-year Treasury CFD)', cost: 0.10 },
];
export const FROM = '2008-01-01', SPLIT = '2017-01-01', FIN_ADD = 2.5, SEEDS = 40, SEEDS_NEED = 38, MIN_N = 100;

const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const r2 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(2), r3 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(3);
const r4 = (x) => x == null || !Number.isFinite(x) ? null : +x.toFixed(4);

// ─── statistics (the turnaround-tuesday functions, copied) ───
export function stats(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, t: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, t: sd > 0 ? mean / (sd / Math.sqrt(n)) : null };
}
export function welch(a, b) {
  const A = stats(a), B = stats(b);
  if (A.n < 2 || B.n < 2) return { diff: A.n && B.n ? A.mean - B.mean : null, t: null };
  return { diff: A.mean - B.mean, t: (A.mean - B.mean) / Math.sqrt(A.sd ** 2 / A.n + B.sd ** 2 / B.n) };
}
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
export const pOneSided = (t) => t == null ? 1 : 0.5 * (1 - erf(t / Math.SQRT2));
export function holm(ps) {
  const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length);
  let run = 0;
  order.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); adj[i] = run; });
  return adj;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const meanOf = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

// ─── financing: (DGS2 last weekly value on or before D + 2.5 %) / 365, one night, in % of the price ───
export function rateOf(dgs2) { return (ymd) => { let v = null; for (const [d, x] of dgs2) { if (d > ymd) break; v = x; } return v; }; }
export const finPct = (rate) => rate == null ? null : (rate + FIN_ADD) / 365;

// ─── day returns from a daily file: Map ymd -> % return close(prev candle on file) to close(D) ───
export function dayReturns(rows) {
  const out = new Map();
  for (let i = 1; i < rows.length; i++) { const [t, , , , c] = rows[i], pc = rows[i - 1][4]; if (pc > 0 && c > 0) out.set(ymdOf(t * 1000), (c / pc - 1) * 100); }
  return out;
}

// ─── one test on one market ───
// rel: release days [{ d, types }]; excl: Set of every CPI / payrolls / FOMC date (never a comparison day)
export function testMarket(M, rows, rel, excl, rate, until) {
  const R = dayReturns(rows), last = until;
  const win = (d) => (d < SPLIT ? 'is' : 'oos');
  const relRows = [], missing = [];
  for (const x of rel) {
    if (x.d < FROM || x.d > last) continue;
    if (!R.has(x.d)) { missing.push(x.d); continue; }
    const f = finPct(rate(x.d)), g = R.get(x.d);
    relRows.push({ d: x.d, types: x.types, w: win(x.d), gross: g, cost: M.cost + f, fin: f });
  }
  const other = [];
  for (const [d, g] of R) if (d >= FROM && d <= last && isTradingDay(d) && !excl.has(d)) other.push({ d, w: win(d), gross: g, fin: finPct(rate(d)) });
  const part = (w) => {
    const A = relRows.filter((x) => x.w === w), B = other.filter((x) => x.w === w), Bg = B.map((x) => x.gross);
    const net = A.map((x) => x.gross - x.cost), net2 = A.map((x) => x.gross - 2 * x.cost), gross = A.map((x) => x.gross);
    const wn = welch(net, Bg), wg = welch(gross, Bg), w2 = welch(net2, Bg), sn = stats(net);
    const type = (t) => { const g2 = A.filter((x) => x.types.includes(t)).map((x) => x.gross); const w3 = welch(g2, Bg); return { n: g2.length, gross: r4(meanOf(g2)), diffGross: r4(w3.diff), tGross: r2(w3.t) }; };
    return { n: A.length, nOther: B.length, from: A[0] && A[0].d, to: A.length ? A[A.length - 1].d : null,
      relGross: r4(meanOf(gross)), relNet: r4(sn.mean), relNetT: r2(sn.t), otherGross: r4(meanOf(Bg)), cost: r4(meanOf(A.map((x) => x.cost))),
      diffNet: r4(wn.diff), tNet: r2(wn.t), diffGross: r4(wg.diff), tGross: r2(wg.t), diffNet2: r4(w2.diff), tNet2: r2(w2.t),
      cpi: type('CPI'), nfp: type('NFP'), _t: wn.t };
  };
  const is = part('is'), oos = part('oos');
  // placebo: 40 seeds, as many OOS comparison days as OOS release days, charged the release-day costs
  const pool = other.filter((x) => x.w === 'oos'), seeds = [];
  for (let s = 1; s <= SEEDS; s++) {
    const rnd = rng(s), idx = pool.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const pick = new Set(idx.slice(0, oos.n)), a = [], b = [];
    pool.forEach((x, i) => { if (pick.has(i)) a.push(x.gross - M.cost - x.fin); else b.push(x.gross); });
    seeds.push(welch(a, b).t);
  }
  const sorted = [...seeds].sort((a, b) => a - b), q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const beaten = seeds.filter((t) => oos._t != null && t < oos._t).length;
  const years = {};
  for (const x of relRows) { const y = x.d.slice(0, 4); (years[y] ||= { rel: [], other: [] }).rel.push(x.gross - x.cost); }
  for (const x of other) { const y = x.d.slice(0, 4); (years[y] ||= { rel: [], other: [] }).other.push(x.gross); }
  const byYear = Object.entries(years).sort().map(([y, v]) => ({ y, n: v.rel.length, relNet: r4(meanOf(v.rel)), otherGross: r4(meanOf(v.other)), diff: v.rel.length ? r4(meanOf(v.rel) - meanOf(v.other)) : null }));
  delete is._t; const tOos = oos._t; delete oos._t;
  return { id: M.id, key: M.key, name: M.name, costRT: M.cost, missing, is, oos, pOne: pOneSided(tOos),
    placebo: { seeds: SEEDS, p5: r2(q(0.05)), p50: r2(q(0.5)), p95: r2(q(0.95)), beaten }, byYear };
}

export function judge(tests) {
  const adj = holm(tests.map((t) => t.pOne));
  tests.forEach((t, i) => {
    t.holmP = r4(adj[i]);
    t.checks = { t2Holm: t.oos.tNet != null && t.oos.tNet >= 2 && adj[i] < 0.05, nOk: t.oos.n >= MIN_N, sameSignIS: t.is.diffNet != null && t.is.diffNet > 0,
      cost2: t.oos.diffNet2 != null && t.oos.diffNet2 > 0, placebo: t.placebo.beaten >= SEEDS_NEED };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  const T1 = tests.find((t) => t.id === 'T1');
  return { verdict: T1 && T1.pass ? 'PASS' : 'FAIL', secondary: tests.filter((t) => t.id !== 'T1' && t.pass).map((t) => t.id) };
}

// ─── the whole study on a directory of daily files ───
export function study(files, dgs2, dateCheck) {
  const lasts = MARKETS.map((M) => ymdOf(files[M.key].rows.at(-1)[0] * 1000)), until = lasts.sort()[0];
  const { days: rel, dropped } = releaseDays(FROM, until);
  const excl = new Set([...cpiDates().map((x) => x.d), ...nfpDates().map((x) => x.d), ...fomcDates()]);
  const rate = rateOf(dgs2);
  const tests = MARKETS.map((M) => testMarket(M, files[M.key].rows, rel, excl, rate, until));
  const J = judge(tests);
  const funnel = { releaseDays: rel.length, cpi: rel.filter((x) => x.types.includes('CPI')).length, nfp: rel.filter((x) => x.types.includes('NFP')).length,
    both: rel.filter((x) => x.types.length > 1).length, dropped, cpiFirstYear: CPI_FIRST_YEAR, cpiMemoryDropped: CPI_MEMORY_DROPPED,
    nfpRule: nfpRuleDates().length, isDays: rel.filter((x) => x.d < SPLIT).length, oosDays: rel.filter((x) => x.d >= SPLIT).length };
  return { study: 'announcement-premium', built: new Date().toISOString().slice(0, 10), data: { from: FROM, until, split: SPLIT, src: 'council-data research/daily (OANDA mid, UTC days)', rateSrc: 'rates.json (FRED DGS2 weekly)' },
    funnel, dateCheck, tests, ...J, releaseDates: rel.map((x) => ({ d: x.d, types: x.types, src: x.src })) };
}

// ─── report ───
const sg = (x, d = 3) => x == null ? 'n/a' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`;
export function headline(S) {
  const T1 = S.tests.find((t) => t.id === 'T1');
  const reason = S.verdict === 'PASS' ? `SPX500 release days beat other days by ${sg(T1.oos.diffNet)} % net, t ${sg(T1.oos.tNet, 2)} OOS`
    : `SPX500 release days ${sg(T1.oos.diffNet)} % a day net vs other days 2017-26 (n ${T1.oos.n}, Welch t ${sg(T1.oos.tNet, 2)}); ${S.tests.filter((t) => t.pass).length} of 5 tests pass`;
  return `**Verdict: ${S.verdict}: ${reason}.**`;
}
export function report(S) {
  const L = [];
  L.push('# Announcement-day premium: a long over the CPI / payrolls release day, against other days: result', '', headline(S), '');
  L.push(`Pre-registered in \`PREREGISTRATION.md\` (pushed alone before \`dates.mjs\` and this run). Paper research only; nothing live changed; ICT and the gold book untouched. Prior: Savor and Wilson (JFQA 2013), equity and Treasury returns are higher on scheduled macro announcement days.`, '');
  L.push(`Unit: the OANDA UTC daily candle of the release's New York date (08:30 New York = 12:30 / 13:30 UTC, inside it): bought at 00:00 UTC, sold at 24:00 UTC. Release-day NET return (round trip + one night of financing at DGS2 + 2.5 %) against the other non-FOMC NYSE weekdays' GROSS return. In sample ${S.data.from} to 2016-12-31, out of sample 2017-01-01 to ${S.data.until}. Data: ${S.data.src}.`, '');
  L.push('## The five tests (out of sample decides; T1 is primary)', '');
  L.push('| test | market | OOS n | release net % | other gross % | diff net % | Welch t net | Holm p | diff gross % (t) | IS n | IS diff net % (t) | 2x costs diff % | placebo t p5 / p50 / p95 (beaten) | pass |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of S.tests) L.push(`| ${t.id} | ${t.name} | ${t.oos.n} | ${sg(t.oos.relNet)} | ${sg(t.oos.otherGross)} | ${sg(t.oos.diffNet)} | ${sg(t.oos.tNet, 2)} | ${t.holmP} | ${sg(t.oos.diffGross)} (${sg(t.oos.tGross, 2)}) | ${t.is.n} | ${sg(t.is.diffNet)} (${sg(t.is.tNet, 2)}) | ${sg(t.oos.diffNet2)} | ${sg(t.placebo.p5, 2)} / ${sg(t.placebo.p50, 2)} / ${sg(t.placebo.p95, 2)} (${t.placebo.beaten} of ${t.placebo.seeds}) | ${t.pass ? 'yes' : 'no'} |`);
  L.push('', 'Checks per test (all needed): OOS Welch t >= 2 with Holm p < 0.05; OOS n >= 100; in-sample difference > 0; OOS difference > 0 at 2x costs; OOS t above the placebo in at least 38 of 40 seeds.', '');
  for (const t of S.tests) L.push(`- ${t.id} ${t.name}: ${Object.entries(t.checks).map(([k, v]) => `${k} ${v ? 'yes' : 'no'}`).join(', ')}. Round trip ${t.costRT} %, mean cost with financing ${t.oos.cost} % a hold. Release day alone, OOS: ${sg(t.oos.relNet)} % net (one-sample t ${sg(t.oos.relNetT, 2)}), ${sg(t.oos.relGross)} % gross.${t.missing.length ? ` Release days without a candle: ${t.missing.join(', ')}.` : ''}`);
  if (S.secondary.length) L.push('', `Secondary tests passing while T1 does not (a hypothesis for their own pre-registration, not a pass): ${S.secondary.join(', ')}.`);
  L.push('', '## In sample and out of sample, gross and net', '');
  L.push('| test | window | n | release gross % | release net % | other gross % | diff gross % | t gross | diff net % | t net |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const t of S.tests) for (const [w, p] of [['IS 2008-16', t.is], [`OOS 2017-${S.data.until.slice(0, 4)}`, t.oos]]) L.push(`| ${t.id} | ${w} | ${p.n} | ${sg(p.relGross)} | ${sg(p.relNet)} | ${sg(p.otherGross)} | ${sg(p.diffGross)} | ${sg(p.tGross, 2)} | ${sg(p.diffNet)} | ${sg(p.tNet, 2)} |`);
  L.push('', '## CPI days and payrolls days apart (gross, against the other days; reported only)', '');
  L.push('| test | window | CPI n | CPI diff gross % (t) | payrolls n | payrolls diff gross % (t) |', '|---|---|---|---|---|---|');
  for (const t of S.tests) for (const [w, p] of [['IS', t.is], ['OOS', t.oos]]) L.push(`| ${t.id} | ${w} | ${p.cpi.n} | ${sg(p.cpi.diffGross)} (${sg(p.cpi.tGross, 2)}) | ${p.nfp.n} | ${sg(p.nfp.diffGross)} (${sg(p.nfp.tGross, 2)}) |`);
  const F = S.funnel;
  L.push('', '## Dates', '');
  L.push(`- ${F.releaseDays} release days used (${F.isDays} in sample, ${F.oosDays} out of sample): ${F.cpi} CPI, ${F.nfp} payrolls, ${F.both} both. Sources per date in \`dates.mjs\` and in result.json \`releaseDates\`.`);
  L.push(`- CPI from ${F.cpiFirstYear} only: 2008-2011 CPI dates cannot be written out reliably here, so those years are payrolls only (and their CPI days sit, unknown, among the comparison days). 2012-17 CPI dates are the cpi-follow study's memory list as kept by its spike check: ${F.cpiMemoryDropped.length} dates it dropped are not used (${F.cpiMemoryDropped.join(', ')}). 2018-21 BLS schedule, 2022 on council/events.mjs.`);
  L.push(`- Payrolls 2008-2021: the BLS rule (${F.nfpRule} dates), 2022 on council/events.mjs.`);
  L.push(`- Dropped: ${F.dropped.map((x) => `${x.d} (${x.types.join('+')}, ${x.why})`).join('; ')}.`);
  const C = S.dateCheck;
  if (C && C.rows) { const fl = C.rows.filter((x) => x.ratio == null || x.ratio < 1.5); L.push(`- Release-minute check of the 2008-09 payrolls rule dates (reported, drops nothing): USB10Y M5 range of the 08:30 New York candle against the median of the 8 nearest other Fridays; ${C.rows.length - fl.length} of ${C.rows.length} at 1.5x or more${fl.length ? `; under 1.5x or no candle: ${fl.map((x) => `${x.d} (${x.ratio == null ? 'n/a' : x.ratio + 'x'})`).join(', ')}` : ''}. Median ratio ${C.median}x.`); }
  else L.push('- Release-minute check of the 2008-09 payrolls rule dates: not run (no datecheck.json).');
  L.push('', '## By year (release net % vs other gross %, a day)', '');
  L.push(`| year | ${S.tests.map((t) => `${t.id} n / diff`).join(' | ')} |`, `|---|${S.tests.map(() => '---').join('|')}|`);
  const ys = [...new Set(S.tests.flatMap((t) => t.byYear.map((b) => b.y)))].filter((y) => y >= '2008').sort();
  for (const y of ys) L.push(`| ${y} | ${S.tests.map((t) => { const b = t.byYear.find((x) => x.y === y); return b ? `${b.n} / ${sg(b.diff)}` : 'n/a'; }).join(' | ')} |`);
  L.push('', '## Reading', '');
  L.push(S.verdict === 'PASS' ? 'T1 passed every pre-registered check. A paper proposal for the owner may follow; nothing live changes by itself.'
    : (() => { const g = S.tests.flatMap((t) => [t.is, t.oos]), lo = Math.min(...g.map((p) => p.diffGross)), hi = Math.max(...g.map((p) => p.diffGross)), tm = Math.max(...g.map((p) => Math.abs(p.tGross)));
      return `The pre-registered primary test (T1, SPX500) does not pass, so this is not an edge on the desk's CFDs and nothing here calls any of these streams one. Even before costs, release days do not differ measurably from other days on these UTC-day CFD returns: the gross differences run from ${sg(lo)} to ${sg(hi)} % a day across the five markets and both windows, the largest |t| ${tm.toFixed(2)}. The premium the paper reports is not seen here on 2008-${S.data.until.slice(0, 4)} OANDA CFD days (with CPI only from 2012), and after a round trip and a night of financing every stream is negative. Not tested: FOMC days (excluded on purpose, see pre-fomc-drift), other releases, the cash close instead of the UTC day.`; })());
  L.push('', `To repeat: \`node research/edge/announcement-premium/run.mjs fetch <dir>\` (git show from origin/council-data, no network), \`node --use-env-proxy research/edge/announcement-premium/run.mjs check\` (optional, rewrites datecheck.json), then \`node research/edge/announcement-premium/run.mjs full <dir>\`.`);
  return L.join('\n') + '\n';
}

// ─── the release-minute check (network) ───
async function check() {
  const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/bars';
  const rule = nfpRuleDates().filter((d) => d < '2010-01-01'), nfp = new Set(nfpRuleDates());
  const fridays = []; for (let t = Date.parse('2007-11-02T12:00:00Z'); ymdOf(t) <= '2010-02-26'; t += 7 * 86400e3) { const d = ymdOf(t); if (!nfp.has(d) && isTradingDay(d)) fridays.push(d); }
  const cache = new Map();
  const rng830 = async (d) => {
    if (cache.has(d)) return cache.get(d);
    const T = zonedToUtc(d, '08:30', 'America/New_York');
    let v = null;
    for (let k = 0; k < 3 && v == null; k++) {
      try { const r = await fetch(`${BASE}?sym=usb10y&tf=5m&from=${T}&to=${T + 300}`); if (r.ok) { const j = await r.json(); const b = (j.bars || []).find((x) => x.time === T); v = b ? b.high - b.low : null; if (!b) break; } }
      catch { /* retry */ }
      await new Promise((ok) => setTimeout(ok, 400));
    }
    cache.set(d, v); return v;
  };
  const rows = [];
  for (const d of rule) {
    const t = Date.parse(d), near = fridays.map((f) => [Math.abs(Date.parse(f) - t), f]).sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]);
    const v = await rng830(d), nv = []; for (const f of near) { const x = await rng830(f); if (x != null) nv.push(x); }
    nv.sort((a, b) => a - b); const med = nv.length >= 4 ? nv[nv.length >> 1] : null;
    rows.push({ d, range: v, nearMedian: med, ratio: v != null && med > 0 ? r2(v / med) : null });
    console.log(d, rows.at(-1).ratio);
  }
  const rs = rows.map((x) => x.ratio).filter((x) => x != null).sort((a, b) => a - b);
  const out = { src: 'OANDA mid USB10Y M5 through the site candle proxy', built: new Date().toISOString().slice(0, 10), rows, median: rs.length ? rs[rs.length >> 1] : null };
  fs.writeFileSync(path.join(HERE, 'datecheck.json'), JSON.stringify(out, null, 1) + '\n');
}

function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const M of MARKETS) fs.writeFileSync(path.join(dir, `${M.key}.json`), execFileSync('git', ['show', `origin/council-data:research/daily/${M.key}.json`], { maxBuffer: 1 << 28 }));
}
function full(dir) {
  const files = Object.fromEntries(MARKETS.map((M) => [M.key, JSON.parse(fs.readFileSync(path.join(dir, `${M.key}.json`), 'utf8'))]));
  const rates = JSON.parse(fs.readFileSync(path.join(HERE, 'rates.json'), 'utf8'));
  const dcf = path.join(HERE, 'datecheck.json'), dateCheck = fs.existsSync(dcf) ? JSON.parse(fs.readFileSync(dcf, 'utf8')) : null;
  const S = study(files, rates.DGS2, dateCheck);
  S.candidates = S.tests.map((t) => ({ rule: `${t.id}: long ${t.name} over the CPI / payrolls release day vs other days`, verdict: t.pass ? 'PASS' : 'FAIL', is: t.is.diffNet, oos: t.oos.diffNet }));
  const prev = path.join(HERE, 'result.json');
  if (fs.existsSync(prev)) { const p = JSON.parse(fs.readFileSync(prev, 'utf8')); const a = { ...p, built: S.built }; if (JSON.stringify(a) === JSON.stringify(S)) S.built = p.built; }
  fs.writeFileSync(prev, JSON.stringify(S, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(S));
  console.log(headline(S));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch' && dir) fetchAll(dir);
  else if (mode === 'check') await check();
  else if (mode === 'full' && dir) full(dir);
  else { console.error('usage: node run.mjs fetch <dir> | check | full <dir>'); process.exit(1); }
}
