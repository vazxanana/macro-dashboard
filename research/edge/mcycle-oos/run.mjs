// Mosha cycle (`mcycle`) on untouched gold history 2007-2019 (study 146, 14 Nov 2026). Pre-registered in PREREGISTRATION.md
// (committed alone first). The rule is the live code, imported and run unchanged: council/mosha-cycle.mjs (cycleTrades,
// cycleBlockers) on BO events from council/engine.mjs msAnalyze(bars, 6), managed by council/fills.mjs manageLive with spotSkip,
// costed with $0.60 a round trip and financing / FIN. The replay harness (replay, recordOf, the event mapping) is the one of the
// study mcycle-base (branch mcycle-base-study, 13 Nov 2026, not merged), copied; H4 / H1 / M15 are built here from M5.
// Nothing here is read by the council; nothing live changes.
//
//   node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>   -> <dir>/xau-5m.json.gz (OANDA mid M5 from June 2006)
//   node research/edge/mcycle-oos/run.mjs run <dir>/xau-5m.json.gz        -> result.json, positions.json, RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { msAnalyze } from '../../../council/engine.mjs';
import { cycleTrades, cycleBlockers } from '../../../council/mosha-cycle.mjs';
import { manageLive, spotSkip, financing } from '../../../council/fills.mjs';

