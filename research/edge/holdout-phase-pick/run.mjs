// research/edge/holdout-phase-pick/run.mjs - discretion made explicit: the phase reader picks which entry to take
// (PREREGISTRATION.md, 23 Nov 2026). Judged on the untouched holdout only. Research only: nothing live reads it, it places
// nothing. Candles from the overnight toolkit's cache (research/edge/_lib/edgekit.mjs).
//   node research/edge/holdout-phase-pick/run.mjs          harness gate, then the holdout run; writes result.json, trades.json, RESULT.md
//   node research/edge/holdout-phase-pick/run.mjs gate     the harness gate alone (written to GATE_OUT, read by the main run)
// Three entry generators are imported unchanged (pinned by hash): h4-pullback-end `candidates` (location step kept),
// direction-chain-gate `candidates` (the ungated H1 box break) and daily-zone-retest `signals` (simulated as its `trades`
// does, without its one-position rule, which the book applies). readPhase (research/edge/_lib/phase.mjs, its defaults) is read
// at each candidate's signal candle close, from candles closed by then, and decides whether the candidate may be taken.
// Choices the pre-registration leaves open, fixed before the holdout run:
// - Phase input: '1d' = dailyNY of the 5m candles, '4h' / '1h' / '15m' = resample, '5m' = the 5m candles. Each is handed to
//   readPhase as its last WIN + 50 closed candles at the signal time (readPhase itself keeps the last 600 closed): the same
//   reading as handing it the whole series (tested), without copying a million candles a call.
// - "Same M5 candle" = the same fill time (every generator fills at the open of a 5m candle). A candidate is taken when its
//   fill is at or after the exit of the trade the market holds (the generators' own one-at-a-time rule).
// - Kept against rejected (reported only): per generator, the kept and the rejected candidates each as one position at a time
//   per market, Welch t on R after costs.
// - Set A trades opened in late 2009 are closed on candles up to 1 Feb 2010 (exit only); Set B reads warm-up candles from
//   2007-01-01 so that the Daily reading has its 600 candles by 2010.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { readPhase } from '../_lib/phase.mjs';
import * as PB from '../h4-pullback-end/run.mjs';
import * as BX from '../direction-chain-gate/run.mjs';
import * as ZR from '../daily-zone-retest/run.mjs';
import { financing } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
export const PIN = {
  'research/edge/_lib/phase.mjs': '6a204f93814b50bc',
  'research/edge/h4-pullback-end/run.mjs': 'c7abd9c768f0821b',
  'research/edge/direction-chain-gate/run.mjs': '2c891e09c4bf3463',
  'research/edge/daily-zone-retest/run.mjs': 'de00379cac36fb31',
};
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
export const SETS = {
  A: { name: 'Set A: 2005-2009, five main markets', markets: K.MARKETS, from: D('2005-01-01'), to: D('2010-01-01'), loadFrom: '2004-01-01', loadTo: '2010-02-01' },
  B: { name: 'Set B: 2010 on, five fresh markets', markets: K.HOLDOUT_MARKETS, from: D('2010-01-01'), to: D('2100-01-01'), loadFrom: '2007-01-01', loadTo: null },
};
export const FAMILY = ['holdout-vb-early', 'holdout-pullback-deep', 'holdout-phase-pick', 'holdout-h1-veto', 'holdout-weekly-fade'];
export const GENS = ['pull', 'zone', 'box']; // the fixed priority when two fills land in the same 5m candle
export const GNAME = { pull: 'Pullback end', box: 'H1 box break', zone: 'Daily zone retest' };
const WIN = 600; // readPhase's default window

export function pinsOk(root = ROOT) {
  const out = {};
  for (const [f, h] of Object.entries(PIN)) {
    const got = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 16);
    out[f] = { want: h, got, ok: got === h };
  }
  return out;
}

