// Edge research · timing: time-of-day / session-open / weekday windows on the multi-year engine replay (replay.mjs output).
//   node research/edge/timing/analyze.mjs <outDir> <resultDir>
// Walk-forward: windows are chosen ONLY on 2018-2023 (in-sample); 2024-2026 (out-of-sample) is reported untouched.
// Writes <resultDir>/result.json and <resultDir>/tables.md (the stats tables and the hour x market heatmaps).
import fs from 'node:fs';
import path from 'node:path';

const [OUT, RES] = process.argv.slice(2);
const rows = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^[a-z]+-\d{4}\.json$/.test(f))) {
  const j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  for (const r of j.rows) { const o = Object.fromEntries(j.cols.map((c, i) => [c, r[i]])); rows.push(o); }
}
rows.sort((a, b) => a.opened - b.opened);
const IS_END = Date.UTC(2024, 0, 1) / 1000;

// ── clocks: UTC, London and New York local time (DST-aware) ──
const lastSun = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
const nthSun = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); return (7 - d.getUTCDay()) % 7 + 1 + 7 * (n - 1); };
const ukDst = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= Date.UTC(y, 2, lastSun(y, 2), 1) / 1000 && t < Date.UTC(y, 9, lastSun(y, 9), 1) / 1000; };
const usDst = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= Date.UTC(y, 2, nthSun(y, 2, 2), 7) / 1000 && t < Date.UTC(y, 10, nthSun(y, 10, 1), 6) / 1000; };
const clock = (t, offH) => { const d = new Date((t + offH * 3600) * 1000); return { h: d.getUTCHours(), m: d.getUTCMinutes(), wd: d.getUTCDay(), mod: d.getUTCHours() * 60 + d.getUTCMinutes() }; };
for (const x of rows) {
  const t = x.opened;
  x.year = new Date(t * 1000).getUTCFullYear();
  x.oos = t >= IS_END;
  x.u = clock(t, 0); x.ln = clock(t, ukDst(t) ? 1 : 0); x.ny = clock(t, usDst(t) ? -4 : -5);
  x.session = x.u.h < 7 ? 'asia' : x.u.h < 12 ? 'london' : x.u.h < 16 ? 'overlap' : x.u.h < 21 ? 'newyork' : 'late';   // the live trader's (fixed UTC)
  x.net = x.R_none - x.cost; x.gross = x.R_none;
  // NY trading day (17:00 NY rollover) weekday: Monday's Asia starts Sunday 17:00 NY
  x.tdWd = clock(t + 7 * 3600, usDst(t) ? -4 : -5).wd;
}

// ── time windows (signal time). Each one has a market-microstructure reason to exist, stated in RESULT.md ──
const between = (mod, a, b) => mod >= a && mod < b;
const WINDOWS = [
  ...Array.from({ length: 24 }, (_, h) => [`UTC ${String(h).padStart(2, '0')}:00`, (x) => x.u.h === h, 'hour']),
  ...[0, 1, 2, 3].map((q) => [`minute :${String(q * 15).padStart(2, '0')}-:${String(q * 15 + 14).padStart(2, '0')}`, (x) => Math.floor(x.u.m / 15) === q, 'minute']),
  ['minute :55-:09 (around the hour)', (x) => x.u.m >= 55 || x.u.m < 10, 'minute'],
  ['Tokyo open 00:00-00:59 UTC', (x) => x.u.h === 0, 'open'],
  ['Frankfurt/London pre-open 07:00-07:59 London', (x) => x.ln.h === 7, 'open'],
  ['London open first 30 min (08:00-08:29 London)', (x) => between(x.ln.mod, 480, 510), 'open'],
  ['London open first 60 min (08:00-08:59 London)', (x) => x.ln.h === 8, 'open'],
  ['London open, fixed UTC 07:00-07:59', (x) => x.u.h === 7, 'open'],
  ['London open, fixed UTC 08:00-08:59', (x) => x.u.h === 8, 'open'],
  ['US data 08:25-08:59 New York', (x) => between(x.ny.mod, 505, 540), 'news'],
  ['NY cash open first 30 min (09:30-09:59 NY)', (x) => between(x.ny.mod, 570, 600), 'open'],
  ['NY cash open first 60 min (09:30-10:29 NY)', (x) => between(x.ny.mod, 570, 630), 'open'],
  ['NY cash open, fixed UTC 13:30-14:29', (x) => between(x.u.mod, 810, 870), 'open'],
  ['NY 10:00 data (10:00-10:29 NY)', (x) => between(x.ny.mod, 600, 630), 'news'],
  ['London fix / London close 16:00-16:59 London', (x) => x.ln.h === 16, 'close'],
  ['London last 30 min (16:00-16:29 London)', (x) => between(x.ln.mod, 960, 990), 'close'],
  ['NY last 30 min of cash (15:30-15:59 NY)', (x) => between(x.ny.mod, 930, 960), 'close'],
  ['NY afternoon 12:00-16:59 NY', (x) => between(x.ny.mod, 720, 1020), 'close'],
  ['Rollover 16:30-18:29 NY (spread widening)', (x) => between(x.ny.mod, 990, 1110), 'close'],
  ['After NY close 17:00-23:59 UTC', (x) => x.u.h >= 17, 'close'],
  ['Friday after 12:00 NY', (x) => x.ny.wd === 5 && x.ny.mod >= 720, 'week'],
  ['Friday (whole NY day)', (x) => x.tdWd === 5, 'week'],
  ['Monday Asia (Sun 17:00 NY to Mon 08:00 London)', (x) => x.tdWd === 1 && !(x.ln.wd === 1 && x.ln.mod >= 480), 'week'],
  ['Monday (whole NY day)', (x) => x.tdWd === 1, 'week'],
  ...[2, 3, 4].map((d) => [`${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][d]} (whole NY day)`, (x) => x.tdWd === d, 'week']),
];

