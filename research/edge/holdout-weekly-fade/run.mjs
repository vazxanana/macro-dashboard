// Edge research · holdout-weekly-fade: direction-chain-gate's ungated H1 box break entry, taken only when (1) the Weekly
// structure side equals the trade's side, (2) the Daily structure side is against it, (3) the breaking H1 candle's close is
// within 0.5 x Daily ATR(14) of one of the last 40 confirmed Daily swing levels. Judged on the untouched holdout
// (PREREGISTRATION.md, committed alone first). Paper research only: nothing live reads or changes.
//   node research/edge/holdout-weekly-fade/run.mjs     (reads the shared toolkit's candle cache, EDGE_DATA, out of git)
// The entry is imported unchanged from direction-chain-gate/run.mjs (pinned by sha256 below). The phase reader
// (research/edge/_lib/phase.mjs) tags each rule trade with the D1 / H4 reading known at the signal: a description only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import * as G from '../direction-chain-gate/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EDGE = path.join(HERE, '..');
export const PINS = { 'direction-chain-gate/run.mjs': '2c891e09c4bf3463' };
export const P = { SWING_K: 3, ATR_N: 14, LEVELS: 40, NEAR_ATR: 0.5 };
export const SETS = {
  A: { name: 'Set A, early years (2005-2009, the five main markets)', markets: K.MARKETS, from: '2005-01-01', to: '2010-01-01', load: { to: '2010-01-09' } },
  B: { name: 'Set B, fresh markets (2010 → last complete day on file)', markets: K.HOLDOUT_MARKETS, from: '2010-01-01', to: null, load: {} },
};
export const FAMILY = ['holdout-vb-early', 'holdout-pullback-deep', 'holdout-phase-pick', 'holdout-h1-veto', 'holdout-weekly-fade'];
export const GATE_TOL = { n: 0.02, meanR: 0.01 };
export const CHOICES = [
  'Set A candles are read to 2010-01-09 only so that trades ENTERED by 2009-12-31 can reach their exit (48 h at most); no entry after 2009-12-31 is taken.',
  'Set B ends at the last complete day on file: entries on the UTC date of the last M5 candle are left out.',
  'Warm-up: every candle on file before a set\'s first entry date is read for structure, swings and ATR only (Set A has no warm-up: the cache starts in 2005 / 2006, so the first weeks give a Weekly side of 0 and no trade).',
  'Weekly / Daily side and levels are read from candles CLOSED at the breaking H1 candle\'s close (e <= that time); a week counts only once its last Daily candle has closed.',
  'Daily ATR(14) = simple mean of the true range (max of high-low, |high - previous close|, |low - previous close|) of the last 14 closed days; fewer than 15 closed days = no ATR = condition 3 fails.',
  '"The last 40 confirmed Daily swing highs or lows" = the 40 most recently confirmed (by confirmation time) of toolkit swings(D, 3), highs and lows together.',
  'One open position at a time per market and stream: direction-chain-gate oneAtATime (a candidate is taken only if its fill is at or after the previous taken trade\'s exit), applied after the set window filter.',
  'Month sums by exit month over the set\'s span (first entry month to the later of the set\'s last entry month and its last exit month), empty months 0; Set A and Set B month series pooled; one-sided p from the toolkit t.',
];
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const r6 = (v) => (Number.isFinite(v) ? +v.toPrecision(7) : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const sec = (d) => Date.parse(d + 'T00:00:00Z') / 1000;

export function pinCheck() {
  return Object.entries(PINS).map(([f, h]) => {
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(EDGE, f))).digest('hex').slice(0, 16);
    return { file: f, want: h, got, ok: got === h };
  });
}