// ---- the three generators, as normalised candidates ---------------------------------------------------------------
// Every candidate: { gen, market, side +1/-1, signalT (close of the signal candle), entryT (fill, a 5m candle start), entry,
// stop, target, exitT, exit, reason, risk, R, Rnet, Rnet2 }.
export function genPull(bars5, market, cost = K.COSTS[market]) {
  return PB.candidates(bars5, market, { cost }).filter((x) => x.loc).map((x) => ({ gen: 'pull', market, side: x.side, signalT: x.signalT,
    entryT: x.entryT, entry: x.entry, stop: x.stop, target: x.target, exitT: x.exitT, exit: x.exit, reason: x.reason, risk: x.risk,
    R: x.R, Rnet: x.Rnet, Rnet2: x.Rnet2 }));
}
export function genBox(bars5, market, cost = K.COSTS[market]) {
  return BX.candidates(market, bars5, { cost }).map((x) => ({ gen: 'box', market, side: x.side, signalT: x.sig, entryT: x.fillT,
    entry: x.entry, stop: x.stop, target: x.target, exitT: x.exitT, exit: x.exit, reason: x.reason, risk: x.side * (x.entry - x.stop),
    R: x.R, Rnet: x.Rnet, Rnet2: x.Rnet2 }));
}
// daily-zone-retest `trades` without its busy rule: each signal simulated on its own, costs and gold-buy financing as there
export function genZone(bars5, market, cost = K.COSTS[market]) {
  const S = ZR.signals(bars5); const out = [];
  for (const s of S.signals) {
    if (s.skip) continue;
    const r = K.simulate({ side: s.side, entry: s.entry, stop: s.stop, target: s.target, t: s.t, type: 'market', maxHold: s.deadline == null ? null : s.deadline - s.t }, bars5);
    if (r.status === 'bad' || r.status === 'nofill' || r.status === 'open') continue;
    const c = (cost || 0) / r.risk;
    const fin = s.side > 0 ? financing({ market, side: 'buy', entry: r.fill, r0: r.risk, filled: r.fillT, closed: r.exitT }).finR : 0;
    out.push({ gen: 'zone', market, side: s.side, signalT: s.signalT, entryT: r.fillT, entry: r.fill, stop: s.stop, target: s.target,
      exitT: r.exitT, exit: r.exit, reason: r.reason, risk: r.risk, R: r.R, Rnet: r.R - c - fin, Rnet2: r.R - 2 * c - 2 * fin });
  }
  return out;
}

// ---- the phase at a signal ------------------------------------------------------------------------------------------
export function phaseSeries(bars5) {
  return { '1d': K.dailyNY(bars5), '4h': K.resample(bars5, 14400), '1h': K.resample(bars5, 3600), '15m': K.resample(bars5, 900), '5m': bars5 };
}
// the last WIN + 50 candles closed by t of each timeframe (readPhase reads only closed candles and keeps the last WIN)
export function trimAt(S, t) {
  const o = {};
  for (const [k, bars] of Object.entries(S)) { const n = K.closedCount(bars, t); o[k] = bars.slice(Math.max(0, n - WIN - 50), n); }
  return o;
}
export const phaseAt = (S, t) => readPhase(trimAt(S, t), t);

// the choice: { ok, why (the first condition missed, or null) }
export function choose(gen, s, P) {
  const d1 = P.tf['1d'], h4 = P.tf['4h'], h1 = P.tf['1h'];
  if (h4.stage === 'range') return { ok: false, why: 'H4 range' };
  if (gen === 'pull') {
    if (h4.side !== s) return { ok: false, why: 'H4 not on the trade side' };
    if (h4.stage !== 'continuation') return { ok: false, why: 'H4 stage not continuation' };
    if (d1.side === -s) return { ok: false, why: 'D1 against' };
    return { ok: true, why: null };
  }
  if (gen === 'box') {
    if (h4.side !== s) return { ok: false, why: 'H4 not on the trade side' };
    if (!h4.confirmed) return { ok: false, why: 'H4 not confirmed (ChoCh only)' };
    if (h4.stage !== 'move' && h4.stage !== 'continuation') return { ok: false, why: 'H4 stage not move / continuation' };
    if (h1.stage === 'pullback') return { ok: false, why: 'H1 in a pullback' };
    return { ok: true, why: null };
  }
  if (gen === 'zone') {
    if (d1.side !== s) return { ok: false, why: 'D1 not on the trade side' };
    if (d1.stage !== 'pullback' && d1.stage !== 'continuation') return { ok: false, why: 'D1 stage not pullback / continuation' };
    return { ok: true, why: null };
  }
  throw new Error('unknown generator ' + gen);
}
const phaseTag = (P) => ({ d1: [P.tf['1d'].side, P.tf['1d'].stage, P.tf['1d'].confirmed], h4: [P.tf['4h'].side, P.tf['4h'].stage, P.tf['4h'].confirmed], h1: [P.tf['1h'].side, P.tf['1h'].stage] });

