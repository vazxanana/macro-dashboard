// Edge research · vb-news-days: the gold and USD/JPY T1 volatility breakouts on US CPI / payrolls / FOMC days against other
// days (PREREGISTRATION.md, committed alone first). Paper research only. The rule and costs are imported, never edited.
//   node research/edge/vb-news-days/run.mjs [candleDir]      (default: edgekit DATA_DIR)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from '../_lib/edgekit.mjs';
import { tradesIn, stats as hcStats, daysOf as goldDaysOf } from '../gold-vol-breakout-hourcost/costs.mjs';
import { charge as goldCharge } from '../gold-vol-breakout-hourcost/run.mjs';
import { buildDays } from '../index-vol-breakout/original.mjs';
import { trades as jpyTrades } from '../usdjpy-vol-breakout-early/run.mjs';
import { HISTORY, EVENTS } from '../../../council/events.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..', '..');
export const W = { DISC: ['2018-01-01', '2021-12-31'], CONF: ['2022-01-01', '2099-12-31'] };
export const SLIP = 0.05, DRAWS = 2000, SEED = 20261124, MIN_N = { gold: 100, usdjpy: 100, pooled: 200 };
export const GATE = { gold: { n: 1121, netR: 0.105, t: 2.79 }, usdjpy: { n: 2079, netR: 0.063 } };
const CH_TYPES = { 'CPI m/m': 'CPI', 'Non-Farm Employment Change': 'NFP', 'Federal Funds Rate': 'FOMC' };
const DAY = 86400;
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// release list: { day (UTC date), t, type }, one per (type, day), from the three sources
export function releases(consensus, upTo = '2099-12-31') {
  const m = new Map(), add = (type, t) => { const day = ymd(t); if (day > upTo) return; const k = `${type}|${day}`; if (!m.has(k)) m.set(k, { day, t, type }); };
  for (const [title, at] of consensus.rows.map((r) => [r[0], r[1]])) if (CH_TYPES[title]) add(CH_TYPES[title], Date.parse(at) / 1000);
  for (const e of HISTORY) if (['CPI', 'NFP', 'FOMC'].includes(e.type)) add(e.type, e.t);
  for (const e of EVENTS) if (['CPI', 'NFP', 'FOMC'].includes(e.type)) add(e.type, e.t);
  return [...m.values()].sort((a, b) => a.t - b.t);
}
export function byDay(rel) { const m = new Map(); for (const r of rel) { if (!m.has(r.day)) m.set(r.day, []); m.get(r.day).push(r); } return m; }

// tag a trade: on a release day? filled before the (first) release of that day?
export function tag(x, relDays) {
  const ev = relDays.get(x.day); if (!ev) return { ...x, rel: false };
  const first = Math.min(...ev.map((e) => e.t)), fillT = Date.parse(x.day + 'T00:00:00Z') / 1000 + x.fillMin * 60;
  return { ...x, rel: true, types: ev.map((e) => e.type), before: fillT + 300 <= first };   // the fill candle ended by the release minute
}

