// fx-vol-breakout: the gold T1 breakout on six forex majors (research/edge/fx-vol-breakout). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MARKETS, COMM, pipOf, costPx, charge, ORIG_SHA, decide } from '../research/edge/fx-vol-breakout/run.mjs';

const DIR = new URL('../research/edge/fx-vol-breakout/', import.meta.url);

test('fx-vol-breakout: the rule is the pinned original, the markets and cost are the pre-registered ones', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/index-vol-breakout/original.mjs', import.meta.url))).digest('hex');
  assert.equal(sha, ORIG_SHA);
  assert.deepEqual(MARKETS, ['eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf']);
  assert.equal(COMM, 0.000045);
  assert.equal(pipOf('usdjpy'), 0.01); assert.equal(pipOf('eurusd'), 0.0001);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /0\.000045/); assert.match(pre, /0\.5 pip a round trip/); assert.match(pre, /Holm over all\s+seven/);
});

test('fx-vol-breakout: the cost is commission on the entry plus half a pip, taken off in R', () => {
  assert.ok(Math.abs(costPx('eurusd', 1.1) - (0.000045 * 1.1 + 0.00005)) < 1e-12);
  assert.ok(Math.abs(costPx('usdjpy', 150) - (0.000045 * 150 + 0.005)) < 1e-12);
  const x = charge('eurusd', { entry: 1.1, r: 0.002, R: 1 }), c = costPx('eurusd', 1.1);
  assert.ok(Math.abs(x.net - (1 - c / 0.002)) < 1e-12); assert.ok(Math.abs(x.net2 - (1 - 2 * c / 0.002)) < 1e-12);
});

test('fx-vol-breakout: the pass bar needs every check, Holm over the series', () => {
  const s = (t, netR, beaten) => ({ all: { t, netR, net2R: netR, n: 500 }, is: { netR, n: 200 }, oos: { netR, n: 300 }, beaten, p: 1 - 0.5 * (1 + Math.tanh(t)) });
  const r = decide({ pool: s(4, 0.1, 40), a: s(1, 0.05, 40), b: s(4, -0.1, 0) });
  assert.equal(r.pool.pass, true); assert.equal(r.a.pass, false); assert.equal(r.b.pass, false);
});

test('fx-vol-breakout: the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  assert.deepEqual(Object.keys(R.series), ['pool', ...MARKETS]);
  assert.equal(R.nights, 0);
  for (const r of Object.values(R.series)) assert.equal(r.pass, Object.values(r.checks).every(Boolean));
});
