// node --test tests/brain-veteran.test.mjs — the macro brain's audit of 20 Nov 2026 (CLAUDE.md "Macro brain audit").
// Each test names what a reader saw on the desk that day and pins the fix. Offline: synthetic candles, temporary folders.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as V from '../council/veteran.mjs';
import * as G from '../council/glance.mjs';
import * as O from '../council/outlook.mjs';
import * as W from '../council/week-ahead.mjs';
import * as D from '../council/daily-report.mjs';
import { levelsFor } from '../council/briefing.mjs';

const DAY = 86400, T = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000, iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const root = new URL('../', import.meta.url);

test('the council loop checks out every repository folder its members read (the veteran batch was missing: three features were empty on the live desk)', () => {
  const yml = fs.readFileSync(new URL('.github/workflows/council.yml', root), 'utf8');
  const sparse = yml.match(/sparse-checkout: \|\n((?: {12}\S+\n)+)/)[1].trim().split(/\s+/);
  const need = new Set();
  for (const f of fs.readdirSync(new URL('council/', root)).filter((f) => f.endsWith('.mjs') && !/test/.test(f))) {
    const src = fs.readFileSync(new URL('council/' + f, root), 'utf8');
    for (const m of src.matchAll(/new URL\('\.\.\/([^']+)', import\.meta\.url\)/g)) if (m[1].includes('/')) need.add(m[1]);
    for (const m of src.matchAll(/from '\.\.\/([^']+)'/g)) need.add(m[1]);
  }
  assert.ok(need.has('research/macro-veteran/references/'), 'the batch is read by news-context, research-watch and redfolder');
  for (const p of need) assert.ok(sparse.some((s) => p === s || p.startsWith(s + '/')), `${p} is not in council.yml's sparse checkout: the member reading it gets nothing on the live desk`);
});

// one row a day, with a Sunday stub every week (as OANDA's UTC daily candles have)
function withStubs(from, to, px = (i) => 4000 + i) {
  const out = []; let i = 0;
  for (let t = from; t <= to; t += DAY) { const w = new Date(t * 1000).getUTCDay(); if (w === 6) continue; const c = px(i++); out.push(w === 0 ? { t, o: c, h: c + 50, l: c - 60, c } : { t, o: c - 1, h: c + 5, l: c - 5, c }); }
  return out;
}
test('trading days: a Sunday stub is not a session (the "200-day average" was 167 trading days, the "13-week high" 10.8 weeks)', () => {
  const B = withStubs(T(2025, 1, 1), T(2026, 11, 19)), closes = B.map((b) => ({ t: b.t, v: b.c }));
  const td = V.tradingDays(closes), fb = V.foldBars(B);
  assert.ok(closes.some((o) => new Date(o.t * 1000).getUTCDay() === 0) && td.every((o) => { const w = new Date(o.t * 1000).getUTCDay(); return w >= 1 && w <= 5; }));
  assert.equal(fb.length, td.length); assert.deepEqual(fb.map((b) => b.c), td.map((o) => o.v), 'closes are the weekday closes');
  const mon = fb.find((b) => new Date(b.t * 1000).getUTCDay() === 1), sun = B.find((b) => b.t === mon.t - DAY);
  assert.equal(mon.h, sun.h, 'the stub\'s high belongs to Monday\'s session'); assert.equal(mon.l, sun.l); assert.equal(mon.o, sun.o, 'and the week opens at the stub\'s open');
  const now = T(2026, 11, 20, 14), raw = levelsFor({ bars: B, now, step: 100 }), fix = levelsFor({ bars: fb, now, step: 100 });
  const sma = (L) => L.list.find((l) => l.label === '200-day average').price, want = td.slice(-200).reduce((a, o) => a + o.v, 0) / 200;
  assert.ok(Math.abs(sma(fix) - want) < 0.06, 'the 200-day average is the mean of the last 200 trading-day closes');
  assert.ok(Math.abs(sma(raw) - want) > 5, 'on the raw rows it was the last 167 trading days');
  // a 5-session horizon ends on the day addSessions names
  const P = O.calls({ closes: td, now, h: 5, unit: '$', asset: 'gold' });
  assert.equal(P.by, '2026-11-26'); assert.equal(P.asOf, '2026-11-19'); assert.match(P.list[0].claim, /\(the 2026-11-19 close\)$/, 'the starting close is named by its date, never "today\'s close"');
  assert.equal(V.TRADING_DAYS_FROM, '2026-11-21', 'the week of 14 Nov stays as it was issued: a second build would add a second set of calls');
});

test('run: the display is on trading days at once; the record keeps the week it already issued and moves with the next week', () => {
  const src = fs.readFileSync(new URL('council/veteran.mjs', root), 'utf8');
  assert.match(src, /const td = weekKey\(now\) >= TRADING_DAYS_FROM;/);
  assert.match(src, /const rec = td \? \{ gold: cut\(gold\)[^\n]+: \{ gold: cut\(rawGold\)/, 'the record build reads the raw rows only for the week already issued');
  assert.match(src, /daily: \{ gold, dxy: dx, goldBars, spx, usdjpy: daily\.usdjpy \}/, 'the display build reads trading days');
  assert.match(src, /const dx = tradingDays\(rawDx\), gold = tradingDays\(rawGold\), goldBars = rawBars \? foldBars\(rawBars\) : null, spx = tradingDays\(rawSpx\);/);
});

const lv = (px, list, mark) => ({ px, asOf: '2026-11-19', unit: '$', dp: 0, mark: mark ? { px: mark, at: '2026-11-20T14:31:58.000Z', dist: +((mark / px - 1) * 100).toFixed(2) } : null,
  fresh: { asOf: '2026-11-19', sessions: 0, stale: false, text: 'as of 2026-11-19 close' },
  list: list.map(([price, label, kind, crossed]) => ({ price, label, kind, dist: +((price / px - 1) * 100).toFixed(2), side: price >= px ? 'above' : 'below', ...(crossed ? { crossed: true } : {}) })) });
const vet = ({ at = '2026-11-20T14:32:10.000Z', p = 0.53, level = 3884.685, mark = 3575.385, bias = 'AUCTION', levels } = {}) => ({ at, base: { upRate: 0.567 }, verdict: { bias, conviction: null, eventWithin72h: null,
  invalidation: ['10Y TIPS real yield above 3.03% (+15 bp from 2.88%) adds to the real-rate headwind', 'DXY above 105.5 (+1.5%) says the dollar is still rising against gold'] }, channels: [{ lean: -1 }],
  outlook: { anchor: { asOf: '2026-11-13' }, week: { horizon: 5, by: '2026-11-20', list: [] }, month: { horizon: 20, by: '2026-12-11', list: [{ asset: 'gold', kind: 'closeAbove', p, baseP: 0.567, by: '2026-12-11', level }] } },
  briefing: { insights: [], hypotheses: [], levels: { gold: levels || lv(3607.405, [[3700, 'Round number', 'round'], [3590.4, '13-week low', 'range', true]], mark), dxy: { px: 103.96 } } } });

test('glance: the odds name their level once the price has left it ("53% chance it is higher by 11 Dec" was about $3,885, with gold at $3,575)', () => {
  const s = G.summary(vet());
  assert.match(s.sentence, /^This week: the macro leans against gold \(at the 13 Nov close he put 53% on gold closing above \$3,885 on 11 Dec, base 57%; gold is now 8\.0% below that level, so read the lean, not the odds\)\./);
  assert.equal(s.bias.level, 3884.685); assert.equal(s.bias.from, '2026-11-13'); assert.equal(s.bias.gapPct, -8); assert.equal(s.bias.p, 0.53, 'the recorded probability is not changed');
  // near its level the short form stays
  assert.match(G.summary(vet({ mark: 3890, levels: lv(3884.685, [[3950, 'Round number', 'round'], [3850, 'Last week\'s low', 'week']], 3890) })).sentence, /\(53% chance it is higher by 11 Dec, base 57%\)/);
});

test('glance: no event in 72 hours is not "no release this week": the next top-tier US release on the council\'s schedule is named, and the holidays ahead', () => {
  const s = G.summary(vet());
  assert.match(s.sentence, /No major release in the next 72 hours; next on the schedule: US PCE \(Wed 25 Nov, 13:30 UTC\)\./);
  assert.equal(s.next.src, 'schedule'); assert.equal(s.next.at, '2026-11-25T13:30:00.000Z');
  assert.match(s.sentence, /Holiday trading ahead: Thanksgiving Thu 26 Nov \(US stocks closed, gold thin\), early close Fri 27 Nov\.$/);
  assert.deepEqual(s.holidays.map((h) => [h.day, h.kind, h.session]), [['2026-11-26', 'holiday', true], ['2026-11-27', 'early', true]]);
  assert.match(G.summary(vet({ at: '2026-11-13T14:00:00.000Z' })).sentence, /No major release is scheduled this week\./, 'nothing top-tier within eight days: the old sentence');
  // which holidays are a session for a dated call: Thanksgiving prints a daily close, Christmas and Good Friday do not
  const H = G.holidaysBetween('2026-12-21', '2027-01-04');
  assert.deepEqual(H.map((h) => [h.day, h.kind, h.session]), [['2026-12-24', 'early', true], ['2026-12-25', 'closed', false], ['2027-01-01', 'closed', false]]);
  assert.match(H[1].text, /a call due that day is scored on the last close before it/);
  assert.equal(G.holidaysBetween('2026-04-01', '2026-04-06')[0].name, 'Good Friday');
});

test('glance: the summary\'s parts must agree, or the sentence is withheld', () => {
  const ok = G.summary(vet()); assert.deepEqual(ok.check, { ok: true, issues: [] });
  // a level "above" that sits under the price
  const s = G.summary(vet()), bad = { ...s, levels: { ...s.levels, above: { price: 3500, label: 'x' } } };
  assert.match(G.consistency(bad, vet()).issues[0], /the level above \(\$3,500\) is not above the price \(\$3,575\)/);
  assert.match(G.consistency({ ...s, bias: { ...s.bias, lean: 'supportive' } }, vet()).issues[0], /the lean \(supportive\) does not match its odds/);
  assert.match(G.consistency({ ...s, sentence: 'This week: the macro leans against gold (53% chance it is higher by 11 Dec, base 57%).' }, vet()).issues[0], /quoted without the level/);
  assert.match(G.consistency(s, { ...vet(), verdict: { bias: 'SELL' } }).issues[0], /never issues one/);
  assert.match(G.consistency(s, vet({ at: '2026-12-14T10:00:00.000Z' })).issues[0], /has passed/);
  const w = G.summary({ ...vet(), verdict: { bias: 'SELL', conviction: null } });
  assert.equal(w.check.ok, false); assert.match(w.sentence, /^Summary withheld this run: its parts disagree \(a macro sell on gold/); assert.match(w.withheld, /^This week:/);
});

test('calls: an open call says where it stands; one the closes already decided is never shown as odds', () => {
  const closes = [['2026-11-13', 3884.685], ['2026-11-16', 3862.77], ['2026-11-17', 3848.795], ['2026-11-18', 3740.23], ['2026-11-19', 3607.405]].map(([d, v]) => ({ t: Date.parse(d + 'T00:00:00Z') / 1000, v }));
  const st = (c) => O.callStatus({ by: '2026-11-20', ...c }, closes, '2026-11-13');
  assert.deepEqual(st({ kind: 'touchDown', level: 3860 }), { state: 'happened', on: '2026-11-17', text: 'already happened: the 2026-11-17 close was 3,849' });
  assert.equal(st({ kind: 'touchUp', level: 3920 }).state, 'open'); assert.match(st({ kind: 'touchUp', level: 3920 }).text, /^not yet: the last close \(2026-11-19\) was 3,607, 8\.7% away$/);
  assert.equal(st({ kind: 'closeAbove', level: 3884.685 }).side, 'off track'); assert.equal(st({ kind: 'pairDown', level: 3884.685 }).side, 'on track');
  assert.match(st({ kind: 'range', lo: 3841, hi: 3952 }).text, /^outside the range/);
  assert.equal(O.callStatus({ kind: 'touchDown', level: 3860, by: '2026-11-20' }, closes, null), null);
  assert.equal(O.callStatus({ kind: 'touchDown', level: 3860, by: '2026-11-20' }, closes.slice(0, 1), '2026-11-13').state, 'open', 'the issue close itself never decides a call');
  // the status is display only: the ledger record of a call carries no status
  const L = O.callsLedger([], { outlook: { week: { list: [{ claim: 'x', p: 0.47, asset: 'gold', kind: 'touchDown', level: 3860, by: '2026-11-20', status: { state: 'happened' } }] } }, closesBy: { gold: closes }, now: T(2026, 11, 20, 14) });
  assert.equal(L.length, 1); assert.ok(!('status' in L[0]));
  // the morning note
  const m = D.marketsReport({ fc: { assets: { gold: { last: 3575 } } }, now: T(2026, 11, 20, 6), vet: { outlook: { week: { from: '$3,885', list: [
    { claim: 'Gold closes at or below $3,860 on some day by 2026-11-20', p: 0.47, baseP: 0.456, status: st({ kind: 'touchDown', level: 3860 }) },
    { claim: 'Gold closes at or above $3,920 on some day by 2026-11-20', p: 0.45, baseP: 0.468, status: st({ kind: 'touchUp', level: 3920 }) }] } } } });
  const odds = m.sections.find((x) => /odds/.test(x.h)).lines;
  assert.equal(odds[0], 'Gold closes at or below $3,860 on some day by 2026-11-20: already happened: the 2026-11-17 close was 3,849 (he gave it 47%).');
  assert.match(odds[1], /: 45% \(usual 47%\); not yet: the last close/);
});

test('verdict: an invalidation line never names as a future event what is already true, and a release carries its country', () => {
  const src = fs.readFileSync(new URL('council/veteran.mjs', root), 'utf8');
  assert.match(src, /gold is already below the 10-week average \$\{a\[1\]\}: the trend tiebreaker is off until a weekly close back above it/);
  assert.match(src, /ry\.lean < 0 \? 'adds to the real-rate headwind' : 'ends the real-rate support'/);
  const r = { event: 'Employment Change', country: 'AUD', scheduledUtc: '2026-11-19T00:30:00.000Z', expectation: { consensus: '25.2K', previous: '-39.3K', capturedAtUtc: '2026-11-15T05:57:23.000Z' }, firstPrint: null };
  assert.equal(V.releaseCheck(r).country, 'AUD'); assert.equal(V.releaseCheck(r, {}, T(2026, 11, 19, 12)).surpriseNote, 'pending');
  assert.match(V.releaseCheck(r, {}, T(2026, 11, 21, 12)).surpriseNote, /^no first print was captured within 48 hours of the release: no surprise is scored$/);
  // one fact, one number: the positioning rank names its window
  const ch = (cot) => V.channels({ cot }, T(2026, 11, 20)).list.find((x) => x.k === 'pos').obs;
  assert.match(ch({ net: 112341, chg4w: 5252, pct: 53, pct3y: 33, asOf: '2026-11-10', weeks: 60 }), /33rd percentile of 3 years \(positions as of 2026-11-10\)$/);
  assert.match(ch({ net: 112341, chg4w: 5252, pct: 53, asOf: '2026-11-10', weeks: 60 }), /53rd percentile of the last 60 weeks/);
  assert.match(O.digest({ list: [{ k: 'pos', obs: ch({ net: 1, chg4w: 1, pct: 91, asOf: '2026-11-10', weeks: 60 }), lean: 0, cannot: '' }] }, null).list[0].says, /Crowded long/, 'the digest still reads the rank');
});

test('week ahead: the levels sit either side of the latest price, the month call names its level, and each day says what to watch', () => {
  const v = vet(); v.summary = G.summary(v);
  const f = W.frameOf({ goldScore: { score: -1, label: 'AUCTION (no macro edge)' } }, v);
  const lvl = f.lines.find((l) => /^Gold near/.test(l)), call = f.lines.find((l) => /month call/.test(l));
  assert.match(lvl, /^Gold near \$3,575 now \(last close \$3,607 on 2026-11-19\); watch \$3,590 above \(13-week low, traded through since that close\) and \$3,550 below/, 'it read "Gold near $3,607 ...; watch $3,590 above"');
  assert.ok(f.levels.above.price > f.levels.mark.px && f.levels.below.price < f.levels.mark.px);
  assert.match(call, /53% that gold closes above \$3,885 on 2026-12-11 \(set at the 2026-11-13 close\) against a base rate of 57% \(leans against gold, confidence low\)\. Gold is now 8\.0% below that level: read the lean, not the odds\.$/);
  const plan = W.build({ now: T(2026, 11, 20, 14, 32), cal: [], rf: null, fc: null, v });
  assert.deepEqual(plan.days.map((d) => d.day), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
  const by = Object.fromEntries(plan.days.map((d) => [d.dow, d]));
  assert.match(by.Monday.focus, /^Watch: all week, a daily close above \$3,590 \(13-week low\) or below \$3,550 \(Round number\)\.$/);
  assert.equal(by.Tuesday.focus, undefined, 'nothing to add: no line');
  assert.match(by.Wednesday.focus, /^Watch: after PCE, the reaction against his own lines \(10Y TIPS real yield above 3\.03%, DXY above 105\.5\)\.$/);
  assert.match(by.Thursday.focus, /A holiday session is thin: its close counts for the dated calls/); assert.equal(by.Thursday.market.kind, 'holiday');
  assert.match(by.Friday.focus, /An early close: the day still counts for the dated calls\./); assert.equal(by.Friday.market.kind, 'early');
  // a dated call due inside the week is named on its day
  const v2 = vet(); v2.outlook.week = { horizon: 5, by: '2026-11-27', list: [] }; v2.summary = G.summary(v2);
  assert.match(W.build({ now: T(2026, 11, 21, 2), cal: [], rf: null, fc: null, v: v2 }).days[4].focus, /Due at this close: week calls\./);
});

test('morning note: on a Friday the six days ahead come from the council\'s schedule too, with the US holiday (it said "No high-impact release ... for the next six days", five days before PCE)', () => {
  const now = T(2026, 11, 20, 6, 3), cal = [{ at: T(2026, 11, 20, 15), country: 'USD', title: 'Revised UoM Consumer Sentiment', impact: 'Medium', forecast: '51.7', previous: '51.0' }];
  const w = D.worldReport({ fc: { regime: {} }, vet: null, cal, now }), sec = w.sections.find((x) => x.h === 'The next six days').lines;
  assert.equal(sec[0], 'Wed 25 Nov 13:30 · United States · PCE (Personal Income and Outlays) · from the desk\'s own schedule (the calendar\'s consensus is not out yet)');
  assert.match(sec[1], /^United States · Thanksgiving Day \(Thu 26 Nov\): US stocks closed, gold and currencies trade a short, thin session that still counts as a daily close\.$/);
  assert.ok(!sec.some((l) => /^No high-impact/.test(l)));
  // a release the calendar already holds is not listed twice
  const cal2 = cal.concat([{ at: T(2026, 11, 25, 13, 30), country: 'USD', title: 'Core PCE Price Index m/m', impact: 'High', forecast: '0.3%', previous: '0.2%' }]);
  const sec2 = D.worldReport({ fc: { regime: {} }, vet: null, cal: cal2, now }).sections.find((x) => x.h === 'The next six days').lines;
  assert.equal(sec2.filter((l) => /PCE/.test(l)).length, 1); assert.match(sec2[0], /Core PCE Price Index m\/m · expected 0\.3%/);
  // a quiet week still says so
  const q = D.worldReport({ fc: { regime: {} }, vet: null, cal: [], now: T(2026, 11, 13, 6, 3) }).sections.find((x) => x.h === 'The next six days').lines;
  assert.deepEqual(q, ['No high-impact release is on the calendar for the next six days.']);
});
