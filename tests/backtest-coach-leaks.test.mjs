// node --test tests/backtest-coach-leaks.test.mjs — ChronosTrade's coach for results (17 Nov 2026): one record across sessions,
// where your R goes (the leak report and its counterfactuals from candles AFTER the exit only), patterns of the trader's own record
// (20+ trades on both sides and |t| >= 2), the session plan and the debrief's free part. Pure functions on BT, plus page wiring:
// the new page block is display and record only (no order call but the caller's own step after msConfirm, no `.stop =`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const BT = createRequire(import.meta.url)('../assets/backtest-engine.js');
const page = readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');
const M15 = 900, T0 = Date.UTC(2026, 0, 5, 8) / 1000;

// a buy closed by hand at +0.5R (entry 100, stop 99, target 102), then candles after it
const manual = (o = {}) => ({ id: 1, side: 'buy', entry: 100, stop: 99, r0: 1, target: 102, exit: 100.5, openedAt: T0, closedAt: T0 + 4 * M15, reason: 'manual', R: 0.5, Rmove: 0.5, net: 5, mfe: 0.7, ...o });
const bar = (i, o, h, l, c) => ({ time: T0 + i * M15, open: o, high: h, low: l, close: c });

test('exitCf: candles AFTER the exit only; the opening stop and target; stop first; nothing before the exit is read', () => {
  const t = manual();
  // candles up to and including the exit candle hit both levels: they must never count
  const before = [bar(0, 100, 103, 98, 100), bar(1, 100, 103, 98, 100), bar(4, 100.5, 105, 90, 100.5)];
  const after = [bar(5, 100.5, 101, 100.2, 100.8), bar(6, 100.8, 102.4, 100.6, 102.1), bar(7, 102, 103, 97, 98)];
  assert.deepEqual(BT.exitCf(t, before.concat(after), M15, T0 + 99 * M15), { R: 2, how: 'target', n: 2, at: T0 + 6 * M15 });
  // changing every candle at or before the exit changes nothing
  const wild = before.map((b) => ({ ...b, high: 999, low: 1 }));
  assert.deepEqual(BT.exitCf(t, wild.concat(after), M15, T0 + 99 * M15), BT.exitCf(t, before.concat(after), M15, T0 + 99 * M15));
  // only candles that ENDED by `until` (the replay moment): the target candle not closed yet -> still open, marked to the last close
  assert.deepEqual(BT.exitCf(t, before.concat(after), M15, T0 + 6 * M15), { R: 0.8, how: 'open', n: 1 });
  // no candle after the exit yet -> nothing measured
  assert.equal(BT.exitCf(t, before, M15, T0 + 99 * M15), null);
  // stop first when one candle holds both; a gap through the stop fills at the open
  assert.equal(BT.exitCf(t, [bar(5, 100.5, 103, 98, 100)], M15, T0 + 99 * M15).R, -1);
  assert.equal(BT.exitCf(t, [bar(5, 97, 97.5, 96, 97)], M15, T0 + 99 * M15).R, -3);
  // the target it OPENED with (ctx.tgt0) wins over a target moved later
  assert.equal(BT.exitCf({ ...t, target: 110, ctx: { tgt0: 102 } }, after, M15, T0 + 99 * M15).R, 2);
  // an exit already past the opening stop (the stop had been moved away) counts as that stop
  assert.deepEqual(BT.exitCf({ ...t, exit: 98.5, R: -1.5 }, after, M15, T0 + 99 * M15), { R: -1, how: 'stop', n: 0 });
  assert.equal(BT.exitCf({ ...t, r0: 0 }, after, M15, T0 + 99 * M15), null);
});

// a record of n trades with a context; f(i) -> overrides
function rec(n, f, sid) { const out = []; for (let i = 0; i < n; i++) { const at = T0 + i * 7200, o = f(i) || {}, R = o.R ?? 1;
  out.push({ id: i + 1, side: 'buy', entry: 100, stop: 99, r0: 1, target: 102, exit: 100 + R, openedAt: at, closedAt: at + 3600, reason: R < 0 ? 'stop' : 'target', R, Rmove: R, net: R * 10, mfe: Math.max(0, R) + 0.2,
    ...o, ctx: { side: 'buy', session: 'London', stopAtr: 1, htfRel: 'with', trend: { htf: 'up', htfName: 'H1' }, ...(o.ctx || {}) }, ...(sid ? { sid } : {}) }); }
  return out; }

