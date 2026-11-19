// Edge research · lead-forward-plan, step 2: what a forward paper record could show for each open lead, and how long it
// would take. Accounting / design only: no rule is tested and nothing is an edge (PREREGISTRATION.md, committed alone first).
// The month-block bootstrap is research/proposals/2026-11-12-path-to-live.mjs's, imported unchanged; `simulateT` below is a
// copy of its `simulate` loop that also keeps each path's monthly-sum t (the test checks the copy against the import).
//   node research/edge/lead-forward-plan/run.mjs          -> result.json and RESULT.md beside this file (reads inputs.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32, quant, simulate, HORIZONS, DRAWS, SEED } from '../../proposals/2026-11-12-path-to-live.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const IN = path.join(HERE, 'inputs.json'), OUT = path.join(HERE, 'result.json'), MD = path.join(HERE, 'RESULT.md');
export const GRID = [0.5, 1, 1.5, 2];
export const PROTOCOL_M = 24, CHECKS = [6, 12, 24];
export const WORLDS = ['measured', 'none', 'losing'];
export const VERDICT = 'PLAN COMPUTED (no rule tested)';
// each study's published decisive-window figures, in that study's own t (the gates)
export const GATES = {
  L1: { n: 771, net: 0.148, t: 2.74 }, L1b: { n: 4784, net: 0.099, t: 2.75 },
  L2: { n: 243, net: 0.194, t: 2.14 }, L2b: { n: 481, net: 0.153, t: 3.19 },
  L3: { n: 130, gross: 0.107, net: 0.036, t: 0.77 }, L3b: { n: 130, net: 0.088, t: 1.91 },
  L4: { n: 2721, gross: 0.026, net: -0.006, t: -0.84 }, L4b: { n: 2721, gross: 0.023, net: -0.022, t: -2.86 },
};
export const TOL = { r: 0.002, t: 0.02 };

const rN = (d) => (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(d));
const r1 = rN(1), r2 = rN(2), r3 = rN(3), r4 = rN(4);
const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => sum(a) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1)); };
export const tOf = (a) => (a.length < 3 ? null : mean(a) / (sd(a) / Math.sqrt(a.length)));
const sorted = (arr) => Array.from(arr).sort((a, b) => a - b);
const share = (arr, f) => { let n = 0; for (const x of arr) if (f(x)) n++; return n / arr.length; };

