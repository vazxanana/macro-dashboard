// gold-marubozu-close: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { enrich, fullClose, simulate, runRule, runBase, yearMeans, excess, placeboPool, holm, monthT, verdictLine, report, TESTS, WIN, RT }
  from '../research/edge/gold-marubozu-close/run.mjs';

const dir = new URL('../research/edge/gold-marubozu-close/', import.meta.url);
const D = 86400, T0 = Date.UTC(2020, 0, 6) / 1000;
function mk(extra) {
  const base = []; for (let k = 0; k < 25; k++) base.push({ open: 100, high: 105, low: 95, close: 100 });
  return enrich([...base, ...extra].map((x, k) => ({ t: T0 + k * D, ...x })));
}

test('setup: a close in the top tenth of a wide enough day; the down band is 15 %; a narrow day never counts', () => {
  const ds = mk([{ open: 96, high: 106, low: 95, close: 105.5 }, { open: 104, high: 105, low: 94, close: 95.5 },
    { open: 100, high: 101, low: 100, close: 101 }, { open: 100, high: 106, low: 95, close: 104 }]);
  assert.equal(fullClose(ds, 25, TESTS.T1), 1);
  assert.equal(fullClose(ds, 25, TESTS.T3), 0);
  assert.equal(fullClose(ds, 26, TESTS.T3), -1);
  assert.equal(fullClose(ds, 27, TESTS.T1), 0);      // range 1 < 0.5 x ATR
  assert.equal(fullClose(ds, 28, TESTS.T1), 0);      // close 2 below the high of an 11 range: not in the band
});

test('long trade: entry at the next open, stop $0.30 under the setup low, out at the third close, costs and financing', () => {
  const ds = mk([{ open: 96, high: 106, low: 95, close: 105.5 }, { open: 105.6, high: 107, low: 104, close: 106 },
    { open: 106, high: 108, low: 105, close: 107 }, { open: 107, high: 110, low: 106, close: 109 }]);
  const tr = simulate(ds, 25, 1);
  assert.equal(tr.entry, 105.6);
  assert.equal(+tr.stop.toFixed(2), 94.7);
  assert.equal(tr.how, 'time');
  assert.equal(tr.exit, 109);
  assert.ok(Math.abs(tr.cost - RT / tr.risk) < 1e-12);
  assert.ok(tr.fin > 0 && tr.net < tr.gross && tr.net2 < tr.net);
});

test('stop: a touch fills at the stop, an open past it at the open; a too-close stop is widened to 0.5 ATR', () => {
  const a = mk([{ open: 96, high: 106, low: 95, close: 105.5 }, { open: 105, high: 106, low: 94, close: 100 },
    { open: 100, high: 101, low: 99, close: 100 }, { open: 100, high: 101, low: 99, close: 100 }]);
  const ta = simulate(a, 25, 1); assert.equal(ta.how, 'stop'); assert.ok(Math.abs(ta.gross + 1) < 1e-9);
  const b = mk([{ open: 96, high: 106, low: 95, close: 105.5 }, { open: 105, high: 106, low: 100, close: 101 },
    { open: 90, high: 91, low: 88, close: 90 }, { open: 90, high: 91, low: 89, close: 90 }]);
  const tb = simulate(b, 25, 1); assert.equal(tb.how, 'stop'); assert.equal(tb.exit, 90); assert.ok(tb.gross < -1);
  const c = mk([{ open: 100, high: 101.5, low: 99, close: 101.4 }, { open: 101.4, high: 102, low: 101, close: 101.5 },
    { open: 101.5, high: 102, low: 101, close: 101.5 }, { open: 101.5, high: 102, low: 101, close: 101.5 }]);
  const tc = simulate(c, 25, 1); assert.ok(Math.abs(tc.risk - 0.5 * c[25].atr) < 1e-9);
});

test('no look-ahead: later days never change the setup or a trade already finished', () => {
  const days = [{ open: 96, high: 106, low: 95, close: 105.5 }, { open: 105.6, high: 107, low: 104, close: 106 },
    { open: 106, high: 108, low: 105, close: 107 }, { open: 107, high: 110, low: 106, close: 109 }];
  const a = mk([...days, { open: 109, high: 110, low: 108, close: 109 }]);
  const b = mk([...days, { open: 10, high: 300, low: 1, close: 200 }]);
  assert.deepEqual(simulate(a, 25, 1), simulate(b, 25, 1));
  assert.equal(fullClose(mk([days[0], { open: 1, high: 1, low: 1, close: 1 }]), 25, TESTS.T1), 1);
});

test('rule one position at a time; excess against the same-year baseline; placebo days are never setups', () => {
  const up = { open: 96, high: 106, low: 95, close: 105.5 };
  const ds = mk([up, up, up, up, up, up, up, up]);
  const R = runRule(ds, TESTS.T1);
  for (let k = 1; k < R.length; k++) assert.ok(R[k].i > R[k - 1].exitDay);
  const base = runBase(ds, 1), ym = yearMeans(base);
  const ex = excess(R, ym); for (const x of ex) assert.ok(Math.abs(x.ex - (x.net - ym['2020'].net)) < 1e-12);
  for (const P of placeboPool(ds, TESTS.T1).values()) for (const i of P) assert.equal(fullClose(ds, i, TESTS.T1), 0);
});

test('helpers: Holm and month-sum t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const T = [{ exitT: Date.UTC(2017, 0, 10) / 1000, net: 1 }, { exitT: Date.UTC(2017, 1, 10) / 1000, net: 2 }];
  assert.equal(monthT(T, ['2017-01-01', '2017-03-31'], 'net').months, 3);
});

test('the report agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
  assert.deepEqual(r.windows, WIN);
  assert.equal(r.verdict, 'FAIL');
  assert.equal(md, report(r));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.equal(line, verdictLine(r));
  assert.ok(line.length < 220);
  for (const k of ['T1', 'T2', 'T3']) { const x = r.tests[k];
    assert.equal(x.pass, false); assert.ok(x.oos.n >= 100 && x.is.n >= 100);
    assert.ok(md.includes(`| ${x.oos.n} |`) && md.includes(`${x.placebo.beaten} of 40`)); }
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', dir));
  assert.equal(crypto.createHash('sha256').update(pre).digest('hex'), r.prereg.sha256);
});