// all candidates of one market with their phase verdict
export function candidatesOf(bars5, market, { cost = K.COSTS[market] } = {}) {
  const c = [...genPull(bars5, market, cost), ...genZone(bars5, market, cost), ...genBox(bars5, market, cost)];
  const S = phaseSeries(bars5);
  for (const x of c) { const P = phaseAt(S, x.signalT); const v = choose(x.gen, x.side, P); x.take = v.ok; x.why = v.why; x.phase = phaseTag(P); }
  return c;
}

// the book: one open position at a time per market, by fill time, ties by GENS order; a blocked candidate is dropped
const PRI = Object.fromEntries(GENS.map((g, i) => [g, i]));
export function book(cands) {
  const out = [];
  for (const m of new Set(cands.map((x) => x.market))) {
    const xs = cands.filter((x) => x.market === m).sort((a, b) => a.entryT - b.entryT || PRI[a.gen] - PRI[b.gen] || a.signalT - b.signalT);
    let free = -Infinity;
    for (const x of xs) if (x.entryT >= free) { out.push(x); free = x.exitT; }
  }
  return out.sort((a, b) => a.entryT - b.entryT);
}

// ---- statistics -----------------------------------------------------------------------------------------------------
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthSums(trades, key) {
  const m = new Map(); for (const x of trades) { const k = monthKey(x.exitT); m.set(k, (m.get(k) || 0) + x[key]); }
  if (!m.size) return [];
  const ks = [...m.keys()].sort(); const [y0, m0] = ks[0].split('-').map(Number), [y1, m1] = ks[ks.length - 1].split('-').map(Number);
  const out = []; for (let y = y0, mo = m0; y < y1 || (y === y1 && mo <= m1); mo === 12 ? (y++, (mo = 1)) : mo++) {
    const k = `${y}-${String(mo).padStart(2, '0')}`; out.push(m.get(k) || 0); }
  return out;
}
function moments(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, t: null, p: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const t = sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
  return { n, mean, t, p: t == null ? null : K.pFromT(t, n - 1) };
}
export const oneSided = (t, p) => (t == null || p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2);
export function summary(trades, key) {
  const sets = {}; const months = [];
  for (const k of Object.keys(SETS)) {
    const xs = trades.filter((x) => x.set === k);
    const st = K.stats(xs, { key, time: 'exitT' });
    sets[k] = { n: st.n, wins: st.wins, meanR: r4(st.meanR), total: r4(st.total), months: st.months, tMonth: r4(st.tMonth), maxDD: r4(st.maxDD) };
    months.push(...monthSums(xs, key));
  }
  const all = trades.map((x) => x[key]); const mt = moments(months), tr = moments(all);
  return { sets, pooled: { n: tr.n, wins: all.filter((v) => v > 0).length, meanR: r4(tr.mean), total: r4(all.reduce((a, b) => a + b, 0)), tTrade: r4(tr.t),
    months: mt.n, tMonth: r4(mt.t), pOne: r4(oneSided(mt.t, mt.p)) } };
}
export function block(trades) { return { net: summary(trades, 'Rnet'), net2x: summary(trades, 'Rnet2'), gross: summary(trades, 'R') }; }
export function verdictOf(b, holmP) {
  const n = b.net.pooled.n;
  const lines = { setAMean: b.net.sets.A.meanR > 0, setBMean: b.net.sets.B.meanR > 0, pooledT: b.net.pooled.tMonth >= 2,
    holm: holmP == null ? null : holmP < 0.05, n100: n >= 100, x2Mean: b.net2x.pooled.meanR > 0 };
  if (!(n >= 100)) return { lines, verdict: 'INCONCLUSIVE', why: 'fewer than 100 pooled holdout trades' };
  const miss = Object.entries(lines).filter(([, v]) => v === false);
  if (miss.length) return { lines, verdict: 'FAIL', why: 'lines missed: ' + miss.map(([k]) => k).join(', ') };
  if (lines.holm == null) return { lines, verdict: 'PENDING', why: 'every other line holds; the five-study Holm needs the other results' };
  return { lines, verdict: 'PASS', why: 'every line holds' };
}
export function familyHolm(myP, dir = path.dirname(HERE)) {
  const ps = [], have = {};
  for (const s of FAMILY) {
    if (s === 'holdout-phase-pick') { ps.push(myP); have[s] = myP; continue; }
    const f = path.join(dir, s, 'result.json'); let p = null;
    if (fs.existsSync(f)) { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); p = j.primaryP ?? j.primary?.pOne ?? j.primary?.p ?? null; /* Audit correction (23 Nov 2026): three siblings store it as primary.p */ } catch { p = null; } }
    have[s] = p; ps.push(p);
  }
  const complete = ps.every((p) => Number.isFinite(p));
  const h = complete ? K.holm(ps) : null;
  return { have, complete, holmP: complete ? r4(h[FAMILY.indexOf('holdout-phase-pick')]) : null, bound: r4(Math.min(1, 5 * myP)) };
}
function welch(a, b) {
  const m = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length; const v = (xs, mu) => xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1);
  if (a.length < 2 || b.length < 2) return { t: null, diff: null, na: a.length, nb: b.length };
  const ma = m(a), mb = m(b), va = v(a, ma) / a.length, vb = v(b, mb) / b.length; const t = (ma - mb) / Math.sqrt(va + vb);
  return { t: r4(t), diff: r4(ma - mb), meanA: r4(ma), meanB: r4(mb), na: a.length, nb: b.length };
}

