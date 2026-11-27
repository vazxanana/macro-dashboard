// Bug hunt on the Desk's Charts (20 Nov 2026): the features built on 18-20 Nov, used in a browser (drawing tools, paper account,
// volume profile, Layout, Markets side by side, live ticks, full screen). Each test pins one fix; CLAUDE.md "Charts bug hunt".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.BT = require('../assets/backtest-engine.js');
const PP = require('../assets/ms-paper.js');
const VP = require('../assets/ms-vprof.js');
const PAPER = fs.readFileSync('assets/ms-paper.js', 'utf8'), DRAW = fs.readFileSync('assets/ms-draw.js', 'utf8'), VPROF = fs.readFileSync('assets/ms-vprof.js', 'utf8');
const PAGE = fs.readFileSync('market-structure.html', 'utf8');
const bar = (time, open, high, low, close, volume) => ({ time, open, high, low, close, volume });

test('rule 1 on the paper account: a stop at or under zero is no stop (order, hand edit, stored record)', () => {
  const s = PP.fresh();
  // the engine itself lets a negative stop through (it only refuses a falsy one): the panel's own check is what holds
  assert.throws(() => PP.order(s, 'xau', { side: 'buy', price: 4000, stop: -5 }, 600), /needs a stop/);
  assert.throws(() => PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 0 }, 600), /needs a stop/);
  assert.throws(() => PP.order(s, 'xau', { side: 'buy', price: 4000, stop: '' }, 600), /needs a stop/);
  assert.throws(() => PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 3990, at: -1 }, 600), /above zero/);
  assert.equal(s.acct.positions.length + s.acct.orders.length, 0, 'nothing was placed');
  const p = PP.order(s, 'xau', { side: 'buy', price: 4000, stop: 3990 }, 630);
  // the stop of an open trade, edited by hand
  assert.match(PP.stopEdit(p, 0, 4001), /needs a stop/); assert.match(PP.stopEdit(p, -5, 4001), /needs a stop/);
  assert.match(PP.stopEdit(p, null, 4001), /needs a stop/); assert.match(PP.stopEdit(p, NaN, 4001), /needs a stop/);
  assert.match(PP.stopEdit(p, 4005, 4001), /below the price now/);
  assert.match(PP.stopEdit(p, 3995, null), /No price/, 'with no price for the market nothing can be checked, so nothing changes');
  assert.equal(PP.stopEdit(p, 3995, 4001), null);
  assert.match(PP.stopEdit({ ...p, side: 'sell' }, 3990, 4001), /above the price now/);
  assert.match(PAPER, /const why = stopEdit\(p, v, cur\); if \(why\) \{ msg\(why, true\); t\.value = p\.stop; return; \}/, 'the table uses it');
  assert.match(PAPER, /if \(v == null \|\| !\(v > 0\)\) \{ msg\('Every trade needs a stop: a price above zero\.', true\); t\.value = D\.stop; return; \}/, 'and the draft');
  // a stored account
  const st = PP.fresh(); st.acct.positions = [{ id: 1, mk: 'xau', side: 'buy', entry: 4000, stop: 0, r0: 4000, units: 1 }, { id: 2, mk: 'xau', side: 'buy', entry: 4000, stop: -5, r0: 4005, units: 1 }, { id: 3, mk: 'xau', side: 'buy', entry: 4000, stop: 3990, r0: 10, units: 1 }];
  assert.deepEqual(PP.norm(st).acct.positions.map((x) => x.id), [3]);
});

