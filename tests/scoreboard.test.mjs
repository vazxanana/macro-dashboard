// Edge scoreboard (market-structure.html, script#ms-sb-js): the pure functions run here without a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = html.match(/<script id="ms-sb-js">([\s\S]*?)<\/script>/)[1];
const W = {};
vm.runInNewContext(src, { window: W });
const SB = W.MS_SB;
const NOW = 1_800_000_000;

test('stats: n, win rate, R per trade, drawdown, t, halves, last 30 days', () => {
  const pts = [1, -1, 2, -1, -1, 3].map((R, i) => ({ t: NOW - (6 - i) * 10 * 86400, R }));
  const s = SB.stats(pts, NOW);
  assert.equal(s.n, 6); assert.equal(s.wins, 3); assert.equal(s.R, 3); assert.equal(s.exp, 0.5);
  assert.equal(s.dd, -2);                       // peak +2 after trade 3, low 0 after trade 5
  assert.deepEqual([s.h1.n, s.h2.n], [3, 3]); assert.ok(Math.abs(s.h1.exp - 2 / 3) < 1e-9); assert.ok(Math.abs(s.h2.exp - 1 / 3) < 1e-9);
  assert.equal(s.l30.n, 3);                     // closed 30, 20 and 10 days ago
  assert.ok(s.t > 0 && s.t < 1);
  assert.deepEqual([...s.curve], [1, 0, 2, 1, 0, 3]);
});

test('verdict: edge needs t >= 2 and both halves positive; thin streams are "few"', () => {
  assert.equal(SB.verdict({ n: 10, t: 5, exp: 1 }), 'few');
  assert.equal(SB.verdict({ n: 40, t: 2.5, exp: 0.3, h1: { exp: 0.2 }, h2: { exp: 0.4 } }), 'edge');
  assert.equal(SB.verdict({ n: 40, t: 2.5, exp: 0.3, h1: { exp: -0.1 }, h2: { exp: 0.6 } }), 'promising');
  assert.equal(SB.verdict({ n: 40, t: -1.5, exp: -0.2, h1: { exp: -0.1 }, h2: { exp: -0.3 } }), 'losing');
  assert.equal(SB.verdict({ n: 40, t: 0.4, exp: 0.05, h1: { exp: 0.1 }, h2: { exp: 0 } }), 'unclear');
});