const U = (y, m = 0, d = 1) => Date.UTC(y, m, d) / 1000;
export const K = {
  N: 6, WIN: 719, VALID: 24 * 3600, HOLD: 72 * 3600, COST: 0.6,
  FROM: U(2007), END: U(2026, 10, 1),   // decisions from 2007-01-01; exits counted up to 2026-10-31
  W: { dec: [U(2007), U(2020)], w2: [U(2020), U(2024)], w3: [U(2024), U(2026, 10, 1)], rec: [U(2020), U(2026, 10, 1)] },
  SEEDS: 40, NEED: 38,
};
export const TF = { '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 };

// H4 / H1 / M15 from M5: UTC buckets, open of the first, high / low over all, close of the last
export function buildTf(m5, sec) {
  const out = []; let cur = null;
  for (const b of m5) { const t = Math.floor(b.time / sec) * sec;
    if (!cur || cur.time !== t) { cur = { time: t, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); }
    else { if (b.high > cur.high) cur.high = b.high; if (b.low < cur.low) cur.low = b.low; cur.close = b.close; } }
  return out;
}
export const framesOf = (m5) => ({ '5m': m5, '15m': buildTf(m5, 900), '1h': buildTf(m5, 3600), '4h': buildTf(m5, 14400) });

// The Trader's event mapping (council/trader.mjs, the mcycle block's `ev`) on the CLOSED candles only
export const evClosed = (closed, sec, N = K.N) => msAnalyze(closed, N).events
  .map((e) => ({ t: closed[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure }));

// The Trader's record for one fresh cycle signal, as its mcycle block builds it
export function recordOf(o, trades, price, now) {
  const d = o.side === 'sell' ? -1 : 1, blk = cycleBlockers(o, trades, price, false);
  const t1 = o.t1 != null && o.room ? o.t1 : +(o.entry + d * 2 * o.r0).toFixed(2);
  return { id: `xau-mcycle-${o.leg}-${o.h4.t}`, market: 'xau', dec: 2, k: 'mcycle', leg: o.leg, h: o.tf, side: o.side, entry: o.entry, stop: o.stop, t1,
    rr: o.room ? o.rr : 2, opened: now, checked: now, status: 'pending', R: null, r0: o.r0, validFor: K.VALID, maxHold: K.HOLD, noBe: true, entryMode: 'limit',
    trigAt: o.t, shadow: blk.length > 0, blockedBy: blk };
}

// The replay: a decision at the start of every M5 candle i (= the moment candle i-1 closed)
export function replay(D, { from = K.FROM, to = Infinity, onStep = null } = {}) {
  const m5 = D['5m'], ptr = {}, cache = {}, trades = [], seen = new Set();
  for (const id of Object.keys(TF)) { ptr[id] = 0; cache[id] = null; }
  const closedN = (id, now) => { const a = D[id]; let p = ptr[id]; while (p + 1 < a.length && a[p + 1].time <= now) p++; ptr[id] = p; return p; };
  let active = [];
  for (let i = 1; i < m5.length; i++) {
    const now = m5[i].time, b = m5[i - 1];
    if (now > to) break;
    if (active.length) {
      for (const tr of active) {
        if (b.time < tr.checked) continue;
        if (!spotSkip(b.time)) manageLive(tr, b);
        if (tr.status === 'pending' && now - tr.opened > tr.validFor) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
      }
      active = active.filter((x) => x.status === 'pending' || x.status === 'open');
    }
    if (now < from) continue;
    const ev = {}, closed = {};
    for (const id of Object.keys(TF)) {
      const p = closedN(id, now);
      if (!cache[id] || cache[id].p !== p) { const w = D[id].slice(Math.max(0, p - K.WIN), p); cache[id] = { p, w, ev: w.length > 2 * K.N + 2 ? evClosed(w, TF[id]) : [] }; }
      ev[id] = cache[id].ev; closed[id] = cache[id].w;
    }
    const C = cycleTrades({ E4: ev['4h'], E1: ev['1h'], E15: ev['15m'], E5: ev['5m'], h1: closed['1h'] }, now);
    if (onStep) onStep(now, C);
    for (const o of C.trades.filter((x) => x.fresh)) {
      const id = `xau-mcycle-${o.leg}-${o.h4.t}`; if (seen.has(id)) continue;
      seen.add(id); const tr = recordOf(o, active, b.close, now); trades.push(tr); active.push(tr);
    }
  }
  return trades;
}

// net R: R - $COST x mult / r0 - mult x financing (buys only); gross = R
export function netOf(tr, mult = 1) {
  if (mult === 0) return tr.R;
  const fin = financing({ market: 'xau', side: tr.side, entry: tr.entry, r0: tr.r0, filled: tr.filled, closed: tr.closed }).finR;
  return +(tr.R - mult * K.COST / tr.r0 - mult * fin).toFixed(4);
}
export const DONE = new Set(['win', 'loss', 'be']);
export const mkey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

export function stats(rows, m0, m1) {
  const n = rows.length, R = rows.map((x) => x.R), sum = R.reduce((a, v) => a + v, 0), avg = n ? sum / n : 0;
  let eq = 0, pk = 0, dd = 0; for (const v of R) { eq += v; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const gw = R.filter((v) => v > 0).reduce((a, v) => a + v, 0), gl = -R.filter((v) => v < 0).reduce((a, v) => a + v, 0);
  const M = new Map(); for (let m = m0; m <= m1; m++) M.set(m, 0); for (const x of rows) { const m = mkey(x.c); if (M.has(m)) M.set(m, M.get(m) + x.R); }
  const ms = [...M.values()], mm = ms.length ? ms.reduce((a, v) => a + v, 0) / ms.length : 0, sd = ms.length > 1 ? Math.sqrt(ms.reduce((a, v) => a + (v - mm) ** 2, 0) / (ms.length - 1)) : 0;
  return { n, win: n ? +(R.filter((v) => v > 0).length / n).toFixed(3) : 0, avg: +avg.toFixed(3), total: +sum.toFixed(2), pf: gl > 0 ? +(gw / gl).toFixed(2) : null,
    maxDD: +dd.toFixed(2), months: ms.length, tMonth: sd > 0 ? +(mm / sd * Math.sqrt(ms.length)).toFixed(2) : 0 };
}
// statistics of closed trades L (exit order) in window [a, b) by exit time, at a cost multiple (0 = gross)
export function winStats(L, [a, b], mult = 1) {
  const rows = L.filter((x) => x.closed >= a && x.closed < b).sort((p, q) => p.closed - q.closed || p.opened - q.opened).map((x) => ({ c: x.closed, R: netOf(x, mult) }));
  return stats(rows, mkey(a), mkey(b - 1));
}

// one-sided p from a t (normal), Holm over a list
const erf = (x) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
export const pOne = (t) => +(1 - 0.5 * (1 + erf(t / Math.SQRT2))).toFixed(5);
export function holm(ps) {
  const ord = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let run = 0;
  ord.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = +run.toFixed(5); });
  return out;
}

// seeded generator
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// placebo: each real trade's side, r0 and rr at a random non-skipped M5 moment of the same calendar year; market at the next open
export function placeboTrades(m5, real, rnd) {
  const byYear = placeboTrades.idx || (placeboTrades.idx = new WeakMap());
  let Y = byYear.get(m5);
  if (!Y) { Y = {}; for (let i = 0; i < m5.length - 1; i++) { if (spotSkip(m5[i].time) || spotSkip(m5[i + 1].time)) continue; const y = new Date(m5[i].time * 1000).getUTCFullYear(); (Y[y] = Y[y] || []).push(i); } byYear.set(m5, Y); }
  const out = [];
  for (const x of real) {
    const y = new Date(x.opened * 1000).getUTCFullYear(), pool = Y[y]; if (!pool) continue;
    const i = pool[Math.floor(rnd() * pool.length)] + 1, d = x.side === 'sell' ? -1 : 1, e = +m5[i].open.toFixed(2);
    const tr = { market: 'xau', k: 'placebo', leg: x.leg, side: x.side, entry: e, stop: +(e - d * x.r0).toFixed(2), t1: +(e + d * x.rr * x.r0).toFixed(2), rr: x.rr, r0: x.r0,
      opened: m5[i].time, filled: m5[i].time, checked: m5[i].time, status: 'open', R: null, maxHold: K.HOLD, noBe: true };
    for (let j = i; j < m5.length; j++) { if (spotSkip(m5[j].time)) continue; if (manageLive(tr, m5[j]) === 'exit') break; }
    if (DONE.has(tr.status)) out.push(tr);
  }
  return out;
}

export const TESTS = { T1: (x) => x.leg === 'pull', T2: (x) => x.leg === 'main', T3: () => true };
export const TEST_NAME = { T1: 'leg pull (trade the pullback, target the H4 50 %)', T2: 'leg main (back with the H4, target the H4 extreme)', T3: 'both legs (the system as it trades)' };

export function analyse(trades, m5) {
  const end = K.END, live = trades.filter((x) => !x.shadow && DONE.has(x.status) && x.closed < end);
  const out = { tests: {}, years: {} };
  const ps = [];
  for (const [k, f] of Object.entries(TESTS)) {
    const L = live.filter(f), S = {};
    for (const [w, r] of Object.entries(K.W)) S[w] = { net: winStats(L, r), gross: winStats(L, r, 0), x2: winStats(L, r, 2) };
    out.tests[k] = { name: TEST_NAME[k], ...S };
    ps.push(pOne(S.dec.net.tMonth));
  }
  const ph = holm(ps);
  Object.keys(TESTS).forEach((k, i) => { out.tests[k].p = ps[i]; out.tests[k].pHolm = ph[i]; });
  // placebo
  for (const [k, f] of Object.entries(TESTS)) {
    const real = live.filter(f).filter((x) => x.closed >= K.W.dec[0] && x.closed < K.W.dec[1]);
    const ts = [];
    for (let s = 1; s <= K.SEEDS; s++) { const P = placeboTrades(m5, real, mulberry32(s)); ts.push(winStats(P, K.W.dec).tMonth); }
    const t0 = out.tests[k].dec.net.tMonth, srt = [...ts].sort((a, b) => a - b);
    out.tests[k].placebo = { t: ts, min: srt[0], median: +((srt[19] + srt[20]) / 2).toFixed(2), max: srt.at(-1), beaten: ts.filter((v) => t0 > v).length };
    const T = out.tests[k];
    T.checks = { t2Holm: T.dec.net.tMonth >= 2 && T.pHolm < 0.05, sameSign2020: T.rec.net.avg > 0 && T.dec.net.avg > 0, x2: T.dec.x2.avg > 0, placebo: T.placebo.beaten >= K.NEED };
    T.pass = Object.values(T.checks).every(Boolean);
  }
  for (const x of live) { const y = new Date(x.closed * 1000).getUTCFullYear(); (out.years[y] = out.years[y] || []).push(x); }
  for (const y of Object.keys(out.years)) { const L = out.years[y]; out.years[y] = { n: L.length, pull: L.filter((x) => x.leg === 'pull').length, main: L.filter((x) => x.leg === 'main').length, avg: +(L.reduce((a, x) => a + netOf(x), 0) / L.length).toFixed(3), total: +L.reduce((a, x) => a + netOf(x), 0).toFixed(2) }; }
  const inDec = (x) => x.opened >= K.W.dec[0] && x.opened < K.W.dec[1];
  const funnel = (L) => { const o = { signals: L.length, live: 0, liveStatus: {}, shadow: {} };
    for (const x of L) { if (x.shadow) { const b = x.blockedBy.join('+'); o.shadow[b] = (o.shadow[b] || 0) + 1; } else { o.live++; o.liveStatus[x.status] = (o.liveStatus[x.status] || 0) + 1; } } return o; };
  out.funnel = { all: funnel(trades.filter((x) => x.opened < end)), decisive: funnel(trades.filter(inDec)) };
  out.pass = out.tests.T3.pass;
  return out;
}

export function positionsOf(trades) {
  return trades.filter((x) => !x.shadow && DONE.has(x.status) && x.closed < K.END).sort((a, b) => a.closed - b.closed || a.opened - b.opened)
    .map((x) => [x.opened, x.filled, x.closed, +netOf(x).toFixed(3), x.side === 'sell' ? -1 : 1, x.leg]);
}

const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
const sg2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
export function verdictText(out) {
  const T = out.tests.T3, d = T.dec.net;
  const why = out.pass ? 'the system clears every pre-registered check' : `${sg(d.avg)}R a trade net (n ${d.n}, t ${sg2(d.tMonth)}), 0 of 3 tests pass`.replace('0 of 3', `${Object.values(out.tests).filter((x) => x.pass).length} of 3`);
  return `${out.pass ? 'PASS' : 'FAIL'}: live Mosha cycle on untouched gold 2007-19, ${why}; placebo beaten ${T.placebo.beaten} of 40.`;
}

export function renderMd(out) {
  const row = (name, S) => `| ${name} | ${S.n} | ${(S.win * 100).toFixed(1)} % | ${sg(S.avg)} | ${sg2(S.total)} | ${sg2(S.tMonth)} | ${S.pf ?? '—'} | ${S.maxDD} |`;
  const head = '| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |\n|---|---|---|---|---|---|---|---|';
  const tab = (T) => [row('2007-19 net (decisive)', T.dec.net), row('2007-19 before costs', T.dec.gross), row('2007-19 at 2x costs', T.dec.x2),
    row('2020-23 net', T.w2.net), row('2020-23 before costs', T.w2.gross), row('2024-Oct 2026 net', T.w3.net), row('2024-Oct 2026 before costs', T.w3.gross), row('2020-Oct 2026 net', T.rec.net)].join('\n');
  const yn = (v) => (v ? 'yes' : 'no');
  const sum = Object.entries(out.tests).map(([k, T]) => `| ${k} ${T.name} | ${T.dec.net.n} | ${sg(T.dec.gross.avg)} / ${sg(T.dec.net.avg)} | ${sg2(T.dec.net.tMonth)} | ${T.pHolm} | ${sg(T.rec.net.avg)} | ${sg(T.dec.x2.avg)} | ${T.placebo.beaten} of 40 (median t ${sg2(T.placebo.median)}) | ${T.pass ? 'PASS' : 'FAIL'} |`).join('\n');
  const yrs = Object.entries(out.years).map(([y, v]) => `| ${y} | ${v.n} | ${v.pull} | ${v.main} | ${sg(v.avg)} | ${sg2(v.total)} |`).join('\n');
  const fun = (F) => `${F.signals} fresh signals; ${F.live} with no blocker (${Object.entries(F.liveStatus).map(([k, v]) => `${k} ${v}`).join(', ')}); shadows excluded: ${Object.entries(F.shadow).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`;
  const C = out.tests.T3;
  return `# Mosha cycle (\`mcycle\`) on untouched gold history, 2007-2019: result (14 Nov 2026)

**Verdict: ${verdictText(out)}**

Paper research only. No live rule, size, filter, stop, config, baseline or council file was changed; nothing was written to
the Mosha desk. The rule, data, windows, costs, tests, placebo and bar were fixed in \`PREREGISTRATION.md\` (committed alone,
before any run). A backtest is not a forward record${out.pass ? '' : ', and this one is not an edge'}.

## What was run

The live code, imported and unchanged: \`council/mosha-cycle.mjs\` \`cycleTrades\` / \`cycleBlockers\` on BO events from
\`council/engine.mjs\` \`msAnalyze(bars, 6)\` over the last ${K.WIN} closed candles of H4, H1, M15 and M5 (H4 / H1 / M15 built
from M5 in UTC buckets), decided at every M5 close; managed with \`council/fills.mjs\` \`manageLive\` on M5 (stop first when one
candle holds both; \`spotSkip\` candles skipped; fill-and-target candles missed); valid 24 h, out 72 h after the fill;
$${K.COST.toFixed(2)} a round trip plus overnight financing on buys (\`financing\`, today's \`FIN\` for every year). Signals with a
blocker (room / cap / price) are shadows and are excluded. Candles: OANDA mid XAU/USD M5 ${out.candles.from} to ${out.candles.to}
(${out.candles.n} candles). Windows by exit time; t on calendar-month sums, every month counted.

## The three tests (decisive window 2007-19, Holm over 3)

| Test | n | R a trade gross / net | t (months) | Holm p | 2020-26 net | 2x costs | Placebo beaten | Result |
|---|---|---|---|---|---|---|---|---|
${sum}

## T3: both legs (the system as it trades)

${head}
${tab(out.tests.T3)}

## T1: leg \`pull\`

${head}
${tab(out.tests.T1)}

## T2: leg \`main\`

${head}
${tab(out.tests.T2)}

## Each year (both legs, after costs)

| Year | Trades | pull | main | R a trade | Total R |
|---|---|---|---|---|---|
${yrs}

## Signals

- 2007-19: ${fun(out.funnel.decisive)}.
- 2007-Oct 2026: ${fun(out.funnel.all)}.

## Placebo

Each test's real trades of 2007-19, same side, opening risk and reward:risk, moved to a random M5 moment of the same year and
entered at market (40 seeds). Real t against the 40 placebo t's: T1 beats ${out.tests.T1.placebo.beaten} (placebo t ${sg2(out.tests.T1.placebo.min)} to ${sg2(out.tests.T1.placebo.max)}),
T2 beats ${out.tests.T2.placebo.beaten} (${sg2(out.tests.T2.placebo.min)} to ${sg2(out.tests.T2.placebo.max)}), T3 beats ${C.placebo.beaten} (${sg2(C.placebo.min)} to ${sg2(C.placebo.max)}). Pass needs 38.

## Reading

${out.pass ? 'Every pre-registered check is met on the untouched window.' : `On the window the rule never saw, the cycle made ${sg(C.dec.net.avg)}R a trade after costs (${sg(C.dec.gross.avg)}R before any cost) over ${C.dec.net.n} trades, t ${sg2(C.dec.net.tMonth)}; on 2020-Oct 2026 ${sg(C.rec.net.avg)}R (n ${C.rec.net.n}). The pullback leg ${sg(out.tests.T1.dec.net.avg)}R (n ${out.tests.T1.dec.net.n}), the main leg ${sg(out.tests.T2.dec.net.avg)}R (n ${out.tests.T2.dec.net.n}).`}
This is the honest baseline for the cycle's forward record: \`positions.json\` holds one row per live filled trade 2007-Oct 2026,
\`[signal, fill, exit, netR, side, leg]\` (unix seconds; net R after $0.60 and financing; +1 buy / -1 sell). It agrees in sign
with \`mcycle-base\` (2020-26, $0.30, OANDA H4 / H1 / M15 fetched directly: −0.574R, n 115), which this study's 2020-26 rows
re-measure at the brief's $0.60 with candles built from M5. Never quote the cycle as an edge.

## Limits

- M5 fills, not the Trader's 1-minute candles: a candle holding both stop and target is a loss here.
- H4 / H1 / M15 built from M5 in UTC buckets; OANDA's own candles of those timeframes can differ by a print.
- Financing at today's rate for every year (the broker's past rates are not known).
- To repeat: \`node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>\`, then \`node research/edge/mcycle-oos/run.mjs run <dir>/xau-5m.json.gz\`.
`;
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

if (MODE === 'render') {   // re-render RESULT.md from result.json (text only; no number recomputed)
  const out = JSON.parse(fs.readFileSync(path.join(HERE, 'result.json'), 'utf8'));
  out.verdict = verdictText(out); fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n'); fs.writeFileSync(path.join(HERE, 'RESULT.md'), renderMd(out));
}
if (MODE === 'run') {
  const m5 = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[3])))), D = framesOf(m5), t0 = Date.now();
  const trades = replay(D, { to: K.END + 4 * 86400 });
  console.error(`replay ${((Date.now() - t0) / 1000).toFixed(0)} s, ${trades.length} signals`);
  const A = analyse(trades, m5);
  const out = { topic: 'mcycle-oos', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Mosha cycle (mcycle), the live paper system: council/mosha-cycle.mjs on msAnalyze BO events of H4 / H1 / M15 / M5 (built from OANDA mid M5), untouched 2007-19',
    window: { decisive: '2007-01-01 to 2019-12-31', reported: ['2020-01-01 to 2023-12-31', '2024-01-01 to 2026-10-31'] },
    params: { ...K }, candles: { n: m5.length, from: iso(m5[0].time), to: iso(m5.at(-1).time) }, ...A };
  out.verdict = verdictText(out);
  out.candidates = Object.entries(out.tests).map(([k, T]) => ({ rule: `${k} ${T.name}`, verdict: T.pass ? 'PASS' : 'FAIL', is: T.dec.net, oos: T.rec.net }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'positions.json'), '[\n' + positionsOf(trades).map((r) => JSON.stringify(r)).join(',\n') + '\n]\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), renderMd(out));
  console.error(out.verdict);
}
