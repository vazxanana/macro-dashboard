// Edge research · vb-prior-close: the gold and USD/JPY volatility breakouts (T1, k 0.5) split by where the previous day
// closed in its own range (PREREGISTRATION.md, committed alone first). Paper research only: nothing live reads or changes.
//   node research/edge/vb-prior-close/run.mjs        (reads the shared toolkit's OANDA M5 cache, EDGE_DATA)
// Rules imported unchanged: gold-vol-breakout-hourcost (original.mjs, costs.mjs daysOf / tradesIn, run.mjs costFrac / hourOf,
// result.json profile = route C1) and fx-vol-breakout (costPx) on index-vol-breakout/original.mjs (the same byte copy).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { daysOf, tradesIn } from '../gold-vol-breakout-hourcost/costs.mjs';
import { costFrac, hourOf } from '../gold-vol-breakout-hourcost/run.mjs';
import { daySkip as fxSkip, vbTrade as fxTrade, normP, holm, rng } from '../index-vol-breakout/original.mjs';
import { costPx } from '../fx-vol-breakout/run.mjs';
import { foldWeekend } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 86400;
export const SLIP = 0.05, TOP = 2 / 3, BOT = 1 / 3, SHUFFLES = 1000, SEED = 20261124;
export const WIN = { DISC: ['2005-01-01', '2014-12-31'], CONF: ['2015-01-01', '2099-12-31'] };
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);

// close location of a bar (null when it has no range)
export function clv(b) { const rg = b.high - b.low; return rg > 0 ? (b.close - b.low) / rg : null; }
export function third(v) { return v == null ? null : v >= TOP ? 'top' : v <= BOT ? 'bottom' : 'mid'; }
// 'with' | 'against' | 'mid' | null for a fill side and the previous day's third
export function group(side, th) {
  if (!th) return null;
  if (th === 'mid') return 'mid';
  return (side > 0) === (th === 'top') ? 'with' : 'against';
}

// the previous folded UTC day of every trade day, built the way buildDays builds it (rows [t,o,h,l,c], sorted)
export function prevBars(rows) {
  const byDay = new Map();
  for (const r of rows) { const d0 = Math.floor(r[0] / DAY) * DAY; if (!byDay.has(d0)) byDay.set(d0, []); byDay.get(d0).push(r); }
  const keys = [...byDay.keys()].sort((a, b) => a - b), d1 = [];
  for (const d0 of keys) { const rs = byDay.get(d0); d1.push({ time: d0, open: rs[0][1], high: Math.max(...rs.map((r) => r[2])), low: Math.min(...rs.map((r) => r[3])), close: rs.at(-1)[4] }); }
  const folded = foldWeekend(d1), out = new Map();
  for (let i = 1; i < folded.length; i++) out.set(ymd(folded[i].time), folded[i - 1]);
  return out;
}

const rowsOf = (mk) => {
  const rows = K.load(mk, '5m').map((b) => [b.t, b.o, b.h, b.l, b.c]).sort((a, b) => a[0] - b[0]);
  return rows;
};

function goldTrades(rows, cost) {
  const { days, dataEnd } = daysOf(rows.slice());
  const prev = prevBars(rows.filter((r) => r[0] < Math.floor(rows.at(-1)[0] / DAY) * DAY));
  const byDay = new Map(days.map((d) => [d.day, d]));
  const tr = tradesIn(days, ['2000-01-01', '2099-12-31']).tr.map((x) => {
    const p = prev.get(x.day), d = byDay.get(x.day);
    if (Math.abs(p.high - p.low - d.prevRange) > 1e-9) throw new Error(`prev bar mismatch ${x.day}`);
    const c = costFrac(cost.profile, hourOf(x), 'frac', cost.commission) * x.entry + SLIP * x.M;
    return { mk: 'xau', day: x.day, side: x.side, R: x.R, net: x.R - x.finR - c / x.r, clv: clv(p) };
  });
  return { tr, dataEnd };
}
function jpyTrades(rows) {
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, rs = rows.filter((r) => r[0] < lastFull);
  const days = daysOfFx(rs), prev = prevBars(rs), tr = [];
  for (const d of days) {
    if (fxSkip(d)) continue;
    const x = fxTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    const p = prev.get(d.day);
    if (Math.abs(p.high - p.low - d.prevRange) > 1e-9) throw new Error(`prev bar mismatch ${d.day}`);
    tr.push({ mk: 'usdjpy', day: d.day, side: x.side, R: x.R, net: x.R - costPx('usdjpy', x.entry) / x.r, clv: clv(p) });
  }
  return { tr, dataEnd: ymd(lastFull - DAY) };
}
let daysOfFx;

