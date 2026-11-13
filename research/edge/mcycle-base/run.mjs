// Mosha cycle (`mcycle`), the live rule's own backtest (13 Nov 2026). Pre-registered in PREREGISTRATION.md (committed alone first).
// The rule is the live code, imported and run unchanged: council/mosha-cycle.mjs (cycleTrades, cycleBlockers) on BO events from
// council/engine.mjs msAnalyze(bars, 6), managed by council/fills.mjs manageLive with spotSkip, costed with financing / FIN.
// Nothing here is read by the council; nothing live changes.
//
//   node --use-env-proxy run.mjs fetch <dir>   -> <dir>/xau-{5m,15m,1h,4h}.json.gz (OANDA mid via /md/bars; kept out of git)
//   node run.mjs run <dir>                     -> result.json, positions.json, RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { msAnalyze } from '../../../council/engine.mjs';
import { cycleTrades, cycleBlockers } from '../../../council/mosha-cycle.mjs';
import { manageLive, spotSkip, financing } from '../../../council/fills.mjs';

export const K = {
  N: 6,                       // msAnalyze swing width, as the Trader (src[id].A = msAnalyze(bars, 6))
  WIN: 719,                   // closed candles a timeframe (the Trader reads 720, the last one forming)
  VALID: 24 * 3600, HOLD: 72 * 3600, COST: 0.3,
  FROM: Date.UTC(2020, 0, 1) / 1000, SPLIT: Date.UTC(2024, 0, 1) / 1000,
  FETCH_FROM: { '4h': Date.UTC(2019, 5, 1) / 1000, '1h': Date.UTC(2019, 9, 1) / 1000, '15m': Date.UTC(2019, 10, 15) / 1000, '5m': Date.UTC(2019, 11, 1) / 1000 },
};
export const TF = { '4h': 14400, '1h': 3600, '15m': 900, '5m': 300 };

// The Trader's own event mapping (council/trader.mjs, the mcycle block's `ev`), on a feed whose last candle is still forming.
export const evTrader = (bb, sec, N = K.N) => msAnalyze(bb, N).events.filter((e) => e.breakIdx < bb.length - 1)
  .map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure }));
