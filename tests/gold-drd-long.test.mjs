// The playbook's weekly-bull daily rejection long (research/edge/gold-drd-long): its pieces on hand-made candles, and the
// report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyDay, days, weeks, weekState, signals, simulate } from '../research/edge/gold-drd-long/run.mjs';

const H = 3600;
test('a New York day ends at 17:00 and the weekend is dropped', () => {
  const fri16 = Date.UTC(2026, 10, 6, 21) / 1000, fri17 = fri16 + H, sun22 = Date.UTC(2026, 10, 8, 22) / 1000;   // NY UTC-5 after 1 Nov
  assert.ok(nyDay(fri16) != null); assert.equal(nyDay(fri17), null, 'Friday 17:00 New York starts the weekend');
  assert.equal(nyDay(sun22), nyDay(Date.UTC(2026, 10, 9, 12) / 1000), 'Sunday 17:00 opens Monday');
});

test('weekly structure turns bullish on a close above a confirmed 2-bar swing high', () => {
  const w = [100, 101, 105, 102, 101, 104, 107].map((c) => ({ high: c + 1, low: c - 1, close: c }));
  const st = weekState(w);
  assert.equal(st[4], 0); assert.equal(st[6], 1, 'a close of 107 above the swing high of week 2 (106)');
});

test('a signal needs a close above the previous low in the top 30% of the range, and the trade uses only later candles', () => {
  const mk = (d, o, h, l, c) => ({ d, t: d * 86400, open: o, high: h, low: l, close: c });
  const ds = [mk(20003, 100, 102, 98, 99), mk(20004, 99, 101, 95, 100.5), mk(20005, 100, 103, 99, 102)];   // Mon-Wed 7-9 Oct 2024
  const S = signals(ds, [{ k: 19996 }, { k: 20003 }], [1, 1]);
  const s1 = S.find((x) => x.i === 1); assert.ok(s1 && s1.rule && s1.base); assert.equal(s1.stop, 95 - 0.3);
  const h1 = [{ time: 20005 * 86400 + 12 * H, open: 100.5, high: 120, low: 100, close: 119 }], start = new Map([[ds[2].d, 0]]);
  const tr = simulate(h1, start, ds, s1, 3, 1);
  assert.equal(tr.entry, 100.5); assert.ok(tr.R > 0);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-drd-long/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-drd-long/RESULT.md', import.meta.url), 'utf8'), p = r.rows['long 0.70 3R'];
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  assert.match(md, new RegExp(`\\| 2006 - Oct 2022 \\(the test\\) \\| ${p.oos.rule.n} \\| \\+${p.oos.rule.avg} \\| ${p.oos.rule.pf} `));
  assert.match(md, new RegExp(`\\| \\+${p.oos.lift} \\| ${p.oos.t} \\|`));
});
