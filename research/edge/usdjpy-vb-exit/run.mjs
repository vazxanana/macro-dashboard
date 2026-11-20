// Edge research · usdjpy-vb-exit: does USD/JPY T1 depend on its 21:00 UTC exit and its 00:00 UTC day? (PREREGISTRATION.md,
// pushed alone first). Paper research only: the rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC.
//   node research/edge/usdjpy-vb-exit/run.mjs <dir with usdjpy-5m-early.json.gz> <dir with usdjpy-5m.json.gz>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, summary, normP, holm, EXIT_S } from '../index-vol-breakout/original.mjs';
import { charge } from '../fx-vol-breakout/run.mjs';
import { buildNyDays, nySkip } from '../gold-vol-breakout-k/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const K = 0.5, H = 3600;
export const EXITS = { '12:00': 12 * H, '15:00': 15 * H, '18:00': 18 * H, '21:00': 21 * H };
export const WIN = { early: ['2005-01-04', '2015-12-31'], late: ['2016-01-01', '2026-11-19'] };
export const GATE = { early: { n: 2089, netR: 0.079 }, late: { n: 2079, netR: 0.063 } };
export const ALTS = ['exit 12:00', 'exit 15:00', 'exit 18:00', 'day from 17:00 New York'];
const inW = (day, [a, b]) => day >= a && day <= b;
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