test('a position left open while the page was closed: the candles in between are read, window by window', () => {
  assert.deepEqual(PP.windows(0, 100, 40), [[0, 40], [40, 80], [80, 100]]);
  assert.deepEqual(PP.windows(100, 100), []); assert.equal(PP.windows(0, 1e9, 240000).length, 12, 'at most twelve windows a pass');
  assert.equal(PP.windows(0, 4000 * 60 * 3)[0][1], 4000 * 60, 'a window is 4,000 minutes: under the candle service\'s 5,000 a request');
  // why: a buy at 3850 with its stop at 3800. Minute 3 trades through the stop; two days later the price is 3690.
  const early = [bar(60, 3850, 3852, 3845, 3848), bar(120, 3848, 3849, 3820, 3822), bar(180, 3822, 3823, 3795, 3797)], late = [bar(172800, 3690, 3692, 3688, 3691)];
  // (1) only the late candles (what the one-minute pane holds after two days): the stop is booked as a gap at another price
  const a = PP.fresh(); PP.order(a, 'xau', { side: 'buy', price: 3850, stop: 3800 }, 30);
  const e1 = PP.process(a.acct, 'xau', late, 200000); assert.equal(e1[0].trade.exit, 3690); assert.ok(e1[0].trade.R < -3, 'the old result: ' + e1[0].trade.R + 'R for a 1R stop');
  // (2) the candles in between first: the stop at its own price, -1R
  const b = PP.fresh(); PP.order(b, 'xau', { side: 'buy', price: 3850, stop: 3800 }, 30);
  const e2 = PP.process(b.acct, 'xau', early, 200000); assert.equal(e2[0].trade.exit, 3800); assert.equal(e2[0].trade.R, -1); assert.equal(e2[0].trade.closedAt, 180);
  // the page: the pane's market waits for the catch-up while the pane does not reach back to its last check
  assert.match(PAPER, /const paneGap = \(\) => \{ const b = H\(\)\.m1\(\), from = dueFrom\(H\(\)\.key\); return from != null && b\.length > 0 && b\[0\]\.time - H\(\)\.TZ > from; \};/);
  assert.match(PAPER, /const gap = paneGap\(\), ev = gap \? \[\] : process\(S\.acct, H\(\)\.key, m1\(\), now\(\)\);/, 'never checked on the pane alone across a gap');
  assert.match(PAPER, /for \(const \[a, z\] of windows\(from, to\)\) \{\s*let bars = null; try \{ bars = await H\(\)\.since\(mk, a, z\); \} catch \(e\) \{ bars = null; \}\s*if \(!Array\.isArray\(bars\)\) break;/, 'a failed read stops the pass: no candle, no exit');
  assert.match(PAPER, /Date\.now\(\) - tried > 15e3/, 'and is not asked again every two seconds');
  assert.match(PAGE, /since: async \(k, from, to\) => \{[\s\S]{0,420}j\.bars\.whole = true; return j\.bars; \} return null; \}/, 'the page marks the service\'s own answer whole (an empty window is a closed market)');
});

