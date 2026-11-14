// gold-cost-synthesis: a DESCRIPTIVE table of 44 gold studies' own result files (PREREGISTRATION.md). No rule is run.
//   node research/edge/gold-cost-synthesis/run.mjs collect   read every study branch with `git show`, write collected.json
//   node research/edge/gold-cost-synthesis/run.mjs           build result.json and RESULT.md from collected.json (offline)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { STUDIES } from './studies.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
// intraday = flat the same session (fixed from each study's own exit rule, before tabulating)
export const INTRADAY = new Set(['gold-vol-breakout', 'gold-vol-breakout-replicate', 'gold-comex-orb', 'gold-london-orb', 'gold-london-reversal', 'gold-pdhl-break', 'ict-silver-bullet-gold', 'mmxm-pdhl-raid-gold', 'gold-late-ny', 'gold-gap-open', 'gold-volume-spike', 'gold-hourly-shock', 'gold-silver-lead-intraday', 'gold-round-numbers', 'gold-vwap', 'gold-floor-pivots']);
export const BINS = [[0, 3, 'under $3'], [3, 6, '$3-6'], [6, 10, '$6-10'], [10, 20, '$10-20'], [20, Infinity, '$20 and over']];

export function get(obj, p) {
  let v = obj;
  for (const k of p.split('.')) { if (v == null) return undefined; v = v[k]; }
  return v;
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// every value one study's table needs, with the JSON path it came from
export function extract(st, json) {
  const out = [];
  for (const t of st.tests) {
    const wins = st.w.only ? { single: st.w.only } : { is: st.w.is, oos: st.w.oos };
    for (const [wk, wpath] of Object.entries(wins)) {
      const base = wpath.replace('{T}', t.key), gbase = st.wg ? st.wg[wk].replace('{T}', t.key) : null;
      const row = { test: t.id, window: wk, values: {} };
      for (const [field, key] of Object.entries(st.f)) {
        const p = key.startsWith('g:') ? `${gbase}.${key.slice(2)}` : `${base}.${key}`;
        const v = num(get(json, p));
        row.values[field] = v == null ? null : { v, path: p };
      }
      const nm = get(json, `tests.${t.key}.name`);
      row.sourceName = typeof nm === 'string' ? nm : null;
      out.push(row);
    }
  }
  return out;
}

const verdictLine = (md) => {
  const l = String(md || '').split(/\r?\n/).find((x) => /^\s*\*\*Verdict/i.test(x));
  return l ? l.replace(/\*\*/g, '').replace(/^\s*Verdict[:.]?\s*/i, '').trim() : null;
};

function collect() {
  const git = (args) => execFileSync('git', args, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const studies = [];
  for (const st of STUDIES) {
    let ref = null, json = null, md = null, commit = null;
    for (const r of [`origin/${st.topic}`, 'origin/main']) {
      try { json = JSON.parse(git(['show', `${r}:research/edge/${st.topic}/result.json`])); md = git(['show', `${r}:research/edge/${st.topic}/RESULT.md`]); ref = r; commit = git(['rev-parse', r]).trim(); break; } catch { /* next */ }
    }
    if (!json) throw new Error(`no result files for ${st.topic}`);
    const verdict = verdictLine(md);
    studies.push({ topic: st.topic, ref, commit, verdict, passed: /^PASS\b/.test(verdict || ''), rows: st.excluded ? [] : extract(st, json) });
  }
  fs.writeFileSync(path.join(DIR, 'collected.json'), JSON.stringify({ collected: new Date().toISOString().slice(0, 10), studies }, null, 1) + '\n');
}

// Spearman rank correlation (average ranks for ties)
export function spearman(xs, ys) {
  const rank = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length, mx = rx.reduce((s, v) => s + v, 0) / n, my = ry.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
export const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function build(collected) {
  const meta = Object.fromEntries(STUDIES.map((s) => [s.topic, s]));
  const rows = [];
  const studies = collected.studies.map((c) => {
    const st = meta[c.topic];
    for (const r of c.rows) {
      const v = (k) => (r.values[k] ? r.values[k].v : null);
      const g = v('g'), net = v('net');
      const t = st.tests.find((x) => x.id === r.test);
      rows.push({
        topic: c.topic, test: r.test, name: r.sourceName || t.name, window: r.window, tf: st.tf, style: INTRADAY.has(c.topic) ? 'intraday' : 'multi-day',
        n: v('n'), gross: g, net, tGross: v('tg'), tNet: v('tn'),
        costR: g != null && net != null ? r3(g - net) : null, costStored: v('costR'), finR: v('finR'),
        stop: st.stopKind === 'median' || st.stopKind === 'mean' ? v('stop') : null,
        stopKind: st.stopKind === 'median' || st.stopKind === 'mean' ? (v('stop') != null ? st.stopKind : null) : null,
        stopAtr: st.stopKind === 'atr' ? v('stop') : null, stopRule: st.stopRule, hold: st.hold, studyPassed: c.passed,
      });
    }
    return { topic: c.topic, commit: c.commit, ref: c.ref, verdict: c.verdict, passed: c.passed, tf: st.tf || null, hold: st.hold || null,
      stopRule: st.stopRule || null, cost: st.cost || null, windows: st.windows || null, excluded: st.excluded || null, tests: st.tests.length };
  });

  const usable = rows.filter((r) => r.gross != null && r.net != null);
  const med = usable.filter((r) => r.stopKind === 'median'), withMean = usable.filter((r) => r.stopKind);
  const bins = BINS.map(([lo, hi, label]) => {
    const b = med.filter((r) => r.stop >= lo && r.stop < hi);
    return { label, lo, hi: hi === Infinity ? null : hi, rows: b.length, studies: new Set(b.map((r) => r.topic)).size,
      gross: r3(median(b.map((r) => r.gross))), cost: r3(median(b.map((r) => r.costR))), net: r3(median(b.map((r) => r.net))),
      grossPos: b.filter((r) => r.gross > 0).length, tg2: b.filter((r) => r.tGross != null && r.tGross >= 2).length,
      tgReported: b.filter((r) => r.tGross != null).length, netPos: b.filter((r) => r.net > 0).length,
      intraday: b.filter((r) => r.style === 'intraday').length, multiDay: b.filter((r) => r.style === 'multi-day').length };
  });
  const sp = (rs, k) => (rs.length >= 3 ? r3(spearman(rs.map((r) => r.stop), rs.map((r) => r[k]))) : null);
  const corr = {
    medianOnly: { n: med.length, studies: new Set(med.map((r) => r.topic)).size, stopVsCost: sp(med, 'costR'), stopVsGross: sp(med, 'gross'), stopVsNet: sp(med, 'net') },
    withMean: { n: withMean.length, studies: new Set(withMean.map((r) => r.topic)).size, stopVsCost: sp(withMean, 'costR'), stopVsGross: sp(withMean, 'gross'), stopVsNet: sp(withMean, 'net') },
  };

  const byStyle = ['intraday', 'multi-day'].map((style) => {
    const b = usable.filter((r) => r.style === style), bt = b.filter((r) => r.tGross != null), bs = b.filter((r) => r.stopKind === 'median');
    return { style, rows: b.length, studies: new Set(b.map((r) => r.topic)).size, medianStopRows: bs.length, stop: r3(median(bs.map((r) => r.stop))),
      gross: r3(median(b.map((r) => r.gross))), cost: r3(median(b.map((r) => r.costR))), net: r3(median(b.map((r) => r.net))),
      grossPos: b.filter((r) => r.gross > 0).length, tgReported: bt.length, tg2: bt.filter((r) => r.tGross >= 2 && r.gross > 0).length,
      costFlips: b.filter((r) => r.gross > 0 && r.costR > r.gross).length };
  });
  // per test: gross t >= 2 and gross > 0 in BOTH windows
  const byTest = new Map();
  for (const r of rows) { const k = `${r.topic} ${r.test}`; if (!byTest.has(k)) byTest.set(k, []); byTest.get(k).push(r); }
  const both = [], bothChecked = [];
  for (const [k, rs] of byTest) {
    const is = rs.find((r) => r.window === 'is'), oos = rs.find((r) => r.window === 'oos');
    if (!is || !oos || is.tGross == null || oos.tGross == null) continue;
    bothChecked.push(k);
    if (is.tGross >= 2 && oos.tGross >= 2 && is.gross > 0 && oos.gross > 0) both.push(k);
  }
  const tg = usable.filter((r) => r.tGross != null);
  const counts = {
    studies: studies.length, studiesExcluded: studies.filter((s) => s.excluded).length, tests: byTest.size, rows: rows.length, usableRows: usable.length,
    rowsTgReported: tg.length, rowsTg2: tg.filter((r) => r.tGross >= 2 && r.gross > 0).length,
    rowsTg15: tg.filter((r) => r.tGross >= 1.5 && r.gross > 0).length,
    rowsTg15NetUnder2: tg.filter((r) => r.tGross >= 1.5 && r.gross > 0 && r.tNet != null && r.tNet < 2).length,
    rowsTg15NetNeg: tg.filter((r) => r.tGross >= 1.5 && r.gross > 0 && r.net <= 0).length,
    rowsTg15NetNegStops: tg.filter((r) => r.tGross >= 1.5 && r.gross > 0 && r.net <= 0).map((r) => r.stop),
    rowsGrossPos: usable.filter((r) => r.gross > 0).length,
    rowsGrossPosCostAbove: usable.filter((r) => r.gross > 0 && r.costR > r.gross).length,
    rowsNetPos: usable.filter((r) => r.net > 0).length,
    rowsTn2: usable.filter((r) => r.tNet != null && r.tNet >= 2).length,
    testsBothChecked: bothChecked.length, testsBothTg2: both.length, testsBothTg2List: both,
    rowsMedianStop: med.length, rowsMeanStop: withMean.length - med.length,
  };
  // rows with gross t >= 1.5 (gross > 0), listed
  const strong = tg.filter((r) => r.tGross >= 1.5 && r.gross > 0).map((r) => ({ topic: r.topic, test: r.test, window: r.window, style: r.style, n: r.n, gross: r.gross, tGross: r.tGross, net: r.net, tNet: r.tNet, costR: r.costR, stop: r.stop, stopKind: r.stopKind }));
  const ref = rows.filter((r) => r.topic === 'gold-vol-breakout-replicate' || (r.topic === 'gold-vol-breakout' && r.test === 'T1'));
  const out = {
    study: 'gold-cost-synthesis', built: collected.collected, kind: 'descriptive synthesis, no rule tested',
    verdict: null, preregistration: 'research/edge/gold-cost-synthesis/PREREGISTRATION.md',
    counts, bins, byStyle, corr, strong, reference: ref, studies, rows,
  };
  out.verdict = headline(out);
  return out;
}

// ---- RESULT.md (every figure comes from result.json; the test re-renders and compares) ----
const f3 = (x) => (x == null ? 'not reported' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(3));
const f2 = (x) => (x == null ? 'not reported' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(2));
const fs$ = (r) => (r.stop != null ? `${r.stopKind === 'mean' ? 'mean ' : ''}$${r.stop.toFixed(2)}` : r.stopAtr != null ? `${r.stopAtr} x ATR (mean, as reported)` : 'not reported');
const wl = { is: 'IS', oos: 'OOS', single: 'single' };

export function headline(R) {
  const c = R.counts, m = R.corr.medianOnly;
  return `DESCRIPTIVE, no rule tested: across ${c.studies} gold studies cost R falls as the $ stop widens (rank ${f2(m.stopVsCost)}) while gross R rises only weakly (${f2(m.stopVsGross)}); ${c.rowsTg2} of ${c.rowsTgReported} test-windows have gross t ≥ 2, ${c.testsBothTg2} tests in both windows.`;
}

export function render(R) {
  const c = R.counts, m = R.corr.medianOnly, a = R.corr.withMean, L = [];
  L.push('# Gold cost synthesis: stop size, gross R and cost R across the 13-14 Nov gold studies', '');
  L.push(`Built ${R.built}. Pre-registration: PREREGISTRATION.md (pushed alone first). Inputs: collected.json (each study's own result.json, read from its branch by run.mjs; the commit of each is in result.json).`, '');
  L.push(`**Verdict: ${headline(R)}**`, '');
  L.push('This is a description of committed results. Nothing was re-run, no candle was read, no rule was tested, no study\'s verdict changes, nothing live changed and no proposal follows. No row below is an edge.', '');
  L.push('## What was read', '');
  L.push(`- ${c.studies} studies, ${c.tests} pre-registered tests, ${c.rows} test-windows (in sample, out of sample, or a single window). ${c.studiesExcluded} study is left out of the stop / cost description: gold-vol-target (portfolio weights rebalanced weekly, not trades with a stop; no R a trade).`);
  L.push(`- ${c.usableRows} test-windows report both gross and net R a trade; ${c.rowsTgReported} of them also report a gross t. ${c.rowsMedianStop} report a median stop in $, ${c.rowsMeanStop} a mean stop in $ only; the rest give the stop as a rule (ATR multiples, a range side) and no $ figure.`);
  L.push('- Cost R = gross minus net, as each study charged it (spread and slippage, $0.30-0.60 a round trip, plus overnight financing on buys where the study counted it). Where a figure is missing the table says "not reported"; nothing was estimated.', '');
  L.push('## Gross R, cost R and net R by median stop in $', '');
  L.push('| Median stop | Test-windows | Studies | Median gross R | Median cost R | Median net R | Gross > 0 | Gross t ≥ 2 (of those with a gross t) | Net > 0 |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const b of R.bins) L.push(`| ${b.label} | ${b.rows} | ${b.studies} | ${f3(b.gross)} | ${f3(b.cost)} | ${f3(b.net)} | ${b.grossPos} | ${b.tg2} of ${b.tgReported} | ${b.netPos} |`);
  L.push('');
  L.push(`Rank correlation (Spearman), median-stop rows only (${m.n} test-windows, ${m.studies} studies): stop $ vs cost R ${f2(m.stopVsCost)}, stop $ vs gross R ${f2(m.stopVsGross)}, stop $ vs net R ${f2(m.stopVsNet)}. With the mean-stop rows added (${a.n} test-windows, ${a.studies} studies): ${f2(a.stopVsCost)}, ${f2(a.stopVsGross)}, ${f2(a.stopVsNet)}. No p-value is given: the rows share data, rules and windows and are not independent.`, '');
  L.push('## Counts', '');
  L.push(`- Test-windows gross-positive: ${c.rowsGrossPos} of ${c.usableRows}; net-positive: ${c.rowsNetPos}; net t ≥ 2: ${c.rowsTn2}.`);
  L.push(`- Gross-positive with gross t ≥ 2: ${c.rowsTg2} of ${c.rowsTgReported} test-windows that report a gross t; with gross t ≥ 1.5: ${c.rowsTg15}, of which ${c.rowsTg15NetUnder2} have a net t under 2.`);
  L.push(`- Gross-positive test-windows whose cost R is larger than their gross R (positive before costs, negative after): ${c.rowsGrossPosCostAbove}.`);
  L.push(`- Tests with gross t ≥ 2 and gross > 0 in BOTH windows: ${c.testsBothTg2} of ${c.testsBothChecked} tests that report a gross t in both (${c.testsBothTg2List.join(', ') || 'none'}).`, '');
  L.push('## Intraday against multi-day rules', '');
  L.push('| Style | Test-windows | Studies | Median of the median stops (rows with one) | Median gross R | Median cost R | Median net R | Gross > 0 | Gross t ≥ 2 and gross > 0 (of those with a gross t) | Gross > 0 but cost > gross |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const b of R.byStyle) L.push(`| ${b.style} | ${b.rows} | ${b.studies} | $${b.stop.toFixed(2)} (${b.medianStopRows} rows) | ${f3(b.gross)} | ${f3(b.cost)} | ${f3(b.net)} | ${b.grossPos} | ${b.tg2} of ${b.tgReported} | ${b.costFlips} |`);
  L.push('', `Intraday = flat the same session by the study's own exit rule (${R.byStyle[0].studies} studies); multi-day = held overnight or longer (${R.byStyle[1].studies} studies).`, '');
  L.push('## Every gross-positive test-window with gross t ≥ 1.5', '');
  L.push('| Study | Test | Window | Style | n | Gross R | Gross t | Net R | Net t | Cost R | Stop |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const s of R.strong) L.push(`| ${s.topic} | ${s.test} | ${wl[s.window]} | ${s.style} | ${s.n} | ${f3(s.gross)} | ${f2(s.tGross)} | ${f3(s.net)} | ${f2(s.tNet)} | ${f3(s.costR)} | ${s.stop != null ? `${s.stopKind === 'mean' ? 'mean ' : ''}$${s.stop.toFixed(2)}` : 'not reported'} |`);
  L.push('');
  L.push('## The replicated rule beside the rest', '');
  L.push('| Study | Test | Window | n | Gross R | Gross t | Net R | Net t | Cost R | Median stop |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R.reference) L.push(`| ${r.topic} | ${r.test} | ${wl[r.window]} | ${r.n} | ${f3(r.gross)} | ${f2(r.tGross)} | ${f3(r.net)} | ${f2(r.tNet)} | ${f3(r.costR)} | ${fs$(r)} |`);
  L.push('');
  L.push(...reading(R), '');
  L.push('## Limits', '');
  L.push('- The studies used different windows (2016-20 | 2021-now for most intraday M5 rules, 2008-16 | 2017-26 for most daily ones, single windows for the two replications and the CPI study), different costs ($0.30 to $0.60 a round trip; financing on buys in some, none in others) and different definitions of 1R. A row of one study is not comparable to a row of another in more than a rough way.');
  L.push('- The tests are not independent: several are variants of one rule on the same days, some tests are subsets of others (gold-hourly-shock T3 is the non-release part of its T1), and every study reads the same gold history. The counts are counts of test-windows, not of independent pieces of evidence, and no p-value or pass / fail is attached to them.');
  L.push('- A fixed dollar cost divided by the stop makes cost R fall as the stop widens by arithmetic. The stop-cost correlation is that arithmetic; it is not a finding about markets.');
  L.push('- Gold\'s price rose a long way across these windows, so the same rule\'s stop in $ is wider in the later window than in the earlier one (gold-vol-breakout T1: $6.49 then $13.49). Stop $ and period are entangled in these rows.');
  L.push('- Most daily rules report their stop as an ATR multiple only, so they are missing from the $ bins; the bins mostly hold intraday rules.');
  L.push('- **Picking "wide stops" after seeing this table is itself data mining.** Any rule built on it needs its own pre-registration on data none of these 44 studies used, and little untouched gold history is left.', '');
  L.push('## Every test-window', '');
  L.push('| Study | Test | Window | TF | n | Gross R | Net R | Gross t | Net t | Cost R (gross − net) | Cost stored | Stop | Hold |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R.rows) L.push(`| ${r.topic} | ${r.test} ${r.name} | ${wl[r.window]} | ${r.tf} | ${r.n ?? 'not reported'} | ${f3(r.gross)} | ${f3(r.net)} | ${f2(r.tGross)} | ${f2(r.tNet)} | ${f3(r.costR)} | ${f3(r.costStored)} | ${fs$(r)}${r.stop == null && r.stopAtr == null ? ` (rule: ${r.stopRule})` : ''} | ${r.hold} |`);
  L.push('');
  L.push('## Each study\'s verdict (its own words)', '');
  L.push('| Study | Commit read | Cost assumption | Windows | Verdict |');
  L.push('|---|---|---|---|---|');
  for (const s of R.studies) L.push(`| ${s.topic} | ${s.commit.slice(0, 10)} | ${s.cost || 'not reported'} | ${s.windows || 'not reported'} | ${String(s.verdict).replace(/\|/g, '/')} |`);
  L.push('');
  return L.join('\n');
}

function reading(R) {
  const c = R.counts, b = R.bins, ref = R.reference, m = R.corr.medianOnly, [id, md] = R.byStyle;
  const v1 = ref.find((r) => r.topic === 'gold-vol-breakout' && r.window === 'is'), v2 = ref.find((r) => r.topic === 'gold-vol-breakout' && r.window === 'oos'), rp = ref.find((r) => r.topic === 'gold-vol-breakout-replicate');
  const flips = R.strong.filter((r) => r.net <= 0), fs = flips.filter((r) => r.stop != null).map((r) => r.stop);
  const flipStudies = [...new Set(flips.map((r) => r.topic))];
  const kept = R.strong.filter((r) => r.net > 0);
  return ['## Reading (plain English)', '',
    `- **Costs fall with the stop, as arithmetic says they must.** The median cost a trade is ${f3(b[0].cost)}R under a $3 stop, ${f3(b[1].cost)}R at $3-6, ${f3(b[2].cost)}R at $6-10, ${f3(b[3].cost)}R at $10-20 and ${f3(b[4].cost)}R at $20 and over (rank ${f2(m.stopVsCost)}). That is a fixed dollar cost divided by a wider stop, not a finding.`,
    `- **Gross R rises only weakly with the stop** (rank ${f2(m.stopVsGross)}). The bin medians are ${f3(b[0].gross)}, ${f3(b[1].gross)}, ${f3(b[2].gross)}, ${f3(b[3].gross)} and ${f3(b[4].gross)}R: near zero up to $10, higher in the two widest bins. The $10-20 bin mixes ${b[3].intraday} intraday and ${b[3].multiDay} multi-day test-windows (${b[3].tg2} reach gross t 2); the $20 and over bin is ${b[4].multiDay} multi-day test-windows of ${b[4].studies} studies held for days, of which ${b[4].tgReported} reports a gross t and ${b[4].tg2} reach gross t 2, so its higher median rests on figures whose noise is not known. Intraday and multi-day rules have about the same median gross R (${f3(id.gross)} and ${f3(md.gross)}R); they differ in cost (${f3(id.cost)} against ${f3(md.cost)}R) and so in net (${f3(id.net)} against ${f3(md.net)}R).`,
    `- **"Positive before costs, lost to costs" is real but narrow.** ${c.rowsGrossPosCostAbove} of ${c.rowsGrossPos} gross-positive test-windows are made negative by their cost (${id.costFlips} intraday, ${md.costFlips} multi-day), but most of these are small gross figures with gross t well under 2. Of the ${c.rowsTg15} gross-positive test-windows with gross t ≥ 1.5, ${flips.length} are made zero or negative by cost (${flipStudies.join(', ')}); every one of them that reports a median stop (${fs.length}) has it between $${Math.min(...fs).toFixed(2)} and $${Math.max(...fs).toFixed(2)}. The other ${kept.length} stay positive after cost but, apart from the replication, under net t 2: there the cost is small and the gross t was not 2 to begin with, or was cut under 2.`,
    `- **Many never had a gross effect to lose**:${c.usableRows - c.rowsGrossPos} of ${c.usableRows} test-windows are flat or negative before any cost, at every stop size, and ${c.rowsTgReported - c.rowsTg2} of the ${c.rowsTgReported} with a gross t do not reach gross t 2. Only ${c.testsBothTg2} tests reach gross t 2 in both windows, and both are the same rule family (${c.testsBothTg2List.join(', ')}).`,
    `- **The replicated rule stands out by its gross R more than by its stop.** gold-vol-breakout T1 had a median stop of $${v1.stop.toFixed(2)} in 2016-20 (cost ${f3(v1.costR)}R, net ${f3(v1.net)}R) and $${v2.stop.toFixed(2)} in 2021-now (cost ${f3(v2.costR)}R, net ${f3(v2.net)}R); its 2007-15 replication had $${rp.stop.toFixed(2)} (cost ${f3(rp.costR)}R) and kept ${f3(rp.net)}R net because its gross was ${f3(rp.gross)}R (gross t ${f2(rp.tGross)}). Its stops sit in the middle of the table (the intraday median is $${id.stop.toFixed(2)}); its consistent gross R is what sets it apart.`,
    '- **So the story holds in part.** Tight stops did turn a handful of real-looking gross effects (the London first-hour breakout above all) into losses, and a wider stop makes any given gross R cheaper to trade. But a wide stop does not create gross R, most of these rules had none, and this table cannot say whether any rule would survive with a wider stop: changing the stop changes the rule, and that is a new test with its own pre-registration, not a reading of this one.'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'collect') collect();
  const collected = JSON.parse(fs.readFileSync(path.join(DIR, 'collected.json'), 'utf8'));
  const R = build(collected);
  fs.writeFileSync(path.join(DIR, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(DIR, 'RESULT.md'), render(R));
  console.log(headline(R), headline(R).length);
  console.log(JSON.stringify({ counts: R.counts, bins: R.bins, corr: R.corr }, null, 1));
}