test('coachLeaks: one row per habit with n, sum and mean R; sorted by the R given up; under 20 "too few to judge"', () => {
  const L0 = rec(30, (i) => (i % 3 === 0 ? { R: -1, stopAway: 0.5 } : i % 7 === 1 ? { R: -1, ctx: { htfRel: 'against' } } : { R: 1 }));
  const L = BT.coachLeaks(L0, null);
  const away = L.rows.find((r) => r.k === 'away'), ag = L.rows.find((r) => r.k === 'against');
  assert.equal(away.n, 10); assert.equal(away.sumR, -10); assert.equal(away.meanR, -1); assert.equal(away.lost, 10); assert.equal(away.judge, 'too few to judge');
  assert.ok(ag.n > 0 && ag.lost === -ag.sumR);
  assert.equal(L.rows[0].k, 'away', 'the biggest leak first');
  assert.match(L.headline, /^Your biggest leak: moved the stop away, −10\.00R over 10 trades \(−1\.00R a trade\)\. Too few trades to judge\.$/);
  // from 20 trades: "your record, not a tested edge"
  const big = BT.coachLeaks(rec(45, (i) => (i < 22 ? { R: -1, stopAway: 0.3 } : { R: 1 })), null);
  assert.equal(big.rows.find((r) => r.k === 'away').judge, 'your record, not a tested edge');
  assert.match(big.headline, /Your record, not a tested edge\.$/);
  // nothing lost -> no leak named
  assert.match(BT.coachLeaks(rec(5, () => ({ R: 1 })), null).headline, /^No leak measured yet/);
});

test('coachLeaks: exits by hand measured with candles after the exit (barsFor); break-even at +1R from the recorded best price; capture', () => {
  const T = [manual({ id: 1 }), manual({ id: 2, openedAt: T0 + 20 * M15, closedAt: T0 + 24 * M15, exit: 100.3, R: 0.3, Rmove: 0.3 }), { ...manual({ id: 3 }), reason: 'stop', exit: 99, R: -1, Rmove: -1, mfe: 1.4, closedAt: T0 + 40 * M15 }];
  const bars = []; for (let i = 0; i < 60; i++) bars.push(bar(i, 100.5, i === 6 || i === 26 ? 102.2 : 100.9, 100.1, 100.5));
  const seen = []; const L = BT.coachLeaks(T, (t) => { seen.push(t.id); return { bars, sec: M15, until: T0 + 60 * M15 }; });
  const man = L.rows.find((r) => r.k === 'manual'), early = L.rows.find((r) => r.k === 'early'), gb = L.rows.find((r) => r.k === 'giveback');
  assert.deepEqual(man.held, { n: 2, R: 4, actual: 0.8, gain: 3.2, open: 0, unmeasured: 0 }); assert.equal(man.lost, 3.2);
  assert.equal(early.n, 2); assert.equal(early.lost, 3.2);
  assert.deepEqual(gb.be, { gain: 1, approx: true }); assert.equal(gb.lost, 1);
  assert.deepEqual(L.be, { reached: 1, lostAfter: 1, gain: 1 });
  assert.equal(L.capture.n, 2); assert.equal(L.capture.ratio, BT.r2(0.8 / 1.4, 2));
  assert.match(L.headline, /holding to the opening target or stop would have made \+4\.00R instead of \+0\.80R/);
  // a trade whose candles the page does not hold is "not measured", never guessed
  const L2 = BT.coachLeaks(T, () => null); assert.deepEqual(L2.rows.find((r) => r.k === 'manual').held, { n: 0, R: 0, actual: 0, gain: 0, open: 0, unmeasured: 2 }); assert.equal(L2.rows.find((r) => r.k === 'manual').lost, 0);
  // the counterfactual never uses a candle at or before the exit: rewriting them changes nothing
  const wild = bars.map((b) => (b.time <= T0 + 24 * M15 && (b.time <= T0 + 4 * M15 || b.time > T0 + 20 * M15) ? { ...b, high: 500, low: 1 } : b));
  const L3 = BT.coachLeaks([T[0]], () => ({ bars: wild, sec: M15, until: T0 + 60 * M15 })), L4 = BT.coachLeaks([T[0]], () => ({ bars, sec: M15, until: T0 + 60 * M15 }));
  assert.deepEqual(L3.rows.find((r) => r.k === 'manual').held, L4.rows.find((r) => r.k === 'manual').held);
});

