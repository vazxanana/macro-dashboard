// node --test tests/analyst-gold.test.mjs: the Analyst's "Live gold systems now" block (8 Nov), built from the Trader's snapshot
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { goldSystemsSection, GOLD_START, GOLD_END, injectSection } from '../council/analyst.mjs';

const now = Date.parse('2026-11-08T03:30:00Z') / 1000;
// the live snapshot of 8 Nov 03:19 UTC
const snapshot = { goldVol: 1.68, goldVolP: 2.47, goldVolMin: null, goldW1: -1,
  moshaBo: { state: { stage: 'h1', dir: 1, h4: { t: 1793851200, dir: 1, level: 4082.82 }, h1: null, m15: null, w1: -1, open: 0, pending: 0 } },
  goldTrend: { state: { hi20: 4200.63, lastClose: 4085.945, open: false, stop: null } }, goldTrendFast: { state: { hi20: 4071.67, lastClose: 4085.945, open: false, stop: null } },
  goldTL: { state: { line: null, open: false, stop: null } }, goldEG: { state: { lastClose: 4085.945, sma: 4047.51, up: true, zone: [3895.57, 3971.355], pending: [3971.36], open: 0 } },
  goldMP: { state: { d1: 1, watching: [], open: 0, test: true } } };
const config = { replicaLive: ['xau'], moshaBo: true, goldTrend: { n: 20, k: 2 }, goldTrendFast: { n: 5, k: 2 }, goldTrendFastShadow: true, goldTL: { n: 3 }, goldEG: { sma: 20 }, goldMP: {}, nqRun: { atR: 2, trail: 1 } };
const trades = [{ k: 'geg', market: 'xau', status: 'pending' }, { k: 'replica', market: 'xau', status: 'open', shadow: true }];
const research = [{ k: 'nq-open', session: 'nyflip', day: '2026-11-07', side: 'buy', status: 'loss', R: -1, opened: 1793800000 }];

test('one row per live Meridian system: gate, chain stage, what each waits for, what is on', () => {
  const s = goldSystemsSection({ snapshot, config, trades, research, now });
  assert.ok(s.startsWith(GOLD_START) && s.endsWith(GOLD_END));
  assert.match(s, /\| Gold replica \| live \| gate closed: 1\.68% average daily range under the 2\.47% gate, so no new replica trade \| nothing on \|/);
  assert.match(s, /\| Mosha BO \| live \| H4 BO buy at 4082\.82 \(11-05 04:00 UTC\); waiting for the H1 BO the other way \(the retracement\)\. Weekly structure is against it/);
  assert.match(s, /\| Gold trend \| live \| waiting for a daily close above the 20-day high 4200\.63 \(last close 4085\.95\) \| nothing on \|/);
  assert.match(s, /\| Gold trend fast \| shadow \| waiting for a daily close above the 5-day high 4071\.67 .* \| paper only \|/);
  assert.match(s, /\| Gold H4 trendline \| live \| no falling H4 trendline through two pivot highs right now \| nothing on \|/);
  assert.match(s, /\| Gold daily engulf \| live \| daily close 4085\.95 above the 20-day average 4047\.51; zone 3895\.57-3971\.36; resting buy at 3971\.36 \| 1 pending \|/);
  assert.match(s, /\| Gold momentum pullback \| live \| D1 up; no pullback zone watched · paper test \| nothing on \|/);
  assert.match(s, /\| NQ New York open run \| live \(paper, research\.json\) \| last session 2026-11-07: buy loss −1\.00R; next at the 09:30 New York open \| — \|/);
  assert.match(s, /\| Mosha cycle \| off \| — \| nothing on \|/);   // 12 Nov 2026: the Mosha cycle got its row (off in this 8 Nov config)
  assert.equal(s.split('\n').filter((l) => l.startsWith('| ')).length, 10, 'header + 9 systems');
});
test('off systems and a snapshot without state blocks still render; no snapshot renders nothing', () => {
  const s = goldSystemsSection({ snapshot: { goldVol: 2.9, goldVolMin: 1.5 }, config: { replicaLive: ['xau'] }, now });
  assert.match(s, /gate open: 2\.90% average daily range, gate 1\.50%/); assert.match(s, /\| Mosha BO \| off \| — \|/); assert.match(s, /\| Gold trend \| off \| — \| — \|/);
  assert.equal(goldSystemsSection({ snapshot: null, config, now }), '');
  const md = '# Report\n\n## Top 3\n\n- a\n';
  assert.match(injectSection(md, goldSystemsSection({ snapshot, config, now }), GOLD_START, GOLD_END), /Report\n\n<!-- gold-systems:start -->[\s\S]*<!-- gold-systems:end -->\n\n## Top 3/);
});
test('the Trader injects it into analysis/latest.md (wiring pin)', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /goldSystemsSection\(\{ snapshot, config, trades, research, now \}\), GOLD_START, GOLD_END\)/);
});
