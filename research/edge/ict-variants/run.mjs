// ICT A-setup variants (edge research, 9 Nov 2026; pre-registered in PLAN.md before the first run). Drives the ICT lab of the
// research MCP (api/_ictlab.js: runMarket = the desk's own signals / isASetup / sizeOf / P + the replay's simulate, its costs,
// stats and summarize) over the repo's research candles instead of OANDA, for the live A-rule and five variants, 2020 → Oct 2026,
// IS 2020-23 / OOS 2024-now, per market and per book (index = NQ+ES+YM, gold = GC). Paper research only: no rule changes.
//
//   git archive -o c.tar origin/council-data research/candles/{nsxusd-histdata,spxusd-histdata,xau-histdata,idx} && tar xf c.tar -C <dir>
//   node research/edge/ict-variants/run.mjs <dir> [outDir=research/edge/ict-variants]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { histStampUtc } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

const require = createRequire(import.meta.url);
const lab = require('../../../api/_ictlab.js');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(process.argv[2] || '.', 'research', 'candles');
const OUT = process.argv[3] || HERE;
const E = await lab.engine();

const FROM = Date.UTC(2020, 0, 1) / 1000, OOS = Date.UTC(2024, 0, 1) / 1000, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], OOSY = [2024, 2025, 2026];
const INDEX = ['nq', 'es', 'ym'], GOLD = ['gc'];

// ---- candles: research files → H1 on the UTC hour → the lab's own cleaning (labSource: positive prices, halt hour dropped) ----
function histH1(dir, pre) {   // HistData M1 csv.gz → UTC (council/histdata.mjs)
  const d = path.join(DIR, dir), m = new Map();
  for (const f of fs.readdirSync(d).filter((f) => f.startsWith(pre) && f.endsWith('.csv.gz')).sort()) {
    for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(d, f))).toString().split('\n')) {
      if (ln.length < 20) continue; const p = ln.split(';');
      const t = histStampUtc(ln);
      if (t < FROM - 400 * 86400) continue;
      const o = +p[1], h = +p[2], l = +p[3], c = +p[4], k = t - (t % 3600), b = m.get(k);
      if (!b) m.set(k, { time: k, open: o, high: h, low: l, close: c, last: t });
      else { if (h > b.high) b.high = h; if (l < b.low) b.low = l; if (t >= b.last) { b.close = c; b.last = t; } }
    }
  }
  return [...m.values()].sort((a, b) => a.time - b.time).map(({ last, ...b }) => b);
}
function dukaH1(sym) {   // Dukascopy 5m rows [t, o, h, l, c] (UTC), as the lab's fallback
  const d = path.join(DIR, 'idx'), m5 = [];
  for (const f of fs.readdirSync(d).filter((f) => f.startsWith(sym + '_')).sort()) for (const r of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(d, f))))) m5.push({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] });
  return E.agg(m5.sort((a, b) => a.time - b.time), 3600);
}
// api/_ictlab.js labSource's `clean`, verbatim in effect
const clean = (a) => a.filter((b) => [b.open, b.high, b.low, b.close, b.time].every((v) => isFinite(v) && v > 0) && !E.inHalt(b.time))
  .map((b) => ({ time: b.time, open: +b.open, high: Math.max(b.high, b.open, b.close), low: Math.min(b.low, b.open, b.close), close: +b.close }));
const SRC = { nq: () => histH1('nsxusd-histdata', 'NSXUSD'), es: () => histH1('spxusd-histdata', 'SPXUSD'), gc: () => histH1('xau-histdata', 'XAUUSD'), ym: () => dukaH1('USA30IDXUSD') };
const NAME = { nq: 'HistData NSXUSD M1 → H1', es: 'HistData SPXUSD M1 → H1', gc: 'HistData XAUUSD M1 → H1', ym: 'Dukascopy USA30IDXUSD 5m → H1 (2023 on)' };
const srcs = {};
for (const k of [...INDEX, ...GOLD]) {
  const H = clean(SRC[k]()), end = H.at(-1).time + 3600;
  srcs[k] = { H, D: E.dailyNY(H).filter((b) => b.time + 86400 <= end), end, src: NAME[k] };
  console.error(`${k}: ${H.length} H1 ${new Date(H[0].time * 1000).toISOString().slice(0, 10)} → ${new Date(H.at(-1).time * 1000).toISOString().slice(0, 16)}`);
}
const TO = Math.max(...Object.values(srcs).map((s) => s.end));