// ---- harness gate (code check on 2010-2026, the five main markets; not part of the verdict) ---------------------------
export function gate() {
  const pb = JSON.parse(fs.readFileSync(path.join(HERE, '../h4-pullback-end/result.json'), 'utf8')).tests[0].windows;
  const bx = JSON.parse(fs.readFileSync(path.join(HERE, '../direction-chain-gate/result.json'), 'utf8')).streams.all;
  const zr = JSON.parse(fs.readFileSync(path.join(HERE, '../daily-zone-retest/result.json'), 'utf8')).T1.cost1;
  const P1 = [], B1 = [], Z1 = []; let oosEnd = Infinity;
  for (const m of K.MARKETS) {
    const b5 = K.load(m, '5m', { from: '2010-01-01' });
    P1.push(...PB.runMarket(b5, m).kept);
    B1.push(...BX.candidates(m, b5));
    const z = ZR.trades(m, b5); Z1.push(...z.trades); oosEnd = Math.min(oosEnd, z.lastDayEnd);
    console.error('gate', m);
  }
  const rows = {}; let ok = true;
  const cmp = (name, refN, refMean, n, mean) => {
    const g = { refN, n, refMeanR: r4(refMean), meanR: r4(mean), ok: Math.abs(n - refN) <= 0.02 * refN && Math.abs(mean - refMean) <= 0.01 };
    rows[name] = g; ok = ok && g.ok;
  };
  const pg = PB.block(P1.filter((x) => x.entryT >= PB.W.rep[0]));
  for (const k of ['rep', 'is', 'oos']) cmp('pull.' + k, pb[k].net.n, pb[k].net.meanR, pg[k].net.n, pg[k].net.meanR);
  const bs = BX.streamsOf(B1).all;
  for (const [k, w] of Object.entries(BX.WIN)) { const xs = bs.filter((x) => x.fillT >= w[0] && x.fillT < w[1]); const s = K.stats(xs, { key: 'Rnet', time: 'exitT' });
    cmp('box.' + k, bx[k].n, bx[k].meanR, s.n, s.meanR); }
  for (const k of ['REP', 'IS', 'OOS']) { const s = ZR.summ(ZR.inWin(Z1, k, oosEnd)); cmp('zone.' + k, zr[k].n, zr[k].meanR, s.n, s.meanR); }
  return { ok, rows, note: 'code check only; 2010-2026 on the five main markets is not holdout data and is not part of the verdict' };
}