// The harness: the same mapping on the CLOSED candles only (the forming candle cannot shape a kept event; the test proves it).
export const evClosed = (closed, sec, N = K.N) => msAnalyze(closed, N).events
  .map((e) => ({ t: closed[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure }));

// The Trader's record for one fresh cycle signal (the fields the management and the judging read), as its mcycle block builds it.
export function recordOf(o, trades, price, now) {
  const d = o.side === 'sell' ? -1 : 1, blk = cycleBlockers(o, trades, price, false);
  const t1 = o.t1 != null && o.room ? o.t1 : +(o.entry + d * 2 * o.r0).toFixed(2);
  return { id: `xau-mcycle-${o.leg}-${o.h4.t}`, market: 'xau', dec: 2, k: 'mcycle', leg: o.leg, h: o.tf, side: o.side, entry: o.entry, stop: o.stop, t1,
    rr: o.room ? o.rr : 2, opened: now, checked: now, status: 'pending', R: null, r0: o.r0, validFor: K.VALID, maxHold: K.HOLD, noBe: true, entryMode: 'limit',
    trigAt: o.t, shadow: blk.length > 0, blockedBy: blk };
}

// The replay. D = { '5m': [...], '15m': [...], '1h': [...], '4h': [...] } candles { time, open, high, low, close }, ascending.
// Clock: a decision at the start of every M5 candle i (= the moment candle i-1 closed); a candle of any timeframe counts as closed
// once the feed has a later candle that has started (the Trader's rule: the last candle of a read is the forming one).
export function replay(D, { from = K.FROM, to = Infinity, onStep = null } = {}) {
  const m5 = D['5m'], ptr = {}, cache = {}, trades = [], seen = new Set();
  for (const id of Object.keys(TF)) { ptr[id] = 0; cache[id] = null; }
  const closedN = (id, now) => { const a = D[id]; let p = ptr[id]; while (p + 1 < a.length && a[p + 1].time <= now) p++; ptr[id] = p; return p; };   // bars [0, p) closed
  let active = [];
  for (let i = 1; i < m5.length; i++) {
    const now = m5[i].time, b = m5[i - 1];
    if (now > to) break;
    // 1. manage the candle that just closed (Trader: manage, then expire on the run clock)
    if (active.length) {
      for (const tr of active) {
        if (b.time < tr.checked) continue;
        if (!spotSkip(b.time)) manageLive(tr, b);
        if (tr.status === 'pending' && now - tr.opened > tr.validFor) { tr.status = 'expired'; tr.closed = now; tr.R = 0; }
      }
      active = active.filter((x) => x.status === 'pending' || x.status === 'open');
    }
    if (now < from) continue;
    // 2. the BO events of each timeframe on its last WIN closed candles; recomputed only when a candle of that timeframe closed
    const ev = {}, closed = {};
    for (const id of Object.keys(TF)) {
      const p = closedN(id, now);
      if (!cache[id] || cache[id].p !== p) { const w = D[id].slice(Math.max(0, p - K.WIN), p); cache[id] = { p, w, ev: w.length > 2 * K.N + 2 ? evClosed(w, TF[id]) : [] }; }
      ev[id] = cache[id].ev; closed[id] = cache[id].w;
    }
    // 3. the cycle's signals, as the Trader's block takes them
    const C = cycleTrades({ E4: ev['4h'], E1: ev['1h'], E15: ev['15m'], E5: ev['5m'], h1: closed['1h'] }, now);
    if (onStep) onStep(now, C);
    for (const o of C.trades.filter((x) => x.fresh)) {
      const id = `xau-mcycle-${o.leg}-${o.h4.t}`; if (seen.has(id)) continue;
      seen.add(id); const tr = recordOf(o, active, b.close, now); trades.push(tr); active.push(tr);
    }
  }
  return trades;
}

// net R of one closed record: R - $COST x mult / r0 - financing (buys only)
export function netOf(tr, mult = 1) {
  const fin = financing({ market: 'xau', side: tr.side, entry: tr.entry, r0: tr.r0, filled: tr.filled, closed: tr.closed }).finR;
  return +(tr.R - mult * K.COST / tr.r0 - fin).toFixed(4);
}
export const DONE = new Set(['win', 'loss', 'be']);
const mkey = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };

