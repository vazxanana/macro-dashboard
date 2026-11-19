// Cost floor map: offline. Reads the committed collected.json (built by collect.mjs from the study branches) and writes
// result.json and RESULT.md. Rules: PREREGISTRATION.md (sections 3-5). Accounting only: no rule is tested, nothing is
// fetched, and no row is called an edge.
//   node research/edge/cost-floor-map/run.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);

// Section 3. s = mean per unit of t, under a constant cost a trade.
export function scaleOf({ gross, net, tNet, tGross }) {
  if (tNet != null && tGross != null && tGross - tNet >= 0.1) return { s: (gross - net) / (tGross - tNet), how: 'both t stored' };
  if (tNet != null && Math.abs(tNet) >= 0.2) return { s: net / tNet, how: 'net / net t' };
  if (tGross != null && Math.abs(tGross) > 0 && gross / tGross > 0) return { s: gross / tGross, how: 'gross / gross t' };
  return { s: null, how: 'no usable t' };
}
export const breakEvenCost = ({ gross }) => gross;
export function t2Cost(row) {
  const { s } = scaleOf(row);
  return s == null || !(s > 0) ? null : row.gross - 2 * s;
}
export function grossT(row) {
  if (row.tGross != null) return row.tGross;
  const { s } = scaleOf(row);
  return s == null || !(s > 0) ? null : row.gross / s;
}

// Section 4a. Instruments the demo quotes (page key -> broker symbol).
export const DEMO_SYM = { xau: 'XAUUSD', eurusd: 'EURUSD', gbpusd: 'GBPUSD', audusd: 'AUDUSD', usdcad: 'USDCAD', usdchf: 'USDCHF',
  nas100: 'NAS100', spx500: 'US500', us30: 'US30', us2000: 'US2000', btc: 'BTCUSD', eth: 'ETHUSD', sol: 'SOLUSD' };
// Demo round trip as % of price: median quoted spread / bid + commission (no slippage, no financing).
export function demoPct(sym) {
  if (!sym) return null;
  return (sym.spreadMedian / sym.bid + (sym.commissionRT || 0)) * 100;
}
// Demo cost of one row in the row's own unit, or null with the reason.
export function demoCost(row, demo, stopPctOverride, finOverride = null) {
  const key = DEMO_SYM[row.inst];
  if (!key) return { v: null, why: `not one instrument the demo quotes (${row.inst})` };
  const sym = demo.symbols[key];
  if (!sym) return { v: null, why: `${key} has no measured spread in the file` };
  const pct = demoPct(sym);
  if (row.unit === '%') {
    const fin = row.finPct ?? 0;
    return { v: pct + fin, pct, stopPct: null, fin, finKnown: row.finPct != null, why: null };
  }
  if (row.unit !== 'R') return { v: null, why: `unit ${row.unit}` };
  let stopPct = stopPctOverride ?? row.stopPct;
  if (stopPct == null && row.stopPips != null) {
    const pip = 10 ** -sym.pipPosition;
    stopPct = (row.stopPips * pip) / sym.bid * 100;
  }
  if (stopPct == null) return { v: null, why: 'stop size not stored as % of price or pips' };
  const cost = row.gross - row.net;
  // Financing in R: the charged cost less the study's stored transaction cost; else the study's stored financing figure;
  // else the CFD financing a committed futures-cost study computed for the same trades; else unknown (not added).
  const finR = row.trans != null ? Math.max(0, cost - row.trans) : row.fin != null ? Math.abs(row.fin) : finOverride;
  return { v: pct / stopPct + (finR ?? 0), pct, stopPct, fin: finR, finKnown: finR != null, why: null };
}

