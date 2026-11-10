// node --test tests/veteran.test.mjs — the Macro veteran (council/veteran.mjs): a code port of the owner's gptmacro_v.1 skill
// that discusses the Macro strategist's view from the strategist's own data. Offline: a synthetic cache, forecast and
// candle set; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as V from '../council/veteran.mjs';

const DAY = 86400, NOW = Date.UTC(2026, 10, 8, 10, 0) / 1000;   // Sun 8 Nov 2026 10:00 UTC
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const wk = (t) => { const d = new Date(t * 1000).getUTCDay(); return d !== 0 && d !== 6; };
// a daily FRED-like series as macro/cache.json keeps it: [[date, value]], weekdays, `n` days back from NOW, value = f(i from the end)
const series = (n, f) => { const out = []; let i = 0; for (let t = Math.floor(NOW / DAY) * DAY - DAY; out.length < n; t -= DAY) { if (!wk(t)) continue; out.unshift([iso(t), +f(i).toFixed(4)]); i++; } return out; };
const closes = (n, f) => { const out = []; let i = 0; for (let t = Math.floor(NOW / DAY) * DAY - 2 * DAY; out.length < n; t -= DAY) { if (!wk(t)) continue; out.unshift({ t, v: +f(i).toFixed(2) }); i++; } return out; };

// a calm world: flat series, a gently rising gold (a 4-week fall in real yields and the dollar: supportive channels)
function cache({ ry = (i) => 2.6 + i * 0.016, d2 = (i) => 4.46 + i * 0.016, be = (i) => 2.23, hy = (i) => (i < 5 ? 3.48 : 3.26), vix = (i) => (i < 5 ? 28 : 22), vx3 = () => 25.5, sofr = () => 3.9, effr = () => 3.86, dxyBroad = () => 120 } = {}) {
  return { fred: { DFII10: series(60, ry), DGS2: series(60, d2), DGS10: series(60, (i) => 4.84), T10YIE: series(60, be), T10Y3M: series(60, () => 0.67), BAMLH0A0HYM2: series(60, hy), VIXCLS: series(60, vix), VXVCLS: series(60, vx3), DTWEXBGS: series(60, dxyBroad), SOFR: series(60, sofr), EFFR: series(60, effr) },
    cot: Array.from({ length: 30 }, (_, i) => ({ t: NOW - (30 - i) * 7 * DAY - 5 * DAY, net: 100000 + i * 1000 })) };
}
const gold = closes(3000, (i) => 4000 * Math.exp(-i * 0.0003) * (1 + 0.004 * Math.sin(i / 7)));
const dxy = closes(300, (i) => 102.36 * (1 - i * 0.0006));   // i counts back from now: the dollar rises into today
const forecast = (o = {}) => ({ at: new Date((NOW - 600) * 1000).toISOString(), assets: { gold: { pUp: 0.54, fit: { base: 0.536 }, drivers: [] } },
  regime: { label: 'Dollar Smile left side (stress) · dollar liquidity draining · VIX curve inverted (stress)' },
  drivers: [{ k: 'ry', vote: -1, detail: '10Y TIPS 2.60%, falling' }, { k: 'dxymom', vote: -1, detail: '+0.30 pts in 5 sessions' }, { k: 'be', vote: -1, detail: '2.23%, −11 bp a week' }, { k: 'cot', vote: 0, detail: '100k net, +4k in 4 weeks, 95th pct' }],
  playbook: [{ title: 'Core CPI m/m', at: new Date((NOW + 2 * DAY + 3.5 * 3600) * 1000).toISOString() }],
  goldScore: { ok: true, asOf: '2026-11-06', score: 0.13, z: { ry4w: 1.43, dxy4w: -0.03 }, bias: 'AUCTION', conviction: null, label: 'AUCTION (no macro edge)', weeks: 1067 }, ...o });