// ---- the variants, exactly as PLAN.md ----
const killzone = (g) => [3, 4, 5, 8, 9, 10, 11].includes(g.feat.etHour);
const pdRight = (g) => g.feat.pd != null && g.feat.pd < 0.5;   // pd is computed in side-mirrored prices: < 0.5 = buy in discount / sell in premium
const VARIANTS = [
  { id: 'V1 atr50', name: 'Stop cap 0.5x daily ATR (was 0.75x)', books: ['index', 'gold'], filters: { atr_max: 0.5 }, kind: 'filter' },
  { id: 'V2 killzone', name: 'ICT kill zones only (London 02-05, NY AM 07-11 ET)', books: ['index', 'gold'], pred: killzone, kind: 'filter' },
  { id: 'V3 htffvg', name: 'Sweep into an unfilled D1/H4 FVG', books: ['index', 'gold'], filters: { htf_fvg: true }, kind: 'filter' },
  { id: 'V4 pd', name: 'Buy in discount / sell in premium (20-day range)', books: ['index', 'gold'], pred: pdRight, kind: 'filter' },
  { id: 'V5 be1', name: 'Break-even at +1R (was +1.5R)', books: ['index'], params: { be: 1 }, kind: 'exit' },
];

// one rule set on one market through the lab's runMarket; a predicate filter rides on isASetup (checked before the busy rule, as filters are)
function run(k, v = {}) {
  const mk = lab.marketOf(k, E), Ev = v.pred ? { ...E, isASetup: (g, m) => E.isASetup(g, m) && v.pred(g) } : E, s = srcs[k];
  const r = lab.runMarket(Ev, mk, s, { from: FROM, to: TO, at: s.end, rule: 'A', filters: v.filters || {}, params: lab.cleanParams(v.params || {}), sizing: 'live', costOn: true });
  return r.trades.filter((t) => t.R != null).map((t) => ({ ...t, market: k, R2: +(2 * t.R - t.gross).toFixed(3) }));
}

// ---- statistics: the lab's stats() plus PF; renamed to the Edge lab's keys (exp, R, n, wr, maxDD, t) ----
const st = (a, f = 'R') => { const s = lab.stats(a.map((t) => t[f])); return { n: s.n, wr: s.winRate, exp: s.avgR, R: s.netR, pf: s.pf, maxDD: s.maxDD, t: s.t }; };
const yearOf = (t) => new Date(t.t * 1000).getUTCFullYear();
const sorted = (a) => [...a].sort((x, y) => x.t - y.t);
function block(trades) {
  const a = sorted(trades), is = a.filter((t) => t.t < OOS), oos = a.filter((t) => t.t >= OOS);
  return { all: st(a), is: st(is), oos: st(oos), oosGross: st(oos, 'gross'), oosCost2: st(oos, 'R2'), years: Object.fromEntries(YEARS.map((y) => [y, st(a.filter((t) => yearOf(t) === y))])) };
}
const welch = (a, b) => { if (a.length < 2 || b.length < 2) return null; const m = (x) => x.reduce((s, v) => s + v, 0) / x.length, v = (x, mu) => x.reduce((s, q) => s + (q - mu) ** 2, 0) / (x.length - 1);
  const ma = m(a), mb = m(b), se = Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length); return se > 0 ? +((ma - mb) / se).toFixed(2) : null; };