// ---- the three conditions, read at time T from closed candles only ------------------------------------------------
export function context(M5) {
  const D = K.dailyNY(M5), W = G.weekly(D), H1 = K.resample(M5, 3600);
  const sD = K.structure(D, P.SWING_K).side, sW = K.structure(W, P.SWING_K).side;
  const sw = K.swings(D, P.SWING_K).sort((a, b) => a.ct - b.ct || a.i - b.i);
  const tr = D.map((d, i) => (i === 0 ? null : Math.max(d.h - d.l, Math.abs(d.h - D[i - 1].c), Math.abs(d.l - D[i - 1].c))));
  return { D, W, H1, sD, sW, sw, tr };
}
export function atrAt(C, n) { // n = closed days
  if (n < P.ATR_N + 1) return null;
  let s = 0; for (let i = n - P.ATR_N; i < n; i++) s += C.tr[i]; return s / P.ATR_N;
}
// T = the breaking H1 candle's close (direction-chain-gate's `sig`); side = the trade's side
export function conditionsAt(C, T, side) {
  const hi = K.closedCount(C.H1, T); const brk = hi ? C.H1[hi - 1] : null;
  const price = brk && brk.e === T ? brk.c : null;
  const nW = K.closedCount(C.W, T), nD = K.closedCount(C.D, T);
  const wSide = nW ? C.sW[nW - 1] : 0, dSide = nD ? C.sD[nD - 1] : 0;
  const atr = atrAt(C, nD);
  let lo = 0, hh = C.sw.length; while (lo < hh) { const m = (lo + hh) >> 1; if (C.sw[m].ct <= T) lo = m + 1; else hh = m; }
  const lv = C.sw.slice(Math.max(0, lo - P.LEVELS), lo);
  let dist = null, lvl = null;
  if (price != null) for (const s of lv) { const d = Math.abs(price - s.price); if (dist == null || d < dist) { dist = d; lvl = s; } }
  const near = atr != null && dist != null ? dist / atr : null;
  const c1 = wSide === side, c2 = dSide === -side, c3 = near != null && near <= P.NEAR_ATR;
  return { price, wSide, dSide, atr, near, level: lvl ? lvl.price : null, levels: lv.length, c1, c2, c3, rule: c1 && c2 && c3 };
}

// candidates of one market with the three conditions; only entries inside [from, to)
export function marketRun(mk, M5, from, to) {
  const C = context(M5);
  const cands = G.candidates(mk, M5).filter((x) => x.fillT >= from && x.fillT < to);
  return cands.map((x) => ({ ...x, ...conditionsAt(C, x.sig, x.side) }));
}

// ---- statistics ----------------------------------------------------------------------------------------------------
export function monthSeries(trades, fromM, toM, key) {
  const m = new Map(); for (const x of trades) { const k = new Date(x.exitT * 1000).toISOString().slice(0, 7); m.set(k, (m.get(k) || 0) + x[key]); }
  const out = []; let [y, mo] = fromM.split('-').map(Number); const [y1, m1] = toM.split('-').map(Number);
  while (y < y1 || (y === y1 && mo <= m1)) { out.push(m.get(`${y}-${String(mo).padStart(2, '0')}`) || 0); mo === 12 ? (y++, (mo = 1)) : mo++; }
  return out;
}
export function tOf(v) { const s = sdv(v); return v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null; }
export function pOne(t, df) { if (t == null) return 1; const p2 = K.pFromT(t, df); return t > 0 ? p2 / 2 : 1 - p2 / 2; }
function months(tr, span) { return { net: monthSeries(tr, ...span, 'Rnet'), net2: monthSeries(tr, ...span, 'Rnet2'), R: monthSeries(tr, ...span, 'R') }; }
export function summ(tr, M) {
  const net = tr.map((x) => x.Rnet); const mt = M ? tOf(M.net) : null;
  let eq = 0, pk = 0, dd = 0; for (const v of [...tr].sort((a, b) => a.fillT - b.fillT).map((x) => x.Rnet)) { eq += v; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  const side = (s) => { const a = tr.filter((x) => x.side === s); return { n: a.length, netR: r3(mean(a.map((x) => x.Rnet))) }; };
  const ex = {}; for (const x of tr) ex[x.reason] = (ex[x.reason] || 0) + 1;
  return { n: tr.length, win: r3(tr.filter((x) => x.Rnet > 0).length / (tr.length || 1)), netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.Rnet2))), total: r2(net.reduce((s, v) => s + v, 0)), months: M ? M.net.length : null, t: r2(mt), tRaw: mt,
    t2x: M ? r2(tOf(M.net2)) : null, grossT: M ? r2(tOf(M.R)) : null, maxDD: r2(dd), buys: side(1), sells: side(-1), exits: ex };
}
export function byYear(tr) {
  const o = {}; for (const x of tr) { const y = new Date(x.fillT * 1000).getUTCFullYear(); (o[y] ||= { n: 0, t: 0 }); o[y].n++; o[y].t += x.Rnet; }
  for (const y in o) o[y] = { n: o[y].n, netR: r3(o[y].t / o[y].n), total: r2(o[y].t) };
  return o;
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: null, t: null };
  const d = mean(a) - mean(b), se = Math.sqrt(sdv(a) ** 2 / a.length + sdv(b) ** 2 / b.length);
  return { diff: r3(d), t: se > 0 ? r2(d / se) : null };
}
export function family(myP) {
  const ps = FAMILY.map((s) => {
    if (s === 'holdout-weekly-fade') return myP;
    try { const r = JSON.parse(fs.readFileSync(path.join(EDGE, s, 'result.json'))); return r.primaryP ?? r.primary?.pOne ?? r.primary?.p ?? null; } catch { return null; }
  });
  const known = ps.every((p) => Number.isFinite(p));
  const adj = known ? K.holm(ps)[FAMILY.indexOf('holdout-weekly-fade')] : Math.min(1, FAMILY.length * myP);
  return { studies: FAMILY, p: ps.map(r6), complete: known, pHolm: r6(adj),
    note: known ? 'Holm over the five primary one-sided p values' : 'not every sibling result is in yet: the bound 5 x p is used' };
}