test('coachLeaks: revenge within a session, oversized, away from levels, outside the best session', () => {
  const T = rec(12, (i) => ({ R: i % 2 ? -1 : 1, ...(i === 3 ? { riskSet: 1, riskPct: 1.5 } : {}), ...(i === 4 ? { ctx: { draw: { near: { dAtr: 2 }, atLevel: false, inBox: false } } } : {}), ...(i >= 8 ? { ctx: { session: 'Asia' } } : {}) }));
  T[5].openedAt = T[4].closedAt + 600; T[4].R = -1; T[4].net = -10;   // opened 10 min after a loss
  const L = BT.coachLeaks(T, null), k = (x) => L.rows.find((r) => r.k === x);
  assert.equal(k('revenge').n, 1); assert.equal(k('size').n, 1); assert.equal(k('levels').n, 1);
  assert.ok(k('session') && /^Outside your best session \((London|Asia)\)$/.test(k('session').name));
  // two sessions' trades are never mixed for revenge: a loss in another session does not count
  const a = rec(1, () => ({ R: -1 }), 'x'), b2 = rec(1, () => ({ R: 1 }), 'y'); b2[0].openedAt = a[0].closedAt + 60; b2[0].closedAt = b2[0].openedAt + 600;
  assert.equal(BT.coachLeaks(a.concat(b2), null).rows.find((r) => r.k === 'revenge'), undefined);
});

test('patterns: a split becomes a pattern only with 20+ trades on BOTH sides and |Welch t| >= 2; a matching draft is warned', () => {
  // 30 trades at a 1 ATR stop lose, 30 at 2 ATR win: a pattern on the stop size
  const T = rec(60, (i) => (i < 30 ? { R: -1 + (i % 3) * 0.05, ctx: { stopAtr: 1 } } : { R: 1.2 + (i % 4) * 0.05, ctx: { stopAtr: 2 } }));
  const P = BT.coachPatterns(T), bad = P.find((p) => p.k === 'stop' && p.bad);
  assert.ok(bad && bad.label === '0.75 to 1.5 ATR' && bad.n === 30 && bad.restN === 30 && bad.t <= -2);
  assert.match(bad.text, /^0\.75 to 1\.5 ATR \(stop size\): −0\.95R a trade, n 30, against \+1\.2\dR for the rest \(n 30\), t −\d+\.\d\d\. Your record, not a tested edge\.$/);
  assert.equal(BT.patternMatch(P, { side: 'buy', stopAtr: 1.1 }).length >= 1, true);
  assert.equal(BT.patternMatch(P, { side: 'buy', stopAtr: 2 }).length, 0, 'the good side is never a warning');
  assert.deepEqual(BT.patternMatch(P, null), []);
  // 19 on one side: no pattern, however large the difference
  const few = rec(49, (i) => (i < 19 ? { R: -1, ctx: { stopAtr: 1 } } : { R: 1.5 + (i % 2) * 0.1, ctx: { stopAtr: 2 } }));
  assert.equal(BT.coachPatterns(few).filter((p) => p.k === 'stop').length, 0);
  // 20 a side but noise (|t| < 2): no pattern
  const noise = rec(40, (i) => ({ R: i % 2 ? 1 : -1, ctx: { stopAtr: i < 20 ? 1 : 2 } }));
  assert.equal(BT.coachPatterns(noise).filter((p) => p.k === 'stop').length, 0);
});

