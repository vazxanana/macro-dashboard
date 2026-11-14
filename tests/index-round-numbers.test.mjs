// index-round-numbers: the rules on hand-made candles (offline), no look-ahead, sessions, the placebo draw and the report
// against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SPEC, K, sessionOn, usDst, euDst, dailyOf, atrBefore, sessionsOf, touched, gridOf, stallSession, breakSession,
  placeboOffs, okOff, holm, monthT, report,
} from '../research/edge/index-round-numbers/run.mjs';

const DIR = new URL('../research/edge/index-round-numbers/', import.meta.url);
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const T0 = Date.UTC(2024, 0, 10, 14, 30) / 1000; // a Wednesday, 09:30 New York (winter)

test('sessions follow New York and Frankfurt daylight time', () => {
  const jan = Date.UTC(2024, 0, 10) / 1000, jul = Date.UTC(2024, 6, 10) / 1000;
  assert.equal(usDst(jan), false); assert.equal(usDst(jul), true);
  assert.deepEqual(sessionOn('us', jan), [jan + 14.5 * 3600, jan + 21 * 3600]);
  assert.deepEqual(sessionOn('us', jul), [jul + 13.5 * 3600, jul + 20 * 3600]);
  assert.deepEqual(sessionOn('eu', jan), [jan + 8 * 3600, jan + 16.5 * 3600]);
  assert.deepEqual(sessionOn('eu', jul), [jul + 7 * 3600, jul + 15.5 * 3600]);
  // the mismatch weeks: US on summer time, Europe not yet (2024-03-10 .. 03-31)
  const mar20 = Date.UTC(2024, 2, 20) / 1000; assert.equal(usDst(mar20), true); assert.equal(euDst(mar20), false);
  assert.equal(usDst(Date.UTC(2024, 2, 9) / 1000), false); assert.equal(euDst(Date.UTC(2024, 2, 31) / 1000), true);
});

test('daily ATR uses only the 14 weekdays before the date, weekends dropped', () => {
  const B = []; let t = Date.UTC(2024, 0, 1) / 1000; // Monday
  for (let d = 0; d < 30; d++, t += 86400) { const wd = new Date(t * 1000).getUTCDay(); const r = wd === 0 || wd === 6 ? 500 : 10; B.push(bar(t + 3600, 100, 100 + r, 100, 100)); }
  const D = dailyOf(B); assert.ok(D.every((x) => ![0, 6].includes(new Date(x.time * 1000).getUTCDay())));
  const day = D[20].time; assert.equal(atrBefore(D, day), 10);
  assert.equal(atrBefore(D, D[14].time), null); // 14 weekdays before: not enough (needs 15)
  // a huge candle ON the day does not change that day's ATR
  const D2 = D.map((x) => ({ ...x })); D2[20].high = 9999; assert.equal(atrBefore(D2, day), 10);
});

const sess = (bars, A = 100) => ({ day: Math.floor(bars[0].time / 86400) * 86400, A, bars });

test('T1 fades the first touch after a 0.5 x ATR approach, limit at the level, stop first', () => {
  // spx500 grid 100: level 5000. Price comes up from 4940 (60 = 0.6 x ATR) and touches 5000.
  const S = [bar(T0, 4945, 4950, 4940, 4948), bar(T0 + 300, 4948, 4990, 4947, 4985), bar(T0 + 600, 4985, 5004, 4984, 4995),
    bar(T0 + 900, 4995, 4996, 4960, 4962), bar(T0 + 1200, 4962, 4963, 4945, 4948)];
  const tr = stallSession('spx500', sess(S));
  assert.equal(tr.length, 1); const x = tr[0];
  assert.equal(x.side, -1); assert.equal(x.entry, 5000); assert.equal(x.stop, 5025); assert.equal(x.target, 4950);
  assert.equal(x.exit, 'target'); assert.equal(x.exitAt, T0 + 1200); assert.equal(x.gross, 2);
  assert.ok(Math.abs(x.net - (2 - SPEC.spx500.cost / 25)) < 1e-12);
  // approach too short: lowest low 4960 (0.4 x ATR): no trade
  const S2 = S.map((b, i) => (i === 0 ? bar(T0, 4965, 4970, 4960, 4968) : i === 1 ? bar(T0 + 300, 4968, 4990, 4961, 4985) : b));
  assert.equal(stallSession('spx500', sess(S2)).length, 0);
  // the fill candle: only the stop counts (a candle reaching the target and not the stop stays open)
  const S3 = [S[0], S[1], bar(T0 + 600, 4985, 5004, 4940, 4950), bar(T0 + 900, 4990, 5030, 4985, 5020)];
  assert.equal(stallSession('spx500', sess(S3))[0].exit, 'stop');
});

test('T1: a second touch in the same session is not traded; a gap fills at the open', () => {
  const S = [bar(T0, 4945, 4950, 4940, 4948), bar(T0 + 300, 4948, 5001, 4947, 4990), bar(T0 + 600, 4990, 4991, 4950, 4952),
    bar(T0 + 900, 4952, 5002, 4951, 4995), bar(T0 + 1200, 4995, 4996, 4990, 4992)];
  const tr = stallSession('spx500', sess(S)); assert.equal(tr.length, 1); assert.equal(tr[0].at, T0 + 300);
  const G = [bar(T0, 4945, 4950, 4940, 4948), bar(T0 + 300, 4948, 4995, 4947, 4990), bar(T0 + 600, 5010, 5012, 5005, 5008), bar(T0 + 900, 5008, 5009, 5000, 5001)];
  const g = stallSession('spx500', sess(G)); assert.equal(g.length, 0); // opened at 5010 > L, the level not touched in that candle
  const G2 = [...G.slice(0, 2), bar(T0 + 600, 5010, 5012, 4999, 5005), bar(T0 + 900, 5005, 5006, 4990, 4992)];
  const g2 = stallSession('spx500', sess(G2)); assert.equal(g2[0].entry, 5010); assert.equal(g2[0].stop, 5025);
});