// ---- the holdout run ----------------------------------------------------------------------------------------------
export function runHoldout() {
  const all = [], perMarket = {};
  for (const [k, s] of Object.entries(SETS)) for (const m of s.markets) {
    const b5 = K.load(m, '5m', { from: s.loadFrom, to: s.loadTo ?? undefined });
    let to = s.to;
    if (k === 'B') { const Dd = K.dailyNY(b5); const last = b5[b5.length - 1].e; for (let i = Dd.length - 1; i >= 0; i--) if (Dd[i].e <= last) { to = Math.min(to, Dd[i].e); break; } }
    const c = candidatesOf(b5, m).filter((x) => x.entryT >= s.from && x.entryT < to).map((x) => ({ ...x, set: k }));
    all.push(...c);
    perMarket[k + ':' + m] = { first: b5.length ? new Date(b5[0].t * 1000).toISOString().slice(0, 10) : null, candidates: c.length,
      byGen: Object.fromEntries(GENS.map((g) => [g, { n: c.filter((x) => x.gen === g).length, taken: c.filter((x) => x.gen === g && x.take).length }])) };
    console.error(k, m, c.length, 'candidates', c.filter((x) => x.take).length, 'pass the choice');
  }
  return { all: all.sort((a, b) => a.entryT - b.entryT), perMarket };
}

