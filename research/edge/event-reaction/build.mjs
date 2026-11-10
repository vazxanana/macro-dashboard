// Gold's reaction to US red-folder releases (CPI, NFP, FOMC), for the veteran's event playbook (9 Nov 2026).
// Pre-registration: preregistration.md (written first). Paper research only: nothing live reads a rule from here.
//
//   node research/edge/event-reaction/build.mjs <council-data checkout>
//
// Needs research/candles/{xau,udx}-histdata (HistData M1) in the checkout. Clock: the files are labelled "EST without DST",
// but the release spikes say otherwise: CPI 08:30 New York sits at file time 08:30 in July (2019, 2024, 2026) and the FOMC
// of 3 Nov 2021 (14:00 EDT, after Europe's clocks went back) at 13:00. The file clock is UTC−5, and UTC−4 while Europe is
// on summer time (last Sunday of March to last Sunday of October), and New York time in 2018: council/histdata.mjs. Writes:
//   council/event-base.json                    per-event rows the veteran reads (council/playbook.mjs; no fetch at run time)
//   research/edge/event-reaction/result.json   the rows' summary and the one pre-registered test
//   research/edge/event-reaction/RESULT.md     the written result
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS, zonedToUtc } from '../../../council/events.mjs';
import { READ_PCT, readOf, binomUpper, testRows, median } from '../../../council/playbook.mjs';
import { histToUtc } from '../../../council/histdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../../..');
const CD = process.argv[2];
if (!CD) { console.error('usage: node research/edge/event-reaction/build.mjs <council-data checkout>'); process.exit(1); }

// BLS CPI release dates 2018-2021 (bls.gov/schedule/news_release/cpi.htm archives); each is kept only if it passes the
// release-minute spike check below (preregistration.md)
const CPI_EARLY = ['2018-01-12', '2018-02-14', '2018-03-13', '2018-04-11', '2018-05-10', '2018-06-12', '2018-07-12', '2018-08-10', '2018-09-13', '2018-10-11', '2018-11-14', '2018-12-12',
  '2019-01-11', '2019-02-13', '2019-03-12', '2019-04-10', '2019-05-10', '2019-06-12', '2019-07-11', '2019-08-13', '2019-09-12', '2019-10-10', '2019-11-13', '2019-12-11',
  '2020-01-14', '2020-02-13', '2020-03-11', '2020-04-10', '2020-05-12', '2020-06-10', '2020-07-14', '2020-08-12', '2020-09-11', '2020-10-13', '2020-11-12', '2020-12-10',
  '2021-01-13', '2021-02-10', '2021-03-10', '2021-04-13', '2021-05-12', '2021-06-10', '2021-07-13', '2021-08-11', '2021-09-14', '2021-10-13', '2021-11-10', '2021-12-10'];
// the shared HistData clock (council/histdata.mjs, 10 Nov 2026): this study's Amendment 1 rule, plus New York time in 2018
const T0 = Date.UTC(2018, 0, 1) / 1000, T1 = Date.UTC(2026, 10, 1) / 1000, NMIN = Math.ceil((T1 - T0) / 60);