test('window / baseRates: changes over matched windows with as-of dates and a stale flag; the reference class', () => {
  const w = V.window(V.fromCache(cache().fred.DFII10), NOW);
  assert.equal(w.v, 2.6); assert.equal(w.chg1, -0.08); assert.equal(w.chg4, -0.32); assert.equal(w.asOf, '2026-11-06'); assert.equal(w.stale, false);
  assert.equal(V.window(V.fromCache(cache().fred.DFII10), NOW + 10 * DAY).stale, true);
  assert.equal(V.window([], NOW), null);
  const b = V.baseRates(gold, { now: NOW });
  assert.equal(b.horizon, 20); assert.ok(b.n > 2000); assert.ok(b.upRate > 0.5 && b.upRate < 0.9, `up rate ${b.upRate}`); assert.ok(b.q10 < b.median && b.median < b.q90);
  assert.equal(V.baseRates(gold.slice(-50), { now: NOW }), null, 'too few observations');
  assert.equal(V.weekKey(NOW), '2026-11-07'); assert.equal(V.weekKey(Date.UTC(2026, 10, 13, 12) / 1000), '2026-11-07'); assert.equal(V.weekKey(Date.UTC(2026, 10, 14, 12) / 1000), '2026-11-14');
});

test('fingerprint: the framework\'s shock table from matched 1-week changes, always with a competing explanation', () => {
  const f = (c) => V.fingerprint(c);
  assert.equal(f({ sofrBps: 20, hy: 5, vixTs: 0.9 }).shock, 'Dollar funding / liquidity shock');
  assert.equal(f({ sofrBps: 4, hy: 22, vixTs: 1.1, dxy: 0.3 }).shock, 'Risk-off / de-risking, funding still calm');
  assert.equal(f({ d2: 12, ry: 8, curve: -4 }).shock, 'Hawkish policy shock');
  assert.equal(f({ d2: -15, ry: -8, hy: 2, vix: 16 }).shock, 'Dovish policy shock');
  assert.equal(f({ d2: -15, ry: -8, hy: 20, vix: 30 }).shock, 'Dovish repricing driven by growth fear');
  assert.equal(f({ be: 8, ry: 1, d2: 2 }).shock, 'Inflation surprise / inflation-risk shock');
  assert.equal(f({ d10: 12, d2: 2, curve: 10 }).shock, 'Sovereign duration / term-premium shock');
  assert.equal(f({ ry: -6, hy: 12, vix: 25, vixChg: 3 }).shock, 'Negative growth / demand shock');
  assert.equal(f({ ry: 6, hy: -8, vixChg: -2 }).shock, 'Positive growth / demand news');
  const m = f({ d2: 1, ry: 1, be: 1, dxy: 0.1, hy: 1, vix: 15 }); assert.equal(m.shock, 'Mixed / no dominant shock'); assert.equal(m.confidence, 'low');
  for (const c of [{ sofrBps: 20 }, { d2: 12, ry: 8 }, {}]) { const r = f(c); assert.ok(r.competing.length > 20); assert.ok(r.goldTest.length > 20); assert.ok(Array.isArray(r.clues) && r.clues.length); }
});

test('channels: one row per driver-map channel with observation, as-of, stale flag, lean and the limit of the observation', () => {
  const C = cache(), S = {}; for (const [k, v] of Object.entries(C.fred)) S[k] = V.fromCache(v);
  S.gold = gold; S.dxy = dxy; S.avg10w = 3950; S.cot = { net: 100000, chg4w: 4000, pct: 95, asOf: '2026-11-03' };
  const ch = V.channels(S, NOW);
  assert.deepEqual(ch.list.map((r) => r.k), ['real', 'infl', 'usd', 'policy', 'risk', 'pos', 'official', 'price']);
  const by = Object.fromEntries(ch.list.map((r) => [r.k, r]));
  assert.equal(by.real.lean, 1); assert.match(by.real.obs, /−32 bp over 4 weeks/); assert.equal(by.real.asOf, '2026-11-06');
  assert.equal(by.policy.lean, 1); assert.match(by.policy.obs, /−32 bp over 4 weeks/);
  assert.equal(by.usd.lean, -1, 'a 4-week dollar rise over 1% is against gold'); assert.match(by.usd.obs, /broad USD/);
  assert.equal(by.risk.lean, 0, 'an inverted VIX curve is stress, not direction'); assert.match(by.risk.obs, /VIX\/VIX3M 1.10/);
  assert.equal(by.pos.lean, 0); assert.equal(by.pos.stale, false); assert.equal(by.official.lean, null); assert.ok(by.official.cannot.length > 20);
  assert.equal(by.price.lean, 1, 'above the 10-week average');
  for (const r of ch.list) { assert.ok(r.cannot && r.cannot.length > 30, `${r.k} must say what it cannot establish`); }
  assert.equal(ch.have, 7); assert.equal(ch.tally, 2); assert.equal(ch.lean, 1);
  assert.equal(ch.changes.ry, -8); assert.equal(ch.changes.d2, -8); assert.equal(ch.changes.hy, 22); assert.equal(ch.changes.vixTs, 1.098);
  // too few observed channels: no lean
  assert.equal(V.channels({ gold: [] }, NOW).lean, null);
});