const paired = (d) => { if (d.length < 2) return null; const m = d.reduce((s, v) => s + v, 0) / d.length, sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / (d.length - 1)); return sd > 0 ? +(m / (sd / Math.sqrt(d.length))).toFixed(2) : null; };
const rdd = (s) => (s.maxDD > 0 ? s.R / s.maxDD : s.R > 0 ? Infinity : 0);

// ---- runs ----
const base = {}; for (const k of [...INDEX, ...GOLD]) base[k] = run(k);
const BOOK = { index: INDEX, gold: GOLD };
const pool = (by, ks) => ks.flatMap((k) => by[k] || []);
const baseline = Object.fromEntries(Object.entries(BOOK).map(([b, ks]) => [b, { ...block(pool(base, ks)), markets: Object.fromEntries(ks.map((k) => [k, block(base[k])])) }]));

const candidates = [];
for (const v of VARIANTS) {
  const by = {}; for (const b of v.books) for (const k of BOOK[b]) by[k] = run(k, v);
  for (const b of v.books) {
    const ks = BOOK[b], V = block(pool(by, ks)), B = baseline[b];
    const markets = Object.fromEntries(ks.map((k) => [k, block(by[k])]));
    // checks, as PLAN.md "The bar"
    const posY = OOSY.filter((y) => V.years[y].n && V.years[y].R > 0).length;
    const mkOk = ks.filter((k) => markets[k].oos.n >= 10 && B.markets[k].oos.n >= 10), mkBetter = mkOk.filter((k) => markets[k].oos.exp > B.markets[k].oos.exp);
    const c = {
      oosN30: V.oos.n >= 30,
      oosBeats05: V.oos.exp != null && V.oos.exp > 0 && V.oos.exp >= B.oos.exp + 0.05,
      isBeats: V.is.exp != null && V.is.exp > B.is.exp,
      oosRetDD: rdd(V.oos) >= rdd(B.oos),
      oosYears: posY >= 2,
      ...(b === 'index' ? { markets: mkOk.length >= 2 && mkBetter.length >= 2 } : {}),
    };
    const fail = !(V.oos.exp != null && V.oos.exp > B.oos.exp) || !(V.oos.exp > 0);
    const verdict = Object.values(c).every(Boolean) ? 'PASS' : fail ? 'FAIL' : 'INCONCLUSIVE';
    // kept vs dropped (filters) / paired difference (exit), OOS
    const oosOf = (a) => a.filter((t) => t.t >= OOS), vIds = new Set(oosOf(pool(by, ks)).map((t) => t.id));
    let extra;
    if (v.kind === 'filter') { const kept = oosOf(pool(by, ks)).map((t) => t.R), dropped = oosOf(pool(base, ks)).filter((t) => !vIds.has(t.id)).map((t) => t.R); extra = { oosKeptVsDroppedT: welch(kept, dropped), oosDropped: lab.stats(dropped) }; }
    else { const bm = new Map(oosOf(pool(base, ks)).map((t) => [t.id, t.R])), d = oosOf(pool(by, ks)).filter((t) => bm.has(t.id)).map((t) => t.R - bm.get(t.id)); extra = { oosPairedN: d.length, oosPairedMeanDiff: d.length ? +(d.reduce((s, x) => s + x, 0) / d.length).toFixed(3) : null, oosPairedT: paired(d) }; }
    candidates.push({ rule: `${v.id} · ${b}: ${v.name}`, variant: v.id, book: b, verdict, checks: c, strong: V.oos.t != null && V.oos.t >= 2,
      is: V.is, oos: V.oos, all: V.all, oosGross: V.oosGross, oosCost2: V.oosCost2, years: Object.fromEntries(YEARS.map((y) => [y, V.years[y].R])), yearStats: V.years,
      vsBaseline: { isExp: +(V.is.exp - B.is.exp).toFixed(3), oosExp: +(V.oos.exp - B.oos.exp).toFixed(3), oosR: +(V.oos.R - B.oos.R).toFixed(2), oosMaxDD: +(V.oos.maxDD - B.oos.maxDD).toFixed(2) },
      markets, marketsBetterOOS: mkBetter, ...extra });
  }
}