test('plan: limits per replay day, the next trade past the plan is named; adherence counts trades taken past a limit', () => {
  const day = T0, T = rec(4, (i) => ({ R: i < 3 ? -1 : 1 }));   // three losses then a win, all on 5 Jan
  assert.deepEqual(BT.planNorm({ maxTrades: '3', maxLossR: '2.5', maxLosses: -1, focus: '  a  rule ', ask: 'yes', askGrade: true, junk: 1 }), { maxTrades: 3, maxLossR: 2.5, maxLosses: 0, focus: 'a rule', nextFocus: '', ask: false, askGrade: true });
  const c = BT.planCheck({ maxTrades: 4, maxLossR: 2, maxLosses: 3 }, T, [], day + 9 * 3600);
  assert.equal(c.trades, 4); assert.equal(c.R, -2); assert.equal(c.streak, 0, 'the last trade won');
  assert.deepEqual(c.broken.map((b) => b.k), ['trades', 'loss']); assert.match(c.broken[0].text, /^4 of 4 trades taken today: the next one is past your plan$/);
  const c3 = BT.planCheck({ maxLosses: 3 }, T.slice(0, 3), [], day + 9 * 3600); assert.deepEqual(c3.broken.map((b) => b.k), ['streak']);
  // another day starts clean; an open position counts as a trade taken today
  const next = BT.planCheck({ maxTrades: 1 }, T, [{ openedAt: day + 86400 + 60 }], day + 86400 + 3600); assert.equal(next.trades, 1); assert.equal(next.broken.length, 1);
  assert.equal(BT.planCheck({}, T, [], day).set, false);
  const A = BT.planAdherence({ maxTrades: 2 }, T); assert.deepEqual(A, { days: 1, kept: 0, past: 2, items: [{ day: '2026-01-05', past: 2 }] });
  assert.equal(BT.planAdherence({}, T), null);
});