export function analyse(c) {
  const futBy = new Map(c.futures.map((f) => [`${f.topic}|${f.test}`, f]));
  const rows = [];
  for (const x of c.rows) {
    if (x.status !== 'read') { rows.push({ ...x, cls: 'cannot' }); continue; }
    if (!(x.gross > 0)) { rows.push({ ...x, cls: 'no-gross', cost: r4(x.gross - x.net) }); continue; }
    const { s, how } = scaleOf(x);
    const cost = x.gross - x.net;
    const tg = grossT(x);
    const t2 = t2Cost(x);
    const fut = futBy.get(`${x.topic}|${x.test}`) || null;
    const demo = demoCost(x, c.demo, fut?.medStopPct ?? null, fut?.cfdFin ?? null);
    const fits = demo.v == null ? 'unknown' : x.gross - demo.v > 0 ? 'yes' : 'no';
    const tDemo = demo.v != null && s > 0 ? (x.gross - demo.v) / s : null;
    const needFut = fits === 'yes' ? 'no' : x.net > 0 ? 'no' : 'yes';
    let cls;
    if (tg != null && tg >= 2 && (x.tNet == null || x.tNet < 2)) cls = 'cost-blocked';
    else if (x.tNet != null && x.tNet >= 2) cls = 'net-t2';
    else cls = 'unproven';
    rows.push({ ...x, cls, s: r4(s), sHow: how, cost: r4(cost), grossT: r2(tg), grossTDerived: x.tGross == null, breakEven: r4(breakEvenCost(x)), t2Cost: t2 == null ? null : r4(t2),
      t2Reached: t2 != null && t2 >= 0, headroom: r4(x.gross - cost), demoCost: r4(demo.v), demoWhy: demo.why, demoPct: r4(demo.pct ?? null), demoStopPct: r4(demo.stopPct ?? null),
      demoFin: r4(demo.fin ?? null), demoFinKnown: demo.finKnown ?? null, fitsDemo: fits, tAtDemo: r2(tDemo), needFutures: needFut,
      futures: fut ? { net: fut.futNet, t: fut.tFut, src: fut.src, market: fut.market } : null });
  }
  const ranked = rows.filter((r) => ['cost-blocked', 'net-t2', 'unproven'].includes(r.cls)).sort((a, b) => (b.grossT ?? -99) - (a.grossT ?? -99) || b.gross - a.gross);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  const studies = new Set(c.rows.map((r) => r.topic));
  const readStudies = new Set(c.rows.filter((r) => r.status === 'read').map((r) => r.topic));
  const count = (k) => rows.filter((r) => r.cls === k).length;
  return {
    built: c.built, scope: c.scope, verdict: 'ACCOUNTING (no rule tested)',
    counts: { studies: studies.size, studiesRead: readStudies.size, studiesUnread: studies.size - readStudies.size, tests: rows.length, read: rows.length - count('cannot'), cannot: count('cannot'),
      positiveGross: ranked.length, costBlocked: count('cost-blocked'), netT2: count('net-t2'), unproven: count('unproven'), noGross: count('no-gross'),
      fitsDemoYes: ranked.filter((r) => r.fitsDemo === 'yes').length, fitsDemoNo: ranked.filter((r) => r.fitsDemo === 'no').length, fitsDemoUnknown: ranked.filter((r) => r.fitsDemo === 'unknown').length },
    demo: { at: c.demo.at, source: c.demo.source, pct: Object.fromEntries(Object.entries(c.demo.symbols).map(([k, v]) => [k, r4(demoPct(v))])),
      quotes: { min: Math.min(...Object.values(c.demo.symbols).map((v) => v.quotes)), max: Math.max(...Object.values(c.demo.symbols).map((v) => v.quotes)),
        from: Object.values(c.demo.symbols).map((v) => v.from).sort()[0], to: Object.values(c.demo.symbols).map((v) => v.to).sort().slice(-1)[0] } },
    yen: c.yen, notStudies: c.notStudies, ranked,
    noGross: rows.filter((r) => r.cls === 'no-gross').map((r) => ({ pr: r.pr, topic: r.topic, test: r.test, gross: r.gross, net: r.net, tNet: r.tNet })),
    cannot: rows.filter((r) => r.cls === 'cannot').map((r) => ({ pr: r.pr, topic: r.topic, test: r.test, why: r.why })),
  };
}