const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PLAN.md'))).digest('hex');
const passes = candidates.filter((c) => c.verdict === 'PASS'), incs = candidates.filter((c) => c.verdict === 'INCONCLUSIVE');
const summary = passes.length ? `PASS for ${passes.map((c) => `${c.variant} (${c.book})`).join(', ')}; the other ${candidates.length - passes.length} verdicts do not pass`
  : `FAIL. None of the ${candidates.length} variant × book verdicts passes the pre-registered bar${incs.length ? ` (${incs.length} inconclusive: ${incs.map((c) => `${c.variant} ${c.book}`).join(', ')})` : ''}; the live A-rule stays`;
const ym = (y) => ({ ...y });
const result = {
  topic: 'ict-variants', built: '2026-11-09', system: 'ICT desk A-setups (H1 iFVG reversal), lab engine api/_ictlab.js runMarket over research candles: NQ/ES/GC HistData M1, YM Dukascopy 5m',
  preregistered: 'PLAN.md (written before the first run)', planSha256: sha,
  window: { from: '2020-01-01', to: new Date((TO - 1) * 1000).toISOString().slice(0, 10), is: '2020-01-01 to 2023-12-31', oos: `2024-01-01 to ${new Date((TO - 1) * 1000).toISOString().slice(0, 10)}` },
  sources: Object.fromEntries(Object.entries(srcs).map(([k, s]) => [k, { src: s.src, h1: s.H.length, first: new Date(s.H[0].time * 1000).toISOString().slice(0, 10), last: new Date(s.H.at(-1).time * 1000).toISOString().slice(0, 16) }])),
  costs: 'lab COST round trip: NQ 1.5, ES 0.5, YM 3 points, gold 0.5; net R = size x (R - cost/risk); live sizing (sizeOf)',
  variantsTried: VARIANTS.length, verdictsGiven: candidates.length,
  verdict: summary,
  baseline: Object.fromEntries(Object.entries(baseline).map(([b, B]) => [b, { is: B.is, oos: B.oos, all: B.all, oosGross: B.oosGross, oosCost2: B.oosCost2, years: Object.fromEntries(YEARS.map((y) => [y, B.years[y].R])), yearStats: B.years, markets: B.markets }])),
  candidates,
  notes: 'Pre-registered in PLAN.md (sha256 above). IS 2020-23, OOS 2024-01-01 to the end of the research candles (Oct 2026). Cash/spot stand-ins for the futures the desk trades. YM has data from 2023 only. Paper research: no live rule, tracker, replay or desk change.',
};
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 1));