test('debate: topic by topic with a stance and why; the verdict keeps the score\'s direction, lowers conviction, never a sell', () => {
  const run = (fc, S = {}) => { const C = cache(), s = {}; for (const [k, v] of Object.entries(C.fred)) s[k] = V.fromCache(v); s.gold = gold; s.dxy = dxy; s.avg10w = 3950; Object.assign(s, S);
    const ch = V.channels(s, NOW), fp = V.fingerprint(ch.changes); return { ch, ...V.debate(fc, ch, fp, { now: NOW, base: V.baseRates(gold, { now: NOW }) }) }; };
  // auction score, supportive channels: auction (a supportive narrative without the score is the hand-judged bias)
  let r = run(forecast());
  assert.deepEqual(r.topics.map((t) => t.topic), ['Direction for gold', 'Real yields', 'US dollar', 'Inflation and the next release', 'Positioning', 'Regime']);
  for (const t of r.topics) { assert.ok(['agree', 'qualify', 'disagree'].includes(t.stance), t.topic); assert.ok(t.macro && t.veteran && t.why, t.topic); }
  assert.equal(r.verdict.bias, 'AUCTION'); assert.equal(r.verdict.conviction, null); assert.match(r.verdict.note, /hand-judged bias/);
  assert.equal(r.topics[1].stance, 'disagree', 'the strategist reads the level (bear), the veteran the 4-week fall'); assert.match(r.topics[1].why, /level .*change/i);
  assert.ok(r.verdict.eventWithin72h && r.verdict.eventWithin72h.title === 'Core CPI m/m'); assert.match(r.verdict.note, /conditional until the print/);
  assert.equal(r.verdict.invalidation.length, 3); assert.match(r.verdict.invalidation[0], /TIPS real yield above 2\.75%/); assert.match(r.verdict.invalidation[1], /DXY above/);
  assert.equal(r.card.shock, 'Risk-off / de-risking, funding still calm'); assert.match(r.card.surprise, /Pending: Core CPI/); assert.equal(r.card.forecastId, 'xau-4w-2026-11-07'); assert.match(r.card.confidence, /base rate \d+% up over 20 days/);
  // BUY Medium score, channels agree: full conviction kept
  r = run(forecast({ goldScore: { ok: true, asOf: '2026-11-06', score: 0.35, z: { ry4w: 1.4, dxy4w: 0.2 }, bias: 'BUY', conviction: 'Medium', label: 'BUY Medium', weeks: 1067 }, playbook: [] }));
  assert.equal(r.verdict.bias, 'BUY'); assert.equal(r.verdict.conviction, 'Medium'); assert.match(r.verdict.note, /Agreed/); assert.equal(r.verdict.eventWithin72h, null);
  // BUY High score, channels against: direction kept, conviction Low (never flipped, never a sell)
  r = run(forecast({ goldScore: { ok: true, asOf: '2026-11-06', score: 0.7, z: {}, bias: 'BUY', conviction: 'High', label: 'BUY High', weeks: 1067 }, playbook: [] }),
    { DFII10: V.fromCache(series(60, (i) => 2.6 - i * 0.02)), DGS2: V.fromCache(series(60, (i) => 4.46 - i * 0.02)), avg10w: 4100 });
  assert.equal(r.ch.lean, -1); assert.equal(r.verdict.bias, 'BUY'); assert.equal(r.verdict.conviction, 'Low'); assert.match(r.verdict.note, /quarter size/);
  // no score at all and channels against: auction, explicitly not a sell
  r = run(forecast({ goldScore: { ok: false, why: 'FRED down' }, playbook: [] }), { DFII10: V.fromCache(series(60, (i) => 2.6 - i * 0.02)), DGS2: V.fromCache(series(60, (i) => 4.46 - i * 0.02)), avg10w: 4100 });
  assert.equal(r.verdict.bias, 'AUCTION'); assert.match(r.verdict.note, /never a macro sell/);
});