// ---- harness gate: the ungated stream on 2010-2026 (five main markets) against direction-chain-gate/result.json -------
export function gate() {
  const ref = JSON.parse(fs.readFileSync(path.join(EDGE, 'direction-chain-gate/result.json'))).streams.all;
  const cands = []; for (const m of K.MARKETS) cands.push(...G.candidates(m, K.load(m, '5m', { from: '2010-01-01' })));
  const S = G.streamsOf(cands).all; const rows = {}; let ok = true;
  for (const [k, w] of Object.entries(G.WIN)) {
    const a = S.filter((x) => x.fillT >= w[0] && x.fillT < w[1]); const n = a.length, m = mean(a.map((x) => x.Rnet));
    const good = Math.abs(n - ref[k].n) <= GATE_TOL.n * ref[k].n && Math.abs(m - ref[k].meanR) <= GATE_TOL.meanR;
    rows[k] = { refN: ref[k].n, n, refMeanR: ref[k].meanR, meanR: +m.toFixed(4), ok: good }; ok = ok && good;
  }
  return { ok, rows, note: 'code check only; 2010-2026 on the five main markets is not holdout data and is not part of the verdict' };
}

// ---- report --------------------------------------------------------------------------------------------------------
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const yn = (b) => (b ? 'yes' : 'no');
export function report(R) {
  const P1 = R.pooled.rule, L = ['# With the Weekly, against the Daily, at a Daily level, on the untouched holdout (holdout-weekly-fade, 23 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Rule, sets, costs and the pass bar were fixed in `PREREGISTRATION.md` (committed alone first; sha256 in `result.json`). Nothing live changed. This page is written by `run.mjs` from `result.json`.', '',
    '## The bar', '', '| Line | Needed | Here | Met |', '|---|---|---|---|',
    `| 1 | Set A mean R after costs > 0 | ${sg(R.sets.A.rule.netR)} (n ${R.sets.A.rule.n}) | ${yn(R.checks.setA)} |`,
    `| 2 | Set B mean R after costs > 0 | ${sg(R.sets.B.rule.netR)} (n ${R.sets.B.rule.n}) | ${yn(R.checks.setB)} |`,
    `| 3 | pooled month t ≥ 2 and Holm p < 0.05 | t ${sg(P1.t, 2)} (${P1.months} months), one-sided p ${r3(R.primary.p)}, Holm ${R.family.complete ? '' : '≤ '}${r3(R.family.pHolm)} | ${yn(R.checks.t2 && R.checks.holm)} |`,
    `| 4 | ≥ 100 pooled trades | ${P1.n} | ${yn(R.checks.n100)} |`,
    `| 5 | pooled mean R > 0 at 2x costs | ${sg(P1.net2R)} | ${yn(R.checks.cost2x)} |`,
    `| gate | ungated entry reproduces direction-chain-gate (3 windows, 2 % / 0.01R) | ${Object.values(R.gate.rows).filter((g) => g.ok).length} of 3 | ${yn(R.gate.ok)} |`, '',
    `Family: ${R.family.note} (siblings' p: ${R.family.p.map((p, i) => R.family.studies[i] + ' ' + r3(p)).join(', ')}).`, '',
    '## The rule against the ungated control, after costs', '',
    '| Series | Rule n | Rule net R | Gross R | 2x cost | Month t | Control n | Control net R | Control month t |', '|---|---|---|---|---|---|---|---|---|'];
  const row = (name, S) => L.push(`| ${name} | ${S.rule.n} | ${sg(S.rule.netR)} | ${sg(S.rule.grossR)} | ${sg(S.rule.net2R)} | ${sg(S.rule.t, 2)} | ${S.control.n} | ${sg(S.control.netR)} | ${sg(S.control.t, 2)} |`);
  row('**Pooled holdout**', R.pooled); row('Set A', R.sets.A); row('Set B', R.sets.B);
  for (const [k, S] of Object.entries(R.markets)) row(`${k} (${S.set})`, S);
  L.push('', '## Each condition alone (pooled holdout, one position at a time per market)', '', '| Condition | n | Net R | Month t |', '|---|---|---|---|');
  for (const [k, S] of Object.entries(R.alone)) L.push(`| ${k} | ${S.n} | ${sg(S.netR)} | ${sg(S.t, 2)} |`);
  L.push('', '## In plain words', '', R.reading, '',
    '## Sides and exits (pooled rule trades)', '',
    `Buys n ${P1.buys.n} ${sg(P1.buys.netR)}R, sells n ${P1.sells.n} ${sg(P1.sells.netR)}R; exits ${Object.entries(P1.exits).map(([k, v]) => k + ' ' + v).join(', ')}; worst drawdown ${sg(P1.maxDD, 2)}R.`, '',
    '## By year (rule trades, net R a trade, n)', '', '| Year | Set A | Set B |', '|---|---|---|');
  const ys = [...new Set([...Object.keys(R.sets.A.byYear), ...Object.keys(R.sets.B.byYear)])].sort();
  for (const y of ys) { const a = R.sets.A.byYear[y], b = R.sets.B.byYear[y]; L.push(`| ${y} | ${a ? `${sg(a.netR)} (${a.n})` : '—'} | ${b ? `${sg(b.netR)} (${b.n})` : '—'} |`); }
  L.push('', '## Harness gate (ungated entry, 2010-2026, five main markets; a code check, not evidence)', '', '| Window | Published n / net R | Here n / net R | Met |', '|---|---|---|---|');
  for (const [k, g] of Object.entries(R.gate.rows)) L.push(`| ${k} | ${g.refN} / ${sg(g.refMeanR, 4)} | ${g.n} / ${sg(g.meanR, 4)} | ${yn(g.ok)} |`);
  L.push('', '## Choices the pre-registration leaves open (written before the run)', '', ...CHOICES.map((c) => '- ' + c), '',
    '## What this does NOT show', '',
    '- One rule, fixed before the run; no swing size, ATR multiple, level count or timeframe is tried. Whatever is seen here is a hypothesis for other data, not a setting to adopt.',
    '- Set B costs are ASSUMED, not measured on the demo account; past years are charged today\'s costs; OANDA mid candles, not broker ticks; gold long financing as direction-chain-gate charges it.',
    '- The phase tags in `trades.json` (D1 / H4 side and stage at the signal) are a description, never part of the verdict.',
    '- Nothing here is an edge on its own and nothing live changes.', '',
    '## Audit (23 Nov 2026)', '',
    '- An adversarial audit found no defect that changes a number or the verdict: the three conditions recomputed from candles cut at each signal agree on 123 sampled candidates (EUR/JPY Set B, gold Set A); every taken trade sits inside its set window (Set A fills 2005-04-20 to 2009-12-31, Set B 2010-01-04 on); no two taken trades of one market overlap; pooled month t recomputed from trades.json (264 months, t -0.36, one-sided p 0.642); the plan file is unchanged since its commit; the pinned entry hash holds.',
    '- Disclosures added by the audit: silver longs carry no overnight financing (only gold longs are charged, as direction-chain-gate does), which flatters Set B buys slightly; the Set B cost figures live in the toolkit as uncommitted working-tree lines written for this family, assumed, not measured.', '',
    '## Data', '', `- ${R.data}`, '- To repeat: `node research/edge/holdout-weekly-fade/run.mjs` (reads the toolkit cache at EDGE_DATA, kept out of git; about a minute).', '');
  return L.join('\n');
}

