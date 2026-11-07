// node --test tests/robustness.test.mjs — the robustness audit (research/robustness.mjs) on synthetic trade lists
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  rng, normCdf, normInv, describe, maxDrawdown, walkForward, bootstrapCI, mcDrawdown, costSensitivity, bonferroni, deflatedSharpe,
  verdict, audit, auditSummary, coachPromotionWF, coachToggles, rebuildTrades, ictTrade, ictCostPts, buildClaims, run, toMarkdown,
} from '../research/robustness.mjs';

// normal draws (Box-Muller) from the seeded generator
function normals(n, mean, sd, seed = 1) { const r = rng(seed), out = []; for (let i = 0; i < n; i++) { const u = Math.max(1e-12, r()), v = r(); out.push(mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)); } return out; }
const asTrades = (R, cost = 0.05, t0 = 1.6e9, step = 86400) => R.map((r, i) => ({ t: t0 + i * step, gross: r + cost, cost }));
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} vs ${b}`);

test('normal CDF and its inverse agree', () => {
  near(normCdf(0), 0.5, 1e-7); near(normCdf(1.959964), 0.975, 1e-6); near(normInv(0.975), 1.959964, 1e-5);
  for (const x of [-3, -1.2, 0.3, 2.5]) near(normInv(normCdf(x)), x, 1e-4, 'round trip');
  assert.equal(normInv(0), -Infinity); assert.equal(normInv(1), Infinity);
});

test('describe, drawdown and the walk-forward split', () => {
  const d = describe([1, -1, 1, -1, 2]);
  assert.equal(d.n, 5); near(d.mean, 0.4, 1e-12); near(d.wr, 0.6, 1e-12); near(d.sum, 2, 1e-12);
  near(d.sd, Math.sqrt(((0.6 ** 2) * 2 + (1.4 ** 2) * 2 + 1.6 ** 2) / 4), 1e-12);
  assert.equal(maxDrawdown([1, -2, 1, -1]), 2);
  assert.equal(maxDrawdown([1, 2, 3]), 0);
  const wf = walkForward([1, 1, 1, 1, 1, 1, -1, -1, -1, -1]);
  assert.equal(wf.is.n, 6); assert.equal(wf.oos.n, 4); assert.equal(wf.is.mean, 1); assert.equal(wf.oos.mean, -1);
  assert.equal(describe([]).n, 0);
});

test('bootstrap CI: excludes 0 for a clear edge, includes it for noise; reproducible with the seed', () => {
  const edge = normals(400, 0.5, 1, 3), noise = normals(400, 0, 1, 4);
  const a = bootstrapCI(edge, { iters: 2000, seed: 9 }), b = bootstrapCI(noise, { iters: 2000, seed: 9 });
  assert.ok(a.lo > 0 && a.hi > a.lo); assert.ok(b.lo < 0 && b.hi > 0); assert.ok(a.pLE0 < 0.01);
  assert.deepEqual(bootstrapCI(edge, { iters: 500, seed: 2 }), bootstrapCI(edge, { iters: 500, seed: 2 }));
  assert.equal(bootstrapCI([1]).lo, null);
});

test('Monte Carlo drawdown: shuffles never beat a run of all-winners, and the 95th percentile is above the median', () => {
  assert.equal(mcDrawdown([1, 2, 0.5], { iters: 200 }).dd95, 0);
  const R = normals(300, 0.1, 1, 5), m = mcDrawdown(R, { iters: 1000, seed: 3 });
  assert.ok(m.dd95 >= m.dd50 && m.dd50 > 0); assert.equal(m.ddActual, maxDrawdown(R));
  // a losing series always ends in a drawdown at least as deep as its total loss
  const L = mcDrawdown([-1, -1, 0.5, -1], { iters: 100 }); assert.ok(L.dd50 >= 2.5 - 1e-12);
});

test('cost sensitivity scales the cost in R per trade', () => {
  const T = [{ gross: 1, cost: 0.1 }, { gross: -1, cost: 0.1 }, { gross: 0.5, cost: 0.2 }];
  const c = costSensitivity(T);
  near(c.x0.mean, 0.5 / 3, 1e-12); near(c.x1.mean, 0.1 / 3, 1e-12); near(c['x1.5'].mean, (0.5 - 0.6) / 3, 1e-12); near(c.x2.mean, (0.5 - 0.8) / 3, 1e-12);
});

test('multiple testing: the bar rises with the number of tries', () => {
  near(bonferroni(2, 1).tReq, 1.645, 1e-3); near(bonferroni(2, 100).tReq, 3.29, 1e-2);
  assert.ok(bonferroni(3, 10).pAdj < bonferroni(3, 100).pAdj); assert.equal(bonferroni(0, 50).pAdj, 1);
  const s = { n: 200, mean: 0.2, sd: 1, skew: 0, kurt: 3 };
  const d1 = deflatedSharpe(s, 1).dsr, d100 = deflatedSharpe(s, 100).dsr;
  assert.ok(d1 > 0.99 && d100 < d1); assert.equal(deflatedSharpe(s, 1).sr0, 0);
  assert.ok(deflatedSharpe({ ...s, mean: 0.4 }, 100).dsr > d100, 'a higher Sharpe deflates less');
  assert.ok(deflatedSharpe({ ...s, skew: -2, kurt: 12 }, 100).dsr < d100, 'fat left tails cost confidence');
  assert.equal(deflatedSharpe({ n: 2, mean: 1, sd: 1 }, 5).dsr, null);
});

test('verdicts: robust, fragile and not proven', () => {
  const strong = audit(asTrades(normals(500, 0.4, 1, 11)), { N: 10, iters: 1000 });
  assert.equal(strong.verdict, 'robust', strong.why.join('; '));
  const weak = audit(asTrades(normals(150, 0.12, 1, 12)), { N: 300, iters: 1000 });
  assert.equal(weak.verdict, 'fragile', weak.why.join('; ')); assert.ok(weak.why.some((w) => /Bonferroni/.test(w)));
  const losing = audit(asTrades(normals(300, -0.2, 1, 13)), { N: 1, iters: 1000 });
  assert.equal(losing.verdict, 'not proven'); assert.ok(losing.why.some((w) => /out-of-sample/.test(w)));
  const few = audit(asTrades([2, 2, 2, -1]), { N: 1, iters: 100 });
  assert.equal(few.verdict, 'not proven'); assert.match(few.why[0], /only 4 trades/);
  // costs: an edge that only exists before costs fails the 2x test
  const thin = audit(normals(2000, 0.15, 0.5, 14).map((r, i) => ({ t: i, gross: r, cost: 0.1 })), { N: 1, iters: 500 });
  assert.notEqual(thin.verdict, 'robust'); assert.ok(thin.why.some((w) => /2x costs/.test(w)));
});

test('a rule fitted on the whole record cannot be robust; a positive untouched sample can be', () => {
  const T = asTrades(normals(500, 0.4, 1, 21), 0.05, Date.parse('2024-01-01') / 1000);
  const fitted = audit(T, { N: 10, iters: 500, fitFrom: '2023-01-01' });
  assert.equal(fitted.untouched.n, 0); assert.equal(fitted.verdict, 'fragile'); assert.ok(fitted.why.some((w) => /no untouched sample/.test(w)));
  const T2 = asTrades(normals(500, 0.4, 1, 22), 0.05, Date.parse('2020-01-01') / 1000);
  const ok = audit(T2, { N: 10, iters: 500, fitFrom: '2021-01-01' });
  assert.ok(ok.untouched.n > 300); assert.equal(ok.verdict, 'robust', ok.why.join('; '));
  // untouched period losing: not robust even though the rest is strong
  const T3 = asTrades([...normals(100, -0.3, 1, 23), ...normals(400, 0.6, 1, 24)], 0.05, Date.parse('2020-01-01') / 1000);
  const bad = audit(T3, { N: 10, iters: 500, fitFrom: '2020-04-10' });
  assert.equal(bad.untouched.n, 100); assert.notEqual(bad.verdict, 'robust'); assert.ok(bad.why.some((w) => /untouched period/.test(w)));
});

test('summary-only claims use normal approximations', () => {
  const s = auditSummary({ is: { n: 400, mean: 0.1, t: 2 }, oos: { n: 100, mean: 0.3, t: 3 }, costPerTrade: 0.05 }, { N: 1 });
  assert.equal(s.n, 500); near(s.mean, 0.14, 1e-12); assert.ok(s.boot.approx && s.boot.lo < s.mean && s.boot.hi > s.mean);
  near(s.cost.x2.mean, 0.09, 1e-12); near(s.cost.x0.mean, 0.19, 1e-12); assert.equal(s.mc.dd95, null); assert.equal(s.summaryOnly, true);
});

test('ICT trade costs: micro futures ticks + commission over the stop, times size', () => {
  near(ictCostPts('NQ'), 3 * 0.25 + 1.24 / 2, 1e-12); near(ictCostPts('gc'), 0.3 + 0.124, 1e-12); assert.equal(ictCostPts('XX'), 0);
  const t = ictTrade({ short: 'NQ', r0: 100, R: 3, size: 1.5, signalAt: 10 });
  near(t.cost, ictCostPts('NQ') / 100 * 1.5, 1e-12); assert.equal(t.gross, 3); assert.equal(t.t, 10);
});

test('rebuild lists: trades with an add pay two units of the median cost, and net stays the listed R', () => {
  const L = [{ t: 1, R: 0.9, gross: 1 }, { t: 2, R: -1.1, gross: -1 }, { t: 3, R: 4, gross: 2 }];
  const T = rebuildTrades(L);
  near(T[0].cost, 0.1, 1e-12); near(T[2].cost, 0.2, 1e-12); for (let i = 0; i < 3; i++) near(T[i].gross - T[i].cost, L[i].R, 1e-12);
});

test('Coach promotions walk-forward: promotes a setup that wins every window and books only the following week', () => {
  const D = 86400, t0 = 1.75e9, rows = [];
  // setup "good": +1/-0.5 alternating, 6 a day -> clears n>=100, +0.10R, both halves; "bad" loses
  for (let d = 0; d < 70; d++) for (let k = 0; k < 6; k++) {
    const opened = t0 + d * D + k * 3600;
    rows.push({ setup: 'good', market: 'xau', side: 'buy', opened, session: 'london', d1: 'with', rr: 2, R: k % 2 ? -0.5 : 1 });
    rows.push({ setup: 'bad', market: 'xau', side: 'sell', opened: opened + 60, session: 'london', d1: 'with', rr: 2, R: -0.3 });
  }
  const wf = coachPromotionWF(rows, { filters: {} }, { win: 30, step: 7 });
  assert.ok(wf.picks.length >= 5); assert.ok(wf.picks.every((p) => p.setup === 'good'));
  assert.ok(wf.trades.length > 0 && wf.trades.every((x) => x.setup === 'good' && x.opened >= t0 + 30 * D));
  assert.equal(new Set(wf.trades.map((x) => x.opened)).size, wf.trades.length, 'no trade counted twice');
  assert.deepEqual(coachPromotionWF([], {}), { picks: [], trades: [], selMean: null });
});

test('Coach toggles: counts changes, cited sample sizes and topics that flipped', () => {
  const h = [
    { by: 'coach-stats', change: 'scalp: skip the overlap session', why: '-0.61R over 10 trades there' },
    { by: 'coach-stats', change: 'scalp: trading the overlap session again', why: 'Blocked trades made +0.27R over 12.' },
    { by: 'coach-backtest', change: 'intraday: only against D1', why: 'over 40 replay trades' },
    { by: 'user', change: 'scalp: live', why: 'owner' },
  ];
  const t = coachToggles(h);
  assert.equal(t.n, 3); assert.equal(t.withN, 3); assert.equal(t.medianN, 12); assert.equal(t.underThirty, 2); assert.equal(t.flipped, 1); assert.equal(t.maxFlips, 2);
});

test('end to end on a synthetic council-data folder: writes robustness.json and robustness.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rob-')), out = path.join(dir, 'out');
  fs.mkdirSync(path.join(dir, 'ict')); fs.mkdirSync(path.join(dir, 'research'));
  const R = normals(120, 0.3, 1.2, 31), t0 = 1.755e9;
  const trades = R.map((r, i) => ({ id: `nq-b-${i}-r`, market: 'nq', short: 'NQ', side: 'buy', signalAt: t0 + i * 7200, opened: t0 + i * 7200, closed: t0 + i * 7200 + 3600, r0: 80, R: +r.toFixed(2), size: 1, aset: i % 2 === 0, status: r > 0 ? 'win' : 'loss' }));
  const nofri = trades.filter((x) => x.aset && x.R > -0.9).map((x) => ({ ...x, id: x.id.replace(/-r$/, '-nofri-r'), variant: 'nofri', shadow: true }));
  fs.writeFileSync(path.join(dir, 'ict/replay.json'), JSON.stringify({ at: 'x', from: '2025-08-01', trades, shadow: [], shadowByVariant: { nofri }, totalsA: { n: 60, R: 18 }, totalsByVariant: { nofri: { n: nofri.length, R: 10 } } }));
  const cols = ['market', 'setup', 'side', 'opened', 'filled', 'rr', 'd1', 'struct', 'session', 'R_none', 'cost', 'fill', 'status'];
  const bt = normals(80, -0.1, 1, 32).map((r, i) => ['eurusd', 'scalp', 'buy', t0 + i * 3600, t0 + i * 3600, 2, i % 2 ? 'against' : 'with', 'n/a', 'london', +r.toFixed(2), 0.1, 1, 'closed']);
  fs.writeFileSync(path.join(dir, 'backtest.json'), JSON.stringify({ at: 'x', from: 'a', to: 'b', days: 30, tradeCols: cols, trades: bt }));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ filters: { scalp: { d1: 'against' } }, history: [{ by: 'coach-stats', change: 'scalp: skip the asia session', why: 'over 9 trades' }] }));
  const doc = run(dir, out, { iters: 300, at: '2026-11-07T00:00:00Z', repoOut: path.join(dir, 'none') });
  const ids = doc.claims.map((c) => c.id);
  for (const id of ['ict-a', 'ict-nofri', 'ict-all', 'scalp-30d', 'swing-adx-fwd', 'scalp-histdata', 'swing-adx', 'coach-toggles']) assert.ok(ids.includes(id), id);
  const a = doc.claims.find((c) => c.id === 'ict-a'); assert.equal(a.n, 60); assert.ok(['robust', 'fragile', 'not proven'].includes(a.verdict));
  assert.equal(doc.claims.find((c) => c.id === 'scalp-30d').n, 40, 'only the live filter (against D1) is audited');
  assert.ok(doc.claims.find((c) => c.id === 'ict-nofri').dropped.n > 0);
  const J = JSON.parse(fs.readFileSync(path.join(out, 'robustness.json'), 'utf8')); assert.equal(J.at, '2026-11-07T00:00:00Z');
  const md = fs.readFileSync(path.join(out, 'robustness.md'), 'utf8');
  assert.match(md, /# Robustness audit/); assert.match(md, /\| ICT A-setups \(desk replay\) \|/); assert.match(md, /## Method/);
  // missing files are skipped, not fatal
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rob-empty-'));
  const e = buildClaims(empty, { iters: 50, repoOut: path.join(empty, 'none') });
  assert.ok(e.claims.every((c) => ['scalp-histdata', 'swing-adx', 'ict-a-2008'].includes(c.id)))   // repo-file summaries only;
  assert.match(toMarkdown({ at: 'x', ...e }), /Swing D1 ADX band/);
});