// statistics of a list of { c (exit time), R } in exit order; months: every calendar month [m0, m1] counts (empty = 0)
export function stats(rows, m0, m1) {
  const n = rows.length, R = rows.map((x) => x.R), sum = R.reduce((a, v) => a + v, 0), avg = n ? sum / n : 0;
  let eq = 0, pk = 0, dd = 0; for (const v of R) { eq += v; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  const gw = R.filter((v) => v > 0).reduce((a, v) => a + v, 0), gl = -R.filter((v) => v < 0).reduce((a, v) => a + v, 0);
  const M = new Map(); for (let m = m0; m <= m1; m++) M.set(m, 0); for (const x of rows) { const m = mkey(x.c); if (M.has(m)) M.set(m, M.get(m) + x.R); }
  const ms = [...M.values()], mm = ms.length ? ms.reduce((a, v) => a + v, 0) / ms.length : 0, sd = ms.length > 1 ? Math.sqrt(ms.reduce((a, v) => a + (v - mm) ** 2, 0) / (ms.length - 1)) : 0;
  return { n, win: n ? +(R.filter((v) => v > 0).length / n).toFixed(3) : 0, avg: +avg.toFixed(3), total: +sum.toFixed(2), pf: gl > 0 ? +(gw / gl).toFixed(2) : null,
    maxDD: +dd.toFixed(2), months: ms.length, tMonth: sd > 0 ? +(mm / sd * Math.sqrt(ms.length)).toFixed(2) : 0 };
}

export function summarize(trades, end) {
  const done = trades.filter((x) => DONE.has(x.status)).sort((a, b) => a.closed - b.closed || a.opened - b.opened);
  const live = done.filter((x) => !x.shadow);
  const lastFull = mkey(end) - 1;   // the last complete calendar month before the data's end
  const m0 = mkey(K.FROM), mS = mkey(K.SPLIT);
  const rowsOf = (L, mult = 1, gross = false) => L.map((x) => ({ c: x.closed, R: gross ? x.R : netOf(x, mult) }));
  const block = (L) => ({ all: stats(rowsOf(L), m0, lastFull), is: stats(rowsOf(L.filter((x) => x.closed < K.SPLIT)), m0, mS - 1), oos: stats(rowsOf(L.filter((x) => x.closed >= K.SPLIT)), mS, lastFull),
    gross: stats(rowsOf(L, 1, true), m0, lastFull), x2: stats(rowsOf(L, 2), m0, lastFull) });
  const legs = { combined: block(live), pull: block(live.filter((x) => x.leg === 'pull')), main: block(live.filter((x) => x.leg === 'main')) };
  const years = {}; for (const x of live) { const y = new Date(x.closed * 1000).getUTCFullYear(); (years[y] = years[y] || []).push(x); }
  for (const y of Object.keys(years)) { const L = years[y]; years[y] = { n: L.length, avg: +(L.reduce((a, x) => a + netOf(x), 0) / L.length).toFixed(3), total: +L.reduce((a, x) => a + netOf(x), 0).toFixed(2) }; }
  const count = (L) => { const o = {}; for (const x of L) o[x.status] = (o[x.status] || 0) + 1; return o; };
  const liveAll = trades.filter((x) => !x.shadow), shadows = trades.filter((x) => x.shadow);
  const byBlk = {}; for (const x of shadows) { const k = x.blockedBy.join('+'); byBlk[k] = byBlk[k] || []; byBlk[k].push(x); }
  const shadow = Object.fromEntries(Object.entries(byBlk).map(([k, L]) => { const D2 = L.filter((x) => DONE.has(x.status)); return [k, { signals: L.length, filled: D2.length, avg: D2.length ? +(D2.reduce((a, x) => a + netOf(x), 0) / D2.length).toFixed(3) : null }]; }));
  const C = legs.combined, pass = C.is.avg > 0 && C.oos.avg > 0 && C.all.tMonth >= 2;
  return { legs, years, funnel: { signals: trades.length, live: liveAll.length, liveStatus: count(liveAll), shadow: shadows.length }, shadow,
    lastFullMonth: lastFull, pass };
}

export function positionsOf(trades) {
  return trades.filter((x) => !x.shadow && DONE.has(x.status)).sort((a, b) => a.closed - b.closed || a.opened - b.opened)
    .map((x) => [x.opened, x.filled, x.closed, +netOf(x).toFixed(3), x.side === 'sell' ? -1 : 1, x.leg]);
}

const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3).replace(/0$/, '');
const sg2 = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
export function verdictText(out) {
  const C = out.legs.combined;
  return `${out.pass ? 'PASS' : 'FAIL'}: the live Mosha cycle rule, run as the Trader runs it, made ${sg(C.all.avg)}R a trade after costs over ${C.all.n} trades on spot gold from 2020 (t ${sg2(C.all.tMonth)} on ${C.all.months} calendar-month sums); in sample ${sg(C.is.avg)}R (n ${C.is.n}), out of sample ${sg(C.oos.avg)}R (n ${C.oos.n}); worst drawdown ${C.all.maxDD}R.`;
}