test('gatherSessions: every saved session read only, merged per session, labelled, ids kept apart; the live account wins', () => {
  const mk = (id, sym, n) => ({ id, sym, tf: '15m', acct: { closed: rec(n, () => ({ R: 1 })) } });
  const A = { s1: mk('s1', 'xau', 3), s2: mk('s2', 'eurusd', 2) }; A.s2.acct.closed.push({ ...A.s2.acct.closed[1], R: 0.5, partial: true });   // a partial close of trade #2
  const before = JSON.stringify(A);
  const g = BT.gatherSessions(A, { current: { id: 's1', sym: 'xau', tf: '15m', acct: { closed: rec(4, () => ({ R: -1 })) } } });
  assert.equal(JSON.stringify(A), before, 'read only');
  assert.equal(g.sessions, 2); assert.equal(g.trades.length, 6, 'the live s1 (4) + s2 merged (2)');
  assert.ok(g.trades.every((t) => /^s[12]#\d+$/.test(t.id) && t.sess.label)); assert.equal(g.trades.filter((t) => t.sid === 's1').every((t) => t.R === -1), true);
  assert.equal(g.trades.find((t) => t.id === 's2#2').R, 1.5, 'partials merged inside their own session');
  assert.equal(g.trades.find((t) => t.id === 's2#1').sess.label, 'EURUSD 15m');
  // the splits and leaks read the merged list as it is (two sessions' trade #1 stay two trades)
  assert.equal(BT.coachSplits(g.trades).n, 6); assert.equal(BT.coachLeaks(g.trades, null).n, 6);
});

test('debrief free part: totals, plan adherence, top leaks, best and worst trade, grades, a focus rule from the top leak', () => {
  const T = rec(8, (i) => ({ R: i === 2 ? 2.5 : i % 2 ? -1 : 0.5, ...(i % 2 ? { stopAway: 0.4 } : {}), ctx: { grade: i < 4 ? 'A' : 'C' } }));
  const d = BT.coachDebrief(T, { plan: { maxTrades: 5 } });
  assert.equal(d.n, 8); assert.equal(d.wins, 4); assert.equal(d.R, 0);
  assert.equal(d.leaks[0].k, 'away'); assert.ok(d.leaks.length <= 3 && d.leaks.every((r) => r.lost > 0));
  assert.equal(d.best.R, 2.5); assert.equal(d.worst.R, -1);
  assert.deepEqual(d.grades.map((g) => [g.grade, g.n]), [['A', 4], ['C', 4]]); assert.equal(d.grades[0].judge, 'too few to judge');
  assert.deepEqual(d.adherence, { days: 1, kept: 0, past: 3, items: [{ day: '2026-01-05', past: 3 }] });
  assert.match(d.focus, /^Keep the stop where you set it at entry/);
  assert.doesNotMatch(JSON.stringify(d), /widen|remove the stop|guarantee|proven edge/i);
});

test('the grade: recorded in the entry context and split in "How you trade"', () => {
  const bars = []; let p = 2000; for (let i = 0; i < 300; i++) { const o = p; p += Math.sin(i / 9); bars.push({ time: T0 + i * M15, open: o, high: Math.max(o, p) + 1, low: Math.min(o, p) - 1, close: p }); }
  const c = BT.coachCtx(bars, M15, bars[250].time + M15, { side: 'buy', entry: bars[250].close, stop: bars[250].close - 3, target: bars[250].close + 6, at: bars[250].time, grade: 'B' }, []);
  assert.equal(c.grade, 'B'); assert.equal(c.tgt0, bars[250].close + 6);
  assert.equal(BT.coachCtx(bars, M15, bars[250].time + M15, { side: 'buy', entry: 1, stop: 0, at: bars[250].time, grade: 'Z' }, []).grade, undefined);
  const sp = BT.coachSplits(rec(4, (i) => ({ ctx: { grade: i % 2 ? 'A' : 'C' } })));
  assert.deepEqual(sp.features.find((f) => f.k === 'grade').groups.map((g) => g.label).sort(), ['Grade A', 'Grade C']);
});

test('page: the coach-for-results block is display and record only; its one order path is the caller\'s own step after msConfirm', () => {
  const a = page.indexOf('// ---- Coach for results (17 Nov 2026'), z = page.indexOf('// ---- end Coach for results');
  assert.ok(a > 0 && z > a); const blk = page.slice(a, z);
  assert.doesNotMatch(blk, /BT\.(place|close|closePartial|cancel)\(|\.stop\s*=[^=]|\binstant\(|\$\('place'\)\.click|BT\.coachStop/);
  // the gate: a styled confirm, then the caller's own `go`, only when the owner asked for it
  assert.match(blk, /function crGate\(go\) \{ if \(!CFR \|\| CFR\.bypass \|\| !CFR\.plan\.ask \|\| !S\.bars\.length\) return true;/);
  assert.match(blk, /msConfirm\([\s\S]{0,300}?\{ title: 'Past your session plan', ok: 'Trade anyway' \}\)\.then\(\(y\) => \{ if \(!y\) return; CFR\.bypass = true; try \{ go\(\); \}/);
  assert.equal((blk.match(/\bgo\(\)/g) || []).length, 1);
  // the gate is called by the two existing order paths, each handing in its own step
  assert.match(page, /function instant\(side\) \{[^\n]*if \(!crGate\(\(\) => instant\(side\)\)\) return;/);
  assert.match(page, /\$\('place'\)\.addEventListener\('click', \(\) => \{ \$\('o-err'\)\.textContent = ''; if \(D && cur\(\) && !crGate\(\(\) => \$\('place'\)\.click\(\)\)\) return;/);
  // storage: the plan and the scope only (display preferences of this device), each write in try / catch
  assert.deepEqual([...new Set([...blk.matchAll(/localStorage\.(setItem|removeItem)\(([^,)]+)/g)].map((m) => m[2]))].sort(), ['CR_PLAN', 'CR_SCOPE']);
  assert.match(blk, /const CR_PLAN = 'btLab:plan', CR_SCOPE = 'btLab:coachScope';/);
  // the keys: A and Shift+A, outside inputs and open dialogs; no clash with the page's other letter keys
  assert.match(blk, /e\.code !== 'KeyA' \|\| e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey \|\| \/INPUT\|TEXTAREA\|SELECT\/\.test/);
  assert.doesNotMatch(page.slice(0, a), /e\.key === 'a'|e\.key === 'A'|'KeyA'/);
  assert.match(page, /<kbd>A<\/kbd><\/td><td>ask the coach about the last closed trade/);
  // its CSS: its own block, outside the simple phone view's block, nothing under 12 px
  const c0 = page.indexOf('/* Coach for results (17 Nov 2026)'), c1 = page.indexOf('/* end Coach for results */'); assert.ok(c0 > 0 && c1 > c0);
  const css = page.slice(c0, c1); assert.doesNotMatch(css, /data-phone|\.ps-/);
  for (const m of css.matchAll(/(?:font-size:\s*|font: \d+ )([\d.]+)px/g)) assert.ok(+m[1] >= 12, m[0]);
  // the report and the export carry the debrief; the scope reaches the session question
  assert.match(page, /debrief: crDebReport\(\)/); assert.match(page, /\.\.\.\(db \? \{ debrief: db \} : \{\}\)/); assert.match(page, /scope: all \? 'all' : 'session'/);
});
