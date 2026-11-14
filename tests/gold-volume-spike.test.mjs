// gold-volume-spike study: the H1 build, the hour-of-day baseline (earlier days only), the three sides and stops, the simulator
// and costs, release tags, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildH1, markSpikes, hourKey, sideOf, specOf, sim, stream, tagged, holm, headline, P } from '../research/edge/gold-volume-spike/run.mjs';

const DIR = new URL('../research/edge/gold-volume-spike/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8, 0, 0) / 1000;   // Monday 8 Jan 2024 00:00 UTC (New York UTC-5 for the 23 days used)

// one hour of 12 M5 rows at a flat price with volume v
const hour = (t, px = 2000, v = 10) => Array.from({ length: 12 }, (_, i) => [t + i * 300, px, px + 0.5, px - 0.5, px, v]);

test('H1 build: OHLC and summed volume per UTC hour, thin hours dropped', () => {
  const rows = [[0, 10, 12, 9, 11, 2], [300, 11, 15, 10, 14, 3], ...Array.from({ length: 10 }, (_, i) => [600 + i * 300, 14, 14, 13, 13.5, 1]),
    [3600, 1, 1, 1, 1, 1]];
  const h = buildH1(rows);
  assert.equal(h.length, 1);
  assert.deepEqual([h[0].o, h[0].h, h[0].l, h[0].c, h[0].v, h[0].n], [10, 15, 9, 13.5, 15, 12]);
  assert.equal(h[0].i1, 12);
});

test('hour key follows New York time across daylight saving', () => {
  assert.equal(hourKey(Date.UTC(2024, 0, 10, 14) / 1000), 9);   // winter: UTC-5
  assert.equal(hourKey(Date.UTC(2024, 6, 10, 13) / 1000), 9);   // summer: UTC-4
});

test('spike needs 20 earlier days of the same hour; the candle and later ones are not in its baseline', () => {
  const h = []; for (let d = 0; d < 22; d++) h.push({ t: T0 + d * 86400, o: 1, h: 2, l: 0, c: 1.5, v: d === 21 ? 31 : 10 });
  markSpikes(h);
  assert.equal(h[19].base, null); assert.equal(h[19].spike, false);
  assert.equal(h[20].base, 10); assert.equal(h[20].spike, false);
  assert.equal(h[21].base, 10); assert.equal(h[21].spike, true);   // 31 > 3 x 10
  const h2 = h.map((x) => ({ ...x })); h2.push({ t: T0 + 22 * 86400, o: 1, h: 2, l: 0, c: 1.5, v: 1e9 });
  markSpikes(h2);
  assert.equal(h2[21].base, 10);   // a later huge candle changes nothing before it
  assert.equal(h[21].cls, 1); assert.equal(h[21].dir, 1);
});

test('sides: T1 with the candle, T2 against an outer close, T3 with it; middle closes untraded', () => {
  const up = { dir: 1, cls: 1 }, mid = { dir: -1, cls: 0 }, low = { dir: 1, cls: -1 };
  assert.deepEqual(['T1', 'T2', 'T3'].map((T) => sideOf(T, up)), [1, -1, 1]);
  assert.deepEqual(['T1', 'T2', 'T3'].map((T) => sideOf(T, mid)), [-1, 0, 0]);
  assert.deepEqual(['T1', 'T2', 'T3'].map((T) => sideOf(T, low)), [1, 1, -1]);
});

test('spec and sim: next open, stop $0.30 past the extreme, stop hit, 4-hour time exit, costs and financing', () => {
  const rows = [...hour(T0), ...hour(T0 + 3600, 2001), ...hour(T0 + 7200, 2002), ...hour(T0 + 10800, 2003), ...hour(T0 + 14400, 2004), ...hour(T0 + 18000, 2005)];
  const x = { t: T0, o: 1995, h: 2003, l: 1990, c: 2001, i1: 12 };
  const b = specOf(rows, x, 1);
  assert.equal(b.entry, 2001); assert.ok(Math.abs(b.stop - 1989.7) < 1e-9); assert.equal(b.t0, T0 + 3600);
  const tb = sim(rows, b, 1);
  assert.equal(tb.how, 'time'); assert.equal(tb.exit, 2004); assert.equal(tb.tx, T0 + 3600 + 4 * 3600);
  assert.ok(Math.abs(tb.cost - 0.6) < 1e-12); assert.equal(tb.nights, 0);
  assert.ok(Math.abs(tb.net - (3 - 0.6) / 11.3) < 1e-9);
  const s = specOf(rows, x, -1);
  assert.ok(Math.abs(s.stop - 2003.3) < 1e-9);
  const ts = sim(rows, s, 2);
  assert.equal(ts.how, 'stop'); assert.ok(Math.abs(ts.net - (-1 - 1.2 / 2.3)) < 1e-9);
  assert.equal(specOf(rows, { ...x, h: 2001.5 }, -1).skip, 'stop under $1');
  assert.equal(specOf(rows, { ...x, i1: rows.length }, 1).skip, 'no prompt next open');
  // a buy held over the 22:00 UTC rollover pays one night of financing
  const t1 = Date.UTC(2024, 0, 8, 20) / 1000, r2 = [...hour(t1), ...hour(t1 + 3600), ...hour(t1 + 7200), ...hour(t1 + 10800), ...hour(t1 + 14400)];
  const f = sim(r2, { k: 0, side: 1, entry: 2000, stop: 1990, t0: t1 }, 1);
  assert.equal(f.nights, 1); assert.ok(Math.abs(f.fin - 0.000148 * 2000) < 1e-9);
});

test('one position at a time; release tags inside the hour only', () => {
  const rows = []; for (let k = 0; k < 10; k++) rows.push(...hour(T0 + k * 3600));
  const c = [{ t: T0, o: 1999, h: 2001, l: 1990, c: 2000.5, i1: 12, dir: 1, cls: 1 }, { t: T0 + 3600, o: 1999, h: 2001, l: 1990, c: 2000.5, i1: 24, dir: 1, cls: 1 }];
  const r = stream(rows, c, 'T1');
  assert.equal(r.tr.length, 1); assert.equal(r.skips['position open'], 1);
  assert.equal(tagged({ t: T0 }, [T0 + 1800]), true);
  assert.equal(tagged({ t: T0 }, [T0 + 3600]), false);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
});

test('report and result.json agree; pre-registration came first', () => {
  const j = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(j.study, 'gold-volume-spike');
  assert.ok(md.includes(headline({ verdict: j.verdict, passed: j.passed, tests: j.tests })));
  assert.ok(md.includes(`**Verdict: ${j.verdict}`));
  assert.ok(headline({ verdict: j.verdict, passed: j.passed, tests: j.tests }).length < 220);
  for (const k of ['T1', 'T2', 'T3']) {
    const x = j.tests[k];
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.ok(md.includes(`| ${x.oos.n} |`));
  }
  assert.equal(j.verdict, j.passed.length ? 'PASS' : 'FAIL');
  assert.equal(j.params.MULT, P.MULT);
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', DIR)));
});