const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
test('build: every source becomes a stream, sorted by evidence, proposals become owner approvals', () => {
  const trades = mk(30, (i) => ({ k: 'scalp', name: 'Scalp', pair: 'M15 → M1', shadow: true, status: i % 3 ? 'loss' : 'win', R: i % 3 ? -1 : 1.5, opened: NOW - 9e5 + i * 1e4, closed: NOW - 9e5 + i * 1e4 + 100 }))
    .concat(mk(3, (i) => ({ k: 'replica', name: 'Replica', shadow: false, status: 'win', R: 2, closed: NOW - i * 1000 })));
  const backtest = { at: '2026-11-07T00:00:00Z', days: 30, tradeCols: ['market', 'setup', 'opened', 'fill', 'status', 'R_none', 'cost', 'd1', 'session', 'rr'],
    trades: mk(60, (i) => ['xau', 'rscalp', NOW - 2e6 + i * 3e4, 1, 'closed', i % 2 ? 1.6 : -1, 0.05, 'with', 'london', 2])
      .concat(mk(10, (i) => ['xau', 'rscalp', NOW - 1e6 + i, 1, 'closed', -1, 0, 'against', 'london', 2]))      // blocked by the D1 rule
      .concat(mk(5, (i) => ['xau', 'rscalp@mkt', NOW - 1e6 + i, 1, 'closed', 5, 0, 'with', 'london', 2])) };  // market twins: not counted
  const config = { filters: { rscalp: { d1: 'with' } }, focusSetups: [], replicaLive: ['xau'] };
  const coach = { proposals: [{ setup: 'rscalp', kind: 'promote', label: 'make rscalp live', n: 60, exp: 0.25 }, { setup: 'ICT A', kind: 'ictFilter', value: 'nofri', label: 'ICT A-setups: skip Fridays' }],
    ictWatch: [{ setup: 'ICT A', kind: 'ictWatch', value: 'h1opp', why: 'not yet' }] };
  const ictReplay = { from: '2025-08-01', trades: mk(40, (i) => ({ id: 'a' + i, aset: i % 2 === 0 || i > 30, status: i % 4 ? 'win' : 'loss', R: i % 4 ? 1.2 : -1, closed: NOW - 4e6 + i * 5e4 })),
    shadow: mk(4, (i) => ({ status: 'win', R: 1, closed: NOW - i })), shadowByVariant: { nofri: mk(25, (i) => ({ status: 'loss', R: -1, closed: NOW - i })) },
    totalsByVariant: { dip: { n: 4, wins: 4, R: 4 }, nofri: { n: 25, wins: 0, R: -25 }, h1opp: { n: 50, wins: 20, R: 6 } } };
  const ictTrades = [{ id: 'f1', aset: true, status: 'win', R: 2, closed: NOW - 50 }, { id: 'f2', aset: false, status: 'win', R: 5, closed: NOW - 40 }];
  const ictShadow = { variant: 'dip', trades: [{ status: 'loss', R: -1, closed: NOW - 10 }], variants: { nofri: { trades: [] }, h1opp: { trades: [] } } };
  const mirror = { state: { status: 'ok', map: { x: { councilR: 1, slipR: 0.1, closedAt: '2027-01-01T00:00:00Z' }, y: { status: 'open' } } }, execution: { n: 2, meanSlipR: 0.05, medianSlipR: 0.05, worstSlipR: 0.1 } };
  const rows = SB.build({ trades, config, coach, backtest, ictReplay, ictTrades, ictShadow, mirror, now: NOW });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));

  assert.equal(by['mer-scalp-shadow'].s.n, 30); assert.equal(by['mer-scalp-shadow'].status, 'shadow');
  assert.equal(by['mer-replica-live'].status, 'live'); assert.equal(by['mer-replica-live'].v, 'few');
  const rp = by['mer-rscalp-replay'];
  assert.equal(rp.s.n, 60, 'replay under the current rule, no @mkt twins'); assert.ok(Math.abs(rp.s.exp - (0.3 - 0.05)) < 1e-9, 'net of spread');
  assert.equal(rp.status, 'watch'); assert.equal(rp.ask.n, 1); assert.match(rp.ask.text, /Make rscalp live/);
  assert.equal(by['ict-a'].s.n, 26, '25 replay A-setups + 1 forward A-setup'); assert.equal(by['ict-a'].status, 'paper'); assert.match(by['ict-a'].ask.text, /Adopt filter: skip Fridays/);
  assert.equal(by['ict-nofri'].status, 'watch'); assert.equal(by['ict-nofri'].v, 'losing');
  assert.equal(by['ict-h1opp'].status, 'watch'); assert.equal(by['ict-h1opp'].s.n, 50, 'totals only when the file has no trade list'); assert.equal(by['ict-h1opp'].s.agg, true);
  assert.equal(by['ict-dip'].s.n, 5, 'dip replay + forward');
  assert.equal(by.mirror.s.n, 1); assert.ok(Math.abs(by.mirror.s.R - 0.9) < 1e-9); assert.match(by.mirror.note, /2 demo fills/);
  assert.equal(by.macro, undefined, 'no macro row without macro/forecast.json');
  // order: 20+ trades by t (best first, losers last), thin streams after
  const big = rows.filter((r) => r.s.n >= 20), tOf = (r) => r.s.t ?? (r.s.tFlat || 0) * 1e6;
  assert.ok(big.every((r, i) => !i || tOf(big[i - 1]) >= tOf(r)));
  assert.ok(rows.findIndex((r) => r.s.n < 20) > rows.indexOf(big[big.length - 1]));
  assert.equal(SB.waiting(coach).length, 2);
});

test('optional files: robustness verdicts attach to the matching stream; macro forecast adds a row', () => {
  const rows = SB.build({
    trades: [{ k: 'scalp', name: 'Scalp', shadow: true, status: 'win', R: 1, closed: NOW }],
    ictReplay: { trades: [{ aset: true, status: 'win', R: 1, closed: NOW }], shadowByVariant: { nofri: [] } },
    robust: { streams: [{ id: 'scalp', verdict: 'fragile', why: 'one half lost' }, { name: 'ICT A-setups', verdict: 'robust' }, { name: 'ICT A-setups: skip Fridays', verdict: 'not proven' }] },
    macro: { scorecard: { calls: [{ hit: true, resolved: NOW - 10 }, { hit: false, resolved: NOW - 5 }, { result: 'hit', resolved: NOW }] } }, now: NOW });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(by['mer-scalp-shadow'].robust, 'fragile'); assert.equal(by['ict-a'].robust, 'robust'); assert.equal(by['ict-nofri'].robust, 'notproven');
  assert.equal(by.macro.s.n, 3); assert.equal(by.macro.s.R, 1); assert.equal(by.macro.status, 'watch');
  assert.equal(SB.macroRow({ scorecard: { n: 12, hits: 8 } }).agg.n, 12);
  // council/macro.mjs format: per-asset hit-rate scorecards; the live log once it has 20+ days, else the replay
  const m = SB.build({ macro: { scorecard: { replay: { gold: { n: 400, hit: 0.55, base: 0.52, z: 1.2, brier: 0.248, pt: 1.1 } }, live: { gold: { n: 3, hit: 0.67, base: 0.67 } } } }, now: NOW })[0];
  assert.equal(m.id, 'macro'); assert.equal(m.s.n, 400); assert.equal(m.s.wins, 220); assert.ok(Math.abs(m.s.exp - 0.1) < 1e-9); assert.equal(m.s.t, 1.2); assert.equal(m.v, 'promising');
  assert.match(m.src, /replay/); assert.match(m.note, /55% against a 52% base rate/);
});