test('ledger: one binary forecast a week in [0.4, 0.7], base rate and the score rule as comparator; resolved and Brier-scored; append-only', () => {
  const base = { upRate: 0.56, n: 3000, from: '2016', to: '2026', horizon: 20 };
  assert.equal(V.probability({ bias: 'AUCTION', agree: 4, disagree: 0, note: 'x' }, base, null), 0.56);
  assert.equal(V.probability({ bias: 'BUY', conviction: 'Medium', agree: 4, disagree: 0, note: 'x' }, base, null), 0.64);
  assert.equal(V.probability({ bias: 'BUY', conviction: 'High', agree: 4, disagree: 0, note: 'x', eventWithin72h: { title: 'CPI' } }, base, null), 0.62, 'half the tilt into an event');
  assert.equal(V.probability({ bias: 'BUY', conviction: 'High', agree: 4, disagree: 0, note: 'x' }, { upRate: 0.65 }, null), 0.7, 'capped');
  assert.equal(V.probability({ bias: 'AUCTION', agree: 2, disagree: 1, note: 'Channels lean against gold' }, base, null), 0.52);
  const verdict = { bias: 'BUY', conviction: 'Medium', agree: 4, disagree: 0, note: 'Agreed.' }, card = { falsifier: 'TIPS above 2.75%' }, gs = { ok: true, score: 0.35, weeks: 1067 };
  let { ledger: L, issued } = V.ledgerIssue([], { now: NOW, gold, verdict, base, gs, card });
  assert.ok(issued); assert.equal(L.length, 1); assert.equal(issued.record_type, 'issued'); assert.equal(issued.forecast_id, 'xau-4w-2026-11-07'); assert.equal(issued.previous_record_id, null);
  assert.equal(issued.forecast.distribution.kind, 'binary_event'); assert.equal(issued.forecast.distribution.event_probability, 0.64);
  assert.equal(issued.forecast.comparator.probability_or_value, 0.69); assert.equal(issued.forecast.base_rate.probability, 0.56); assert.match(issued.forecast.resolution_rule.rule, /close\[t0 \+ 20 rows\]/);
  assert.equal(issued.anchor.close, gold[gold.length - 1].v); assert.ok(issued.forecast.target.deadline_utc > issued.forecast.issued_at_utc);
  // the same week: not issued twice; next week: a new record
  assert.equal(V.ledgerIssue(L, { now: NOW + 2 * DAY, gold, verdict, base, gs, card }).issued, null);
  L = V.ledgerIssue(L, { now: NOW + 7 * DAY, gold: gold.concat(closes(5, () => 4100).map((o) => ({ ...o, t: o.t + 7 * DAY }))), verdict, base, gs, card }).ledger; assert.equal(L.length, 2);
  // resolution: 20 more closes after the anchor, higher -> outcome true, Brier (0.64-1)^2
  const more = Array.from({ length: 25 }, (_, i) => ({ t: gold[gold.length - 1].t + (i + 1) * DAY, v: 4200 + i }));
  const R = V.ledgerResolve(L, gold.concat(more));
  const res = R.filter((r) => r.record_type === 'resolved'); assert.equal(res.length, 1); assert.equal(res[0].forecast_id, 'xau-4w-2026-11-07'); assert.equal(res[0].resolution.outcome, true);
  assert.equal(res[0].resolution.scores.brier, +((0.64 - 1) ** 2).toFixed(4)); assert.equal(res[0].resolution.scores.brier_base, +((0.56 - 1) ** 2).toFixed(4)); assert.equal(res[0].resolution.scores.brier_comparator, +((0.69 - 1) ** 2).toFixed(4));
  assert.equal(res[0].previous_record_id, 'vet-2026-11-07-issued');
  assert.equal(V.ledgerResolve(R, gold.concat(more)).length, R.length, 'resolving again adds nothing');
  const s = V.ledgerSummary(R); assert.equal(s.issued, 2); assert.equal(s.resolved, 1); assert.equal(s.hit, 1); assert.ok(s.skillVsBase > 0); assert.match(s.note, /too few/);
  // the issued record is never edited by a resolution
  assert.deepEqual(R.find((r) => r.record_id === 'vet-2026-11-07-issued'), L[0]);
});

