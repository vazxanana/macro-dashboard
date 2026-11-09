// Analyst report blocks (council/analyst.mjs): the section splicer every member uses on analysis/latest.md, the Live Scalp rule
// check and the Coach churn block, which had no tests (9 Nov reliability audit). Fixtures shaped like council-data samples.
import test from 'node:test';
import assert from 'node:assert/strict';
import { injectSection, liveRuleSection, coachChurnSection, churnSubject, newsAround } from '../council/analyst.mjs';
import { auditTopic } from '../council/coach.mjs';

const S = '<!-- live-rule:start -->', E = '<!-- live-rule:end -->';
const NOW = Date.UTC(2026, 10, 9, 14, 0) / 1000;   // Mon 9 Nov 2026 14:00 UTC (overlap session)

test('injectSection: replace, insert before Top 3, append; idempotent', () => {
  const md = '# Brief\n\nWeekly text.\n\n## Top 3 to watch\n\n1. Gold\n';
  const a = injectSection(md, `${S}\nA\n${E}`);
  assert.ok(a.indexOf(S) < a.indexOf('## Top 3'));
  const b = injectSection(a, `${S}\nB\n${E}`);
  assert.equal(b.split(S).length, 2); assert.match(b, /\nB\n/); assert.doesNotMatch(b, /\nA\n/);
  assert.equal(injectSection(b, `${S}\nB\n${E}`), b);
  assert.match(injectSection('# x', `${S}\nC\n${E}`), /# x\n\n<!-- live-rule:start -->\nC\n<!-- live-rule:end -->\n$/);
  assert.equal(injectSection(md, ''), md, 'an empty section keeps the report');
});

test('injectSection: an orphan start marker (end lost) never swallows the text after it on the next round', () => {
  // a report whose live-rule block lost its end marker (cut short / hand edit): the owner's weekly text sits between
  const md = `# Brief\n\n${S}\nold block\n\nThe Analyst's weekly text that must survive.\n\n## Top 3 to watch\n\n1. Gold\n`;
  const once = injectSection(md, `${S}\nnew 1\n${E}`);
  const twice = injectSection(once, `${S}\nnew 2\n${E}`);
  assert.match(twice, /The Analyst's weekly text that must survive\./);
  assert.match(twice, /## Top 3 to watch/);
  assert.equal(twice.split(S).length, 2, 'one block, no orphan marker left');
  assert.match(twice, /new 2/);
});

test('injectSection: an orphan end marker before the block is dropped, the block is written once', () => {
  const md = `# Brief\n${E}\nText.\n\n## Top 3 to watch\n`;
  const out = injectSection(md, `${S}\nX\n${E}`);
  assert.equal(out.split(E).length, 2); assert.match(out, /Text\./); assert.ok(out.indexOf(S) < out.indexOf(E));
});

const snapshot = { markets: {
  xau: { label: 'XAU/USD', trend: { '1d': 1 }, setups: [{ k: 'scalp', state: 'READY', side: 'sell' }] },
  eurusd: { label: 'EUR/USD', trend: { '1d': -1 }, setups: [] },
  btc: { label: 'BTC/USD', trend: { '1d': 0 }, setups: [{ k: 'scalp', state: 'WAIT', side: 'buy' }] } },
  d1src: { xau: { src: 'OANDA', trend: 1, kraken: -1 }, eurusd: { src: 'Kraken', why: 'timeout' } } };
const config = { minRR: 1.5, focusSetups: ['scalp'], filters: { scalp: { d1: 'with', noSession: ['asia'], noMarket: ['btc'] } }, replicaLive: [] };
const backtest = { days: 30, tradeCols: ['setup', 'market', 'fill', 'status', 'R_none', 'cost', 'd1', 'session'], trades: [
  ['scalp', 'xau', 1, 'win', 2, 0.1, 'with', 'london'], ['scalp', 'xau', 1, 'loss', -1, 0.1, 'with', 'london'],
  ['scalp', 'xau', 1, 'loss', -1, 0.1, 'against', 'london'],   // other D1: not under the live rule
  ['scalp', 'xau', 0, 'loss', -1, 0, 'with', 'london'],        // never filled
  ['scalp', 'btc', 1, 'win', 3, 0, 'with', 'london'],          // a market the rule skips: shown, not in the total
  ['scalp', 'eurusd', 1, 'loss', -1, 0.05, 'with', 'asia'] ] };   // a session the rule skips

test('liveRuleSection: rule text, per-market verdicts, the replay under the live rule after costs', () => {
  const s = liveRuleSection({ snapshot, config, backtest, now: NOW });
  assert.ok(s.startsWith(S) && s.endsWith(E));
  assert.match(s, /Rule now: Scalp \(M15 → M1\) with D1 only, not in asia, skips btc\./);
  assert.match(s, /Session now: \*\*overlap\*\*\./);
  assert.match(s, /\| XAU\/USD \| up \(OANDA; Kraken says down\) \| \*\*buy\*\* only \| READY sell \(blocked: wrong side\) \| 2 trades, 50% won, \+0\.40R a trade \|/);
  assert.match(s, /\| EUR\/USD \| down \(Kraken, OANDA failed\) \| \*\*sell\*\* only \| — \| no trades \|/);
  assert.match(s, /\| BTC\/USD \| flat \(Kraken\) \| no \(rule skips BTC\/USD, no D1 trend\) \| WAIT buy \| 1 trades, 100% won, \+3\.00R a trade \|/);
  assert.match(s, /Replay total on the markets it trades live: 2 trades, \+0\.40R a trade \(\+0\.80R\)/);
  assert.match(s, /reward:risk ≥ 1\.5/);
});

test('liveRuleSection: no market data or no config keeps the last block; a synthetic backtest is ignored', () => {
  assert.equal(liveRuleSection({ snapshot: { markets: {} }, config, backtest, now: NOW }), '');
  assert.equal(liveRuleSection({ snapshot, config: null, backtest, now: NOW }), '');
  const s = liveRuleSection({ snapshot, config: { ...config, focusSetups: [] }, backtest: { ...backtest, fake: true }, now: Date.UTC(2026, 10, 9, 3) / 1000 });
  assert.match(s, /\*\*Scalp is not live right now\*\*/);
  assert.match(s, /the rule skips it, so no live Scalp until it ends/);
  assert.match(s, /Replay total on the markets it trades live: 0 trades, \+0\.00R a trade/);
});

test('churnSubject / auditTopic: Coach history lines grouped by the rule they move', () => {
  assert.equal(churnSubject('Minimum stop 0.6 → 0.7 ATR'), 'Minimum stop');
  assert.equal(churnSubject('Break-even at 1R → 1.5R'), 'Break-even');
  assert.equal(churnSubject('Paused scalp (3 losses)'), 'scalp · pause');
  assert.equal(churnSubject('scalp, rscalp: only with D1 (+0.3R over 40)'), 'scalp, rscalp · D1 rule');
  assert.equal(churnSubject('swing: skip the london session (−0.4R over 35)'), 'swing · london session');
  assert.equal(churnSubject('swing: break-even off'), 'swing · break-even');
  assert.equal(churnSubject('Something else (why)'), 'Something else');
  assert.equal(auditTopic('scalp: skip the asia session'), 'scalp|asia');
  assert.equal(auditTopic('Minimum stop 0.6 → 0.7 ATR'), 'all|stop');
  assert.equal(auditTopic(''), 'all|other');
});

test('coachChurnSection: counts Coach changes of the last 7 days only, flags back-and-forth and one-way settings', () => {
  const at = (h) => new Date((NOW - h * 3600) * 1000).toISOString();
  const history = [
    { at: at(100), by: 'coach-stats', change: 'Minimum stop 0.5 → 0.6 ATR' }, { at: at(60), by: 'coach-stats', change: 'Minimum stop 0.6 → 0.7 ATR' },
    { at: at(10), by: 'coach-stats', change: 'Minimum stop 0.7 → 0.8 ATR' },
    { at: at(90), by: 'coach-stats', change: 'scalp: only with D1' }, { at: at(50), by: 'coach-stats', change: 'scalp: no D1 rule' }, { at: at(5), by: 'coach-stats', change: 'scalp: only with D1' },
    { at: at(20), by: 'owner', change: 'scalp: only with D1' },                    // owner changes are not counted
    { at: at(24 * 9), by: 'coach-stats', change: 'Break-even at 1R → 1.5R' } ];   // older than 7 days
  const s = coachChurnSection({ config: { history }, now: NOW });
  assert.match(s, /\| Minimum stop \*\*\(up every time\)\*\* \| 3 \| 0\.5 → 0\.6 → 0\.7 → 0\.8/);
  assert.match(s, /\| scalp · D1 rule \*\*\(back and forth\)\*\* \| 3 \|/);
  assert.doesNotMatch(s, /Break-even/);
  assert.match(s, /6 changes on 2 rules; 1 rule went back and forth 3\+ times; 1 setting only ever moved one way/);
  assert.match(coachChurnSection({ config: {}, now: NOW }), /No Coach rule changes in this period\./);
});

test('newsAround: calendar items for the pair\'s currencies plus recorded news not already on the calendar', () => {
  // 10 Nov 2026 13:30 UTC is US CPI on the council calendar (council/events.mjs)
  const t = Date.UTC(2026, 10, 10, 13, 30) / 1000;
  const tr = { label: 'EUR/USD', pm: { news: [{ t: t + 120, title: 'CPI m/m' }, { t: t + 3 * 3600, title: 'Fed speaker' }] } };
  const n = newsAround(tr, t - 1800, t + 4 * 3600);
  assert.ok(n.some((e) => e.country === 'USD' && /CPI/i.test(e.title) && e.t === t), 'the calendar CPI');
  assert.equal(n.filter((e) => /CPI/i.test(e.title)).length, 1, 'the recorded CPI is the same release, not a second one');
  assert.ok(n.some((e) => e.title === 'Fed speaker'));
  assert.deepEqual(n.map((e) => e.t), n.map((e) => e.t).slice().sort((a, b) => a - b));
});