// the day's candles from 00:00 UTC up to the one ending at the exit (21:00 = the rule's own candles)
export const barsTo = (d, exitS) => d.bars.filter((b) => b.t - d.d0 < exitS);   // the last starts at exit − 5 min
// usdjpy-vol-breakout-early's `trades` calls, with the candles handed over as the only change
export function tradesExit(days, exitS = EXIT_S) {
  const tr = [];
  for (const d of days) {
    if (daySkip(d)) continue;
    const x = vbTrade(exitS === EXIT_S ? d.bars : barsTo(d, exitS), { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (!x.skip) tr.push({ day: d.day, ...charge('usdjpy', x) });
  }
  return tr;
}
// gold-vol-breakout-k's nyTrades with the forex charge (its own nyTrades charges gold's $0.60)
export function tradesNy(nyDays, w, inclusive = true) {
  const tr = [];
  for (const d of nyDays) {
    if (!inW(d.day, w) || nySkip(d, inclusive)) continue;
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (!x.skip) tr.push({ day: d.day, ...charge('usdjpy', x) });
  }
  return tr;
}
export const cell = (tr) => { const s = summary(tr); return { n: s.n, win: s.win, netR: s.netR, grossR: s.grossR, net2R: s.net2R, t: s.t, grossT: s.grossT, stops: s.stops, time: s.time, maxDD: s.maxDD, total: s.total }; };
export const rowOf = (e, l) => ({ early: cell(e), late: cell(l), pooled: cell([...e, ...l]) });
// the pre-registered reading over the four alternatives
export function reading(alts) {
  const posBoth = alts.every((a) => a.early.netR > 0 && a.late.netR > 0), t2 = alts.filter((a) => a.pooled.t >= 2).length;
  return { posBoth, t2, broad: posBoth && t2 >= 3, label: posBoth && t2 >= 3 ? 'BROAD' : 'NARROW' };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const L = ['# USD/JPY T1: does it depend on the 21:00 UTC exit and the 00:00 UTC day? (20 Nov 2026)', '',
    'Paper research only. Settings, gate and reading were fixed in `PREREGISTRATION.md` (pushed alone before any figure at another setting was computed; sha256 in `result.json`). The rule\'s functions come unchanged from `index-vol-breakout/original.mjs`, the cost from `fx-vol-breakout` `charge`, the 17:00 New York days from `gold-vol-breakout-k`. **Nothing is adopted**: the rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC. Nothing live changed.', '',
    `**Verdict: ${R.verdict}**`, '',
    `Gate: exit 21:00 / 00:00 UTC day reproduces both published studies (early n ${R.gate.got.early.n}, ${sg(R.gate.got.early.netR)}R; late n ${R.gate.got.late.n}, ${sg(R.gate.got.late.netR)}R): ${R.gate.ok ? 'yes' : 'no'}; the exit-filter path at 21:00 gives ${R.gate.same} of ${R.gate.of} trades identical.`, '',
    '| Setting | 2005-15 n / net / month t | 2016 → 2026-11-19 n / net / month t | Pooled n | Net R | Gross R | Net 2x cost | Win | Month t | Gross t | Holm p |',
    '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const s of R.settings) {
    const x = s.row, h = R.holm.find((q) => q.name === s.name);
    L.push(`| ${s.name} | ${x.early.n} / ${sg(x.early.netR)} / ${sg(x.early.t, 2)} | ${x.late.n} / ${sg(x.late.netR)} / ${sg(x.late.t, 2)} | ${x.pooled.n} | ${sg(x.pooled.netR)} | ${sg(x.pooled.grossR)} | ${sg(x.pooled.net2R)} | ${(x.pooled.win * 100).toFixed(1)} % | ${sg(x.pooled.t, 2)} | ${sg(x.pooled.grossT, 2)} | ${h ? (h.pHolm < 0.001 ? '< 0.001' : h.pHolm) : '—'} |`);
  }
  L.push('', `Reading (pre-registered): net R > 0 in both windows at all four alternatives: ${R.reading.posBoth ? 'yes' : 'no'}; pooled month t ≥ 2 at ${R.reading.t2} of 4 (3 needed): **${R.reading.label}**.`, '',
    '**What it says.** ' + R.text, '',
    `Data: OANDA mid M5 USD/JPY, ${R.data}. Cost: commission 0.000045 of the entry + 0.5 pip a round trip, no financing (no variant holds over the 17:00 New York rollover). The 17:00 New York day's open is read inclusively (first candle within 60 minutes of the anchor); the strict reading is the last row.`, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2);
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex') !== ORIG_SHA) throw new Error('original.mjs changed');
  const rowsOf = (f) => { const r = JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); r.sort((p, q) => p[0] - q[0]); return r; };
  const RE = rowsOf(path.join(a, 'usdjpy-5m-early.json.gz')), RL = rowsOf(path.join(b, 'usdjpy-5m.json.gz'));
  const E = buildDays(RE).filter((d) => inW(d.day, WIN.early)), Ld = buildDays(RL).filter((d) => inW(d.day, WIN.late));
  // gate
  const e0 = tradesExit(E), l0 = tradesExit(Ld), got = { early: cell(e0), late: cell(l0) };
  const ok = ['early', 'late'].every((w) => got[w].n === GATE[w].n && got[w].netR === GATE[w].netR);
  const f0 = [...tradesExit(E, EXIT_S - 1), ...tradesExit(Ld, EXIT_S - 1)], b0 = [...e0, ...l0];   // EXIT_S - 1 forces the filter path
  const same = b0.filter((x, i) => f0[i] && JSON.stringify(x) === JSON.stringify(f0[i])).length;
  console.log('gate', ok, JSON.stringify(got.early), JSON.stringify(got.late), same, b0.length, f0.length);
  if (!ok || same !== b0.length || f0.length !== b0.length) { console.log('GATE FAILED: stop'); process.exit(2); }
  const settings = [];
  for (const [e, s] of Object.entries(EXITS)) settings.push({ name: e === '21:00' ? 'exit 21:00 (rule)' : `exit ${e}`, row: rowOf(tradesExit(E, s), tradesExit(Ld, s)) });
  const NE = buildNyDays(RE), NL = buildNyDays(RL);
  settings.push({ name: 'day from 17:00 New York', row: rowOf(tradesNy(NE, WIN.early), tradesNy(NL, WIN.late)) });
  settings.push({ name: 'day from 17:00 New York, strict open', row: rowOf(tradesNy(NE, WIN.early, false), tradesNy(NL, WIN.late, false)) });
  const alts = ALTS.map((n) => settings.find((s) => s.name === n).row), rd = reading(alts);
  const ps = alts.map((x) => normP(x.pooled.t)), adj = holm(ps), holmRows = ALTS.map((n, i) => ({ name: n, p: r3(ps[i]), pHolm: r3(adj[i]) }));
  const rule = settings[3].row, S = (n) => settings.find((s) => s.name === n).row.pooled;
  const verdict = `${rd.label}: USD/JPY T1 net R ${rd.posBoth ? 'positive in 2005-15 and 2016 → now at every alternative' : 'not positive in both windows at every alternative'} (exits 12:00 / 15:00 / 18:00 UTC, 17:00 New York day), pooled month t ≥ 2 at ${rd.t2} of 4; rule ${sg(rule.pooled.netR)}R (n ${rule.pooled.n}, t ${sg(rule.pooled.t, 2)}); the rule stays as it is`;
  for (const s of settings) console.log(s.name, JSON.stringify(s.row.pooled), s.row.early.netR, s.row.late.netR);
  const neg = settings.flatMap((s) => ['early', 'late'].filter((w) => s.row[w].netR <= 0).map((w) => `${s.name} ${w === 'early' ? '2005-15' : '2016 →'} (${sg(s.row[w].netR)}R)`));
  const text = `Net R a trade pooled: ${settings.slice(0, 5).map((s) => `${s.name} ${sg(s.row.pooled.netR)} (t ${sg(s.row.pooled.t, 2)})`).join(', ')}. `
    + `Before costs: ${settings.slice(0, 5).map((s) => `${s.name} ${sg(s.row.pooled.grossR)}`).join(', ')}. `
    + (neg.length ? `Windows with net R ≤ 0: ${neg.join(', ')}. ` : 'Net R is positive in both windows at every setting. ')
    + `At 2x costs pooled: ${settings.slice(0, 5).map((s) => `${s.name} ${sg(s.row.pooled.net2R)}`).join(', ')}. `
    + `Cautions: the 12:00 exit is thin in 2016 → now (${sg(settings[0].row.late.netR)}R, month t ${sg(settings[0].row.late.t, 2)}) and near zero at 2x costs, and the 17:00 New York day keeps about two thirds of the rule's net R (${sg(S('day from 17:00 New York').netR)}R against ${sg(rule.pooled.netR)}R; ${sg(S('day from 17:00 New York').net2R)}R at 2x costs), so the margin over costs moves with where the day is cut and how long the trade is held; the sign does not. `
    + `The strict reading of the New York open keeps ${S('day from 17:00 New York, strict open').n} trades (${sg(S('day from 17:00 New York, strict open').netR)}R). `
    + 'None of this selects a setting: every cell was read on data already used for the rule, so a better-looking exit or anchor would need its own pre-registration on untouched history, and none is left. Paper research; nothing live changes and no proposal is written.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'usdjpy-vb-exit', title: 'USD/JPY T1: exit time and day anchor', built: '2026-11-20', preregistration: 'research/edge/usdjpy-vb-exit/PREREGISTRATION.md', planSha256: sha,
    verdict, reading: rd, gate: { want: GATE, got, ok, same, of: b0.length }, windows: WIN, k: K, settings, holm: holmRows, text,
    data: `early cache ${new Date(RE[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(RE.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${RE.length} candles), late cache ${new Date(RL[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(RL.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${RL.length} candles); windows ${WIN.early.join(' → ')} and ${WIN.late.join(' → ')}` };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(verdict);
}
