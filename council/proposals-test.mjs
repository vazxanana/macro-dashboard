// Checks spotProposals (council/proposals.mjs) drops markets the live Trader already runs on OANDA (snapshot.feed).
//   node council/proposals-test.mjs [research/spotcheck.json]   (defaults to a built-in sample)
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spotProposals } from './proposals.mjs';
const spot = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : { at: '2026-11-07T19:40:44.995Z', markets: {
  xau: { n: 137, liveR: 36.43, spotR: 75.11 }, eurusd: { n: 34, liveR: 3.26, spotR: -18.69 }, gbpusd: { n: 45, liveR: -11.75, spotR: -26.85 },
  audusd: { n: 77, liveR: 2.72, spotR: 17.32 }, usdcad: { n: 36, liveR: -8.32, spotR: -17.02 }, usdchf: { n: 54, liveR: 25.65, spotR: -0.43 } } };
const at = '2026-11-07T20:00:00.000Z', all = Object.fromEntries(Object.keys(spot.markets).map((m) => [m, 'OANDA']));
const bad = spotProposals(spot, at);   // no feed: the old behaviour, every market the spot check flags
let fails = 0; const check = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { fails++; console.log(`FAIL ${name}: ${e.message}`); } };
check('without a feed the spot check flags markets', () => assert.ok(bad.length === 1 && bad[0].markets.length >= 1));
check('all markets on OANDA -> no proposal', () => assert.deepEqual(spotProposals(spot, at, { feed: all }), []));
const off = bad.length ? bad[0].markets[0] : 'eurusd';
check(`only ${off} still on Kraken -> proposal names only ${off}`, () => {
  const p = spotProposals(spot, at, { feed: { ...all, [off]: 'Kraken' } });
  assert.equal(p.length, 1); assert.deepEqual(p[0].markets, [off]); assert.equal(p[0].value, 'oanda:' + off); assert.equal(p[0].kind, 'dataSource');
});
check('a market missing from the feed counts as not on OANDA', () => { const f = { ...all }; delete f[off]; assert.deepEqual(spotProposals(spot, at, { feed: f })[0].markets, [off]); });
check('a Kraken market the spot check does not flag -> no proposal', () => {
  const ok = Object.keys(spot.markets).find((m) => !bad[0]?.markets.includes(m));
  assert.deepEqual(spotProposals(spot, at, { feed: { ...all, [ok]: 'Kraken' } }), []);
});
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed'); process.exit(fails ? 1 : 0);