test('build + run: veteran.json, the ledger and the analysis block, from the strategist\'s files only (no fetch)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vet-')); fs.mkdirSync(path.join(dir, 'macro')); fs.mkdirSync(path.join(dir, 'research', 'daily'), { recursive: true }); fs.mkdirSync(path.join(dir, 'analysis'));
  fs.writeFileSync(path.join(dir, 'macro', 'forecast.json'), JSON.stringify(forecast())); fs.writeFileSync(path.join(dir, 'macro', 'cache.json'), JSON.stringify(cache()));
  fs.writeFileSync(path.join(dir, 'research', 'daily', 'xau.json'), JSON.stringify({ rows: gold.map((o) => [o.t, o.v, o.v, o.v, o.v, 1]) }));
  for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) fs.writeFileSync(path.join(dir, 'research', 'daily', `${k}.json`), JSON.stringify({ rows: dxy.map((o) => [o.t, 1, 1, 1, { eurusd: 1.1, usdjpy: 150, gbpusd: 1.27, usdcad: 1.36, usdchf: 0.88 }[k], 1]) }));
  fs.writeFileSync(path.join(dir, 'analysis', 'latest.md'), '# Analysis\n\n## Top 3\n- x\n');
  const logs = []; const v = V.run({ dir, now: NOW, log: (...a) => logs.push(a.join(' ')) });
  assert.ok(v && v.debate.length === 6 && v.channels.length === 8); assert.equal(v.paperOnly, true); assert.match(v.brief, /^Macro veteran, 2026-11-08 10:00 UTC\. Shock: /);
  const j = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran.json'), 'utf8')); assert.equal(j.verdict.bias, 'AUCTION'); assert.equal(j.ledger.issued, 1); assert.equal(j.ledger.issuedNow, 'xau-4w-2026-11-07');
  for (const p of ['at', 'shock.shock', 'shock.confidence', 'channels', 'tally.lean', 'debate', 'verdict.bias', 'verdict.note', 'verdict.invalidation', 'card.falsifier', 'base.upRate', 'ledger.lastProbability', 'brief']) {
    assert.ok(p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), j) !== undefined, `veteran.json ${p} (the page reads it)`); }
  const L = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran-ledger.json'), 'utf8')); assert.equal(L.length, 1);
  const md = fs.readFileSync(path.join(dir, 'analysis', 'latest.md'), 'utf8'); assert.match(md, /<!-- veteran:start -->\n## Macro veteran/); assert.match(md, /\| Real yields \| .* \| disagree \|/); assert.ok(md.indexOf(V.VET_END) < md.indexOf('## Top 3'));
  // a second run the same week: idempotent files, no second ledger record
  V.run({ dir, now: NOW + 60, log: () => {} }); assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran-ledger.json'), 'utf8')).length, 1);
  // no strategist output yet: nothing written
  const d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'vet-')); assert.equal(V.run({ dir: d2, now: NOW, log: () => {} }), null); assert.equal(fs.existsSync(path.join(d2, 'macro', 'veteran.json')), false);
});