test('forward trades count after costs (Rnet) where recorded, and keep what the equity-curve tooltip shows', () => {
  const trades = [
    { k: 'scalp', name: 'Scalp', shadow: true, status: 'loss', R: -1, Rnet: -1.4, costR: 0.4, market: 'xau', label: 'XAU/USD', side: 'buy', opened: NOW - 200, closed: NOW - 100 },
    { k: 'scalp', name: 'Scalp', shadow: true, status: 'win', R: 2, Rnet: 1.6, costR: 0.4, market: 'xau', label: 'XAU/USD', side: 'sell', opened: NOW - 90, closed: NOW - 50 },
    { k: 'scalp', name: 'Scalp', shadow: true, status: 'win', R: 1, closed: NOW - 10 }];   // no cost recorded: as recorded
  const r = SB.build({ trades, now: NOW }).find((x) => x.id === 'mer-scalp-shadow');
  assert.ok(Math.abs(r.s.R - 1.2) < 1e-9, 'net total: -1.4 + 1.6 + 1');
  assert.deepEqual([...r.s.curve].map((v) => +v.toFixed(2)), [-1.4, 0.2, 1.2]);
  const p = r.s.P[0];
  assert.equal(p.g, -1); assert.equal(p.c, 0.4); assert.equal(p.sh, 1); assert.equal(p.m, 'XAU/USD'); assert.equal(p.sd, 'buy'); assert.equal(p.st, 'loss');
  assert.equal(r.s.P[2].c, undefined);
});