// ── HistData M1 into minute-indexed arrays (close, high, low; NaN = no bar) ──
function loadM1(sub, pre) {
  const dir = path.join(CD, 'research', 'candles', sub), C = new Float64Array(NMIN).fill(NaN), H = new Float64Array(NMIN).fill(NaN), L = new Float64Array(NMIN).fill(NaN);
  const files = fs.readdirSync(dir).filter((f) => f.startsWith(pre) && f.endsWith('.csv.gz')).sort();
  let n = 0;
  for (const f of files) for (const ln of zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString().split('\n')) {
    if (ln.length < 20) continue; const p = ln.split(';');
    const t = histToUtc(+ln.slice(0, 4), +ln.slice(4, 6), +ln.slice(6, 8), +ln.slice(9, 11), +ln.slice(11, 13)), i = (t - T0) / 60;
    if (i < 0 || i >= NMIN) continue; H[i] = +p[2]; L[i] = +p[3]; C[i] = +p[4]; n++;
  }
  return { C, H, L, n, files: files.length };
}
const X = loadM1('xau-histdata', 'XAUUSD'), U = loadM1('udx-histdata', 'UDXUSD');
const idx = (t) => Math.round((t - T0) / 60);
// close at time t = the close of the bar starting at t - 60; accepts a bar up to `back` minutes older
function at(S, t, back = 5) { for (let k = 1; k <= back + 1; k++) { const i = idx(t) - k; if (i >= 0 && i < NMIN && Number.isFinite(S.C[i])) return S.C[i]; } return null; }
const pct = (a, b) => (a && b ? +((b / a - 1) * 100).toFixed(4) : null);
// 5-minute high-low range from the bar starting at t
function range5(S, t) { let h = -Infinity, l = Infinity; for (let k = 0; k < 5; k++) { const i = idx(t) + k; if (i < 0 || i >= NMIN || !Number.isFinite(S.H[i])) continue; h = Math.max(h, S.H[i]); l = Math.min(l, S.L[i]); } return h > l ? h - l : null; }
// the events.mjs check: the release minute's 5-minute range vs the median of the same minute on weekdays within ±25 days
function spike(S, t) {
  const r = range5(S, t), others = [];
  for (let d = -25; d <= 25; d++) { if (!d) continue; const u = t + d * 86400, wd = new Date(u * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue; const x = range5(S, u); if (x) others.push(x); }
  const m = median(others); return r && m ? +(r / m).toFixed(2) : null;
}

// ── events ──
const evs = [];
for (const e of [...HISTORY, ...EVENTS]) if (['CPI', 'NFP', 'FOMC'].includes(e.type) && e.t >= T0 && e.t < T1) evs.push({ type: e.type, d: e.local.slice(0, 10), t: e.t, src: e.history ? 'events.mjs HISTORY' : 'events.mjs EVENTS' });
const dropped = [];
for (const d of CPI_EARLY) { const t = zonedToUtc(d, '08:30', 'America/New_York'), m = spike(U, t);
  if (m != null && m >= 2) evs.push({ type: 'CPI', d, t, src: 'BLS schedule 2018-21, spike-checked' }); else dropped.push({ d, spike: m }); }
evs.sort((a, b) => a.t - b.t);

// the batch's CPI first prints with the Cleveland core nowcast captured the day before (2022-24)
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/macro-veteran/references/cpi-first-print-release-ledger-2022-2024.json'), 'utf8'));
const NC = new Map(ledger.records.map((r) => [r.release_date, r]));

const rows = [], missing = [];
for (const e of evs) {
  const pre = at(X, e.t), dpre = at(U, e.t);
  const g5 = pct(pre, at(X, e.t + 300, 2)), g60 = pct(pre, at(X, e.t + 3600, 2)), dx5 = pct(dpre, at(U, e.t + 300, 2)), dx60 = pct(dpre, at(U, e.t + 3600, 2));
  if (g5 == null || g60 == null || dx5 == null) { missing.push({ type: e.type, d: e.d }); continue; }
  const row = { type: e.type, d: e.d, t: e.t, g5, g60, g5to60: pct(at(X, e.t + 300, 2), at(X, e.t + 3600, 2)), dx5, dx60, spike: spike(U, e.t) };
  const r = e.type === 'CPI' && NC.get(e.d);
  if (r && r.nowcast_comparator && r.first_print_fields && r.first_print_fields.core_mom_sa) {
    const core = +r.first_print_fields.core_mom_sa.percent, nc = +r.nowcast_comparator.core_percent;
    if (Number.isFinite(core) && Number.isFinite(nc)) row.nowcast = { core, nowcast: +nc.toFixed(3), diff: +(core - nc).toFixed(3), selected: r.nowcast_comparator.selected_date };
  }
  rows.push(row);
}

// ── the one pre-registered test (CPI), plus NFP / FOMC as secondary cells ──
const test = {};
for (const ty of ['CPI', 'NFP', 'FOMC']) test[ty] = testRows(rows.filter((r) => r.type === ty));
const T = test.CPI;
const verdictText = T.pass
  ? `PASS: on CPI days gold kept going the dollar's first-read way from T+5 to T+60 in ${T.hits} of ${T.n} (${Math.round(T.hit * 100)}%, p ${T.p}); both halves above 50%. A tested descriptive regularity, not a trading rule.`
  : `FAIL: on CPI days gold's T+5 to T+60 move followed the dollar's first read in ${T.hits} of ${T.n} (${T.n ? Math.round(T.hit * 100) : 'n/a'}%, p ${T.p ?? 'n/a'}; 2018-21 ${T.halves.a.n ? Math.round(T.halves.a.hit * 100) + '%' : 'n/a'}, 2022-26 ${T.halves.b.n ? Math.round(T.halves.b.hit * 100) + '%' : 'n/a'}). The playbook labels every reaction statistic descriptive, not a tested edge.`;

const built = new Date().toISOString();
const base = { v: 1, built, preregistration: 'research/edge/event-reaction/preregistration.md', readPct: READ_PCT,
  note: 'Per-event gold (XAU/USD) and dollar index (UDX) moves around US CPI / NFP / FOMC releases, HistData M1 (clock: council/histdata.mjs). pre = close at T; g5 / g60 = % to T+5 / T+60; g5to60 = T+5 to T+60; dx5 / dx60 = the dollar index. read = the dollar\'s first 5 minutes (±' + READ_PCT + '%): hot read = dollar up. nowcast (CPI 2022-24) = core first print vs the Cleveland core nowcast (a model benchmark, not survey consensus). Descriptive unless test.CPI.pass.',
  coverage: { from: evs.length ? evs[0].d : null, to: evs.length ? evs.at(-1).d : null, xauBars: X.n, udxBars: U.n }, dropped, missing,
  test: { hypothesis: 'CPI: gold T+5→T+60 has the sign opposite to the dollar index T→T+5 when |dx5| ≥ ' + READ_PCT + '%', bar: 'n ≥ 30, hit ≥ 60%, one-sided binomial p < 0.05, both halves (2018-21, 2022-26) above 50%', ...test, verdict: verdictText },
  rows };
fs.writeFileSync(path.join(ROOT, 'council', 'event-base.json'), JSON.stringify(base).replace(/\},\{"type"/g, '},\n{"type"') + '\n');

// ── result.json + RESULT.md for the Edge lab ──
const by = (ty) => rows.filter((r) => r.type === ty);
const cell = (R, k) => { const v = R.map((r) => r[k]).filter(Number.isFinite); return v.length ? { n: v.length, median: +median(v).toFixed(3), up: +(v.filter((x) => x > 0).length / v.length).toFixed(2) } : { n: 0 }; };
const split = (R) => Object.fromEntries(['hot', 'inline', 'cool'].map((b) => { const S = R.filter((r) => readOf(r.dx5) === b); return [b, { n: S.length, g60: cell(S, 'g60'), g5to60: cell(S, 'g5to60') }]; }));
const summary = Object.fromEntries(['CPI', 'NFP', 'FOMC'].map((ty) => [ty, { n: by(ty).length, all: { g60: cell(by(ty), 'g60'), g5to60: cell(by(ty), 'g5to60') }, byRead: split(by(ty)) }]));
const ncRows = by('CPI').filter((r) => r.nowcast), ncSplit = Object.fromEntries([['hot', (d) => d >= 0.05], ['inline', (d) => d > -0.05 && d < 0.05], ['cool', (d) => d <= -0.05]].map(([b, f]) => { const S = ncRows.filter((r) => f(r.nowcast.diff)); return [b, { n: S.length, g60: cell(S, 'g60') }]; }));
const result = { topic: 'event-reaction', title: "Gold's reaction to US CPI, NFP and FOMC releases (the veteran's event playbook)", system: 'veteran event playbook (council/playbook.mjs); XAU/USD and the dollar index, HistData M1 2018-26',
  built, preregistration: base.preregistration, verdict: verdictText, coverage: base.coverage, dropped, missing, test: base.test, summary, nowcastSplit: { note: 'CPI 2022-24: core first print minus the Cleveland core nowcast (model benchmark, not survey consensus)', ...ncSplit } };
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
const f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : `${x > 0 ? '+' : ''}${x.toFixed(2)}%`), pc = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`);
const tbl = (ty) => { const s = summary[ty]; return [`| ${ty} | all | ${s.all.g60.n} | ${f2(s.all.g60.median)} | ${pc(s.all.g60.up)} | ${f2(s.all.g5to60.median)} | ${pc(s.all.g5to60.up)} |`,
  ...['hot', 'inline', 'cool'].map((b) => { const c = s.byRead[b]; return `| ${ty} | ${b === 'hot' ? 'hot read (dollar up)' : b === 'cool' ? 'cool read (dollar down)' : 'in line'} | ${c.n} | ${f2(c.g60.median)} | ${pc(c.g60.up)} | ${f2(c.g5to60.median)} | ${pc(c.g5to60.up)} |`; })]; };
const md = [`# Gold's reaction to US CPI, NFP and FOMC releases: result`, '',
  'Paper research only. No live rule, size or trade changed. Pre-registration: `preregistration.md` (written before any number below).', '',
  `## Verdict: ${verdictText}`, '',
  'Clock: the M1 files are read as UTC−5, UTC−4 while Europe is on summer time (Amendment 1 in preregistration.md: the release spikes put the files\' "EST without DST" label wrong in summer). The first run, on +5 h all year, also failed (CPI 20 of 32, 63%, p 0.11). Clock correction, 10 Nov 2026 (the pre-registered audit research/edge/histdata-clock; converter council/histdata.mjs): 2018 stamps are New York time, so the US-daylight / Europe-winter weeks of 2018 are an hour earlier than Amendment 1 put them. One event moved: CPI 2018-03-13 now passes the spike check (6.4x; 0.34x before) and enters the test, so 34 of 72 became 34 of 73, still a fail. The dollar-index file of 2018 is NOT certified by that audit (its hourly returns do not follow EUR/USD at any offset), so the dollar reads of the 2018 CPI rows are the weakest numbers here.', '',
  `Events: ${rows.length} with M1 coverage (${summary.CPI.n} CPI from ${by('CPI')[0]?.d ?? 'n/a'}, ${summary.NFP.n} NFP and ${summary.FOMC.n} FOMC from 2022), to ${base.coverage.to}. CPI 2018-21 dates dropped by the spike check: ${dropped.length ? dropped.map((x) => `${x.d} (${x.spike != null ? x.spike + 'x' : 'no bars'})`).join(', ') : 'none'}. Events without bars: ${missing.length ? missing.map((x) => `${x.type} ${x.d}`).join(', ') : 'none'}.`, '',
  '## The test (CPI, gold T+5→T+60 against the dollar\'s first read)', '',
  '| Type | n | hits | hit rate | p (one-sided) | 2018-21 | 2022-26 | pass |', '|---|---|---|---|---|---|---|---|',
  ...['CPI', 'NFP', 'FOMC'].map((ty) => { const x = test[ty]; return `| ${ty}${ty === 'CPI' ? '' : ' (secondary)'} | ${x.n} | ${x.hits} | ${pc(x.hit)} | ${x.p ?? 'n/a'} | ${x.halves.a.n ? `${pc(x.halves.a.hit)} (${x.halves.a.n})` : 'n/a'} | ${x.halves.b.n ? `${pc(x.halves.b.hit)} (${x.halves.b.n})` : 'n/a'} | ${ty === 'CPI' ? (x.pass ? 'yes' : 'no') : 'not a pass route'} |`; }), '',
  '## Descriptive: gold by the dollar\'s first 5-minute read (±' + READ_PCT + '%)', '',
  'The first-hour split overlaps the first five minutes that define the read, so it shows the size of the reaction, not a forecast.', '',
  '| Type | Read | n | gold T→T+60 median | up | gold T+5→T+60 median | up |', '|---|---|---|---|---|---|---|', ...tbl('CPI'), ...tbl('NFP'), ...tbl('FOMC'), '',
  '## Descriptive: CPI 2022-24 by core print vs the Cleveland nowcast', '',
  '| Split | n | gold T→T+60 median | up |', '|---|---|---|---|', ...['hot', 'inline', 'cool'].map((b) => `| ${b} | ${ncSplit[b].n} | ${f2(ncSplit[b].g60.median)} | ${pc(ncSplit[b].g60.up)} |`), '',
  'The nowcast is a model benchmark captured the day before, not survey consensus; the print is the one-decimal first print. Gold\'s release-day move (UTC daily candle) is computed at run time by `council/playbook.mjs`.', ''].join('\n');
fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
console.log(md);