test('COT row: cot.mjs\'s release clock (first Monday after the as-of date) and a 3-year percentile, not a 4-day lag over 60 weeks', () => {
  const T = (d) => Date.parse(d + 'T00:00:00Z') / 1000;
  // 200 weekly reports, the last as of Tue 3 Nov 2026 (public Fri 6 Nov, known from Mon 9 Nov under the conservative rule)
  const cot = Array.from({ length: 200 }, (_, k) => ({ t: T('2026-11-03') - (199 - k) * 7 * DAY, net: 100000 + k * 100, gross: 300000 }));
  const C = { ...cache(), cot };
  const pos = (now) => V.build({ fc: forecast(), cache: C, daily: { gold, dxy }, now }).v.channels.find((r) => r.k === 'pos');
  const sun = pos(NOW);   // Sun 8 Nov: the old 4-day lag already used the 3 Nov report
  assert.match(sun.obs, /as of 2026-10-27/); assert.match(sun.obs, /100th percentile of 3 years/);
  assert.equal(sun.stale, false, 'a 12-day-old report is the newest usable one on a Sunday, not stale');
  assert.equal(pos(T('2026-11-17')).stale, false, '14 days: a holiday week'); assert.equal(pos(T('2026-11-25')).stale, true, 'no new report for 3 weeks: stale');
  const mon = pos(T('2026-11-09') + 3600);
  assert.match(mon.obs, /as of 2026-11-03/);
  // a short history says so instead of a percentile of a few weeks
  const few = V.build({ fc: forecast(), cache: cache(), daily: { gold, dxy }, now: NOW }).v.channels.find((r) => r.k === 'pos');
  assert.match(few.obs, /percentile n\/a \(\d+ weeks of history\)/);
});