// 11 Nov 2026: a verdict that rests on a backtest says so. The machine verdict (r.v) is what the digest and week pane compare.
test('backtest only: the chip says it, the machine verdict does not change, the digest sees no movers', async () => {
  const win = (i) => (i % 4 ? 1.2 : -1);
  // a system replay with an edge verdict and 3 forward live trades of the same setup; a forward stream with 40 trades and the same verdict
  const replay = { from: '2020-01-01', trades: mk(80, (i) => ({ k: 'gtrend', name: 'Gold trend', status: win(i) > 0 ? 'win' : 'loss', R: win(i), closed: NOW - 9e6 + i * 1e5 })) };
  const trades = mk(3, (i) => ({ k: 'gtrend', name: 'Gold trend', shadow: false, status: 'win', R: 1, closed: NOW - i * 1000 }))
    .concat(mk(2, (i) => ({ k: 'gtrend', name: 'Gold trend', shadow: true, status: 'loss', R: -1, closed: NOW - i * 1000 })))
    .concat(mk(40, (i) => ({ k: 'fwd', name: 'Forward stream', shadow: true, status: win(i) > 0 ? 'win' : 'loss', R: win(i), closed: NOW - 4e6 + i * 5e4 })));
  const ictReplay = { from: '2025-08-01', trades: mk(60, (i) => ({ id: 'a' + i, aset: true, status: win(i) > 0 ? 'win' : 'loss', R: win(i), closed: NOW - 4e6 + i * 5e4 })) };
  const ictTrades = mk(5, (i) => ({ id: 'f' + i, aset: true, status: 'win', R: 1, closed: NOW - i * 100 }));
  const macro = { scorecard: { replay: { gold: { n: 400, hit: 0.55, base: 0.52, z: 1.2 } }, live: { gold: { n: 3, hit: 0.67, base: 0.67 } } } };
  const D = { trades, replay, ictReplay, ictTrades, macro, config: { goldTrend: true }, now: NOW };
  const rows = SB.build(D), by = Object.fromEntries(rows.map((r) => [r.id, r]));

  const rp = by['mer-gtrend-sysreplay'];
  assert.equal(rp.v, 'edge', 'the machine verdict is the old one'); assert.equal(rp.fwd, 0); assert.equal(rp.vBt, true);
  assert.equal(rp.vShow, 'Edge (backtest only)');
  assert.match(rp.vTip, /None of this row’s 80 trades is a forward/); assert.match(rp.vTip, /A backtest is not a forward record\./);
  assert.match(rp.vTip, /own row: 5 closed \(3 live, 2 shadow\)/, 'the same setup\'s forward count, live and shadow apart');
  assert.match(SB.build({ replay, now: NOW })[0].vTip, /The same setup has no closed forward trade yet\.$/);
  const fw = by['mer-fwd-shadow'];
  assert.equal(fw.v, 'edge'); assert.equal(fw.fwd, 40); assert.equal(fw.vBt, false); assert.equal(fw.vShow, 'Edge'); assert.equal(fw.vTip, '');
  const ia = by['ict-a'];   // 60 replay + 5 forward: under 20 forward, so the verdict rests on the replay
  assert.equal(ia.v, 'edge'); assert.equal(ia.fwd, 5); assert.equal(ia.vShow, 'Edge (backtest only)'); assert.match(ia.vTip, /Only 5 of this row’s 65 trades are forward/);
  assert.equal(by.macro.v, 'promising'); assert.equal(by.macro.vShow, 'Promising (backtest only)'); assert.match(by.macro.vTip, /Only 3 of this row’s 400 scored days/);
  assert.equal(by['mer-gtrend-live'].v, 'few'); assert.equal(by['mer-gtrend-live'].vShow, 'Too few'); assert.equal(by['mer-gtrend-live'].vBt, false);

  // shown(): only Edge and Promising are relabelled; 20 forward trades is enough; a row that does not know its forward count is left alone
  assert.equal(SB.FWD_MIN, 20);
  assert.equal(SB.shown({ v: 'losing', fwd: 0, s: { n: 50 } }).label, 'Losing');
  assert.equal(SB.shown({ v: 'unclear', fwd: 0, s: { n: 50 } }).bt, false);
  assert.equal(SB.shown({ v: 'edge', fwd: 20, s: { n: 50 } }).label, 'Edge');
  assert.equal(SB.shown({ v: 'edge', fwd: 19, s: { n: 50 } }).label, 'Edge (backtest only)');
  assert.equal(SB.shown({ v: 'edge', s: { n: 50 } }).label, 'Edge');
  assert.match(SB.shown({ v: 'promising', fwd: 1, s: { n: 50 } }).tip, /Only 1 of this row’s 50 trades is a forward \(live or paper\) trade,/);

  // every machine verdict is still one of the five words, and nothing but the display fields carries the new wording
  for (const r of rows) { assert.match(r.v, /^(edge|promising|unclear|losing|few)$/); assert.ok(!/backtest/.test(r.v)); assert.equal(typeof r.vShow, 'string'); }

  // the digest: a baseline saved before this change (plain machine verdicts) against today's rows = no movers, same map
  const dg = await import('../council/digest.mjs');
  const before = Object.fromEntries(rows.map((r) => [r.id, r.v]));
  assert.deepEqual(dg.verdictMap(rows), before);
  assert.equal(dg.movers(rows, before).length, 0);
  assert.ok(Object.values(dg.verdictMap(rows)).every((v) => dg.VERDICT[v]), 'the digest can still name every verdict');
  assert.equal(dg.movers(rows, { ...before, 'mer-gtrend-sysreplay': 'promising' }).map((m) => [m.id, m.from, m.to].join(' ')).join('|'), 'mer-gtrend-sysreplay promising edge');
});

test('backtest only: the page shows the display field, the legend explains it, the row class keeps the machine verdict', () => {
  assert.match(src, /class="sb-v v-' \+ r\.v \+ \(r\.vBt \? ' v-bt" title="' \+ esc\(r\.vTip\)/);
  assert.match(src, /'<tr class="sb-r v-' \+ r\.v \+ \(r\.vBt \? ' bt' : ''\)/);
  assert.match(src, /if \(r\.vBt\) bits\.push\(/, 'the opened row says it in words (a tooltip does not open on touch)');
  assert.match(html, /<p class="ms-note sb-foot">[^<]*(<b>[^<]*<\/b>[^<]*)*<b>\(backtest only\)<\/b> after Edge or Promising: fewer than 20 of the row’s trades are forward/);
  assert.match(html, /\.sb-v\.v-bt \{ background: none; border-style: dashed; \}/);
});