// ── stats ──
function stats(a, key = 'net') {
  const n = a.length; if (!n) return { n: 0, wr: null, exp: null, R: 0, maxDD: 0, streak: 0, t: null };
  let s = 0, ss = 0, w = 0, cum = 0, pk = 0, dd = 0, st = 0, worst = 0;
  for (const x of a) { const r = x[key]; s += r; ss += r * r; if (r > 0) w++; cum += r; pk = Math.max(pk, cum); dd = Math.min(dd, cum - pk); if (r < 0) { st++; worst = Math.max(worst, st); } else st = 0; }
  const m = s / n, sd = n > 1 ? Math.sqrt(Math.max(0, (ss - n * m * m) / (n - 1))) : 0;
  return { n, wr: +(w / n).toFixed(3), exp: +m.toFixed(3), R: +s.toFixed(1), maxDD: +dd.toFixed(1), streak: worst, t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : null };
}
const welch = (a, b) => { const A = stats(a), B = stats(b); if (A.n < 2 || B.n < 2) return 0;
  const v = (arr, m) => arr.reduce((q, x) => q + (x.net - m) ** 2, 0) / (arr.length - 1);
  return (A.exp - B.exp) / Math.sqrt(v(a, A.exp) / A.n + v(b, B.exp) / B.n); };
const years = (a) => Object.fromEntries([...new Set(a.map((x) => x.year))].sort().map((y) => [y, stats(a.filter((x) => x.year === y))]));

// ── setups: universe (the live non-session filters) and baseline (plus the live sessions) ──
const SETUPS = {
  scalp: { label: 'Scalp M15->M1 (live: against D1, not Asia/overlap, skips AUD/USD, rr >= 1.2)',
    U: (x) => x.setup === 'scalp' && x.d1 === 'against' && x.market !== 'audusd' && x.rr >= 1.2,
    B: (x) => x.session !== 'asia' && x.session !== 'overlap' },
  intraday: { label: 'Intraday H1->M5 (shadow: rr 1.2-10, all hours)', U: (x) => x.setup === 'intraday' && x.rr >= 1.2 && x.rr <= 10, B: () => true },
  rscalp: { label: 'Retrace M15->M1 (shadow: rr >= 3)', U: (x) => x.setup === 'rscalp' && x.rr >= 3, B: () => true },
  rintra: { label: 'Retrace H1->M5 (shadow: skips USD/CHF, rr >= 1.2)', U: (x) => x.setup === 'rintra' && x.market !== 'usdchf' && x.rr >= 1.2, B: () => true },
};
const both = (a) => ({ is: stats(a.filter((x) => !x.oos)), oos: stats(a.filter((x) => x.oos)) });
const res = { topic: 'timing', system: 'MERIDIAN council engine (council/engine.mjs) — Scalp, Intraday, Retrace M15->M1, Retrace H1->M5', data: {}, setups: {}, candidates: [], selectedIS: [], variantsTried: 0, heatmaps: {} };
res.data = { trades: rows.length, from: new Date(rows[0].opened * 1000).toISOString().slice(0, 10), to: new Date(rows.at(-1).opened * 1000).toISOString().slice(0, 10),
  markets: [...new Set(rows.map((x) => x.market))], inSample: '2018-2023', outOfSample: '2024-2026 (to Oct 2026)' };