export function renderMd(out) {
  const L = out.legs, row = (name, S) => `| ${name} | ${S.n} | ${(S.win * 100).toFixed(1)} % | ${sg(S.avg)} | ${sg2(S.total)} | ${sg2(S.tMonth)} | ${S.pf ?? '—'} | ${S.maxDD} |`;
  const tab = (k) => [row('2020 to end', L[k].all), row('In sample 2020-23', L[k].is), row('Out of sample 2024 on', L[k].oos), row('Before costs', L[k].gross), row('Twice the cost', L[k].x2)].join('\n');
  const head = '| | Trades | Win rate | R a trade | Total R | t (months) | Profit factor | Worst drawdown R |\n|---|---|---|---|---|---|---|---|';
  const yrs = Object.entries(out.years).map(([y, v]) => `| ${y} | ${v.n} | ${sg(v.avg)} | ${sg2(v.total)} |`).join('\n');
  const sh = Object.entries(out.shadow).map(([k, v]) => `| ${k} | ${v.signals} | ${v.filled} | ${v.avg == null ? '—' : sg(v.avg)} |`).join('\n');
  return `# Mosha cycle (\`mcycle\`), the live rule's own backtest: result (13 Nov 2026)

**Verdict: ${verdictText(out)}**

Paper research only. No live rule, size, filter, stop, config, baseline or council file was changed. The rule, data, costs
and pass bar were fixed in \`PREREGISTRATION.md\` (committed alone, before any candle was read). Pass bar: the combined live
stream net of costs above 0 in both halves AND t >= 2 on calendar-month sums over the whole window.${out.pass ? '' : ' It is not met.'}
A backtest is not a forward record, and this one is not an edge${out.pass ? ' until a forward record agrees' : ''}.

## What was run

The live code, imported and unchanged: \`council/mosha-cycle.mjs\` \`cycleTrades\` / \`cycleBlockers\` on BO events from
\`council/engine.mjs\` \`msAnalyze(bars, 6)\` over the last ${K.WIN} closed OANDA candles of H4, H1, M15 and M5 (the Trader's
720-candle reads less the forming candle), decided at every M5 close; managed with \`council/fills.mjs\` \`manageLive\` on M5
(stop first when one candle holds both; spot-shut and rollover candles skipped; fill-and-target candles missed); valid 24 h,
out 72 h after the fill; $${K.COST.toFixed(2)} a round trip plus overnight financing on buys (\`financing\`, today's \`FIN\` for
every year). Candles: OANDA mid XAU/USD ${out.candles.m5.from} to ${out.candles.m5.to} (M5 ${out.candles.m5.n}, M15
${out.candles['15m'].n}, H1 ${out.candles['1h'].n}, H4 ${out.candles['4h'].n}). Halves by exit time; months ${out.window.months}.

## Combined live stream (both legs)

${head}
${tab('combined')}

## Leg \`pull\` (trade the pullback, target the H4 50 %)

${head}
${tab('pull')}

## Leg \`main\` (the ChoCh back with the H4, target the H4 extreme)

${head}
${tab('main')}

## Each year (combined, after costs)

| Year | Trades | R a trade | Total R |
|---|---|---|---|
${yrs}

## Signals

${out.funnel.signals} fresh cycle signals were recorded; ${out.funnel.live} with no blocker (the live stream: ${Object.entries(out.funnel.liveStatus).map(([k, v]) => `${k} ${v}`).join(', ')}),
${out.funnel.shadow} shadows. Shadows by blocker, descriptive only (after costs, filled ones):

| Blocker | Signals | Filled | R a trade |
|---|---|---|---|
${sh}

## Reading

${out.pass ? 'The bar is met on this backtest.' : `Both legs lose in both halves: the pullback leg ${sg(L.pull.all.avg)}R a trade (n ${L.pull.all.n}), the main leg ${sg(L.main.all.avg)}R (n ${L.main.all.n}). Before any cost the combined stream is ${sg(L.combined.gross.avg)}R a trade, so the loss is the rule, not the cost.`}
Only the signals the live code takes count here; the ${out.funnel.shadow} signals it records as shadows for want of room
(target under 1R, traded at 2R) are shown above for completeness and are not part of the test. This agrees in sign with
the earlier mechanical readings of the owner's cycle (\`mosha-retrace\`, \`mosha-cycle\`), which were different rules.

## How it could be wired (not done here)

\`positions.json\` holds one row per filled live trade, \`[t, o, c, R, side, leg]\` (signal, fill, exit in unix seconds; net R
after $0.30 and financing; +1 buy / -1 sell). A later, owner-approved change could add an \`mcycle\` entry to
\`council/decay.mjs\` \`SYSTEMS\` built from these rows by \`research/edge/decay-monitor/run.mjs\` (its baseline, drawdown
band) and a block in \`research/edge/expectations/build.mjs\` for "What to expect", and then drop \`MS_NO_BASE\` for it. Note
that the whole window 2020-26 is the window the rule was written on by eye (the owner's cycle of Nov 2026), so these
figures are in sample for the rule as a whole; the IS / OOS split separates time, not the rule's design.

## Limits

- M5 fills, not the Trader's 1-minute candles: a candle holding both stop and target is a loss here.
- The Trader runs about every minute; here a decision at every M5 close. Signals are only taken while fresh (1 h), as live.
- Financing at today's rate for every year (the broker's past rates are not known).
- To repeat: \`node --use-env-proxy research/edge/mcycle-base/run.mjs fetch <dir>\`, then \`node research/edge/mcycle-base/run.mjs run <dir>\`.
`;
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function range(tf, a0, b0) {
  const m = new Map(), sec = TF[tf];
  for (let a = a0; a < b0;) { const b = Math.min(b0, a + 4999 * sec); let j = null, err = null;
    for (let k = 0; k < 6 && !j; k++) { try { const r = await fetch(`${BASE}bars?sym=xau&tf=${tf}&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && x.src === 'OANDA' && Array.isArray(x.bars)) j = x; else err = x && x.error ? String(x.error) : `HTTP ${r.status}`; } catch (e) { err = String(e.message || e); } if (!j) await sleep(2000 * (k + 1)); }
    if (!j) throw new Error(`xau ${tf} ${iso(a)}: ${err}`);
    for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) m.set(+x.time, [+x.time, +x.open, +x.high, +x.low, +x.close]);
    a = b; await sleep(80); }
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
export const loadDir = (dir) => Object.fromEntries(Object.keys(TF).map((id) => [id, toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `xau-${id}.json.gz`)))))]));

if (MODE === 'fetch') {
  const OUT = process.argv[3]; fs.mkdirSync(OUT, { recursive: true });
  const end = Math.floor(Date.now() / 1000 / 86400) * 86400;
  for (const id of Object.keys(TF)) { const rows = await range(id, K.FETCH_FROM[id], end); fs.writeFileSync(path.join(OUT, `xau-${id}.json.gz`), zlib.gzipSync(JSON.stringify(rows))); console.log(`${id}: ${rows.length} candles ${iso(rows[0][0])} → ${iso(rows.at(-1)[0])}`); }
}
if (MODE === 'run') {
  const D = loadDir(process.argv[3]), end = D['5m'].at(-1).time + 300, t0 = Date.now();
  const trades = replay(D);
  console.error(`replay ${((Date.now() - t0) / 1000).toFixed(0)} s, ${trades.length} signals`);
  const S = summarize(trades, end);
  const cand = (id) => ({ n: D[id].length, from: iso(D[id][0].time), to: iso(D[id].at(-1).time) });
  const out = { topic: 'mcycle-base', built: '2026-11-13', at: new Date().toISOString(),
    system: 'Mosha cycle (mcycle), the live paper system: council/mosha-cycle.mjs on msAnalyze BO events of H4 / H1 / M15 / M5, run as the Trader runs it, spot gold OANDA mid',
    window: { from: '2020-01-01', split: '2024-01-01', to: iso(end).slice(0, 10), months: S.legs.combined.all.months },
    params: { ...K, FETCH_FROM: undefined }, candles: { m5: cand('5m'), '15m': cand('15m'), '1h': cand('1h'), '4h': cand('4h') },
    ...S, open: trades.filter((x) => !x.shadow && (x.status === 'open' || x.status === 'pending')).length };
  out.verdict = verdictText(out);
  out.candidates = ['combined', 'pull', 'main'].map((k) => ({ rule: k === 'combined' ? 'both legs (the pre-registered test)' : `leg ${k} (descriptive)`, verdict: k === 'combined' ? (out.pass ? 'PASS' : 'FAIL') : 'descriptive', is: out.legs[k].is, oos: out.legs[k].oos }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'positions.json'), '[\n' + positionsOf(trades).map((r) => JSON.stringify(r)).join(',\n') + '\n]\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), renderMd(out));
  console.error(out.verdict);
}
