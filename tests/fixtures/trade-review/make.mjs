// Builds tests/fixtures/trade-review (deterministic; a made-up desk, not real trades): node tests/fixtures/trade-review/make.mjs
// The files it writes are committed; re-run only on purpose (tests/trade-review.test.mjs names their figures).
import fs from 'node:fs';
const D = new URL('.', import.meta.url).pathname, T0 = 1794700800;   // 2026-11-15 00:00 UTC
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const trades = [], research = [];
// shadow scalp: 80 trades; the Asia fills (02:00 UTC) lose, the overlap fills (13:00 UTC) win more often
for (let i = 0; i < 80; i++) {
  const asia = i % 4 === 0, day = T0 - 40 * 86400 + Math.floor(i / 2) * 86400, e = day + (asia ? 2 : 13) * 3600 + (i % 2) * 1800;
  const win = asia ? rnd() < 0.1 : rnd() < 0.6, R = win ? 1.5 : -1, cost = 0.08;
  trades.push({ id: `xau-scalp-${e}`, market: i % 5 === 0 ? 'eurusd' : 'xau', k: 'scalp', name: 'Scalp', side: i % 2 ? 'buy' : 'sell', entry: 4000, stop: 3995, t1: 4007.5, rr: 1.5, opened: e, filled: e,
    closed: e + (win ? 7200 : (i % 3 === 0 ? 900 : 5400)), status: win ? 'win' : 'loss', R, costR: cost, Rnet: +(R - cost).toFixed(3), exitKind: win ? 'target' : 'stop', mfe: win ? 1.4 : (i % 7 === 0 ? 1.1 : 0.3), mae: 0.5,
    shadow: true, blockedBy: ['focus'], feat: { session: asia ? 'asia' : 'overlap' } });
}
// live gold daily engulf: 3 trades (one trailed winner)
for (let i = 0; i < 3; i++) {
  const e = T0 - (10 - i * 3) * 86400, w = i === 1;
  trades.push({ id: `xau-geg-${e}`, market: 'xau', k: 'geg', name: 'Gold daily engulf', side: 'buy', entry: 4000, stop: 3980, t1: 4200, rr: 10, opened: e, filled: e, closed: e + 86400,
    status: w ? 'win' : 'loss', R: w ? 2.4 : -1, costR: 0.06, Rnet: w ? 2.34 : -1.06, exitKind: 'stop', ...(w ? { trailMoved: true, exit: 'trailing stop' } : {}), mfe: w ? 3.4 : 0.2, shadow: false, blockedBy: [] });
}
// never counted: a duplicate, a replay row, an open trade, an ICT record
trades.push({ id: 'xau-scalp-dup', market: 'xau', k: 'scalp', status: 'duplicate', R: null, shadow: true, opened: T0 - 86400 });
trades.push({ id: 'xau-geg-replay', market: 'xau', k: 'geg', status: 'win', R: 5, replay: true, opened: T0 - 86400, closed: T0 - 3600 });
trades.push({ id: 'xau-geg-open', market: 'xau', k: 'geg', status: 'open', R: 0, opened: T0 - 3600 });
trades.push({ id: 'ict:nq-b-1', market: 'nq', k: 'ict-a', status: 'win', R: 3, opened: T0 - 7200, closed: T0 - 3600 });
// research replica: buys lose, sells win; no cost on record
for (let i = 0; i < 40; i++) {
  const e = T0 - 15 * 86400 + i * 8 * 3600, buy = i % 2 === 0, win = buy ? i % 8 === 0 : i % 4 !== 1;
  research.push({ id: `xau-replica-${e}-${buy ? 'b' : 's'}`, market: 'xau', k: 'replica', name: 'Gold replica', side: buy ? 'buy' : 'sell', entry: 4000, stop: 3990, t1: 4020, rr: 2, opened: e, filled: e, closed: e + 3 * 3600, status: win ? 'win' : 'loss', R: win ? 2 : -1, session: 'london' });
}
research.push({ id: 'nq-nyflip-1', market: 'nq', k: 'nq-open', session: 'nyflip', name: 'NQ open run', side: 'buy', entry: 1, stop: 0.9, t1: 1.2, rr: 2, opened: T0 - 86400, filled: T0 - 86400, closed: T0 - 80000, status: 'loss', R: -1 });
const scalps = trades.filter((x) => x.k === 'scalp' && x.status !== 'duplicate'), lost = scalps.filter((x) => x.status === 'loss');
fs.mkdirSync(D + 'ctrader', { recursive: true }); fs.mkdirSync(D + 'reviews', { recursive: true });
const w = (f, j) => fs.writeFileSync(D + f, JSON.stringify(j) + '\n');
w('trades.json', trades); w('research.json', research); w('config.json', { ownerShadow: { replica: 1 } });
w('coach.json', { decay: { systems: [{ id: 'geg', k: 'geg', name: 'Gold daily engulf', live: true, status: 'healthy', why: ['in line with its backtest'] }] }, expect: { systems: [] } });
w('ctrader/mirror.json', { state: { map: {} } });
w('ctrader/mirror-1.json', { account: '1', books: ['shadow'], state: { map: Object.fromEntries(scalps.slice(0, 30).map((x, i) => [x.id, { slipR: i % 3 === 0 ? 0.1 : 0.02 }])) } });
w('ctrader/mirror-2.json', { account: '2', books: ['ict'], state: { map: { 'ict:nq-b-1': { slipR: 9 } } } });
w('ctrader/mirror-accounts.json', { groups: [{ account: '1', books: ['shadow'], file: 'mirror-1.json' }, { account: '2', books: ['ict'], file: 'mirror-2.json' }] });
w('reviews/analyst.json', { reviews: Object.fromEntries(lost.slice(0, 5).map((x) => [x.id, { tags: ['noise'] }])) });
w('reviews/losses.json', { reviews: Object.fromEntries(lost.slice(0, 2).map((x) => [x.id, { tags: ['hunt'] }])) });