export function welch(a, b) {
  const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length;
  return { d: mean(a) - mean(b), t: (mean(a) - mean(b)) / Math.sqrt(va + vb) };
}
// paired month t of (release mean − other mean), months with both
export function monthDiff(tr, key = 'net') {
  const m = new Map();
  for (const x of tr) { const k = x.day.slice(0, 7); if (!m.has(k)) m.set(k, { a: [], b: [] }); (x.rel ? m.get(k).a : m.get(k).b).push(x[key]); }
  const d = [...m.values()].filter((v) => v.a.length && v.b.length).map((v) => mean(v.a) - mean(v.b));
  const s = sdv(d);
  return { months: d.length, d: mean(d), t: d.length > 1 && s > 0 ? mean(d) / (s / Math.sqrt(d.length)) : 0 };
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
// random-day sets: same size, drawn without replacement from other-day trades; percentile of the release mean
export function control(rel, oth, seed, draws = DRAWS) {
  const rnd = rng(seed), n = rel.length, v = oth.map((x) => x.net), real = mean(rel.map((x) => x.net)), out = [];
  for (let d = 0; d < draws; d++) {
    const a = v.slice(); let s = 0;
    for (let i = 0; i < n; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; s += a[i]; }
    out.push(s / n);
  }
  out.sort((p, q) => p - q);
  const below = out.filter((x) => x < real).length / draws;
  return { real: r3(real), p2_5: r3(out[Math.floor(0.025 * draws)]), p50: r3(out[Math.floor(0.5 * draws)]), p97_5: r3(out[Math.floor(0.975 * draws)]), pct: r3(below), outside: below < 0.025 || below > 0.975 };
}
export function normP(t) {
  const z = Math.abs(t) / Math.SQRT2, k = 1 / (1 + 0.3275911 * z);
  const erf = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-z * z);
  return 1 - erf;   // two-sided
}
export function holm(ps) {
  const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; }); return adj;
}
function side(tr) { return { n: tr.length, netR: r3(mean(tr.map((x) => x.net))), grossR: r3(mean(tr.map((x) => x.R))) }; }
export function cell(tr, seed) {
  const rel = tr.filter((x) => x.rel), oth = tr.filter((x) => !x.rel), w = welch(rel.map((x) => x.net), oth.map((x) => x.net)), md = monthDiff(tr), mg = monthDiff(tr, 'R');
  return { release: side(rel), other: side(oth), delta: r3(w.d), welchT: r2(w.t), monthDiff: { months: md.months, d: r3(md.d), t: r2(md.t) }, grossMonthT: r2(mg.t), control: control(rel, oth, seed) };
}