// ---- main ----------------------------------------------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pins = pinCheck(), all = [], data = [], spans = {};
  for (const set of ['A', 'B']) {
    const S = SETS[set]; let last = '';
    for (const mk of S.markets) {
      const M5 = K.load(mk, '5m', S.load);
      const fileLast = new Date(M5.at(-1).t * 1000).toISOString().slice(0, 10);
      const to = S.to ? sec(S.to) : sec(fileLast);
      const rows = marketRun(mk, M5, sec(S.from), to).map((x) => ({ ...x, set }));
      const tf = { '1d': K.dailyNY(M5), '4h': K.resample(M5, 14400), '1h': K.resample(M5, 3600), '15m': K.resample(M5, 900), '5m': [] };
      for (const x of rows) if (x.rule) { try { const ph = readPhase(tf, x.sig, { window: 300 }); x.phase = `${ph.tf['1d'].side}:${ph.tf['1d'].stage}|${ph.tf['4h'].side}:${ph.tf['4h'].stage}`; } catch { x.phase = null; } }
      all.push(...rows); if (!S.to && fileLast > last) last = fileLast;
      data.push(`${mk} (Set ${set}): ${M5.length} M5 candles ${new Date(M5[0].t * 1000).toISOString().slice(0, 10)} → ${fileLast}, ${rows.length} candidates in the set window, ${rows.filter((x) => x.rule).length} meeting all three conditions`);
      console.error(data.at(-1));
    }
    spans[set] = last;
  }
  const take = (f) => { const out = []; for (const set of ['A', 'B']) for (const mk of SETS[set].markets) out.push(...G.oneAtATime(all.filter((x) => x.set === set && x.market === mk && f(x)))); return out; };
  const ruleT = take((x) => x.rule), ctrlT = take(() => true);
  const spanOf = (set, tr) => {
    const endEntry = SETS[set].to ? '2009-12' : spans[set].slice(0, 7);
    const maxExit = tr.reduce((m, x) => Math.max(m, x.exitT), 0); const ex = maxExit ? new Date(maxExit * 1000).toISOString().slice(0, 7) : endEntry;
    return [SETS[set].from.slice(0, 7), ex > endEntry ? ex : endEntry];
  };
  const sp = { A: spanOf('A', ctrlT.filter((x) => x.set === 'A')), B: spanOf('B', ctrlT.filter((x) => x.set === 'B')) };
  const pooledOf = (tr) => { const a = months(tr.filter((x) => x.set === 'A'), sp.A), b = months(tr.filter((x) => x.set === 'B'), sp.B);
    return summ(tr, { net: [...a.net, ...b.net], net2: [...a.net2, ...b.net2], R: [...a.R, ...b.R] }); };
  const pooled = { rule: pooledOf(ruleT), control: pooledOf(ctrlT), ruleMinusControl: welch(ruleT.map((x) => x.Rnet), ctrlT.map((x) => x.Rnet)) };
  const sets = {};
  for (const s of ['A', 'B']) { const r = ruleT.filter((x) => x.set === s), c = ctrlT.filter((x) => x.set === s);
    sets[s] = { ...SETS[s], span: sp[s], rule: summ(r, months(r, sp[s])), control: summ(c, months(c, sp[s])), byYear: byYear(r) }; }
  const markets = {};
  for (const s of ['A', 'B']) for (const mk of SETS[s].markets) { const r = ruleT.filter((x) => x.market === mk && x.set === s), c = ctrlT.filter((x) => x.market === mk && x.set === s);
    markets[mk] = { set: s, rule: summ(r, months(r, sp[s])), control: summ(c, months(c, sp[s])) }; }
  const alone = {
    'Weekly side = trade side': pooledOf(take((x) => x.c1)), 'Daily side against the trade': pooledOf(take((x) => x.c2)),
    'Within 0.5 ATR of a Daily swing level': pooledOf(take((x) => x.c3)), 'All three (the rule)': pooled.rule, 'None (ungated control)': pooled.control,
  };
  const P1 = pooled.rule, p = pOne(P1.tRaw, P1.months - 1), fam = family(p);
  console.error('gate: running the ungated entry on 2010-2026 (code check)');
  const g = gate();
  const checks = { setA: sets.A.rule.netR > 0, setB: sets.B.rule.netR > 0, t2: P1.tRaw >= 2, holm: fam.pHolm < 0.05, n100: P1.n >= 100, cost2x: P1.net2R > 0 };
  const pinsOk = pins.every((x) => x.ok);
  const word = !pinsOk || !g.ok || P1.n < 100 ? 'INCONCLUSIVE' : Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
  const missed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  const verdict = `${word}${!pinsOk ? ' (pinned module changed)' : ''}${!g.ok ? ' (harness gate missed)' : ''}: pooled holdout ${sg(P1.netR)}R a trade after costs (n ${P1.n}, month t ${sg(P1.t, 2)}, one-sided p ${r3(p)}); Set A ${sg(sets.A.rule.netR)}R (n ${sets.A.rule.n}), Set B ${sg(sets.B.rule.netR)}R (n ${sets.B.rule.n}); 2x costs ${sg(P1.net2R)}R; ungated control ${sg(pooled.control.netR)}R (n ${pooled.control.n})${missed.length ? '; lines missed: ' + missed.join(', ') : ''}`;
  const RC = pooled.ruleMinusControl;
  const reading = `${word === 'PASS' ? 'Every pre-registered line holds. Paper research only: at most a candidate for its own forward paper record, by the owner\'s decision.' : `The rule does not pass the pre-registered bar (${word}${missed.length ? '; missed: ' + missed.join(', ') : ''}).`} ` +
    `The rule, pooled: ${sg(P1.netR)}R a trade after costs (n ${P1.n}, gross ${sg(P1.grossR)}R, month t ${sg(P1.t, 2)} over ${P1.months} months). The ungated entry on the same holdout: ${sg(pooled.control.netR)}R (n ${pooled.control.n}, gross ${sg(pooled.control.grossR)}R, month t ${sg(pooled.control.t, 2)}); rule minus control ${sg(RC.diff)}R (Welch t ${sg(RC.t, 2)}, the two overlap). ` +
    `Set A ${sg(sets.A.rule.netR)}R (n ${sets.A.rule.n}) against its control ${sg(sets.A.control.netR)}R; Set B ${sg(sets.B.rule.netR)}R (n ${sets.B.rule.n}) against ${sg(sets.B.control.netR)}R. ` +
    'The shape was chosen from two of the owner\'s marked trades and an in-sample scan of 2010-2026 on the five main markets; whatever it shows here is read as the pre-registration says, never as an edge without its n and t.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'holdout-weekly-fade', built: '2026-11-23', preregistration: 'research/edge/holdout-weekly-fade/PREREGISTRATION.md', planSha256: sha, verdict, verdictWord: word,
    primary: { p: r6(p), t: P1.t, n: P1.n, months: P1.months }, checks, family: fam, pins, pinsOk, gate: g, params: P, choices: CHOICES, costs: K.COSTS,
    data: data.join('; ') + '. Source: the shared toolkit\'s OANDA mid M5 cache; 2010-2026 on the five main markets read only for the harness gate.',
    sets, pooled, alone, markets, reading };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R) + '\n');
  const ruleIds = new Set(ruleT.map((x) => x.market + x.fillT)), ctrlIds = new Set(ctrlT.map((x) => x.market + x.fillT));
  const slim = all.map((x) => [x.set, x.market, x.side, (x.fillT - x.sig) / 300, x.fillT, +x.entry.toPrecision(6), +x.stop.toPrecision(6), x.exitT, x.reason[0], r3(x.R), r3(x.Rnet), x.wSide, x.dSide, r2(x.near),
    x.rule ? 1 : 0, ruleIds.has(x.market + x.fillT) ? 1 : 0, ctrlIds.has(x.market + x.fillT) ? 1 : 0, x.phase ?? null]);
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ cols: ['set', 'market', 'side', 'fillLagM5', 'fillT', 'entry', 'stop', 'exitT', 'exit(s/t/T)', 'R', 'Rnet',
    'weeklySide', 'dailySide', 'nearATR', 'allThree', 'ruleTaken', 'controlTaken', 'phaseD1|H4'], note: 'every ungated candidate in the holdout sets; signal time (breaking H1 close) = fillT - 300 x fillLagM5; ruleTaken / controlTaken = in the one-position-at-a-time stream', rows: slim }) + '\n');
  console.log(verdict); console.log(JSON.stringify(g.rows));
}