export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { diff: d, t: se > 0 ? d / se : null };
}
export function pairedMonthT(tr) {
  const m = new Map();
  for (const x of tr) { if (x.g !== 'with' && x.g !== 'against') continue; const k = x.day.slice(0, 7); if (!m.has(k)) m.set(k, { with: [], against: [] }); m.get(k)[x.g].push(x.net); }
  const d = [...m.values()].filter((v) => v.with.length && v.against.length).map((v) => mean(v.with) - mean(v.against));
  const s = sdv(d); return { months: d.length, mean: mean(d), t: d.length > 1 && s > 0 ? mean(d) / (s / Math.sqrt(d.length)) : null };
}
function monthSumT(a) {
  const m = new Map(); for (const x of a) m.set(x.day.slice(0, 7), (m.get(x.day.slice(0, 7)) || 0) + x.net);
  const v = [...m.values()], s = sdv(v); return v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null;
}
const tag = (tr) => tr.map((x) => ({ ...x, g: group(x.side, third(x.clv)) }));
const grp = (a) => ({ n: a.length, netR: r3(mean(a.map((x) => x.net))), grossR: r3(mean(a.map((x) => x.R))), monthT: r2(monthSumT(a)),
  buys: a.filter((x) => x.side > 0).length, sells: a.filter((x) => x.side < 0).length });
const diffOf = (tr) => mean(tr.filter((x) => x.g === 'with').map((x) => x.net)) - mean(tr.filter((x) => x.g === 'against').map((x) => x.net));