// every calendar month from..to (YYYY-MM)
export function monthList(from, to) {
  const out = []; let [y, m] = from.split('-').map(Number); const [Y, M] = to.split('-').map(Number);
  while (y < Y || (y === Y && m <= M)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
// month blocks: each calendar month of the window holds its trades' net R in order (an empty month is an empty block)
export function blocks(s, nets) {
  const ms = monthList(s.monthFrom, s.monthTo), idx = new Map(ms.map((k, i) => [k, i])), out = ms.map(() => []);
  s.trades.forEach((t, i) => { const j = idx.get(t[0].slice(0, 7)); if (j == null) throw new Error(`${t[0]} outside ${s.monthFrom}..${s.monthTo}`); out[j].push(nets[i]); });
  return out;
}
export const netsAt = (s, m) => s.trades.map((t) => t[1] - m * t[2]);

// the study's own t: 'month' = monthly sums over months that hold a trade; 'trade' = one-sample t of the trades
export function gateStats(s) {
  const net = netsAt(s, 1), gross = s.trades.map((t) => t[1]);
  let t;
  if (s.tDef === 'trade') t = tOf(net);
  else { const mm = new Map(); s.trades.forEach((x, i) => { const k = x[0].slice(0, 7); mm.set(k, (mm.get(k) || 0) + net[i]); }); t = tOf([...mm.values()]); }
  return { n: s.trades.length, gross: mean(gross), net: mean(net), t };
}
export function gateCheck(key, g) {
  const e = GATES[key], ok = [];
  if (e.n != null) ok.push(g.n === e.n);
  if (e.gross != null) ok.push(Math.abs(g.gross - e.gross) <= TOL.r);
  if (e.net != null) ok.push(Math.abs(g.net - e.net) <= TOL.r);
  if (e.t != null) ok.push(Math.abs(g.t - e.t) <= TOL.t);
  return { expected: e, got: { n: g.n, gross: r4(g.gross), net: r4(g.net), t: r3(g.t) }, pass: ok.every(Boolean) };
}

// path-to-live's `simulate`, the same random numbers in the same order, plus each path's monthly-sum t at every horizon
export function simulateT(months, horizons = HORIZONS, draws = DRAWS, seed = SEED) {
  const rnd = mulberry32(seed), H = Math.max(...horizons), cum = {}, dd = {}, t = {};
  for (const h of horizons) { cum[h] = new Float64Array(draws); dd[h] = new Float64Array(draws); t[h] = new Float64Array(draws); }
  const tot = months.map((b) => sum(b));
  for (let k = 0; k < draws; k++) {
    let c = 0, pk = 0, d = 0, s1 = 0, s2 = 0;
    for (let j = 1; j <= H; j++) {
      const i = Math.floor(rnd() * months.length);
      for (const x of months[i]) { c += x; if (c > pk) pk = c; else if (pk - c > d) d = pk - c; }
      s1 += tot[i]; s2 += tot[i] * tot[i];
      if (cum[j]) {
        cum[j][k] = c; dd[j][k] = d;
        const m = s1 / j, v = (s2 - j * m * m) / (j - 1);
        t[j][k] = v > 1e-18 ? m / Math.sqrt(v / j) : (m > 0 ? Infinity : m < 0 ? -Infinity : 0);
      }
    }
  }
  return { cum, dd, t, draws };
}

// months for an expected t of 2: from monthly sums over ALL calendar months, and from the trades
export function monthsToT2(monthTotals, nets, monthsN) {
  const mu = mean(monthTotals), sg = sd(monthTotals), m = mean(nets), s = sd(nets), perMonth = nets.length / monthsN;
  return {
    monthly: mu > 0 ? (2 * sg / mu) ** 2 : null,
    fromTrades: m > 0 ? (2 * s / m) ** 2 / perMonth : null,
    tradesForT2: m > 0 ? (2 * s / m) ** 2 : null,
  };
}

export function planAt(s, m, m1, opts = {}) {
  const draws = opts.draws || DRAWS, seed = opts.seed ?? SEED;
  const net = netsAt(s, m), B = blocks(s, net), monthsN = B.length, tot = B.map(sum);
  const mu = mean(net), shift = { measured: 0, none: mu, losing: mu + Math.abs(m1) };
  const head = { cost: m, n: net.length, months: monthsN, perYear: r2(net.length / monthsN * 12), mean: r4(mu), sd: r3(sd(net)), total: r1(sum(net)),
    monthMean: r3(mean(tot)), monthSd: r3(sd(tot)), tMonthAll: r2(tOf(tot)), tTrades: r2(tOf(net)) };
  const mt = monthsToT2(tot, net, monthsN);
  head.monthsToT2 = { measured: r1(mt.monthly), measuredFromTrades: r1(mt.fromTrades), tradesForT2: mt.tradesForT2 == null ? null : Math.round(mt.tradesForT2), none: null, losing: null };
  const sim = {};
  for (const w of WORLDS) sim[w] = simulateT(B.map((b) => b.map((x) => x - shift[w])), HORIZONS, draws, seed);
  const E = sim.measured;
  const floor = Object.fromEntries(CHECKS.map((h) => [h, quant(sorted(E.cum[h]), 0.05)]));
  const ddStop = quant(sorted(E.dd[PROTOCOL_M]), 0.95);
  const worlds = {};
  for (const w of WORLDS) {
    const X = sim[w];
    let stopped = 0;
    for (let i = 0; i < X.draws; i++) if (X.dd[PROTOCOL_M][i] > ddStop || CHECKS.some((h) => X.cum[h][i] < floor[h])) stopped++;
    worlds[w] = {
      mean: r4(mu - shift[w]), stoppedIn24: r3(stopped / X.draws),
      horizons: Object.fromEntries(HORIZONS.map((h) => { const c = sorted(X.cum[h]), d = sorted(X.dd[h]);
        return [h, { cum: { p5: r1(quant(c, 0.05)), p50: r1(quant(c, 0.5)), p95: r1(quant(c, 0.95)) }, pLoss: r3(share(X.cum[h], (x) => x < 0)),
          pT2: r3(share(X.t[h], (x) => x >= 2)), dd: { p50: r1(quant(d, 0.5)), p95: r1(quant(d, 0.95)) } }]; })),
    };
  }
  return { ...head, measuredPositive: mu > 0, stops: { floor: Object.fromEntries(CHECKS.map((h) => [h, r1(floor[h])])), ddStop: r1(ddStop), protocolMonths: PROTOCOL_M }, worlds };
}

export function planStream(s, opts = {}) {
  const m1 = mean(netsAt(s, 1));
  return Object.fromEntries((opts.grid || GRID).map((m) => [m, planAt(s, m, m1, opts)]));
}

// what each lead's forward record needs on the demo route, against the mirror's symbol list
export function demoGaps(demo) {
  const has = (k) => !!(demo.symbols || {})[k], sym = demo.symbols || {};
  const sun = (k) => (sym[k] ? sym[k].spreadLogWeekdaysUtc.includes(0) : false);
  return {
    source: `council-data ctrader/symbols.json (${demo.at}): the symbols the mirror maps, not the broker's whole catalogue`,
    symbols: Object.keys(sym),
    L1: { needs: 'USD/JPY (and for L1b GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY) quoted and filled at 00:55 and 06:00 UTC on gotobi days',
      onList: { USDJPY: has('USDJPY'), GBPJPY: has('GBPJPY'), AUDJPY: has('AUDJPY'), CADJPY: has('CADJPY'), CHFJPY: has('CHFJPY') },
      gap: 'no yen pair is on the mirror\'s list, so no spread, fill or commission of a yen pair has ever been read on this route (the spread log reads only listed symbols)' },
    L2: { needs: 'EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, EUR/JPY filled in the first five minutes after the Sunday 17:00 New York reopen',
      onList: { EURUSD: has('EURUSD'), GBPUSD: has('GBPUSD'), USDJPY: has('USDJPY'), AUDUSD: has('AUDUSD'), USDCHF: has('USDCHF'), EURJPY: has('EURJPY') },
      sundayReads: Object.fromEntries(['EURUSD', 'GBPUSD', 'AUDUSD', 'USDCHF'].map((k) => [k, sun(k)])),
      schedule: sym.EURUSD ? `${sym.EURUSD.schedule} (${sym.EURUSD.scheduleTimeZone})` : null,
      gap: 'two of the six (USD/JPY, EUR/JPY) are not listed; the spread log holds no Sunday read of any pair, and the broker\'s forex session opens at 17:02 New York, so the reopen candle the rule fades and its slippage have never been seen on this route' },
    L3: { needs: 'a 10-year Treasury CFD (OANDA USB10Y_USD in the study) held over the last three US trading days of each month, with its financing',
      onList: { bond: Object.keys(sym).some((k) => /USB|UST|BOND|TNOTE|10Y/i.test(k)) },
      gap: 'no bond symbol is on the mirror\'s list; the study\'s CFD is OANDA\'s, and the futures cost (#943) is not a demo route at all' },
    L4: { needs: 'NAS100 / US500 bought at the 16:00 New York cash close and sold at the next 09:30 open, with the swap charged',
      onList: { NAS100: has('NAS100'), US500: has('US500') },
      schedule: sym.NAS100 ? `${sym.NAS100.schedule} (${sym.NAS100.scheduleTimeZone})` : null,
      swapLong: { NAS100: sym.NAS100 ? sym.NAS100.swapLong : null, US500: sym.US500 ? sym.US500.swapLong : null },
      spreadMedian: { NAS100: sym.NAS100 && sym.NAS100.spreadTypical ? sym.NAS100.spreadTypical.median : null, US500: sym.US500 && sym.US500.spreadTypical ? sym.US500.spreadTypical.median : null },
      gap: 'both indices are listed and quoted (one day of reads, 12-13 Nov); what is missing is a writer: no council member opens a trade at the cash close, and the spread at 16:00 New York and the swap actually charged on a held CFD have not been read' },
  };
}

export function build(opts = {}) {
  const I = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const streams = {};
  for (const [k, s] of Object.entries(I.streams)) {
    const gate = gateCheck(k, gateStats(s));
    streams[k] = { lead: s.lead, name: s.name, window: `${s.trades[0][0]} to ${s.trades.at(-1)[0]}`, months: `${s.monthFrom} to ${s.monthTo}`, key: s.key, gate,
      plan: gate.pass ? planStream(s, opts) : null };
  }
  return {
    topic: 'lead-forward-plan', built: '2026-11-14', verdict: VERDICT,
    rule: 'accounting / design only: no rule tested, no rule proposed, nothing live changed; no lead is an edge; any forward paper stream needs the owner\'s approval as a new rule (absolute rule 3)',
    prereg: 'research/edge/lead-forward-plan/PREREGISTRATION.md',
    method: { from: 'research/proposals/2026-11-12-path-to-live.mjs (mulberry32, quant, simulate imported)', draws: opts.draws || DRAWS, seed: opts.seed ?? SEED, horizons: HORIZONS, protocolMonths: PROTOCOL_M, checks: CHECKS, grid: GRID,
      worlds: 'measured = the stream at that cost; none = minus that level\'s mean; losing = minus (that level\'s mean + |the 1x mean|)',
      stops: 'from the measured world at each cost: total under its 5th percentile at 6 / 12 / 24 months, or a closed drawdown over the 95th percentile of the 24-month worst drawdown' },
    sources: I.sources, streams, demo: demoGaps(I.demo),
  };
}

// ── RESULT.md ──
const f = (x, d = 3) => (x == null ? 'n/a' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d));
const mo = (x) => (x == null ? 'never' : x > 600 ? 'over 50 yr' : x >= 24 ? `${Math.round(x)} (${(x / 12).toFixed(1)} yr)` : `${Math.round(x)}`);
const pc = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)} %`);
export function report(o) {
  const L = [];
  L.push('# What a forward paper record could show for each open lead, and how long it would take (14 Nov 2026)', '');
  L.push(`**Verdict: ${o.verdict}.** This is accounting, not a test: no rule is tested, no rule is proposed, and nothing live changed. **No lead is an edge.** **This is not a proposal to trade anything.** Any forward paper stream of any lead below would be a new rule and needs the owner's approval first (absolute rule 3); the council has none today.`, '');
  const S = o.streams;
  const p1 = (k) => S[k].plan && S[k].plan[1];
  L.push('In one line per lead, at the cost each study charged (1x):', '');
  for (const k of ['L1', 'L2', 'L3', 'L4']) {
    const p = p1(k), q = p && p.worlds;
    L.push(`- **${S[k].name}**: ${p.perYear} trades a year, ${f(p.mean)}R a trade (sd ${p.sd}); months of forward record for an expected t of 2: ${p.measuredPositive ? `**${mo(p.monthsToT2.measured)}**` : '**never** (not positive after its cost)'}${p.measuredPositive ? `; a two-year record shows t ≥ 2 in ${pc(q.measured.horizons[24].pT2)} of paths if it is as measured and in ${pc(q.none.horizons[24].pT2)} if there is no edge` : ''}.`);
  }
  const fast = Object.entries(S).filter(([, s]) => s.plan && s.plan[1].measuredPositive && s.plan[1].monthsToT2.measured <= 36).map(([k]) => k);
  const fastHalf = Object.entries(S).filter(([, s]) => s.plan && s.plan[0.5].measuredPositive && s.plan[0.5].monthsToT2.measured <= 36).map(([k]) => k);
  L.push('', `So: at the cost the studies charged, ${fast.length ? `only ${fast.join(', ')} would reach an expected t of 2 within three years` : '**no stream reaches an expected t of 2 within three years of forward record**'}; at half that cost, ${fastHalf.length ? fastHalf.join(', ') : 'none'}. A forward record of two or three years can therefore mostly measure the COST at each lead's minute, and stop a stream that is clearly worse than its study; it cannot prove one. The stop lines are fixed from the as-measured world, so their false-stop rate is about 12-13 % in every stream (three 5 % checks and one 95 % drawdown line), as in the path-to-live plan.`, '');
  L.push(`Months to t 2 from monthly sums is the honest figure where several trades fall in the same days (the four gotobi crosses trade the same mornings, the six gap pairs the same weekends): their trades are not independent, so the per-trade figure is much shorter and wrong for planning (L1b at 1x: ${mo(S.L1b.plan[1].monthsToT2.measuredFromTrades)} months from trades, ${mo(S.L1b.plan[1].monthsToT2.measured)} from months).`, '');
  L.push('## Method', '', `Pre-registered in PREREGISTRATION.md (pushed alone first). Each lead's own decisive-window trades, read from the pinned commits by \`extract.mjs\` into \`inputs.json\`; per trade gross R and the cost its study charged (1x); the cost grid scales the whole charged cost (0.5x, 1x, 1.5x, 2x). The month-block bootstrap is ${o.method.from}: ${o.method.draws.toLocaleString('en-US')} paths, seed ${o.method.seed}, every calendar month of the window a block (empty months included). Worlds: ${o.method.worlds}. Stop lines (${o.method.stops}). "Months to t 2" = (2σ/μ)² on monthly sums over all calendar months; "from trades" = (2 sd / mean)² trades at the stream's pace. P(t ≥ 2) = share of paths whose monthly-sum t over that horizon is 2 or more.`, '');
  L.push('## Gates (each study\'s published decisive-window figures, in its own t)', '', '| Stream | n | gross | net | t | expected | pass |', '|---|---|---|---|---|---|---|');
  for (const [k, s] of Object.entries(S)) { const g = s.gate.got, e = s.gate.expected; L.push(`| ${k} ${s.name} | ${g.n} | ${f(g.gross)} | ${f(g.net)} | ${f(g.t, 2)} | ${Object.entries(e).map(([a, b]) => `${a} ${b}`).join(', ')} | ${s.gate.pass ? 'yes' : 'NO'} |`); }
  L.push('');
  for (const lead of ['L1', 'L2', 'L3', 'L4']) {
    L.push(`## ${lead}`, '');
    for (const [k, s] of Object.entries(S).filter(([, x]) => x.lead === lead)) {
      L.push(`### ${k}: ${s.name}`, '', `Trades ${s.window}, months ${s.months} (keyed by ${s.key}).`, '');
      if (!s.plan) { L.push('Gate not passed: not used.', ''); continue; }
      L.push('| Cost | trades / yr | mean R | sd | months to t 2 (monthly; from trades) | stop lines: total under at 6 / 12 / 24 m; drawdown over | P(stop in 24 m): as measured (false) / no edge (correct) / losing | P(t ≥ 2): 24 m / 36 m / 60 m as measured | P(t ≥ 2) 24 m, no edge |', '|---|---|---|---|---|---|---|---|---|');
      for (const m of GRID) {
        const p = s.plan[m], W = p.worlds, st = p.stops;
        L.push(`| ${m}x | ${p.perYear} | ${f(p.mean)} | ${p.sd} | ${mo(p.monthsToT2.measured)}; ${mo(p.monthsToT2.measuredFromTrades)} | ${f(st.floor[6], 1)} / ${f(st.floor[12], 1)} / ${f(st.floor[24], 1)}; ${st.ddStop}R | ${pc(W.measured.stoppedIn24)} / ${pc(W.none.stoppedIn24)} / ${pc(W.losing.stoppedIn24)} | ${pc(W.measured.horizons[24].pT2)} / ${pc(W.measured.horizons[36].pT2)} / ${pc(W.measured.horizons[60].pT2)} | ${pc(W.none.horizons[24].pT2)} |`);
      }
      const p = s.plan[1];
      L.push('', `At 1x, 24 months as measured: total ${f(p.worlds.measured.horizons[24].cum.p5, 1)} / ${f(p.worlds.measured.horizons[24].cum.p50, 1)} / ${f(p.worlds.measured.horizons[24].cum.p95, 1)}R (5 / 50 / 95 %), P(total < 0) ${pc(p.worlds.measured.horizons[24].pLoss)}; with no edge P(total < 0) ${pc(p.worlds.none.horizons[24].pLoss)}.${p.measuredPositive ? '' : ' Not positive at 1x: its stop lines at 1x are lines of a losing stream and are shown for completeness only.'}`, '');
    }
  }
  const D = o.demo;
  L.push('## What the demo route lacks today', '', `${D.source}. Listed: ${D.symbols.join(', ')}.`, '');
  for (const k of ['L1', 'L2', 'L3', 'L4']) {
    const g = D[k];
    L.push(`- **${k}** needs ${g.needs}. On the list: ${Object.entries(g.onList).map(([a, b]) => `${a} ${b ? 'yes' : 'no'}`).join(', ')}. ${g.gap}.${g.swapLong ? ` Swap on a long (the broker's own figure, swap type 1): NAS100 ${g.swapLong.NAS100}, US500 ${g.swapLong.US500}; median spread outside the rollover NAS100 ${g.spreadMedian.NAS100}, US500 ${g.spreadMedian.US500} points.` : ''}`);
  }
  L.push('', '## Reading, and suggestions (for the owner; nothing here is done)', '');
  L.push('- Every lead turns on a cost nobody has measured at the minute it trades. Before any forward paper stream, the cheapest step is to MEASURE that cost: read bid / ask (and, on a demo account that lists the symbol, a fill) at the lead\'s own minutes for a few weeks. That is a data writer, not a trading rule, and would itself need the owner to approve adding symbols to the demo account.');
  L.push('- A forward record only helps where its expected t of 2 comes in a time the owner would wait; where it needs many years at 1x, the record would only ever show the cost, not the edge.');
  L.push('- No owner-decisions item is written by this study. If the owner wants any of this, it is a new rule with its own pre-registration (the stop lines above, fixed before the first trade), paper and demo only.');
  L.push('', 'Files: `PREREGISTRATION.md`, `extract.mjs` (inputs), `inputs.json`, `run.mjs`, `result.json`. Test: `tests/lead-forward-plan.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = build();
  fs.writeFileSync(OUT, JSON.stringify(o, null, 1) + '\n');
  fs.writeFileSync(MD, report(o));
  for (const [k, s] of Object.entries(o.streams)) console.log(k, s.gate.pass, JSON.stringify(s.gate.got), s.plan ? JSON.stringify({ perYear: s.plan[1].perYear, mean: s.plan[1].mean, m2: s.plan[1].monthsToT2 }) : '');
}