const f = (v, d = 3) => (v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const ft = (v) => (v == null ? '-' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
function detail(trades) {
  const byMarket = {}, byYear = {}, byReason = {}, bySide = {}, byGen = {};
  for (const x of trades) {
    const add = (o, k) => { const g = (o[k] ||= { n: 0, R: 0, Rnet: 0 }); g.n++; g.R += x.R; g.Rnet += x.Rnet; };
    add(byMarket, x.set + ':' + x.market); add(byYear, new Date(x.entryT * 1000).getUTCFullYear()); add(byReason, x.reason);
    add(bySide, x.side > 0 ? 'buy' : 'sell'); add(byGen, x.gen);
  }
  for (const o of [byMarket, byYear, byReason, bySide, byGen]) for (const g of Object.values(o)) { g.meanR = r4(g.R / g.n); g.meanRnet = r4(g.Rnet / g.n); g.R = r4(g.R); g.Rnet = r4(g.Rnet); }
  return { byMarket, byYear, byReason, bySide, byGen };
}

export function report(res) {
  const L = [], p = res.primary.net;
  L.push('# Discretion made explicit, the phase reader picks the entry: holdout result (23 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.headline}`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any holdout candle was read for this study); run once by `run.mjs` on the',
    'toolkit\'s OANDA mid 5m cache. The three entry generators and the phase reader are imported unchanged (hashes pinned). R after',
    'each generator\'s own costs (toolkit round trips; gold buys of the box break and the zone retest pay financing as in their',
    'studies; Set B costs are ASSUMED, not measured); t on calendar-month sums by exit month, each set\'s own months joined; p one-sided.', '');
  L.push('| Stream | n | R a trade after costs | month t | at 2x costs | before costs |', '|---|---|---|---|---|---|');
  const row = (name, b, k) => { const g = k ? b.net.sets[k] : b.net.pooled, g2 = k ? b.net2x.sets[k] : b.net2x.pooled, g0 = k ? b.gross.sets[k] : b.gross.pooled;
    return `| ${name} | ${g.n} | ${f(g.meanR)} | ${ft(g.tMonth)} | ${f(g2.meanR)} | ${f(g0.meanR)} |`; };
  L.push(row('Book with the choice, Set A (2005-2009, five main markets)', res.primary, 'A'), row('Book with the choice, Set B (2010 on, five fresh markets)', res.primary, 'B'),
    row('**Book with the choice, pooled holdout (primary)**', res.primary, null), row('Control: same generators, no choice, pooled', res.control, null),
    row('Control, Set A', res.control, 'A'), row('Control, Set B', res.control, 'B'));
  for (const g of GENS) L.push(row(`Book: ${GNAME[g]} trades only (pooled)`, res.bookByGen[g], null));
  L.push('', `Primary: one-sided p ${ft(p.pooled.pOne)}; Holm over the five holdout studies ${res.holm.complete ? ft(res.holm.holmP) : 'not yet computable (' + Object.entries(res.holm.have).filter(([, v]) => v == null).map(([k]) => k).join(', ') + ' missing); it is at most ' + ft(res.holm.bound)}.`);
  L.push('', 'Pass lines: ' + Object.entries(res.lines).map(([k, v]) => `${k} ${v == null ? 'pending' : v ? 'yes' : 'no'}`).join(', ') + '.');
  L.push('', `Book with the choice against the control (pooled, after costs): ${f(res.vsControl.diff)}R a trade, Welch t ${ft(res.vsControl.t)} (n ${res.vsControl.na} / ${res.vsControl.nb}; the two share trades, so the t is only a guide). Reported only.`);
  L.push('', '## Each generator: kept by the choice against rejected (each one position at a time per market, pooled holdout, after costs)', '',
    '| Generator | candidates | kept n | kept R | rejected n | rejected R | difference | Welch t |', '|---|---|---|---|---|---|---|---|');
  for (const g of GENS) { const w = res.keptVsRejected[g];
    L.push(`| ${GNAME[g]} | ${res.funnel[g].candidates} | ${w.na} | ${f(w.meanA)} | ${w.nb} | ${f(w.meanB)} | ${f(w.diff)} | ${ft(w.t)} |`); }
  L.push('', '## Which condition removed how many candidates (the first condition missed)', '');
  for (const g of GENS) L.push(`- ${GNAME[g]}: ${res.funnel[g].candidates} candidates, ${res.funnel[g].kept} pass; ` +
    Object.entries(res.funnel[g].removed).map(([k, v]) => `${k} ${v}`).join(', ') + '.');
  L.push('', '## Per market (book with the choice), R a trade after costs (n)', '', Object.entries(res.detail.byMarket).map(([k, g]) => `${k} ${f(g.meanRnet)} (${g.n})`).join(' · '));
  L.push('', '## By entry year (book with the choice), R a trade after costs (n)', '', Object.entries(res.detail.byYear).map(([k, g]) => `${k} ${f(g.meanRnet)} (${g.n})`).join(' · '));
  L.push('', '## Exits and sides (book with the choice)', '', Object.entries(res.detail.byReason).map(([k, g]) => `${k} ${g.n} (${f(g.meanR, 2)}R before costs)`).join(', ') + '; ' +
    Object.entries(res.detail.bySide).map(([k, g]) => `${k}s ${f(g.meanRnet)}R after costs (n ${g.n})`).join(', ') + '.');
  L.push('', '## Harness gate', '', `Each generator, unchanged, re-run on 2010-2026, five main markets: ${res.gate.ok ? 'reproduced' : 'MISSED'} (` +
    Object.entries(res.gate.rows).map(([k, r]) => `${k} n ${r.n} / ${r.refN}, ${f(r.meanR)} / ${f(r.refMeanR)}R`).join('; ') + `). tests/phase.test.mjs: ${res.phaseTests}. A code check only, not part of the verdict.`);
  L.push('', '## In plain words', '', ...res.plain.map((s) => '- ' + s));
  L.push('', '## What it does NOT show', '',
    '- One mechanical reading of the market cycle (the repository\'s phase reader, 3-candle swings), not the owner\'s reading on a chart; no variant of the choice was tried.',
    '- Set B costs are assumed round trips; stop slippage beyond a gap is not modelled; financing is charged only where the generators\' studies charge it (gold buys).',
    '- Set A trades opened in late December 2009 are closed on candles of January 2010 (exit only).',
    '- A FAIL is about this written choice on this holdout; it does not judge a person\'s discretion, which only a record of choices stamped before the outcome can measure.', '');
  if (res.audit) L.push('## Audit correction (23 Nov 2026)', '', ...res.audit.map((x) => '- ' + x), '');
  L.push('Nothing live changed. Files: result.json (every number), trades.json (every trade of the book and of the control, with its phase), tests/holdout-phase-pick.test.mjs.');
  return L.join('\n') + '\n';
}

const GATE_OUT = process.env.GATE_OUT || null;
export function main() {
  const pins = pinsOk(); const pinOk = Object.values(pins).every((x) => x.ok);
  // the gate's second half: the phase reader passes its own tests
  const pt = spawnSync(process.execPath, ['--test', 'tests/phase.test.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const pm = /# pass (\d+)[\s\S]*# fail (\d+)/.exec(pt.stdout || '');
  const phaseTests = pm ? `pass ${pm[1]}, fail ${pm[2]}` : 'not run';
  let g;
  if (GATE_OUT && fs.existsSync(GATE_OUT)) g = JSON.parse(fs.readFileSync(GATE_OUT, 'utf8')); else g = gate();
  console.error('gate', g.ok, JSON.stringify(g.rows));
  const H0 = runHoldout(); const all = H0.all;
  const chosen = book(all.filter((x) => x.take)), control = book(all);
  const tag = new Set(chosen), ctag = new Set(control);
  const primary = block(chosen), ctrl = block(control);
  const bookByGen = Object.fromEntries(GENS.map((x) => [x, block(chosen.filter((y) => y.gen === x))]));
  const funnel = {}, keptVsRejected = {};
  for (const x of GENS) {
    const c = all.filter((y) => y.gen === x); const removed = {};
    for (const y of c) if (!y.take) removed[y.why] = (removed[y.why] || 0) + 1;
    funnel[x] = { candidates: c.length, kept: c.filter((y) => y.take).length, removed };
    keptVsRejected[x] = welch(book(c.filter((y) => y.take)).map((y) => y.Rnet), book(c.filter((y) => !y.take)).map((y) => y.Rnet));
  }
  const pOne = primary.net.pooled.pOne ?? 1;
  const holm = familyHolm(pOne);
  let v = verdictOf(primary, holm.holmP);
  const phaseOk = !!pm && +pm[1] > 0 && +pm[2] === 0;
  if (!pinOk || !g.ok || !phaseOk) v = { ...v, verdict: 'INCONCLUSIVE', why: !pinOk ? 'pinned module hash differs' : !g.ok ? 'harness gate missed' : 'tests/phase.test.mjs did not pass' };
  const vsControl = welch(chosen.map((x) => x.Rnet), control.map((x) => x.Rnet));
  const P0 = primary.net, C0 = ctrl.net;
  const headline = `Book with the choice: pooled holdout ${f(P0.pooled.meanR)}R a trade after costs (n ${P0.pooled.n}, month t ${ft(P0.pooled.tMonth)}, one-sided p ${ft(P0.pooled.pOne)}); `
    + `Set A ${f(P0.sets.A.meanR)}R (n ${P0.sets.A.n}), Set B ${f(P0.sets.B.meanR)}R (n ${P0.sets.B.n}); at 2x costs ${f(primary.net2x.pooled.meanR)}R; before costs ${f(primary.gross.pooled.meanR)}R. `
    + `Control without the choice ${f(C0.pooled.meanR)}R (n ${C0.pooled.n}, month t ${ft(C0.pooled.tMonth)}). ${v.why[0].toUpperCase() + v.why.slice(1)}.`;
  const plain = [
    `The choice let ${chosen.length} trades through out of ${all.filter((x) => x.take).length} candidates it accepted (${all.length} candidates in all); without it the same generators took ${control.length} trades.`,
    `With the choice the book made ${f(P0.pooled.meanR)}R a trade after costs, without it ${f(C0.pooled.meanR)}R: the difference is ${f(vsControl.diff)}R a trade.`,
    ...GENS.map((x) => `${GNAME[x]}: kept by the choice ${f(keptVsRejected[x].meanA)}R a trade (n ${keptVsRejected[x].na}), rejected ${f(keptVsRejected[x].meanB)}R (n ${keptVsRejected[x].nb}), Welch t ${ft(keptVsRejected[x].t)}.`),
    `Before costs the book is ${f(primary.gross.pooled.meanR)}R a trade; costs take ${f(primary.gross.pooled.meanR - P0.pooled.meanR)}R a trade.`,
  ];
  const res = { study: 'holdout-phase-pick', built: '2026-11-23', verdict: v.verdict, why: v.why, headline, primaryP: r4(pOne), lines: v.lines, holm, pins, gate: g, phaseTests,
    sets: Object.fromEntries(Object.entries(SETS).map(([k, s]) => [k, { name: s.name, markets: s.markets, from: s.from, to: s.to }])), priority: GENS, costs: K.COSTS,
    perMarket: H0.perMarket, primary, control: ctrl, bookByGen, vsControl, keptVsRejected, funnel, detail: detail(chosen), controlDetail: detail(control), plain };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  // trades.json: every candidate taken by the book with the choice or by the control (the rest are regenerated by run.mjs;
  // their counts are in result.json `funnel`), compact so the file stays under 3 MB
  const WHY = [...new Set(all.map((x) => x.why).filter(Boolean))].sort();
  const st = (v) => (v === 'continuation' ? 'c' : v === 'pullback' ? 'p' : v === 'move' ? 'm' : 'r');
  const ph = (x) => `${x.phase.d1[0]}${st(x.phase.d1[1])}${+x.phase.d1[2]} ${x.phase.h4[0]}${st(x.phase.h4[1])}${+x.phase.h4[2]} ${x.phase.h1[0]}${st(x.phase.h1[1])}`;
  const cols = ['gen', 'set', 'market', 'side', 'signalT', 'entryT', 'entry', 'stop', 'target', 'exitT', 'exit', 'reason', 'R', 'Rnet', 'Rnet2', 'take', 'why', 'book', 'control', 'phase'];
  const p6 = (x) => +x.toPrecision(6);
  const rows = all.filter((x) => tag.has(x) || ctag.has(x)).map((x) => [x.gen, x.set, x.market, x.side, x.signalT, x.entryT, p6(x.entry), p6(x.stop), p6(x.target), x.exitT, p6(x.exit), x.reason[0] + (x.reason === 'time' ? 'i' : ''),
    +x.R.toFixed(4), +x.Rnet.toFixed(4), +x.Rnet2.toFixed(4), x.take ? 1 : 0, x.why == null ? -1 : WHY.indexOf(x.why), tag.has(x) ? 1 : 0, ctag.has(x) ? 1 : 0, ph(x)]);
  const tj = { cols, why: WHY, note: 'the holdout candidates taken by the book with the choice (book = 1, the primary) or by the control without it (control = 1); times unix s UTC; prices to 6 significant digits; reason s = stop, t = target, ti = time; R before costs, Rnet after 1x, Rnet2 after 2x costs (4 decimals); take = passes the phase choice; why = index into `why` of the first condition missed (-1 = none); phase = "D1 H4 H1" at the signal close, each side (+1 / -1 / 0), stage (m move, p pullback, c continuation, r range) and, for D1 / H4, confirmed (1 / 0)', rows };
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(tj).replace(/\],\[/g, '],\n[') + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(res.verdict, headline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'gate') { const g = gate(); const out = GATE_OUT || path.join(HERE, '_gate.json'); fs.writeFileSync(out, JSON.stringify(g, null, 1)); console.log(g.ok, JSON.stringify(g.rows)); }
  else main();
}