// relabelling control: shuffle the prior-day CLV across the trade days of each market (within the window)
export function control(tr, shuffles = SHUFFLES, seed = SEED) {
  const rand = rng(seed), byMk = new Map();
  for (const x of tr) { if (!byMk.has(x.mk)) byMk.set(x.mk, []); byMk.get(x.mk).push(x); }
  const out = [];
  for (let s = 0; s < shuffles; s++) {
    const all = [];
    for (const a of byMk.values()) {
      const v = a.map((x) => x.clv);
      for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
      a.forEach((x, i) => all.push({ ...x, g: group(x.side, third(v[i])) }));
    }
    out.push(diffOf(all));
  }
  return out;
}
export function evalWindow(tr, shuffles) {
  const T = tag(tr), w = T.filter((x) => x.g === 'with'), ag = T.filter((x) => x.g === 'against'), mid = T.filter((x) => x.g === 'mid');
  const wl = welch(w.map((x) => x.net), ag.map((x) => x.net)), pm = pairedMonthT(T), wlG = welch(w.map((x) => x.R), ag.map((x) => x.R));
  const res = { all: grp(T), with: grp(w), against: grp(ag), mid: grp(mid), diff: r3(wl.diff), welchT: r2(wl.t), tRaw: wl.t, diffGross: r3(wlG.diff), welchTGross: r2(wlG.t),
    pairedMonths: pm.months, pairedMonthT: r2(pm.t), pairedMonthTRaw: pm.t };
  if (shuffles) { const c = control(T, shuffles), beat = c.filter((v) => wl.diff > v).length; res.control = { shuffles, beaten: beat, share: r3(beat / shuffles), p95: r3([...c].sort((a, b) => a - b)[Math.floor(0.95 * shuffles)]), median: r3([...c].sort((a, b) => a - b)[Math.floor(shuffles / 2)]) }; }
  return res;
}
export function judge(tests) {
  const ks = Object.keys(tests), ps = ks.map((k) => (tests[k].CONF.tRaw == null ? 1 : normP(tests[k].CONF.tRaw))), adj = holm(ps), out = {};
  ks.forEach((k, i) => {
    const D = tests[k].DISC, C = tests[k].CONF;
    const items = { diffBoth: D.diff > 0 && C.diff > 0, welch2Holm: (C.tRaw ?? -1) >= 2 && adj[i] < 0.05, pairedMonthT2: (C.pairedMonthTRaw ?? -1) >= 2,
      n200: C.with.n >= 200 && C.against.n >= 200, withNetPos: D.with.netR > 0 && C.with.netR > 0, control95: C.control.share > 0.95 };
    out[k] = { p: r3(ps[i]), pHolm: r3(adj[i]), items, pass: Object.values(items).every(Boolean), verdict: !items.n200 ? 'INCONCLUSIVE' : Object.values(items).every(Boolean) ? 'PASS' : 'FAIL' };
  });
  return out;
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# The breakouts split by the previous day\'s close location (vb-prior-close, 24 Nov 2026)', '', `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, split, costs, windows and bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed; no filter is adopted; the two breakouts\' forward records stay the judge. Written by `run.mjs` from `result.json`.', '',
    '"With the close" = a buy after the previous UTC day (weekend folded) closed in the top third of its range, or a sell after a bottom-third close; "against" = the opposite. Net R after costs (gold: measured hourly route C1; USD/JPY: 0.000045 × entry + 0.5 pip). Month t = calendar-month sums.', '',
    '## The table', '',
    '| Test | Window | All n / net | With n / net / gross / month t | Against n / net / gross / month t | Middle n / net | With − against net (Welch t) | Gross diff (Welch t) | Paired month t (months) | Control: share of 1,000 relabellings beaten (95th pct) |',
    '|---|---|---|---|---|---|---|---|---|---|'];
  for (const [k, T] of Object.entries(R.tests)) for (const w of ['DISC', 'CONF']) {
    const x = T[w];
    L.push(`| ${k} ${T.name} | ${w === 'DISC' ? 'discovery 2005-2014' : `confirmation 2015 → ${R.dataEnd}`} | ${x.all.n} / ${sg(x.all.netR)} | ${x.with.n} / ${sg(x.with.netR)} / ${sg(x.with.grossR)} / ${sg(x.with.monthT, 2)} | ${x.against.n} / ${sg(x.against.netR)} / ${sg(x.against.grossR)} / ${sg(x.against.monthT, 2)} | ${x.mid.n} / ${sg(x.mid.netR)} | ${sg(x.diff)} (${sg(x.welchT, 2)}) | ${sg(x.diffGross)} (${sg(x.welchTGross, 2)}) | ${sg(x.pairedMonthT, 2)} (${x.pairedMonths}) | ${x.control.share} (${sg(x.control.p95)}) |`);
  }
  const yn = (b) => (b ? 'yes' : 'no');
  L.push('', '## The bar (confirmation unless named)', '', '| Test | p | Holm p | Diff > 0 both windows | Welch t ≥ 2 and Holm < 0.05 | Paired month t ≥ 2 | n ≥ 200 each | With net > 0 both windows | Beats 95 % of relabellings | Verdict |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, d] of Object.entries(R.decision)) { const i = d.items; L.push(`| ${k} | ${d.p} | ${d.pHolm} | ${yn(i.diffBoth)} | ${yn(i.welch2Holm)} | ${yn(i.pairedMonthT2)} | ${yn(i.n200)} | ${yn(i.withNetPos)} | ${yn(i.control95)} | ${d.verdict} |`); }
  L.push('', '## Sides inside the groups (confirmation)', '');
  for (const [k, T] of Object.entries(R.tests)) { const x = T.CONF; L.push(`- ${k} ${T.name}: with = ${x.with.buys} buys + ${x.with.sells} sells; against = ${x.against.buys} buys + ${x.against.sells} sells.`); }
  L.push('', '## In plain words', '', R.reading, '', '## What this does NOT show', '',
    '- It reads one fixed split (thirds of the previous UTC day, weekend folded). Quartiles, 0.5, a New York day or the close location of a longer window are not tested, and trying them now on these trades would be a search.',
    '- Gold is charged today\'s measured relative spread on every year; USD/JPY today\'s demo commission and an allowance. Older spreads were wider.',
    '- OANDA mid candles, not broker ticks. The breakouts themselves are not re-tested; only the split is new.', '',
    '- Middle-third days averaged more than either group in every row; that was not a pre-registered test and is reported only (a post-hoc look, not a finding).', '',
    '## Data', '', `- ${R.data}`, `- Harness gate: gold T1 2021-01-01 → 2026-11-12 under route C1 = n ${R.gate.got.n}, ${sg(R.gate.got.netR)}R (gold-vol-breakout-hourcost: n 1121, +0.105R): ${R.gate.ok ? 'held' : 'missed'}.`, '- To repeat: `node research/edge/vb-prior-close/run.mjs` (toolkit cache at EDGE_DATA, out of git).', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  ({ buildDays: daysOfFx } = await import('../index-vol-breakout/original.mjs'));
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'gold-vol-breakout-hourcost', 'result.json'), 'utf8'));
  const xr = rowsOf('xau'), jr = rowsOf('usdjpy');
  const G = goldTrades(xr, { profile: hc.profile, commission: hc.commission }), J = jpyTrades(jr);
  const dataEnd = G.dataEnd < J.dataEnd ? G.dataEnd : J.dataEnd;
  const sets = { T1: { name: 'gold', tr: G.tr }, T2: { name: 'USD/JPY', tr: J.tr }, T3: { name: 'gold + USD/JPY pooled', tr: [...G.tr, ...J.tr] } };
  const tests = {};
  for (const [k, s] of Object.entries(sets)) tests[k] = { name: s.name, DISC: evalWindow(s.tr.filter((x) => inW(x.day, WIN.DISC)), SHUFFLES), CONF: evalWindow(s.tr.filter((x) => inW(x.day, WIN.CONF)), SHUFFLES) };
  const g4 = G.tr.filter((x) => inW(x.day, ['2021-01-01', '2026-11-12'])), gate = { want: { n: 1121, netR: 0.105 }, got: { n: g4.length, netR: r3(mean(g4.map((x) => x.net))) } };
  gate.ok = gate.got.n === 1121 && gate.got.netR === 0.105;
  if (!gate.ok) throw new Error('gate missed: ' + JSON.stringify(gate));
  const dec = judge(tests), v = dec.T3.verdict;
  const C = (k) => tests[k].CONF, D = (k) => tests[k].DISC;
  const line = (k) => `${k} ${tests[k].name}: confirmation with ${sg(C(k).with.netR)}R (n ${C(k).with.n}) vs against ${sg(C(k).against.netR)}R (n ${C(k).against.n}), difference ${sg(C(k).diff)}R (Welch t ${sg(C(k).welchT, 2)}, paired month t ${sg(C(k).pairedMonthT, 2)}); discovery difference ${sg(D(k).diff)}R (t ${sg(D(k).welchT, 2)})`;
  const verdict = `${v}: ${line('T3')}`;
  const fails = (k) => Object.entries(dec[k].items).filter(([, b]) => !b).map(([c]) => c).join(', ') || 'none';
  const reading = `T3 pooled (the decision): ${dec.T3.verdict} (items not met: ${fails('T3')}). T1 gold: ${dec.T1.verdict} (not met: ${fails('T1')}). T2 USD/JPY: ${dec.T2.verdict} (not met: ${fails('T2')}). ${line('T1')}. ${line('T2')}. A split that does not hold in both windows and against the relabelling control is not a filter; the breakouts stay as they are.`;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const strip = (o) => JSON.parse(JSON.stringify(o, (key, val) => (key === 'tRaw' || key === 'pairedMonthTRaw' ? undefined : val)));
  const R = { study: 'vb-prior-close', built: '2026-11-24', preregistration: 'research/edge/vb-prior-close/PREREGISTRATION.md', planSha256: sha, verdict, verdictWord: v, dataEnd,
    data: `OANDA mid M5 (toolkit cache): xau ${ymd(xr[0][0])} → ${G.dataEnd}, ${G.tr.length} T1 trades; usdjpy ${ymd(jr[0][0])} → ${J.dataEnd}, ${J.tr.length} T1 trades (last day on file left out).`,
    thresholds: { top: '>= 2/3', bottom: '<= 1/3' }, costs: { xau: 'gold-vol-breakout-hourcost route C1 (profile frac, commission, 0.05 x M, long financing)', usdjpy: '0.000045 x entry + 0.005' },
    windows: WIN, gate, decision: dec, tests: strip(tests), reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R) + '\n');
  console.log(verdict);
}
