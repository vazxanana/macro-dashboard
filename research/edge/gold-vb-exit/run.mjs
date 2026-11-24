// Edge research · gold-vb-exit: does gold T1 depend on its 21:00 UTC exit and its 00:00 UTC day, at the demo's measured hourly
// cost (gold-vol-breakout-hourcost's C1, frozen)? The twin of usdjpy-vb-exit (PREREGISTRATION.md, pushed alone first). Paper
// research only: the rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC; nothing is adopted.
//   node research/edge/gold-vb-exit/run.mjs [<dir with 5m-YYYY.json.gz of xau>]   (default: the toolkit cache's xau folder)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { medRange, daysOf } from '../gold-vol-breakout-hourcost/costs.mjs';
import { barsFor, buildNyDays, nySkip } from '../gold-vol-breakout-k/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHA = {
  'gold-vol-breakout-hourcost/original.mjs': 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f',
  'gold-vol-breakout-hourcost/costs.mjs': 'c753937339a0e5531c011bb4ed6473a1e4f9682e28c203cac20152f7891c922a',
  'gold-vol-breakout-k/original.mjs': 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f',
  'gold-vol-breakout-hourcost/result.json': 'fd5990419496374fd1d7c1791f778bd250d1b350064e7386d18de8a82b38325b',
};
export const K = 0.5, H = 3600, DAY = 86400, SLIP = 0.05, EARLY_MIN = 360;
export const EXITS = { '12:00': 12 * H, '15:00': 15 * H, '18:00': 18 * H, '21:00': 21 * H };
export const SPAN = { from: '2006-11-01', to: '2026-11-14' };            // rows kept: from ≤ t < to (the loader drops the last day)
export const WIN = { early: ['2007-01-01', '2015-12-31'], late: ['2016-01-01', '2026-11-12'] };
export const HC_WIN = { W1: ['2007-01-01', '2011-12-31'], W2: ['2012-01-01', '2015-12-31'], W3: ['2016-01-01', '2020-12-31'], W4: ['2021-01-01', '2026-12-31'], POOLED: ['2007-01-01', '2026-12-31'] };
export const ALTS = ['exit 12:00', 'exit 15:00', 'exit 18:00', 'day from 17:00 New York'];
export const COMBOS = ['12:00', '15:00', '18:00', '21:00'].map((e) => `early fills, exit ${e}`);
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdv = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// ─── cost C1 (hourcost's route H + 0.05 × M, frozen), the exit half charged at the window's last hour ───
export const exitHourOf = (exitS) => Math.floor((exitS - 300) / H);                    // 21:00 → 20 (hourcost's EXIT_HOUR)
export const costFrac = (profile, fillH, exitH, commission) => 0.5 * profile[fillH].frac + 0.5 * profile[exitH].frac + commission;
export function priced(x, { profile, commission }, exitH) {
  const c = (costFrac(profile, Math.floor(x.fillMin / 60), exitH, commission) * x.entry + SLIP * x.M) / x.r;
  return { day: x.day, side: x.side, how: x.how, fillMin: x.fillMin, r: x.r, R: x.R, finR: x.finR, cost: c, net: x.R - x.finR - c, net2: x.R - 2 * x.finR - 2 * c };
}
// one rule trade on the candles handed over, with its slippage base M
function one(d, bars, C, exitH) {
  const x = O.vbTrade(bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
  if (x.skip) return null;
  const i = bars.findIndex((b) => b.t === x.fillT);
  return priced({ day: d.day, ...x, M: medRange(bars, i) }, C, exitH);
}
// T1 at a UTC exit on the original's eligible days (daySkip on the 00:00-20:55 candles)
export function tradesExit(days, full, C, exitS = O.EXIT_S) {
  const tr = [];
  for (const d of days) { if (O.daySkip(d)) continue; const t = one(d, barsFor(d, full, exitS), C, exitHourOf(exitS)); if (t) tr.push(t); }
  return tr;
}
// the 17:00 New York day, orders and hold 21 h from the anchor
export function tradesNy(nyDays, w, C, inclusive = true) {
  const tr = [];
  for (const d of nyDays) {
    if (!inW(d.day, w) || nySkip(d, inclusive)) continue;
    const exitH = new Date((d.d0 + 21 * H - 300) * 1000).getUTCHours(), t = one(d, d.bars, C, exitH);
    if (t) tr.push(t);
  }
  return tr;
}
export const early = (tr) => tr.filter((x) => x.fillMin < EARLY_MIN), late = (tr) => tr.filter((x) => x.fillMin >= EARLY_MIN);

// ─── statistics ───
export function cell(tr) {
  const mt = O.monthT(tr), gt = O.monthT(tr, 'R');
  let eq = 0, pk = 0, dd = 0; for (const x of tr) { eq += x.net; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n: tr.length, win: r3(tr.filter((x) => x.net > 0).length / (tr.length || 1)), netR: r3(mean(tr.map((x) => x.net))), grossR: r3(mean(tr.map((x) => x.R))),
    net2R: r3(mean(tr.map((x) => x.net2))), total: r2(tr.reduce((s, x) => s + x.net, 0)), t: r2(mt.t), grossT: r2(gt.t), tRaw: mt.t,
    stops: tr.filter((x) => x.how === 'stop').length, time: tr.filter((x) => x.how === 'time').length, maxDD: r2(dd) };
}
export const rowOf = (tr) => ({ early: cell(tr.filter((x) => inW(x.day, WIN.early))), late: cell(tr.filter((x) => inW(x.day, WIN.late))), pooled: cell(tr.filter((x) => inW(x.day, [WIN.early[0], WIN.late[1]]))) });
export function welch(a, b) { const va = sdv(a) ** 2 / a.length, vb = sdv(b) ** 2 / b.length; return (mean(a) - mean(b)) / Math.sqrt(va + vb); }

// the pre-registered reading over the four alternatives
export function reading(alts) {
  const posBoth = alts.every((a) => a.early.netR > 0 && a.late.netR > 0), t2 = alts.filter((a) => a.pooled.t >= 2).length;
  const nonPos = alts.filter((a) => !(a.pooled.netR > 0)).length;
  const label = posBoth && t2 >= 3 ? 'BROAD' : nonPos >= 2 || t2 === 0 ? 'FAIL' : 'NARROW';
  return { posBoth, t2, nonPos, label };
}
export const comboHolds = (row, pHolm) => row.pooled.netR > 0 && row.early.netR > 0 && row.late.netR > 0 && pHolm < 0.05;

// placebo at a UTC exit: a market entry at a random 5-minute candle 01:00 → exit − 3 h, charged C1
export function placebo(pool, full, C, exitS, seeds = O.SEEDS) {
  const from = 1 * H, to = exitS - 3 * H, grid = (to - from) / 300 + 1, exitH = exitHourOf(exitS), res = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = O.rng(seed), net = [];
    for (const d of pool) {
      const startT = d.d0 + from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1, bars = barsFor(d, full, exitS);
      const x = O.placeboTrade(bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (!x) continue;
      const i = bars.findIndex((b) => b.t >= startT);
      net.push(priced({ day: d.day, ...x, fillMin: (bars[i].t - d.d0) / 60, M: medRange(bars, i) }, C, exitH).net);
    }
    res.push(mean(net));
  }
  return res;
}

// ─── report (RESULT.md is this function of result.json) ───
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const pf = (p) => (p == null ? '—' : p < 0.001 ? '< 0.001' : String(p));
export function report(R) {
  const L = ['# Gold T1: does it depend on the 21:00 UTC exit and the 00:00 UTC day, at the measured hourly cost? (24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Settings, combinations, gate and reading were fixed in `PREREGISTRATION.md` (pushed alone before any figure at another exit was computed under this cost; sha256 in `result.json`). The rule\'s functions come unchanged from `gold-vol-breakout-hourcost/original.mjs` (the verbatim `gold-vol-breakout` code) and `costs.mjs`, the exit candles and the 17:00 New York days from `gold-vol-breakout-k`; the cost is that study\'s C1, frozen from its `result.json`. **Nothing is adopted**: the rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC, every fill time. Nothing live changed and no proposal is written.', '',
    `Gate: at 21:00 / 00:00 UTC, C1 reproduces gold-vol-breakout-hourcost's published grid in every window (${Object.entries(R.gate.windows).map(([w, g]) => `${w} n ${g.got.n} ${sg(g.got.netR)}R t ${sg(g.got.t, 2)}`).join('; ')}): ${R.gate.ok ? 'yes, exactly' : 'NO'}; the exit-filter path at 21:00 gives ${R.gate.same} of ${R.gate.of} trades identical.`, '',
    '## Exits and day anchor (net R a trade after C1; month t of calendar-month sums)', '',
    '| Setting | 2007-15 n / net / month t | 2016 → 2026-11-12 n / net / month t | Pooled n | Net R | Gross R | Net 2x cost | Win | Month t | Gross t | Total R | Worst DD R | Holm p (8) | Placebos beaten (of 40) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const s of R.settings) {
    const x = s.row, h = R.holm.find((q) => q.name === s.name);
    L.push(`| ${s.name} | ${x.early.n} / ${sg(x.early.netR)} / ${sg(x.early.t, 2)} | ${x.late.n} / ${sg(x.late.netR)} / ${sg(x.late.t, 2)} | ${x.pooled.n} | ${sg(x.pooled.netR)} | ${sg(x.pooled.grossR)} | ${sg(x.pooled.net2R)} | ${(x.pooled.win * 100).toFixed(1)} % | ${sg(x.pooled.t, 2)} | ${sg(x.pooled.grossT, 2)} | ${sg(x.pooled.total, 1)} | ${sg(x.pooled.maxDD, 1)} | ${h ? pf(h.pHolm) : '—'} | ${s.placebo == null ? '—' : s.placebo} |`);
  }
  L.push('', `Reading (pre-registered): net R > 0 in both windows at all four alternatives: ${R.reading.posBoth ? 'yes' : 'no'}; pooled month t ≥ 2 at ${R.reading.t2} of 4 (3 needed); pooled net R ≤ 0 at ${R.reading.nonPos} of 4 (2 = FAIL): **${R.reading.label}**.`, '',
    '## The four pre-registered combinations: early fills only (fill candle before 06:00 UTC) × each UTC exit', '',
    '| Combination | 2007-15 n / net / month t | 2016 → n / net / month t | Pooled n | Net R | Net 2x | Month t | Holm p (8) | Holds | Late fills, same exit: n / net | Early − late, Welch t |',
    '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of R.combos) {
    const x = c.row;
    L.push(`| ${c.name} | ${x.early.n} / ${sg(x.early.netR)} / ${sg(x.early.t, 2)} | ${x.late.n} / ${sg(x.late.netR)} / ${sg(x.late.t, 2)} | ${x.pooled.n} | ${sg(x.pooled.netR)} | ${sg(x.pooled.net2R)} | ${sg(x.pooled.t, 2)} | ${pf(c.pHolm)} | ${c.holds ? 'yes' : 'no'} | ${c.lateRow.n} / ${sg(c.lateRow.netR)} | ${sg(c.diff)} / ${sg(c.welchT, 2)} |`);
  }
  L.push('', `Combinations holding (pooled net > 0, both windows > 0, Holm p < 0.05): ${R.combos.filter((c) => c.holds).length} of 4. They do not change the label; a combination that holds is a hypothesis, not a rule.`, '',
    '**What it says.** ' + R.text, '',
    `Data: ${R.data}. Cost C1: half the demo's median quoted spread share of the fill hour + half that of the exit window's last hour + commission ${R.cost.commission} of the entry + 0.05 × M (median high − low of the 12 M5 candles ending with the fill candle), plus the trade's financing on a buy held over the 22:00 UTC rollover (only the 17:00 New York day can); 2x = twice cost and financing. Placebo: 40 seeded random market entries from 01:00 UTC to the exit − 3 h, stop 0.5 × the previous day's range, charged the same.`, '');
  return L.join('\n');
}

// ─── the run ───
export function loadRows(dir) {
  const a = Date.parse(SPAN.from + 'T00:00:00Z') / 1000, b = Date.parse(SPAN.to + 'T00:00:00Z') / 1000, rows = [], seen = new Set();
  for (const f of fs.readdirSync(dir).filter((f) => /^5m-\d{4}\.json\.gz$/.test(f)).sort()) for (const r of JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))) if (r[0] >= a && r[0] < b && !seen.has(r[0])) { seen.add(r[0]); rows.push(r.slice(0, 5)); }
  return rows.sort((p, q) => p[0] - q[0]);
}
// the full UTC day's candles (as gold-vol-breakout-k's load builds them), from rows already cut by daysOf's rule
export function fullOf(rows) {
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, full = new Map();
  for (const r of rows) { if (r[0] >= lastFull) continue; const d0 = Math.floor(r[0] / DAY) * DAY; if (!full.has(d0)) full.set(d0, []); full.get(d0).push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4] }); }
  return full;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const edge = path.join(HERE, '..');
  for (const [f, want] of Object.entries(SHA)) if (crypto.createHash('sha256').update(fs.readFileSync(path.join(edge, f))).digest('hex') !== want) throw new Error(f + ' changed');
  const HC = JSON.parse(fs.readFileSync(path.join(edge, 'gold-vol-breakout-hourcost', 'result.json')));
  const C = { profile: HC.profile, commission: HC.commission };
  const { DATA_DIR } = await import('../_lib/edgekit.mjs');
  const dir = process.argv[2] || path.join(DATA_DIR, 'xau');
  const rows = loadRows(dir), { days, dataEnd } = daysOf(rows.map((r) => [...r])), full = fullOf(rows);
  if (dataEnd !== WIN.late[1]) throw new Error('data end ' + dataEnd);
  // gate 1: hourcost's C1 grid, exactly
  const rule = tradesExit(days, full, C), gw = {}; let ok = true;
  for (const [w, win] of Object.entries(HC_WIN)) {
    const c = cell(rule.filter((x) => inW(x.day, win))), want = HC.grid.H['0.05'][w];
    const got = { n: c.n, netR: c.netR, grossR: c.grossR, total: c.total, t: c.t, grossT: c.grossT };
    const g = Object.keys(want).every((k) => got[k] === want[k]); ok &&= g; gw[w] = { got, want, ok: g };
  }
  // gate 2: the filter path at 21:00 − 1 s
  const f0 = tradesExit(days, full, C, O.EXIT_S - 1), same = rule.filter((x, i) => f0[i] && JSON.stringify(x) === JSON.stringify(f0[i])).length;
  console.log('gate', ok, same, rule.length, f0.length);
  if (!ok || same !== rule.length || f0.length !== rule.length) { console.log('GATE FAILED: stop', JSON.stringify(gw)); process.exit(2); }
  const inAll = (tr) => tr.filter((x) => inW(x.day, [WIN.early[0], WIN.late[1]]));
  const pool = days.filter((d) => inW(d.day, [WIN.early[0], WIN.late[1]]) && !O.daySkip(d));
  const byExit = {}, settings = [];
  for (const [e, s] of Object.entries(EXITS)) {
    byExit[e] = s === O.EXIT_S ? rule : tradesExit(days, full, C, s);
    const pm = cell(inAll(byExit[e])).netR, pl = placebo(pool, full, C, s);
    settings.push({ name: e === '21:00' ? 'exit 21:00 (rule)' : `exit ${e}`, row: rowOf(byExit[e]), placebo: pl.filter((v) => pm > v).length, placeboMean: r3(mean(pl)) });
    console.log(e, JSON.stringify(settings.at(-1).row.pooled));
  }
  const NY = buildNyDays(rows.filter((r) => r[0] < Math.floor(rows.at(-1)[0] / DAY) * DAY));
  const ny = (inc) => [...tradesNy(NY, WIN.early, C, inc), ...tradesNy(NY, WIN.late, C, inc)];
  settings.push({ name: 'day from 17:00 New York', row: rowOf(ny(true)), placebo: null });
  settings.push({ name: 'day from 17:00 New York, strict open', row: rowOf(ny(false)), placebo: null });
  const altRows = ALTS.map((n) => settings.find((s) => s.name === n).row), rd = reading(altRows);
  const combos = Object.keys(EXITS).map((e, i) => {
    const E = early(byExit[e]), Lt = late(byExit[e]), Ep = inAll(E).map((x) => x.net), Lp = inAll(Lt).map((x) => x.net);
    return { name: COMBOS[i], exit: e, row: rowOf(E), lateRow: cell(inAll(Lt)), diff: r3(mean(Ep) - mean(Lp)), welchT: r2(welch(Ep, Lp)) };
  });
  const tests = [...ALTS.map((n, i) => ({ name: n, t: altRows[i].pooled.tRaw })), ...combos.map((c) => ({ name: c.name, t: c.row.pooled.tRaw }))];
  const ps = tests.map((x) => O.normP(x.t)), adj = O.holm(ps), holmRows = tests.map((x, i) => ({ name: x.name, p: r3(ps[i]), pHolm: r3(adj[i]) }));
  for (const c of combos) { c.pHolm = holmRows.find((h) => h.name === c.name).pHolm; c.holds = comboHolds(c.row, c.pHolm); }
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'tRaw' ? undefined : v)));
  const S = (n) => settings.find((s) => s.name === n).row, rr = S('exit 21:00 (rule)').pooled, held = combos.filter((c) => c.holds);
  const verdict = `${rd.label}: gold T1 at the measured hourly cost (C1), pooled 2007 → 2026-11-12: ${ALTS.map((n) => `${n} ${sg(S(n).pooled.netR)}R (t ${sg(S(n).pooled.t, 2)})`).join(', ')}, against the rule's 21:00 ${sg(rr.netR)}R (n ${rr.n}, t ${sg(rr.t, 2)}); net R > 0 in both windows at all four: ${rd.posBoth ? 'yes' : 'no'}, month t ≥ 2 at ${rd.t2} of 4; early-fill combinations holding: ${held.length} of 4; the rule stays as it is`;
  const neg = settings.flatMap((s) => ['early', 'late'].filter((w) => !(s.row[w].netR > 0)).map((w) => `${s.name} ${w === 'early' ? '2007-15' : '2016 →'} (${sg(s.row[w].netR)}R)`));
  const best = [...settings.slice(0, 4)].sort((a, b) => b.row.pooled.netR - a.row.pooled.netR)[0];
  const text = `Before costs, pooled: ${settings.slice(0, 5).map((s) => `${s.name} ${sg(s.row.pooled.grossR)}`).join(', ')}; C1 takes about ${sg(rr.grossR - rr.netR)}R a trade at 21:00. `
    + (neg.length ? `Windows with net R ≤ 0: ${neg.join(', ')}. ` : 'Net R is positive in both windows at every setting. ')
    + `At 2x cost pooled: ${settings.slice(0, 5).map((s) => `${s.name} ${sg(s.row.pooled.net2R)}`).join(', ')}. `
    + (best.name === 'exit 21:00 (rule)'
      ? `No alternative exit nets more than the rule's own 21:00 (${sg(best.row.pooled.netR)}R a trade): on gold the later the exit the more the trade keeps (USD/JPY peaked at 15:00 in usdjpy-vb-exit); the earlier exits keep most of it in both windows, so the result does not hang on the exact exit hour. `
      : `The highest-looking UTC exit is ${best.name} (${sg(best.row.pooled.netR)}R); it is NOT adopted: every cell was read on data the rule was built and checked on. `)
    + `The 17:00 New York day is the weak setting: positive in both windows but only ${sg(S('day from 17:00 New York').late.netR)}R (month t ${sg(S('day from 17:00 New York').late.t, 2)}) in 2016 →, worst drawdown ${sg(S('day from 17:00 New York').pooled.maxDD, 1)}R, so where the day is cut matters more than when it ends (18:00 and the New York day had been seen at $0.60 in gold-vol-breakout-k, 12:00 and 15:00 had not). `
    + `Early fills (before 06:00 UTC): ${combos.map((c) => `exit ${c.exit} ${sg(c.row.pooled.netR)}R (n ${c.row.pooled.n}, t ${sg(c.row.pooled.t, 2)}${c.holds ? ', holds' : ''})`).join(', ')}; the late fills at 21:00 ${sg(combos[3].lateRow.netR)}R (n ${combos[3].lateRow.n}). The early split at 21:00 had been seen (holdout-vb-early, vb-early-exec), so none of these is new evidence. `
    + `The 17:00 New York day's strict open keeps ${S('day from 17:00 New York, strict open').pooled.n} trades (${sg(S('day from 17:00 New York, strict open').pooled.netR)}R), almost none after 2015, when the feed's first candle of that day starts exactly 60 minutes after the anchor (the reason the inclusive reading is the main one). `
    + `The early-fill combinations hold at ${held.length} of 4 exits; early minus late is ${combos.map((c) => `${sg(c.diff)}R (Welch t ${sg(c.welchT, 2)})`).join(', ')} at 12:00 / 15:00 / 18:00 / 21:00. The early split was seen before on these years, so this is a hypothesis for the forward records (vb-early-forward), not a rule. `
    + 'Cautions: today\'s relative spread is charged on every past year (in 2007 a retail gold spread was surely wider), the stop-order slippage is assumed (0.05 × M), and OANDA mid candles are not broker fills. Paper research; nothing live changes and no proposal is written.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = strip({ study: 'gold-vb-exit', title: 'Gold T1: exit time and day anchor at the measured hourly cost', built: '2026-11-24', preregistration: 'research/edge/gold-vb-exit/PREREGISTRATION.md', planSha256: sha,
    verdict, reading: rd, gate: { ok, windows: gw, same, of: rule.length }, windows: WIN, k: K,
    cost: { from: 'gold-vol-breakout-hourcost result.json (route H + 0.05 × M)', sha256: SHA['gold-vol-breakout-hourcost/result.json'], commission: C.commission, slip: SLIP },
    settings, combos, holm: holmRows, text,
    data: `OANDA mid XAU/USD M5 from the toolkit cache (${rows.length} candles, ${new Date(rows[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(rows.at(-1)[0] * 1000).toISOString().slice(0, 10)}; the loader drops the last, forming day: data end ${dataEnd}); windows ${WIN.early.join(' → ')} and ${WIN.late.join(' → ')}` });
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(verdict);
}