// ---------- report ----------
const f = (v, d = 3) => (v == null ? '—' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const sg = (v, d = 3) => (v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
export const TABLE_HEAD = '| # | Study | Test | Instrument | Unit | n | Gross | t gross | Cost charged | Net t | Break-even cost | t-2 cost | Demo cost (measured) | Fits on the demo? | Would need futures? |';
export function tableRow(r) {
  const t2 = r.t2Cost == null ? '—' : r.t2Cost < 0 ? `not reached (${f(r.t2Cost)})` : f(r.t2Cost);
  const demo = r.demoCost == null ? 'unknown' : f(r.demoCost) + (r.demoFinKnown ? '' : '†');
  return `| ${r.rank} | ${r.topic} (#${r.pr}) | ${r.test} | ${r.inst ?? '—'} | ${r.unit} | ${r.n ?? '—'} | ${sg(r.gross)} | ${f(r.grossT, 2)}${r.grossTDerived ? '*' : ''} | ${f(r.cost)} | ${f(r.tNet, 2)} | ${f(r.breakEven)} | ${t2} | ${demo} | ${r.fitsDemo} | ${r.needFutures} |`;
}

function report(res) {
  const R = res.ranked;
  const c = res.counts;
  const name = (r) => `${r.topic} ${r.test} (#${r.pr})`;
  const blocked = R.filter((r) => r.cls === 'cost-blocked');
  const netT2 = R.filter((r) => r.cls === 'net-t2');
  const unproven = R.filter((r) => r.cls === 'unproven');
  const fitsYes = R.filter((r) => r.fitsDemo === 'yes');
  const L = [];
  L.push('# Cost floor map: the 13-14 Nov studies, what cost each pre-cost effect can carry');
  L.push('');
  L.push(`Built ${res.built}. Pre-registration: PREREGISTRATION.md (committed and pushed alone first). Inputs: collected.json (read from each study's own branch by collect.mjs).`);
  L.push('');
  L.push(`**Verdict: ${res.verdict}.** This is accounting of committed results, not a test of any market: no data was fetched, no rule was run, no study's verdict changes, and no row below is an edge.`);
  L.push('');
  L.push('## What was read');
  L.push('');
  L.push(`- ${c.studies} studies of pull requests #815-#943, ${c.tests} decisive tests. ${c.read} tests could be read (gross, net and a t stored on the decisive object), in ${c.studiesRead} studies; ${c.cannot} could not (listed at the end with the reason).`);
  L.push(`- Of the tests read, ${c.positiveGross} have a POSITIVE decisive gross mean (the ranked table) and ${c.noGross} have none (gross zero or negative).`);
  L.push(`- Left out (not a study, or not run): ${[...new Map(res.notStudies.map((x) => [x.topic, x])).values()].map((x) => `${x.topic} (#${x.pr})`).join(', ')}.`);
  L.push('');
  L.push('## The two floors');
  L.push('');
  L.push('Cost is taken as a constant a trade (section 3 of the pre-registration). **Break-even cost** = the cost a trade at which the decisive net mean is 0 (= the gross mean). **t-2 cost** = the cost at which the decisive net t is 2 (= gross − 2·s, s = the mean per unit of t). A t-2 cost below zero means the effect does not reach t 2 even with no cost at all. "Cost charged" = gross − net (spread, commission, slippage and financing as the study charged them). A dagger on a demo cost = financing unknown and not added (the transaction cost alone). An asterisk on t gross = derived from the stored net t under the same assumption (not stored by the study).');
  L.push('');
  L.push(`Demo cost (measured): council-data ctrader/symbols.json of ${res.demo.at} (median quoted spread over its quotes + commission, no slippage), converted to R with the study's stored median stop as % of price (or pips), plus the study's own financing where it is stored apart. Round trip as % of price: ${Object.entries(res.demo.pct).map(([k, v]) => `${k} ${v}%`).join(', ')}. The spread is the median of only ${res.demo.quotes.min}-${res.demo.quotes.max} quotes a symbol taken between ${res.demo.quotes.from} and ${res.demo.quotes.to} (about one trading day, all hours outside the rollover): a snapshot of this account, not a history. The median stop understates the mean cost in R (cost / stop is convex), and no slippage is in it: read the demo figure as a floor, not the full cost.`);
  L.push('');
  L.push('## Ranked table (tests with a positive decisive gross, strongest pre-cost t first)');
  L.push('');
  L.push(TABLE_HEAD);
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R) L.push(tableRow(r));
  L.push('');
  L.push('Units: R = R a trade; % = % of price a trade; "R a month" / "% a week" / "R an event" = the study\'s own book unit (the floors are in the same unit). "Fits on the demo?" = gross minus the measured demo cost above zero; "unknown" = the demo does not quote the instrument, or the study stored no stop size to convert the cost to R.');
  L.push('');
  L.push('## Reading for the owner');
  L.push('');
  L.push(`**Blocked only by cost (gross t ≥ 2, net t under 2): ${blocked.length} tests.** ${blocked.map((r) => `${name(r)}: gross ${sg(r.gross)} ${r.unit} (t ${f(r.grossT, 2)}), charged ${f(r.cost)}, break-even ${f(r.breakEven)}, t-2 cost ${r.t2Cost == null ? '—' : r.t2Cost < 0 ? 'not reached' : f(r.t2Cost)}${r.demoCost != null ? `, measured demo ${f(r.demoCost)} (${r.fitsDemo === 'yes' ? `fits, t ${f(r.tAtDemo, 2)} at that cost` : 'does not fit'})` : ', demo cost unknown'}${r.futures ? `; futures route (${r.futures.src.split(' ')[0]}): net ${sg(r.futures.net)} t ${f(r.futures.t, 2)}` : ''}`).join('; ')}.`);
  L.push('');
  const halfCut = blocked.filter((r) => r.t2Cost != null && r.t2Cost < r.cost / 2).length;
  const noT2 = blocked.filter((r) => r.t2Cost == null || r.t2Cost < 0).length;
  L.push(`These effects are present before costs and the costs each study charged take them away. A cheaper route only helps where it cuts the cost below the t-2 cost: for ${halfCut} of these ${blocked.length} the t-2 cost is under half of what was charged (the route would have to cost less than half as much), and ${noT2} of them ${noT2 === 1 ? "does" : "do"} not reach t 2 even at zero cost by this rule. Each gross t was measured once, before any correction for the many tests of these two days (the multiple-testing recount is separate work).`);
  L.push('');
  L.push(`**Net t ≥ 2 at the cost the study charged: ${netT2.length} tests.** ${netT2.map((r) => `${name(r)} (net ${sg(r.net)}, t ${f(r.tNet, 2)}, headroom ${f(r.headroom)} over the charged cost${r.demoCost != null ? `; demo ${r.fitsDemo}` : '; demo cost unknown'})`).join('; ')}. Each study's own verdict stands (none was called an edge: they failed other pre-registered checks such as the other window, Holm, or a placebo); the floors only say how much cost they could carry.`);
  L.push('');
  L.push(`**Fits on the demo at its measured cost: ${fitsYes.length} of the ${c.positiveGross} positive-gross tests** (${c.fitsDemoNo} do not, ${c.fitsDemoUnknown} unknown). ${fitsYes.length ? fitsYes.map((r) => `${name(r)} (gross ${sg(r.gross)}, demo ${f(r.demoCost)}, t at that cost ${f(r.tAtDemo, 2)})`).join('; ') + '.' : ''} "Fits" means the mean stays above zero at the measured spread and commission; it says nothing about t, and the demo figure has no slippage in it.`);
  L.push('');
  const demoT2 = R.filter((r) => r.tAtDemo != null && r.tAtDemo >= 2);
  L.push(`**Net t at least 2 at the measured demo cost: ${demoT2.length} tests** (${demoT2.map((r) => `${name(r)}, t ${f(r.tAtDemo, 2)}`).join('; ') || 'none'}). Read with care: the demo spread is one day of quotes, no slippage is in it, and each study's own verdict (FAIL or not proven) stands for reasons beyond cost.`);
  L.push('');
  L.push(`**Unproven at any cost (gross positive but gross t under 2): ${unproven.length} tests.** A cheaper route cannot make these proven: even at zero cost their t is under 2. ${unproven.slice(0, 40).map(name).join(', ')}${unproven.length > 40 ? ', …' : ''}.`);
  L.push('');
  L.push(`**No gross effect (gross zero or negative): ${c.noGross} tests.** Cost is not what stops them: ${res.noGross.map((r) => `${r.topic} ${r.test}`).join(', ')}.`);
  L.push('');
  if (res.yen) {
    const y = res.yen;
    L.push(`**Yen (gotobi T2, the strongest yen row).** The demo quotes no yen pair, so its cost there is unknown. The committed gotobi-cost study (#893) put the break-even at ${y.breakEvenPips} pips a round trip and net month t 2 at ${y.t2Pips} pips; the published average USD/JPY spread it cites is ${y.publishedSpreadPips} pips (its sources: web search summaries of 14 Nov 2026, pages not opened). That study, not this one, is the place to read the yen route.`);
    L.push('');
  }
  L.push('**Futures.** Only figures a committed cost study computed for the same trades are shown: index-futures-cost (#900, CME micro index futures; its own sources) for index-overnight, index-ibs and turn-of-month, and bond-month-end-futures (#943, Treasury futures) for bond-month-end. For any other row a futures contract may exist (from memory, not opened) but its cost was not measured here and carries no number.');
  L.push('');
  L.push('## Caveats');
  L.push('');
  L.push('- The constant-cost assumption moves the t in proportion to the mean. On a month-sum t (most studies judged on months) it is an approximation: months hold different numbers of trades. A cost in R also depends on each trade\'s stop.');
  L.push('- Every gross t above is a single, uncorrected test among the many of these two days. "Blocked only by cost" is a statement about cost, not evidence of an edge.');
  L.push('- Financing is part of "cost charged" (the demo charges a swap too); the demo figure adds the study\'s own financing only where the study stored it apart from the spread.');
  L.push('');
  L.push('## Could not be read');
  L.push('');
  for (const x of res.cannot) L.push(`- ${x.topic} (#${x.pr}) ${x.test}: ${x.why}`);
  L.push('');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const c = JSON.parse(readFileSync(join(HERE, 'collected.json'), 'utf8'));
  const res = analyse(c);
  writeFileSync(join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  writeFileSync(join(HERE, 'RESULT.md'), report(res) + '\n');
  console.log(JSON.stringify(res.counts));
}
export { report };