test('T2 follows the first close 0.05 x ATR beyond, next open, stop 0.1 x ATR back, target 0.5 x ATR', () => {
  const S = [bar(T0, 4980, 4995, 4978, 4990), bar(T0 + 300, 4990, 5008, 4989, 5006), bar(T0 + 600, 5007, 5030, 5005, 5028),
    bar(T0 + 900, 5028, 5060, 5027, 5058), bar(T0 + 1200, 5058, 5059, 5050, 5055)];
  const tr = breakSession('spx500', sess(S));
  assert.equal(tr.length, 1); const x = tr[0];
  assert.equal(x.side, 1); assert.equal(x.entry, 5007); assert.equal(x.stop, 4990); assert.equal(x.target, 5057);
  assert.equal(x.exit, 'target'); assert.ok(Math.abs(x.gross - 50 / 17) < 1e-12);
  // a close under 0.05 x ATR beyond (5004) is no break
  const S2 = S.map((b, i) => (i === 1 ? bar(T0 + 300, 4990, 5008, 4989, 5004) : i === 2 ? bar(T0 + 600, 5004, 5004.5, 5001, 5003) : b)).slice(0, 3);
  assert.equal(breakSession('spx500', sess(S2)).length, 0);
  // no next candle in the session: no trade; time exit at the last session candle
  assert.equal(breakSession('spx500', sess(S.slice(0, 2))).length, 0);
  const S3 = [S[0], S[1], bar(T0 + 600, 5007, 5020, 5000, 5015)];
  const y = breakSession('spx500', sess(S3))[0]; assert.equal(y.exit, 'time'); assert.equal(y.exitPx, 5015);
});

test('no look-ahead: changing candles after a decision does not change whether or where a trade opens', () => {
  const S = [bar(T0, 4945, 4950, 4940, 4948), bar(T0 + 300, 4948, 4990, 4947, 4985), bar(T0 + 600, 4985, 5004, 4984, 4995),
    bar(T0 + 900, 4995, 4996, 4960, 4962), bar(T0 + 1200, 4962, 4963, 4945, 4948)];
  const a = stallSession('spx500', sess(S)), b = stallSession('spx500', sess([...S.slice(0, 3), bar(T0 + 900, 4995, 5100, 4990, 5090)]));
  assert.equal(a[0].entry, b[0].entry); assert.equal(a[0].at, b[0].at); assert.equal(a[0].stop, b[0].stop);
});

test('sessionsOf keeps only cash-session candles and needs an ATR', () => {
  const B = []; let t = Date.UTC(2024, 0, 1) / 1000;
  for (let d = 0; d < 25; d++, t += 86400) for (let m = 0; m < 288; m++) B.push(bar(t + m * 300, 100, 101, 99, 100));
  const S = sessionsOf('nas100', B);
  assert.ok(S.length > 0 && S.length <= 25 - 15);
  for (const s of S) { const [o, c] = sessionOn('us', s.day); assert.ok(s.bars.every((x) => x.time >= o && x.time < c)); assert.equal(s.bars.length, 78); }
  const E = sessionsOf('de40', B); assert.equal(E[0].bars.length, 102);
});

test('grid, placebo draws and Holm', () => {
  assert.deepEqual(touched(gridOf(500), bar(0, 19990, 20010, 19980, 20005)), [40]);
  assert.deepEqual(touched(gridOf(500, 0.5), bar(0, 19990, 20010, 19980, 20005)), []);
  for (let s = 1; s <= 40; s++) { const o = placeboOffs(s); for (const u of Object.values(o)) assert.ok(okOff(u)); assert.deepEqual(o, placeboOffs(s)); }
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(6)), [0.04, 0.09, 0.09, 0.5]);
  const mt = monthT([{ at: Date.UTC(2021, 0, 5) / 1000, net: 1 }], Date.UTC(2021, 0, 1) / 1000, Date.UTC(2021, 3, 1) / 1000); assert.equal(mt.months, 3);
  assert.equal(K.IS_FROM, Date.UTC(2016, 0, 1) / 1000); assert.equal(K.OOS_FROM, Date.UTC(2021, 0, 1) / 1000);
});

test('the report and the verdict match result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  const line = md.split('\n').find((l) => l.startsWith('**Verdict: ')); assert.ok(line.includes(R.verdict));
  assert.ok(R.verdict.length < 220);
  const prim = Object.values(R.tests).filter((v) => v.role === 'primary');
  assert.equal(prim.length, 2); assert.equal(Object.keys(R.tests).length, 4);
  assert.equal(R.verdict.startsWith('PASS'), prim.some((v) => v.verdict === 'PASS'));
  for (const v of Object.values(R.tests)) {
    assert.equal(v.verdict === 'PASS', Object.values(v.bar).every(Boolean));
    assert.equal(v.placebo.means.length, 40);
    assert.equal(v.bar['OOS month-sum t >= 2'], v.oos.t >= 2);
    assert.equal(v.bar['IS net R a trade > 0'], v.is.net > 0);
  }
});