test('wiring: the Macro desk loads macro/veteran.json and renders the discussion; the council round runs the veteran after the strategist', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.ok(html.includes("get('macro/veteran.json')")); assert.match(html, /<section class="md-vet" id="ms-md-vet"/); assert.match(html, /function renderVet\(\)/); assert.match(html, /renderScore, renderVet, renderSmile/);
  for (const id of ['ms-md-vet-verdict', 'ms-md-vet-list', 'ms-md-vet-foot', 'ms-md-vet-at']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(html, /#ms-cp-macro \.md-vet-row\.disagree \.md-vet-st/);
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  const i = yml.indexOf('node council/macro.mjs data'), j = yml.indexOf('node council/veteran.mjs data'); assert.ok(i > 0 && j > i, 'veteran right after the strategist');
  assert.ok(fs.existsSync(new URL('../research/macro-veteran/SKILL.md', import.meta.url))); assert.ok(fs.existsSync(new URL('../research/macro-veteran/references/gold-driver-map.md', import.meta.url)));
  const claude = fs.readFileSync(new URL('../CLAUDE.md', import.meta.url), 'utf8'); assert.match(claude, /## Macro veteran \(8 Nov 2026/);
});

test('the argument\'s record: weekly debates resolved at the horizon, a per-topic scoreboard, and what the strategist has adopted', () => {
  const topics = [{ topic: 'Direction for gold', stance: 'agree', m: 1, v: 1 }, { topic: 'Real yields', stance: 'disagree', m: -1, v: 1 }, { topic: 'Positioning', stance: 'agree', m: 0, v: null }];
  let { hist, issued } = V.debatesIssue([], { now: NOW, gold, topics });
  assert.ok(issued); assert.equal(hist.length, 1); assert.equal(issued.week, '2026-11-07'); assert.deepEqual(issued.topics[1], { topic: 'Real yields', stance: 'disagree', m: -1, v: 1 }); assert.equal(issued.resolved, null);
  assert.equal(V.debatesIssue(hist, { now: NOW + DAY, gold, topics }).issued, null, 'one record a week');
  const more = Array.from({ length: 25 }, (_, i) => ({ t: gold[gold.length - 1].t + (i + 1) * DAY, v: 4200 + i }));
  hist = V.debatesResolve(hist, gold.concat(more)); assert.equal(hist[0].resolved.dir, 1); assert.ok(hist[0].resolved.returnPct > 0);
  const sb = V.scoreboard(hist);
  assert.equal(sb.weeks, 1); assert.equal(sb.pending, 0); assert.deepEqual(sb.byTopic['Real yields'], { strategist: { n: 1, hit: 0 }, veteran: { n: 1, hit: 1 } });
  assert.deepEqual(sb.byTopic['Positioning'], { strategist: { n: 0, hit: null }, veteran: { n: 0, hit: null } }, 'abstentions are not scored');
  assert.equal(sb.veteran.hit, 1); assert.equal(sb.strategist.hit, 0.5); assert.equal(sb.strategist.n, 2);
  assert.equal(V.scoreboard([]).weeks, 0);
  // teaching: from the strategist's learned block
  const t0 = V.teaching({}); assert.deepEqual(t0.adopted, []); assert.match(t0.line, /does not run/);
  const t1 = V.teaching({ learned: { active: ['v_ry4w'], recent: [{ action: 'adopt' }], challengers: { v_ry4w: { vs: 'ry', challenger: { hit: 0.58, t: 3.2 }, incumbent: { hit: 0.51, t: 0.6 }, adopted: true }, v_dxy4w: { vs: 'dxymom', challenger: null, incumbent: { hit: 0.5, t: 0.1 }, adopted: false } } } });
  assert.deepEqual(t1.adopted, ['v_ry4w']); assert.equal(t1.pending.length, 1); assert.match(t1.line, /adopted v_ry4w/); assert.match(t1.line, /v_dxy4w no record yet vs dxymom hit 50%, t 0.1/);
  // debate topics carry the numeric leans the scoreboard needs
  const C = cache(), s = {}; for (const [k, v] of Object.entries(C.fred)) s[k] = V.fromCache(v); s.gold = gold; s.dxy = dxy; s.avg10w = 3950;
  const ch = V.channels(s, NOW), d = V.debate(forecast(), ch, V.fingerprint(ch.changes), { now: NOW, base: null });
  const ry = d.topics.find((t) => t.topic === 'Real yields'); assert.equal(ry.m, -1); assert.equal(ry.v, 1);
  assert.equal(d.topics.find((t) => t.topic === 'Regime').m, null);
});

test('revision 1.3: the port names its skill version and reads the batch\'s real CPI pilot', () => {
  assert.equal(V.SKILL_VERSION, '1.3');
  const c = V.cpiPilot(); assert.equal(c.point, 0.255); assert.equal(c.status, 'unresolved'); assert.match(c.label, /not a scored forecast/); assert.equal(c.releaseUtc, '2026-11-10T13:30:00Z');
  assert.equal(V.cpiPilot('/nonexistent/ledger.jsonl'), null, 'the Vercel bundle has no research/: null, never a throw');
});


test('revision 1.3: release discipline — expectation captured before, first print kept, integrity checks, CPI rate context', () => {
  const at = '2026-11-10T13:30:00.000Z', T = Date.parse(at) / 1000;
  const fcPre = { playbook: [{ title: 'Core CPI m/m', at, consensus: '0.2%', previous: '0.3%', actual: null }, { title: 'Late item', at: new Date((NOW - DAY) * 1000).toISOString(), consensus: '1%' }] };
  const a = V.captureExpectations([], fcPre, NOW);
  assert.equal(a.hist.length, 1, 'an event already past is never captured after the fact');
  assert.equal(a.hist[0].expectation.consensus, '0.2%'); assert.equal(a.hist[0].firstPrint, null);
  // a later run with a changed consensus does not edit the captured expectation
  const b = V.captureExpectations(a.hist, { playbook: [{ ...fcPre.playbook[0], consensus: '0.3%' }] }, NOW + 3600);
  assert.equal(b.hist[0].expectation.consensus, '0.2%'); assert.equal(b.added.length, 0);
  // the print arrives 30 minutes after the release: first print attached once, surprise = print − captured expectation
  const c = V.captureExpectations(b.hist, { playbook: [{ ...fcPre.playbook[0], actual: '0.3%' }] }, T + 1800);
  assert.equal(c.hist[0].firstPrint.value, '0.3%'); assert.deepEqual(c.hist[0].firstPrint.flags, []);
  const d = V.captureExpectations(c.hist, { playbook: [{ ...fcPre.playbook[0], actual: '0.4%' }] }, T + 40 * DAY);
  assert.equal(d.hist[0].firstPrint.value, '0.3%', 'a revised value never replaces the first print');
  const S = { DFII10: [{ t: Date.UTC(2026, 10, 9) / 1000, v: 2.60 }, { t: Date.UTC(2026, 10, 10) / 1000, v: 2.68 }] };
  const r = V.releaseCheck(c.hist[0], S);
  assert.equal(r.trusted, true); assert.equal(r.surprise, 0.1); assert.equal(r.claim, V.CLAIM.descriptive);
  assert.equal(r.rates.observedBp, 8); assert.match(r.rates.read, /at or above the typical CPI day/); assert.match(r.rates.study, /6\.11 bp .* 4\.06 bp/);
  // a print first seen days late, or before its scheduled time, is not scored as a surprise
  const late = V.captureExpectations(b.hist, { playbook: [{ ...fcPre.playbook[0], actual: '0.3%' }] }, T + 3 * DAY);
  const rl = V.releaseCheck(late.hist[0]); assert.equal(rl.trusted, false); assert.equal(rl.surprise, null); assert.match(rl.checks[2].text, /may not be the first print/);
  const early = V.captureExpectations(b.hist, { playbook: [{ ...fcPre.playbook[0], actual: '0.3%' }] }, T - 600);
  assert.equal(V.releaseCheck(early.hist[0]).trusted, false); assert.match(early.hist[0].firstPrint.flags[0], /before the scheduled time/);
  // no captured expectation: print minus previous is never a surprise
  const none = V.captureExpectations([], { playbook: [{ title: 'Core CPI m/m', at, previous: '0.3%' }] }, NOW);
  const rn = V.releaseCheck(V.captureExpectations(none.hist, { playbook: [{ title: 'Core CPI m/m', at, actual: '0.5%' }] }, T + 600).hist[0]);
  assert.equal(rn.surprise, null); assert.match(rn.checks[0].text, /not a surprise/);
  assert.equal(V.CPI_RATE_STUDY.events, 36); assert.equal(V.CPI_RATE_STUDY.contrastBp, 2.06);
});

test('revision 1.3: build carries the releases, the claim type and the untrusted-print note; run writes veteran-expectations.json', () => {
  const C = cache(), fc = forecast({ playbook: [{ title: 'Core CPI m/m', at: new Date((NOW + 2 * DAY) * 1000).toISOString(), consensus: '0.2%', previous: '0.3%' }] });
  const { v, expectations } = V.build({ fc, cache: C, daily: { gold, dxy }, now: NOW });
  assert.equal(expectations.length, 1); assert.equal(v.releases.length, 1); assert.equal(v.releases[0].firstPrint, null);
  assert.equal(v.skillVersion, '1.3'); assert.ok(v.cpiRateStudy); assert.ok(Object.values(V.CLAIM).includes(v.card.claimType));
  assert.match(v.card.surprise, /captured before it \(0\.2%\); print minus previous is not a surprise/);
  // a print first seen 3 days after the release: kept, flagged, and the verdict says it is not read as a surprise
  const later = NOW + 5 * DAY, fc2 = forecast({ playbook: [{ ...fc.playbook[0], actual: '0.4%' }] });
  const o = V.build({ fc: fc2, cache: C, daily: { gold, dxy }, expectations, now: later });
  assert.equal(o.v.releases[0].trusted, false); assert.match(o.v.verdict.note, /not trusted as a surprise/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vet13-')); fs.mkdirSync(path.join(dir, 'macro'));
  fs.writeFileSync(path.join(dir, 'macro', 'forecast.json'), JSON.stringify(fc)); fs.writeFileSync(path.join(dir, 'macro', 'cache.json'), JSON.stringify(C));
  V.run({ dir, now: NOW, log: () => {} });
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran-expectations.json'), 'utf8')).length, 1);
});