test('the paper panel: a press is never redrawn under, a change is shown at once, the draft does not move under a field in hand', () => {
  assert.match(PAPER, /function draw\(force\) \{\s*const el = \$\('ms-pp'\); if \(!el \|\| !S\) return;\s*if \(pressing && Date\.now\(\) - pressing < 4000\) \{ pend = true; return; \}/);
  assert.match(PAPER, /el\.addEventListener\('pointerdown', \(\) => \{ pressing = Date\.now\(\); \}, true\);/);
  assert.match(PAPER, /root\.addEventListener\('pointerup', release, true\); root\.addEventListener\('pointercancel', release, true\); root\.addEventListener\('blur', release\);/);
  assert.match(PAPER, /if \(k === sig \|\| \(typing && !force\)\) \{ live\(fl, eq\); return; \}/, 'only the timer waits for a field in hand');
  for (const id of ['pp-risk', 'pp-tgt', 'pp-satr']) assert.match(PAPER, new RegExp(`t\\.id === '${id}'[^\\n]*?draw\\(true\\); return;`), id + ' redraws at once');
  assert.match(PAPER, /if \(keep\) \{ const f = el\.querySelector\(keep\); if \(f\) \{ try \{ f\.focus\(\{ preventScroll: true \}\);/, 'the focus stays where it was');
  assert.match(PAPER, /el\.addEventListener\('focusin', \(e\) => \{ if \(D && e\.target\.closest && e\.target\.closest\('\.pp-draft'\) && e\.target\.tagName === 'INPUT'\) D\.follow = false; \}\);/);
  assert.match(PAPER, /if \(D\.follow && !held\) \{ setDraftDefaults\(false\); \}/, 'no following while the panel cannot show it');
  assert.match(PAPER, /else \{ D\.at = v; if \(!D\.touched\) setDraftDefaults\(true\); \}/, 'a typed entry still sets the stop and target around it, unless they were typed');
});

test('the panel\'s line of news survives the redraw that follows every order and close; the CSV writes plain prices', () => {
  assert.match(PAPER, /let LIVE = \{ t: '', bad: false \};\s*function msg\(t, bad\) \{ LIVE = \{ t: String\(t \?\? ''\), bad: !!bad \};/);
  assert.match(PAPER, /<p class="pp-live\$\{LIVE\.bad \? ' bad' : ''\}" id="ms-pp-live" role="status" aria-live="polite">\$\{esc\(LIVE\.t\)\}<\/p>/, 'drawn with the panel, escaped');
  assert.match(PAPER, /if \(t\.length\) msg\(t\.join\(' · '\)\);/, 'fills and exits go through it too');
  assert.match(PAPER, /typeof v === 'number' && Number\.isFinite\(v\) \? \+v\.toFixed\(8\) : v/, '3549.72, not 3549.7200000000003');
});

test('the position\'s lines follow the charts that show its market now', () => {
  assert.match(PAPER, /const chartsKey = \(\) => \(root\.msCharts \? root\.msCharts\.list\.map\(\(c\) => c\.id \+ ':' \+ c\.market\(\)\)\.join\('\|'\) : ''\);/);
  assert.match(PAPER, /LINES = \[\]; CK = chartsKey\(\);/); assert.match(PAPER, /if \(chartsKey\(\) !== CK\) lines\(\);/);
});

test('a drawing let go outside its chart is let go', () => {
  assert.match(DRAW, /const endGes = \(\) => \{ if \(GES\) up\(GES\.cx\); \};\s*addEventListener\('pointerup', endGes, true\); addEventListener\('pointercancel', endGes, true\); addEventListener\('blur', endGes\);/);
  assert.match(DRAW, /if \(GES && ev\.pointerType === 'mouse' && ev\.buttons === 0\) up\(GES\.cx\);/, 'a mouse back with no button down (released outside the window)');
  assert.doesNotMatch(DRAW, /el\.addEventListener\('pointerup', \(\) => up\(cx\), true\)/, 'no longer per chart only');
  assert.match(DRAW, /if \(GES\) \{ if \(SEL && GES\.d0\) load\(SEL\.mk\)\[SEL\.i\] = GES\.d0; GES\.cx && lock\(GES\.cx, false\); GES = null; \}/, 'Escape lets go of any gesture and unlocks the chart');
});

test('full screen: the floating parts are made, moved and shown inside the full-screen element (the browser\'s and the page\'s own)', () => {
  assert.match(DRAW, /const fsHost = \(\) => document\.fullscreenElement \|\| document\.querySelector\('#v-charts\.ch-fake-fs'\) \|\| document\.body;/);
  assert.equal((DRAW.match(/fsHost\(\)\.appendChild\(/g) || []).length, 3, 'the style bar, the right-click menu and the drawings list, made on first use');
  assert.doesNotMatch(DRAW, /document\.body\.appendChild\((el|m)\)/);
  assert.match(DRAW, /for \(const id of \['ms-dsel', 'ms-cmenu', 'ms-ph-menu', 'ms-toasts', 'ms-dlist'\]\)/);
  assert.match(DRAW, /document\.addEventListener\('fullscreenchange', fsMove\); document\.addEventListener\('ms:fs', fsMove\);/);
  assert.match(PAGE, /document\.dispatchEvent\(new Event\('ms:fs'\)\);/, 'the page\'s own full screen says so');
  // the rule that hides everything else in full screen leaves them alone
  const rule = /:is\(#v-charts:fullscreen, #v-charts\.ch-fake-fs\) > :not\(\.sec-h\)[^{]*\{ display: none !important; \}/.exec(PAGE)[0];
  for (const k of [':not(.ms-dsel)', ':not(.ms-cmenu)', ':not(.ph-menu)', ':not(#ms-toasts)']) assert.ok(rule.includes(k), k);
  assert.match(PAGE, /const openMenu = \(pn, btn\) => \{ if \(forBtn === btn && !MENU\.hidden\) \{ close\(\); return; \} menuHost\(\);/);
  assert.match(PAGE, /const openMk = \(pn, btn\) => \{ if \(forBtn === btn && !MENU\.hidden\) \{ close\(\); return; \} menuHost\(\);/);
  assert.match(PAGE, /const openMarket = \(\) => \{ if \(leaveFs\(openMarket\)\) return;/, 'the market list is in the page header: full screen is left for it');
});

test('layout with Sync: a window wider than a chart can draw is cut to its last candles, never an empty chart', () => {
  const src = /window\.msLayFit = (\(r, n, cap\) => \{[^\n]*?\});\n/.exec(PAGE)[1], fit = new Function(`return ${src};`)();
  // H4 leads with five weeks: on M5 that is 10,640 candles from -7,700 to +2,940; the chart holds 1,500 candles and draws 1,240
  const r = fit({ from: -7700, to: 2940 }, 1500, 1240);
  assert.equal(Math.round(r.to - r.from), 1240); assert.ok(r.from < 1499 - 1000 && r.to >= 1499, 'its candles are in view: ' + JSON.stringify(r));
  assert.ok(r.to <= 1499 + 1240 * 0.08 + 1, 'a small margin on the right, not a blank chart');
  assert.deepEqual(fit({ from: 1300, to: 1520 }, 1500, 1240), { from: 1300, to: 1520 }, 'a window the chart can draw is untouched');
  assert.deepEqual(fit({ from: 100, to: 2000 }, 1500, 1240), { from: 1499 + 1240 * 0.08 - 1240, to: 1499 + 1240 * 0.08 });
  assert.deepEqual(fit({ from: 0, to: 2000 }, 1500, 0), { from: 0, to: 2000 }, 'no width known: untouched');
  assert.equal(fit(null, 10, 10), null);
  assert.match(PAGE, /const r2 = layFit\(P, window\.BT\.syncRange\(lvOf\(src\), lvOf\(P\), r\)\); if \(!r2\) continue;/);
});

test('volume profile: the free charts carry the feed\'s volume, and a move of the price scale redraws it', () => {
  // unweighted candles give another value area than the same candles with their volume
  const B = []; for (let i = 0; i < 60; i++) B.push(bar(i * 60, 100 + i, 102 + i, 99 + i, 101 + i, i < 10 ? 5000 : 10));
  const withVol = VP.profile(B, 30, 70), flat = VP.profile(B.map((b) => ({ ...b, volume: 0 })), 30, 70);
  assert.ok(withVol.pocPx < 115 && flat.vah > withVol.vah + 10, 'the volume decides where the value area is');
  assert.match(PAGE, /SP\.bars = SP\.raw\.map\(\(b\) => \(\{ time: b\.time \+ TZ, open: b\.open \+ off, high: b\.high \+ off, low: b\.low \+ off, close: b\.close \+ off, volume: b\.volume \}\)\);/, 'one chart / Split\'s free chart');
  assert.match(PAGE, /function mmSet\(C, raw, all\) \{ const bars = raw\.map\(\(b\) => \(\{ time: b\.time \+ TZ, open: \+b\.open, high: \+b\.high, low: \+b\.low, close: \+b\.close, volume: \+b\.volume \|\| 0 \}\)\);/, 'Markets side by side');
  assert.match(PAGE, /if \(L\.volume != null\) x\.volume = L\.volume;/, 'a live tick keeps the candle\'s volume');
  assert.match(VPROF, /ya = cx\.series\.priceToCoordinate\(last\.close\); yb = cx\.series\.priceToCoordinate\(last\.close \* 1\.01\);/);
  assert.match(VPROF, /document\.documentElement\.dataset\.theme, ya, yb, typeof cx\.market === 'function' \? cx\.market\(\) : ''\]\.join\('\|'\);/, 'the price scale is part of the redraw key');
});

test('a price stream that goes silent is asked again; a market shut for the weekend is not read every second', () => {
  assert.match(PAGE, /const STREAM_QUIET = 12e3,/);   // 45 s until 26 Nov 2026; the stream's heartbeat is heard now
  assert.match(PAGE, /if \(document\.hidden\) \{ heard = Date\.now\(\); return; \}[\s\S]{0,200}?if \(marketClosed\(\) \|\| Date\.now\(\) - heard < STREAM_QUIET\) return;\s*clearInterval\(quiet\); try \{ es\.close\(\); \} catch \(e\) \{\} G\.es = null; if \(G\.live\) \{ G\.live = false; setStatus\(\); \} startTicks\(\);/);
  assert.match(PAGE, /if \(f\.es && f\.open && Date\.now\(\) - \(f\.heard \|\| 0\) > STREAM_QUIET\) \{ try \{ f\.es\.close\(\); \} catch \(e\) \{\} clearTimeout\(f\.re\); f\.open\(\); \}/, 'the free charts\' streams too');
  const src = /const shutNow = (\(I, d = new Date\(\)\) => \{[^\n]*?\});\n/.exec(PAGE)[1], shut = new Function(`return ${src};`)();
  const at = (s) => new Date(s), fx = { group: 'Forex' };
  assert.equal(shut(fx, at('2026-11-21T12:00:00Z')), true, 'Saturday'); assert.equal(shut(fx, at('2026-11-22T21:00:00Z')), true, 'Sunday before the reopen');
  assert.equal(shut(fx, at('2026-11-22T22:30:00Z')), false); assert.equal(shut(fx, at('2026-11-20T20:59:00Z')), false, 'Friday before the close');
  assert.equal(shut(fx, at('2026-11-20T21:00:00Z')), true); assert.equal(shut(fx, at('2026-11-18T12:00:00Z')), false);
  assert.equal(shut({ group: 'Crypto' }, at('2026-11-21T12:00:00Z')), false, 'crypto never shuts'); assert.equal(shut(null), false);
  assert.match(PAGE, /if \(I && shutNow\(I\) && now - C\.at < SHUT_POLL\) continue;/, 'Markets side by side');
  assert.match(PAGE, /if \(shutNow\(I\) && now - SP_POLL < SHUT_POLL\) return;/, 'one chart and Split\'s free chart');
  assert.match(PAGE, /const SHUT_POLL = 60e3;/);
});

test('phone: the drawing tools keep 44 px and take a second row (15 tools shared one row at 22 px each)', () => {
  const i = PAGE.indexOf('#v-charts .sec-h > .dr-bar { flex: 1 1 0; min-width: 0; flex-wrap: wrap;');
  assert.ok(i > 0); const blk = PAGE.slice(PAGE.lastIndexOf('@media (max-width: 640px)', i), i); assert.ok(!/\n\s*\}\s*\n\s*@media/.test(blk), 'inside the phone block');
  assert.match(PAGE, /#v-charts \.sec-h > \.dr-bar button \{ flex: 1 0 44px; width: auto; min-width: 44px; max-width: 64px; \}/);
});
