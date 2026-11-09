// node --test tests/cot.test.mjs — COT positioning desk (council/cot.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRow, features, sigExtreme, sigFlow, evaluate, build } from '../council/cot.mjs';
const DAY = 86400, W = 7 * DAY, t0 = Date.UTC(2019, 0, 1) / 1000;
test('rows parse from either report, by field pattern', () => {
  const a = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03T00:00:00.000', cftc_contract_market_code: '099741', lev_money_positions_long: '120', lev_money_positions_short: '20', traders_lev_money_long_all: '40', traders_lev_money_short_all: '25', open_interest_all: '700' }, 'tff');
  assert.equal(a.net, 100); assert.equal(a.tL, 40); assert.equal(a.oi, 700);
  const b = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', m_money_positions_long_all: '5', m_money_positions_short_all: '9' }, 'dis');
  assert.equal(b.net, -4); assert.equal(parseRow({ report_date_as_yyyy_mm_dd: 'x' }, 'dis'), null);
});
test('features have no look-ahead; signals fire at extremes and big weekly flows', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * W, net: Math.round(1000 * Math.sin(i / 9)), long: 0, short: 0, tL: 50 + (i % 5), tS: 40, oi: 1000 }));
  rows.push({ t: t0 + 300 * W, net: 5000, long: 0, short: 0, tL: 60, tS: 40, oi: 1000 });
  const F = features(rows), last = F.at(-1);
  assert.equal(last.pct, 100); assert.equal(sigExtreme(last), -1); assert.equal(sigFlow(last), 1); assert.ok(last.z > 1.5);
  assert.equal(F[10].pct, null, 'needs a year of history');
});
test('evaluation scores signals against later prices, and build marks missing markets', () => {
  const rows = Array.from({ length: 400 }, (_, i) => ({ t: t0 + i * W, net: i % 20 < 10 ? i * 10 : -i * 10, long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const px = Array.from({ length: 3000 }, (_, i) => ({ t: t0 + i * DAY, v: 100 + i * 0.01 }));
  const r = evaluate(features(rows), px, 1); assert.ok(r.extreme5 && r.flow20); assert.ok(r.flow5.base > 0.9);
  const out = build({ '099741': rows }, { eurusd: px }); assert.equal(out.find((m) => m.k === 'eur').missing, undefined); assert.equal(out.find((m) => m.k === 'gold').missing, true);
});
test('signal text speaks in the quoted pair: crowded-short CHF futures lean USD/CHF down', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * W, net: Math.round(1000 * Math.sin(i / 9)), long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  rows.push({ t: t0 + 300 * W, net: -5000, long: 1, short: 1, tL: 1, tS: 1, oi: 1 });
  const chf = build({ '092741': rows }, {}).find((m) => m.k === 'chf'), eur = build({ '099741': rows }, {}).find((m) => m.k === 'eur');
  assert.match(chf.signals[0].text, /USD\/CHF down/); assert.equal(chf.signals[0].pairDir, -1); assert.match(eur.signals[0].text, /EUR\/USD up/);
});
test('no look-ahead in holiday weeks: a move before the Monday after the report never counts', async () => {
  const { RELEASE_LAG } = await import('../council/cot.mjs'); assert.equal(RELEASE_LAG, 6);
  // only the last report fires a flow signal; price jumps +10% on the Friday after it (could be pre-publication in a holiday week)
  const rows = Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * W, net: Math.round(100 * Math.sin(i)), long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const t = t0 + 300 * W; rows.push({ t, net: 99999, long: 1, short: 1, tL: 1, tS: 1, oi: 1 });
  const px = []; for (let d = 0; d < 2200; d++) { const tt = t0 + d * DAY; px.push({ t: tt, v: tt >= t + 3 * DAY ? 110 : 100 }); }
  const r = evaluate(features(rows), px, 1, { from: t - DAY });
  assert.equal(r.flow5.n, 1); assert.equal(r.flow5.avg, 0, 'the Friday jump is not in the measured return');
});

// ---- 9 Nov data audit (against council-data macro/cot-raw.json) and the pre-registered study (research/edge/cot-positioning) ----
test('release timing: public from the first Monday after the as-of date; holiday-week Monday as-of dates enter on the same Tuesday', async () => {
  const { knownAt, entryIdx, weekdays } = await import('../council/cot.mjs');
  const tue = Date.UTC(2026, 10, 3) / 1000, mon = Date.UTC(2020, 11, 21) / 1000;
  assert.equal(new Date(knownAt(tue) * 1000).toISOString().slice(0, 10), '2026-11-09');
  assert.equal(new Date(knownAt(mon) * 1000).toISOString().slice(0, 10), '2020-12-28');
  // daily candles with a Sunday stub: the entry is the Tuesday close, never the Sunday stub or the Monday of the release
  const px = weekdays(Array.from({ length: 20 }, (_, d) => ({ t: Date.UTC(2020, 11, 21 + d) / 1000, v: 100 + d })));
  assert.ok(px.every((o) => ![0, 6].includes(new Date(o.t * 1000).getUTCDay())), 'weekend candles dropped');
  assert.equal(new Date(px[entryIdx(px, mon)].t * 1000).toISOString().slice(0, 10), '2020-12-29');
});
test('horizons count weekdays: a Sunday stub is not one of the 5 days', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * W, net: Math.round(100 * Math.sin(i)), long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const t = t0 + 300 * W; rows.push({ t, net: 99999, long: 1, short: 1, tL: 1, tS: 1, oi: 1 });
  // price +1 each weekday, flat on weekends; Sunday rows exist (as OANDA's stub). 5 weekdays after the Tuesday entry = +5, not +4
  const px = []; let v = 100; for (let d = 0; d < 2200; d++) { const tt = t0 + d * DAY, wd = new Date(tt * 1000).getUTCDay(); if (wd !== 0 && wd !== 6) v += 1; if (wd !== 6) px.push({ t: tt, v }); }
  const r = evaluate(features(rows), px, 1, { from: t - DAY }), entry = px.find((o) => o.t === t + 7 * DAY).v;
  assert.equal(r.flow5.n, 1); assert.equal(r.flow5.avg, +((5 / entry) * 100).toFixed(2));
});
test('late-published weeks (2025 shutdown backlog) are shown but never tested', async () => {
  const { isLate, LATE } = await import('../council/cot.mjs');
  assert.ok(LATE.length >= 1);
  assert.equal(isLate(Date.UTC(2025, 9, 7) / 1000), true); assert.equal(isLate(Date.UTC(2025, 8, 23) / 1000), false); assert.equal(isLate(Date.UTC(2026, 10, 3) / 1000), false);
  const start = Date.UTC(2022, 0, 4) / 1000, rows = Array.from({ length: 220 }, (_, i) => ({ t: start + i * W, net: Math.round(100 * Math.sin(i)), long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const iLate = rows.findIndex((r) => isLate(r.t)); rows[iLate].net = 99999;   // the only flow signal falls in a late week
  const px = Array.from({ length: 1600 }, (_, d) => ({ t: start + d * DAY, v: 100 + d }));
  const F = features(rows); assert.equal(F[iLate].late, true); assert.equal(sigFlow(F[iLate]), 1);
  assert.equal(evaluate(F, px, 1, { from: start }).flow5.n, 0);
});
test('overlapping 20-day windows: t is not inflated by counting the same move 4 times', async () => {
  const { overlapT } = await import('../council/cot.mjs');
  // four weekly signals in a row read the same 20-day move: neighbours are near-copies of each other
  const xs = [0.03, 0.031, 0.029, 0.03, -0.01, -0.011, -0.009, -0.01, 0.02, 0.021, 0.019, 0.02];
  const ks = xs.map((_, i) => i * 5), naive = overlapT(xs, ks, 5), over = overlapT(xs, ks, 20);
  const m = xs.reduce((a, b) => a + b) / xs.length, s = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
  assert.ok(Math.abs(naive - m / (s / Math.sqrt(xs.length))) < 1e-9, 'no overlap = the plain t');
  assert.ok(over < naive, 'positively correlated neighbours shrink t');
  assert.ok(Math.abs(overlapT(xs, xs.map((_, i) => i * 100), 20) - naive) < 1e-9, 'far apart: the plain t again');
});
test('missing values and missing weeks: null / blank / "." stay null, a gap is not one week of flow', () => {
  const p = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', lev_money_positions_long: '10', lev_money_positions_short: '4', traders_lev_money_long_all: '.', traders_lev_money_short_all: null, open_interest_all: ' ' }, 'tff');
  assert.equal(p.net, 6); assert.equal(p.tL, null); assert.equal(p.tS, null); assert.equal(p.oi, null);
  assert.equal(parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', lev_money_positions_long: null, lev_money_positions_short: '4' }, 'tff'), null, 'a missing long is not 0');
  const rows = Array.from({ length: 80 }, (_, i) => ({ t: t0 + i * W, net: i, long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  rows.splice(60, 2);   // two reports missing
  const F = features(rows); assert.equal(F[60].chg1, null); assert.equal(F[60].z, null); assert.equal(F[61].chg1, 1); assert.equal(F[60].chg4, null);
});
test('commercials parse from both reports (TFF dealers; Disaggregated producer/merchant + swap, incl. the double underscore)', () => {
  const a = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', lev_money_positions_long: '1', lev_money_positions_short: '2', dealer_positions_long_all: '30', dealer_positions_short_all: '70' }, 'tff');
  assert.equal(a.cL, 30); assert.equal(a.cS, 70);
  const b = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', m_money_positions_long_all: '5', m_money_positions_short_all: '1', prod_merc_positions_long: '10', prod_merc_positions_short: '50', swap_positions_long_all: '20', swap__positions_short_all: '40' }, 'dis');
  assert.equal(b.cL, 30); assert.equal(b.cS, 90);
  const c = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', m_money_positions_long_all: '5', m_money_positions_short_all: '1', prod_merc_positions_long: '10' }, 'dis');
  assert.equal(c.cL, undefined, 'half a commercial book is no book');
});
test('extremes are tested only with a full 3-year history behind the percentile', () => {
  // a crowded-long extreme every 10th week from the start; only those with 156 prior reports count
  const rows = Array.from({ length: 260 }, (_, i) => ({ t: t0 + i * W, net: i % 10 === 9 ? 1e6 : Math.round(100 * Math.sin(i)), long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const px = Array.from({ length: 2000 }, (_, d) => ({ t: t0 + d * DAY, v: 100 }));
  const F = features(rows), r = evaluate(F, px, 1, { from: t0 });
  assert.ok(F.some((f) => f.pctWeeks < 156 && sigExtreme(f)), 'the desk still shows a 1-2 year extreme');
  assert.equal(r.extreme20.n, F.filter((f) => f.pctWeeks >= 156 && sigExtreme(f)).length);
});
test('a failed half of the fetch keeps the cached markets of that report and stays due for a retry', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { run } = await import('../council/cot.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cot-')); fs.mkdirSync(path.join(dir, 'macro'));
  const old = { t: t0, code: '088691', long: 5, short: 1, net: 4, tL: 1, tS: 1, oi: 9 };
  fs.writeFileSync(path.join(dir, 'macro', 'cot-raw.json'), JSON.stringify({ at: '2026-11-01T00:00:00Z', src: {}, rows: { '088691': Array.from({ length: 20 }, (_, i) => ({ ...old, t: t0 + i * W })) } }));
  const tffRow = { cftc_contract_market_code: '099741', lev_money_positions_long: '10', lev_money_positions_short: '4', open_interest_all: '100' };
  const fetchImpl = async (url) => (/72hh-3qpy/.test(url) ? { ok: false, status: 503 } : { ok: true, json: async () => Array.from({ length: 20 }, (_, i) => ({ ...tffRow, report_date_as_yyyy_mm_dd: new Date((t0 + i * W) * 1000).toISOString().slice(0, 10) })) });
  await run({ dir, fetchImpl, now: Date.parse('2026-11-09T00:00:00Z'), log: () => {} });
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'cot-raw.json'), 'utf8'));
  assert.equal(raw.rows['088691'].length, 20, 'gold kept'); assert.equal(raw.rows['099741'].length, 20, 'EUR fetched');
  assert.equal(raw.at, '2026-11-01T00:00:00Z', 'not marked fresh, so the next round retries'); assert.match(raw.src.cached, /088691/);
  const out = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'cot.json'), 'utf8'));
  assert.equal(out.markets.find((m) => m.k === 'gold').missing, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('per market the desk gets percentile, change, z and edge (tested / none / untested) from the pre-registered study', async () => {
  const { edgeOf, loadStudy } = await import('../council/cot.mjs');
  const study = { topic: 'cot-positioning', window: 'IS 2020-23, OOS 2024-2026', verdict: { verdict: 'FAIL' }, desk: { gold: { passed: [] }, aud: { passed: [{ id: 'H4-4w', label: 'extreme, 4w' }] } } };
  assert.equal(edgeOf(study, 'gold').status, 'none'); assert.match(edgeOf(study, 'gold').text, /^edge: none/);
  assert.equal(edgeOf(study, 'aud').status, 'tested'); assert.equal(edgeOf(study, 'silver').status, 'untested'); assert.equal(edgeOf(null, 'gold').status, 'untested');
  const rows = Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * W, net: i % 30 === 29 ? -99999 : Math.round(1000 * Math.sin(i / 9)), long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const px = Array.from({ length: 2400 }, (_, d) => ({ t: t0 + d * DAY, v: 100 + (d % 30) }));
  const out = build({ '232741': rows, '088691': rows }, { audusd: px, xau: px }, { study });
  const g = out.find((m) => m.k === 'gold'), a = out.find((m) => m.k === 'aud');
  for (const k of ['pct', 'pct1y', 'chg1', 'z', 'edgeStatus', 'edgeText', 'knownAt']) assert.ok(k in g, k);
  assert.equal(g.edgeStatus, 'none'); assert.equal(a.edgeStatus, 'tested');
  // gold's study cells did not pass, so no desk test may call itself an edge there; each test says what the study found
  assert.ok(Object.values(g.tests).every((x) => x.edge === false && /not confirmed/.test(x.study)));
  assert.equal(a.tests.extreme20.study, 'passed H4-4w');
  // the committed study is readable and names every market but silver
  const s = loadStudy(); assert.ok(s && s.desk); assert.deepEqual(Object.keys(s.desk).sort(), ['aud', 'cad', 'chf', 'es', 'eur', 'gbp', 'gold', 'jpy', 'nq', 'nzd']);
});
test('the pre-registered study reads as a FAIL in the Edge lab and keeps its pre-registration beside it', async () => {
  const fs = await import('node:fs');
  const { studyVerdict } = await import('../research/edge/verdict.mjs');
  const dir = new URL('../research/edge/cot-positioning/', import.meta.url);
  const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.ok(fs.existsSync(new URL('preregistration.md', dir)));
  assert.equal(studyVerdict(res, md).verdict, 'fail');
  assert.equal(res.status, 'ok'); assert.ok(res.primary.length === 6 && res.primary.every((p) => p.verdict === 'FAIL'));
  // no look-ahead in the split: in-sample ends before out of sample starts, and late weeks are listed as excluded
  assert.ok(res.split.is[1] < res.split.oos[0]); assert.deepEqual(res.split.lateExcluded.map((w) => w.from), ['2025-09-30']);
  // the desk only flags a market whose cell passed both windows
  for (const [k, d] of Object.entries(res.desk)) for (const p of d.passed) { const c = res.markets[k].cells.find((x) => x.id === p.id); assert.ok(c.pass && c.isPass, `${k} ${p.id}`); }
});