const md = [];
for (const [k, S] of Object.entries(SETUPS)) {
  const U = rows.filter(S.U), B = U.filter(S.B);
  const base = both(B), baseG = { is: stats(B.filter((x) => !x.oos), 'gross'), oos: stats(B.filter((x) => x.oos), 'gross') };
  res.setups[k] = { label: S.label, baseline: base, baselineGross: baseG, baselineYears: years(B) };
  md.push(`\n### ${S.label}\n\nBaseline net: IS n${base.is.n} exp ${base.is.exp} (t ${base.is.t}) | OOS n${base.oos.n} exp ${base.oos.exp} (t ${base.oos.t}). Gross: IS ${baseG.is.exp} | OOS ${baseG.oos.exp}.\n`);
  md.push('| window | rule | IS n | IS exp in window | IS exp rest | IS t(diff) | rule IS exp | rule OOS n | rule OOS exp | baseline OOS exp | OOS window exp (n) | OOS years + | verdict |');
  md.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, fn, fam] of WINDOWS) {
    const inB = B.filter(fn), outB = B.filter((x) => !fn(x)), inU = U.filter(fn);
    const addable = inU.length > inB.length;   // the window reaches hours the live sessions skip
    const variants = [['drop', outB, inB]];
    if (addable) variants.push(['add', B.concat(inU.filter((x) => !S.B(x))).sort((a, b) => a.opened - b.opened), inU.filter((x) => !S.B(x))]);
    for (const [rule, kept, win] of variants) {
      res.variantsTried++;
      const wIS = win.filter((x) => !x.oos), restIS = (rule === 'drop' ? outB : B).filter((x) => !x.oos);
      if (wIS.length < 30) continue;
      const tDiff = welch(wIS, restIS), sIS = stats(wIS), rIS = stats(restIS);
      const ruleIS = stats(kept.filter((x) => !x.oos));
      // in-sample selection: dropping a window that is clearly worse, or adding one that is clearly better (|t| >= 2), and the rule improves IS
      const pick = rule === 'drop' ? tDiff <= -2 && ruleIS.exp > base.is.exp : tDiff >= 2 && ruleIS.exp > base.is.exp && sIS.exp > 0;
      if (!pick) continue;
      const ruleOOS = stats(kept.filter((x) => x.oos)), wOOS = stats(win.filter((x) => x.oos));
      const yrs = years(kept.filter((x) => x.oos)), pos = Object.values(yrs).filter((s) => s.exp > 0).length, ny = Object.keys(yrs).length;
      const pass = ruleOOS.n >= 100 && ruleOOS.exp > 0 && ruleOOS.exp > base.oos.exp && pos >= Math.ceil(ny * 2 / 3)
        && (rule === 'drop' ? wOOS.exp < base.oos.exp : wOOS.exp > 0);   // and the window itself still differs the same way OOS
      const c = { setup: k, window: name, family: fam, rule: `${k}: ${rule === 'drop' ? 'skip' : 'also trade'} ${name}`, is: ruleIS, oos: ruleOOS, years: years(kept),
        window_is: sIS, window_oos: wOOS, rest_is: rIS, tDiffIS: +tDiff.toFixed(2), baseline: base, verdict: pass ? 'PASS' : 'FAIL' };
      res.selectedIS.push(c);
      md.push(`| ${name} | ${rule} | ${sIS.n} | ${sIS.exp} | ${rIS.exp} | ${tDiff.toFixed(2)} | ${ruleIS.exp} | ${ruleOOS.n} | ${ruleOOS.exp} | ${base.oos.exp} | ${wOOS.exp} (${wOOS.n}) | ${pos}/${ny} | ${pass ? 'PASS' : 'FAIL'} |`);
    }
  }
  // every window, selected or not: inside vs the rest, IS and OOS, on the universe (all hours) — the descriptive table
  md.push(`\n#### Every window · ${k} · universe without the session rule: net R/trade inside the window (n) vs outside, IS and OOS\n`);
  md.push('| window | IS in | IS rest | OOS in | OOS rest | same sign both halves |'); md.push('|---|---|---|---|---|---|');
  const desc = [];
  for (const [name, fn, fam] of WINDOWS) {
    if (fam === 'hour') continue;
    const a = U.filter(fn), b = U.filter((x) => !fn(x));
    const si = stats(a.filter((x) => !x.oos)), ri = stats(b.filter((x) => !x.oos)), so = stats(a.filter((x) => x.oos)), ro = stats(b.filter((x) => x.oos));
    const same = Math.sign(si.exp - ri.exp) === Math.sign(so.exp - ro.exp);
    desc.push({ window: name, isIn: si, isRest: ri, oosIn: so, oosRest: ro, consistent: same });
    md.push(`| ${name} | ${si.exp} (${si.n}) | ${ri.exp} | ${so.exp} (${so.n}) | ${ro.exp} | ${same ? (si.exp > ri.exp ? 'better' : 'worse') : 'no'} |`);
  }
  res.setups[k].windows = desc;
  // heatmap: OOS net expectancy by UTC hour x market, on the universe (all hours, so the hours the live rule skips show too)
  const mk = [...new Set(U.map((x) => x.market))].sort();
  const H = { markets: mk, rows: [] };
  md.push(`\n#### Heatmap · ${k} · OOS 2024-2026 net expectancy R/trade (n) by signal hour UTC x market — universe without the session rule${k === 'scalp' ? ' (AUD/USD shown for reference although the live rule skips it)' : ''}\n`);
  const UH = k === 'scalp' ? rows.filter((x) => x.setup === 'scalp' && x.d1 === 'against' && x.rr >= 1.2) : U;
  const mk2 = [...new Set(UH.map((x) => x.market))].sort(); H.markets = mk2;
  md.push(`| UTC hour | ${mk2.join(' | ')} | all | IS all |`); md.push(`|---|${mk2.map(() => '---').join('|')}|---|---|`);
  for (let h = 0; h < 24; h++) {
    const cell = (a) => { const s = stats(a); return s.n ? `${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(2)} (${s.n})` : '·'; };
    const o = UH.filter((x) => x.oos && x.u.h === h);
    const r = { hour: h, cells: Object.fromEntries(mk2.map((m) => { const s = stats(o.filter((x) => x.market === m)); return [m, { exp: s.exp, n: s.n }]; })), all: stats(o), isAll: stats(UH.filter((x) => !x.oos && x.u.h === h)) };
    H.rows.push(r);
    md.push(`| ${String(h).padStart(2, '0')}${k === 'scalp' && (h < 7 || (h >= 12 && h < 16)) ? ' (off)' : ''} | ${mk2.map((m) => cell(o.filter((x) => x.market === m))).join(' | ')} | ${cell(o)} | ${cell(UH.filter((x) => !x.oos && x.u.h === h))} |`);
  }
  res.heatmaps[k] = H;
}
res.candidates = res.selectedIS.filter((c) => c.verdict === 'PASS');
fs.mkdirSync(RES, { recursive: true });
fs.writeFileSync(path.join(RES, 'tables.md'), md.join('\n') + '\n');
// the shared schema: stats blocks {n, wr, exp, R, maxDD, t}; baseline = the live Scalp sleeve, every setup's baseline in baselines
const sb = (s) => ({ n: s.n, wr: s.wr, exp: s.exp, R: s.R, maxDD: s.maxDD, t: s.t, streak: s.streak });
fs.writeFileSync(path.join(RES, 'result.json'), JSON.stringify({
  topic: 'timing', system: res.system, data: res.data,
  baseline: { is: sb(res.setups.scalp.baseline.is), oos: sb(res.setups.scalp.baseline.oos) },
  baselines: Object.fromEntries(Object.entries(res.setups).map(([k, v]) => [k, { label: v.label, is: sb(v.baseline.is), oos: sb(v.baseline.oos), grossIs: sb(v.baselineGross.is), grossOos: sb(v.baselineGross.oos), years: Object.fromEntries(Object.entries(v.baselineYears).map(([y, s]) => [y, sb(s)])) }])),
  candidates: res.selectedIS.map((c) => ({ rule: c.rule, is: sb(c.is), oos: sb(c.oos), years: Object.fromEntries(Object.entries(c.years).map(([y, s]) => [y, sb(s)])),
    windowIs: sb(c.window_is), windowOos: sb(c.window_oos), tDiffIS: c.tDiffIS, verdict: c.verdict })),
  variantsTried: res.variantsTried,
  heatmaps: res.heatmaps,
  notes: 'net = R (no break-even) minus one spread in R; IS 2018-2023, OOS 2024-Oct 2026; a window is selected only on IS (|Welch t| >= 2 vs the rest and the rule improves IS), then judged OOS by the preamble criteria plus: the window itself must still be worse (drop) / positive (add) OOS.',
}, null, 1));
console.log(md.join('\n'));
console.log(`\nvariants tried ${res.variantsTried}; selected in-sample ${res.selectedIS.length}; pass OOS ${res.candidates.length}`);
