// Collects the measurements into result.json. node summary.mjs <scratch dir> <out result.json>
// <scratch dir> holds: cnbc.json.gz, probe.json.gz, rolls.json (rolls.mjs), d1frame.json, check-adjust.json, shifts.json, why.json,
// touch.json, replay-stub-base.json, replay-stub-new.json, bench.json (benchdiff.mjs)
import fs from 'node:fs';
import zlib from 'node:zlib';
const [S, OUT] = process.argv.slice(2);
const J = (f) => JSON.parse(fs.readFileSync(`${S}/${f}`, 'utf8'));
const P = JSON.parse(zlib.gunzipSync(fs.readFileSync(`${S}/probe.json.gz`))).series;
const rolls = J('rolls.json'), adj = J('check-adjust.json'), shifts = J('shifts.json'), why = J('why.json'), touch = J('touch.json');
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const closeOn = (k, day) => { const b = (P[k] || []).find((x) => iso(x[0] + 12 * 3600) === day); return b ? b[4] : null; };
// index rolls: rollAdjust on CNBC's cash index; % of the front close that day
const idx = {};
for (const [k, fut] of [['nq', '@ND.1'], ['es', '@SP.1'], ['ym', '@DJ.1'], ['rty', '@TFS.1']])
  idx[k] = adj[k].rolls.filter((r) => r.day >= '2025-01-01').map((r) => ({ ...r, spread: +r.spread.toFixed(2), pct: +(100 * r.spread / closeOn(`${fut}|1D`, r.day)).toFixed(2) }));
// gold: switches where the Dec 2026 contract minus the continuous front changes level (the step = the spread)
const Z = new Map((P['GCZ26|1D'] || []).map((b) => [b[0], b[4]])), G = (P['@GC.1|1D'] || []).filter((b) => Z.has(b[0])).map((b) => ({ day: iso(b[0] + 12 * 3600), d: Z.get(b[0]) - b[4], c: b[4] }));
const gold = G.slice(1).map((x, i) => ({ day: x.day, spread: +(G[i].d - x.d).toFixed(1), pct: +(100 * (G[i].d - x.d) / x.c).toFixed(2) })).filter((x) => x.day >= '2025-01-01' && x.pct > 0.4);   // a switch is upward (contango); one thin-print day of the deferred contract (11 Aug 2025, -0.46 %) is not
const gap = Object.fromEntries(Object.entries(rolls.markets).map(([k, m]) => [k, { p95: m.gapP95, p99: m.gapP99 }]));
const out = {
  topic: 'futures-roll',
  question: 'Do contract rolls in the ICT desk\'s CNBC continuous futures fake gaps / FVGs / sweeps or distort stops (replay and live)?',
  preregistration: 'research/edge/futures-roll/preregistration.md (committed before any candle around a roll was looked at)',
  data: { cnbc: `council-data research/futures-roll/cnbc.json.gz (dumped ${rolls.dump}) and probe.json.gz (cash indices, spot gold, single contracts)`, cash: 'OANDA mid H1 NAS100/SPX500/US30/XAU via meridianx.dev /md/bars', replay: 'replays.sh on the dump with the clock of council-data ict/replay.json at 475f6bc3 (7 Nov 2026 21:16), which pre-#561 main reproduced exactly (251 A-trades, +61.87R, 0 differences); base = origin/main a8b703a4: 249 A-trades, +63.56R' },
  findings: {
    intraday: 'CNBC 1H/5M of @X.1 are the CURRENT contract\'s own candles (Dec 2026 for the indices and gold on 7 Nov): no roll step anywhere in them. Evidence: basis to OANDA cash decays smoothly Mar-Nov 2026 (NQ 630 -> 96) with no quarterly jump; adjusted = unadjusted path; NQZ26 1D - @ND.1 1D = 0 from 14 Sep. Before the contract was front its hours are thin (NQ < 18 H1 candles a day until early June 2026, YM until July).',
    daily: 'CNBC 1D of @X.1 is an UNADJUSTED splice of front months: it steps by the calendar spread on the switch day (indices: Monday of the expiry week, June 2026 on the Monday after; gold: the last business day before the delivery month, Oct skipped).',
    h1BasisSteps: 'The pre-registered H1 basis scan (rolls.mjs) flagged steps that are not CNBC rolls: thin deferred-contract hours (NQ Apr-May, ES Jan-Apr 2026) and OANDA\'s own index-CFD reference change on 15 Sep 2026 15-17 UTC (Dec contract minus CNBC cash is flat that day).',
    live: 'Each live run re-reads 24 days of the current contract, so on the first run after a switch an open trade\'s stored levels sit one spread away from the candles (sells stopped by the spread, buys given it).',
  },
  dailyRolls2025_26: { ...idx, gc: gold },
  h1GapsNonRoll: gap,
  verdict: 'REAL, but not where it was suspected. CNBC intraday candles never jump at a roll (one contract per request), so no H1 gap / FVG / sweep and no replay exit was faked by a roll step. Three data problems are real: (1) the DAILY candles step by the calendar spread at every switch (5-7x the 95th-percentile H1 gap) and flipped the 50-day bias of 8 replay A-signals; (2) live, a trade open across a switch is managed against candles one spread away (1 replay A-trade, gold 29 Jul 2026, +1.07R of fake gain); (3) the replay used the current contract own history from before it was front: thin deferred prints (H1 ranges 0-0.8x the market, up to 100 % one-print candles) behind 90 of the 249 replay A-trades, incl. the 4 Jun 2026 NQ/ES signals.',
  fix: 'Data layer only. ict/tracker.mjs rollAdjust (daily candles back-adjusted with spreads measured on CNBC cash-index closes; indices) and contractShift/shiftTrade (open trades moved by the measured intraday offset on a contract switch; live tracker); ict/replay.mjs liquidFrom (CNBC intraday only from the contract front-month stretch, earlier hours back-filled as before, OANDA filling where the files end). Signals, A-rule, sizing and exits unchanged.',
  replayAChanges: why,
  touched: touch,
  shiftsUsedByBench: shifts,
};
try { out.bench = J('bench.json'); } catch (e) {}
// stage 2 (not pre-registered; added after the dump showed CNBC intraday is the current contract's own history)
try { out.deferredContract = { rangeRatioVsCashByMonth: J('ranges.json'), weeklyLiquidity: J('liquidity.json'), replayEffectPerMarket: J('deferred.json') }; } catch (e) {}
const tot = (f) => { const r = J(f); const C = r.trades.filter((x) => x.aset && x.closed); return { n: C.length, R: +C.reduce((s, x) => s + x.R, 0).toFixed(2) }; };
try { out.replayATotals = { base: tot('replay-stub-base.json'), dailyRollFix: tot('replay-stub-new.json'), bothFixes: tot('replay-stub-full.json') }; } catch (e) {}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ idx, gold, gap }, null, 1));