function loadRows(dir, market) {
  const f = path.join(dir, market); const rows = [];
  for (const n of fs.readdirSync(f).filter((x) => x.startsWith('5m-')).sort()) rows.push(...JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(f, n)))));
  rows.sort((a, b) => a[0] - b[0]); return rows.filter((r, i) => i === 0 || r[0] !== rows[i - 1][0]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2] || DATA_DIR;
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gold-vol-breakout-hourcost', 'result.json'), 'utf8'));
  // gold
  const g = goldDaysOf(loadRows(dir, 'xau')), gDays = g.days;
  const gTr = tradesIn(gDays, ['2018-01-01', '2099-12-31']).tr, gNet = goldCharge(gTr, hc.profile, 'frac', hc.commission, SLIP);
  const gAll = gTr.map((x, i) => ({ mk: 'xau', day: x.day, fillMin: x.fillMin, side: x.side, R: x.R, net: gNet[i].net }));
  const gGateTr = tradesIn(gDays, ['2021-01-01', '2026-12-31']).tr.filter((x) => x.day <= '2026-11-12');
  const gs = hcStats(goldCharge(gGateTr, hc.profile, 'frac', hc.commission, SLIP)), gGate = { n: gs.n, netR: gs.netR, t: gs.t };
  // usdjpy
  const jr = loadRows(dir, 'usdjpy'), lastDay = ymd(jr.at(-1)[0]), jDays = buildDays(jr).filter((d) => d.day < lastDay);
  const jAll0 = jpyTrades('usdjpy', jDays.filter((d) => d.day >= '2016-01-01'));
  const jg = jAll0.filter((x) => x.day <= '2026-11-19'), jGate = { n: jg.length, netR: r3(mean(jg.map((x) => x.net))) };
  const gateOk = Object.keys(GATE.gold).every((k) => GATE.gold[k] === gGate[k]) && Object.keys(GATE.usdjpy).every((k) => GATE.usdjpy[k] === jGate[k]);
  console.log('gate', gGate, jGate, gateOk);
  const dataEnd = [g.dataEnd, jDays.at(-1).day].sort()[0];
  const base = { study: 'vb-news-days', built: new Date().toISOString().slice(0, 10), dataEnd, gate: { gold: { want: GATE.gold, got: gGate }, usdjpy: { want: GATE.usdjpy, got: jGate }, ok: gateOk } };
  if (!gateOk) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'STOPPED: a harness gate failed' }, null, 1) + '\n'); process.exit(2); }
  const jAll = jAll0.filter((x) => x.day >= '2018-01-01').map((x) => ({ mk: 'usdjpy', day: x.day, fillMin: x.fillMin, side: x.side, R: x.R, net: x.net }));
  // releases
  const rel = releases(JSON.parse(fs.readFileSync(path.join(ROOT, 'council', 'consensus-history.json'), 'utf8')), dataEnd), rd = byDay(rel);
  const counts = {}; for (const r of rel) { const y = r.day.slice(0, 4); counts[y] ||= { CPI: 0, NFP: 0, FOMC: 0 }; counts[y][r.type]++; }
  const T = { gold: gAll.filter((x) => x.day <= dataEnd).map((x) => tag(x, rd)), usdjpy: jAll.filter((x) => x.day <= dataEnd).map((x) => tag(x, rd)) };
  T.pooled = [...T.gold, ...T.usdjpy];
  const tests = [], cells = {};
  const keys = ['gold', 'usdjpy', 'pooled'];
  keys.forEach((k, i) => { cells[k] = {}; for (const [wk, w] of Object.entries(W)) cells[k][wk] = cell(T[k].filter((x) => inW(x.day, w)), SEED + 10 * i + (wk === 'CONF' ? 1 : 0)); });
  const ps = keys.map((k) => normP(cells[k].CONF.monthDiff.t)), adj = holm(ps);
  keys.forEach((k, i) => {
    const d = cells[k].DISC, c = cells[k].CONF;
    const checks = { sameSign: Math.sign(d.monthDiff.d) === Math.sign(c.monthDiff.d) && Math.sign(d.delta) === Math.sign(c.delta), monthT2: Math.abs(c.monthDiff.t) >= 2, holm: adj[i] < 0.05, welch2: Math.abs(c.welchT) >= 2, control: c.control.outside, n: c.release.n >= MIN_N[k] };
    tests.push({ test: k, p: r3(ps[i]), pHolm: r3(adj[i]), checks, holds: Object.values(checks).every(Boolean), sign: c.delta > 0 ? 'better' : 'worse' });
  });
  // descriptive: before / after the release on release days, and by type
  const desc = {};
  for (const k of ['gold', 'usdjpy']) { desc[k] = {};
    for (const [wk, w] of Object.entries(W)) { const r = T[k].filter((x) => x.rel && inW(x.day, w));
      desc[k][wk] = { before: side(r.filter((x) => x.before)), after: side(r.filter((x) => !x.before)),
        CPI: side(r.filter((x) => x.types.includes('CPI'))), NFP: side(r.filter((x) => x.types.includes('NFP'))), FOMC: side(r.filter((x) => x.types.includes('FOMC'))) }; } }
  const held = tests.filter((x) => x.holds);
  const c = (k) => cells[k].CONF;
  const verdict = (held.length ? `DIFFERENT (${held.map((x) => `${x.test} ${x.sign}`).join(', ')})` : 'NO DIFFERENCE SHOWN, 0 of 3')
    + `: confirmation 2022 → ${dataEnd}, release-day minus other-day net R a trade: gold ${c('gold').delta >= 0 ? '+' : ''}${c('gold').delta}R (n ${c('gold').release.n} vs ${c('gold').other.n}, month t ${c('gold').monthDiff.t}), USD/JPY ${c('usdjpy').delta >= 0 ? '+' : ''}${c('usdjpy').delta}R (n ${c('usdjpy').release.n} vs ${c('usdjpy').other.n}, month t ${c('usdjpy').monthDiff.t}), pooled ${c('pooled').delta >= 0 ? '+' : ''}${c('pooled').delta}R (month t ${c('pooled').monthDiff.t})`;
  const R = { ...base, windows: W, releases: { n: rel.length, first: rel[0].day, last: rel.at(-1).day, days: rd.size, byYear: counts }, cells, tests, desc, verdict };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(verdict);
}