// ---- tables for RESULT.md (stdout) ----
const f = (x, d = 3) => (x == null ? '-' : (x > 0 ? '+' : '') + (+x).toFixed(d));
const row = (s) => `${s.n} | ${s.wr == null ? '-' : Math.round(100 * s.wr) + '%'} | ${f(s.exp)} | ${f(s.R, 1)} | ${s.pf ?? '-'} | ${s.maxDD.toFixed(1)} | ${s.t ?? '-'}`;
const out = [];
out.push(`plan sha256 ${sha}`, `window ${result.window.from} → ${result.window.to}`, '');
out.push('## Verdicts', '', '| variant | book | IS n | IS avg R | OOS n | OOS WR | OOS avg R | OOS R | OOS PF | OOS DD | OOS t | Δ avg R IS / OOS | OOS yrs + | checks failed | verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const b of ['index', 'gold']) { const B = baseline[b]; out.push(`| baseline (live A-rule) | ${b} | ${B.is.n} | ${f(B.is.exp)} | ${B.oos.n} | ${Math.round(100 * B.oos.wr)}% | ${f(B.oos.exp)} | ${f(B.oos.R, 1)} | ${B.oos.pf} | ${B.oos.maxDD.toFixed(1)} | ${B.oos.t} | | ${OOSY.filter((y) => B.years[y].R > 0).length}/3 | | |`); }
for (const c of candidates) out.push(`| ${c.variant} | ${c.book} | ${c.is.n} | ${f(c.is.exp)} | ${c.oos.n} | ${c.oos.wr == null ? '-' : Math.round(100 * c.oos.wr) + '%'} | ${f(c.oos.exp)} | ${f(c.oos.R, 1)} | ${c.oos.pf ?? '-'} | ${c.oos.maxDD.toFixed(1)} | ${c.oos.t ?? '-'} | ${f(c.vsBaseline.isExp)} / ${f(c.vsBaseline.oosExp)} | ${OOSY.filter((y) => c.yearStats[y].R > 0).length}/3 | ${Object.entries(c.checks).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'} | **${c.verdict}** |`);
out.push('', '## Per market (n / win rate / avg R / net R / PF / max DD / t)', '');
for (const b of ['index', 'gold']) for (const k of BOOK[b]) {
  out.push(`### ${k.toUpperCase()}`, '', '| rule | IS n | WR | avg R | R | PF | DD | t | OOS n | WR | avg R | R | PF | DD | t |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  out.push(`| baseline | ${row(baseline[b].markets[k].is)} | ${row(baseline[b].markets[k].oos)} |`);
  for (const c of candidates.filter((c) => c.book === b)) out.push(`| ${c.variant} | ${row(c.markets[k].is)} | ${row(c.markets[k].oos)} |`);
  out.push('');
}
out.push('## By year (net R, n in brackets)', '', `| rule | book | ${YEARS.join(' | ')} |`, `|---|---|${YEARS.map(() => '---').join('|')}|`);
for (const b of ['index', 'gold']) { const B = baseline[b]; out.push(`| baseline | ${b} | ${YEARS.map((y) => `${f(B.years[y].R, 1)} (${B.years[y].n})`).join(' | ')} |`); }
for (const c of candidates) out.push(`| ${c.variant} | ${c.book} | ${YEARS.map((y) => `${f(c.yearStats[y].R, 1)} (${c.yearStats[y].n})`).join(' | ')} |`);
out.push('', '## By year, per-trade (avg R / win rate / PF / max DD / t)', '', `| rule | book | ${YEARS.join(' | ')} |`, `|---|---|${YEARS.map(() => '---').join('|')}|`);
const yc = (s) => (s.n ? `${f(s.exp, 2)} / ${Math.round(100 * s.wr)}% / ${s.pf ?? '-'} / ${s.maxDD.toFixed(1)} / ${s.t ?? '-'}` : '-');
for (const b of ['index', 'gold']) out.push(`| baseline | ${b} | ${YEARS.map((y) => yc(baseline[b].years[y])).join(' | ')} |`);
for (const c of candidates) out.push(`| ${c.variant} | ${c.book} | ${YEARS.map((y) => yc(c.yearStats[y])).join(' | ')} |`);
out.push('', '## Robustness (OOS)', '', '| variant | book | OOS avg R gross | at costs x2 | baseline gross / x2 | kept vs dropped t / paired t | dropped n / avg R |', '|---|---|---|---|---|---|---|');
for (const c of candidates) { const B = baseline[c.book]; out.push(`| ${c.variant} | ${c.book} | ${f(c.oosGross.exp)} | ${f(c.oosCost2.exp)} | ${f(B.oosGross.exp)} / ${f(B.oosCost2.exp)} | ${c.oosKeptVsDroppedT ?? (c.oosPairedT != null ? `paired ${c.oosPairedT} (n ${c.oosPairedN}, Δ ${f(c.oosPairedMeanDiff)})` : '-')} | ${c.oosDropped ? `${c.oosDropped.n} / ${f(c.oosDropped.avgR)}` : '-'} |`); }
out.push('', summary);
console.log(out.join('\n'));
