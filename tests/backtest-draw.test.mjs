// node --test tests/backtest-draw.test.mjs — ChronosTrade's drawing tools like TradingView (17 Nov 2026): the magnet, hit
// testing, resize and move, the label, the stored shape (old sessions and the Mosha hand-over still load), and the page wiring
// (tools, keys, the floating bar; a drawing never touches an order or a stop).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const BT = createRequire(import.meta.url)('../assets/backtest-engine.js');
const page = readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');

// a linear chart: 10 px a bar of 900 s from T0, 2 px a dollar from 2000 at y 400 (price up = y down)
const T0 = 1767571200, SEC = 900, X = (t) => (t - T0) / SEC * 10, Y = (p) => 400 - (p - 2000) * 2, W = 800, H = 500;
const bar = { time: T0, open: 2010, high: 2030, low: 2001, close: 2020 };

test('magnet: off leaves the price; weak snaps within the pixel tolerance only; strong always to the nearest O / H / L / C', () => {
  assert.equal(BT.drawSnap(bar, 2012.3, Y, 0), 2012.3);
  assert.equal(BT.drawSnap(bar, 2012.3, Y, 1), 2010);        // 4.6 px from the open
  assert.equal(BT.drawSnap(bar, 2025, Y, 1, 8), 2025);       // 10 px from the high and the close: outside 8 px
  assert.equal(BT.drawSnap(bar, 2025, Y, 1), 2030);          // within the default 12 px; a tie goes to the first in O, H, L, C
  assert.equal(BT.drawSnap(bar, 2026, Y, 2), 2030);
  assert.equal(BT.drawSnap(bar, 1950, Y, 2), 2001);          // strong: the low, however far
  assert.equal(BT.drawSnap(bar, 1950, Y, 1), 1950);
  assert.equal(BT.drawSnap(null, 2012.3, Y, 2), 2012.3, 'no candle under the point (past the replay): no snap');
  assert.equal(BT.drawSnap(bar, 2012.3, () => null, 2), 2012.3);
});

test('geometry and hit testing: handles first, then the body; boxes have corners and edge midpoints', () => {
  const r = { type: 'r', t1: T0, p1: 2050, t2: T0 + 10 * SEC, p2: 2000 }, g = BT.drawGeom(r, X, Y, W, H);
  assert.deepEqual([g.x1, g.y1, g.x2, g.y2], [0, 300, 100, 400]);
  assert.equal(g.pts.length, 8);
  assert.equal(BT.drawHit(g, 1, 299), 'c11'); assert.equal(BT.drawHit(g, 99, 402), 'c22'); assert.equal(BT.drawHit(g, 2, 398), 'c12'); assert.equal(BT.drawHit(g, 101, 301), 'c21');
  assert.equal(BT.drawHit(g, 50, 301), 'ep1'); assert.equal(BT.drawHit(g, 50, 399), 'ep2'); assert.equal(BT.drawHit(g, 1, 350), 'et1'); assert.equal(BT.drawHit(g, 99, 350), 'et2');
  assert.equal(BT.drawHit(g, 30, 340), 'body'); assert.equal(BT.drawHit(g, 130, 340), null);
  const t = { type: 't', t1: T0, p1: 2000, t2: T0 + 20 * SEC, p2: 2050 }, gt = BT.drawGeom(t, X, Y, W, H);
  assert.equal(BT.drawHit(gt, 0, 400), 'a'); assert.equal(BT.drawHit(gt, 200, 300), 'b'); assert.equal(BT.drawHit(gt, 100, 350), 'body'); assert.equal(BT.drawHit(gt, 100, 330), null);
  assert.equal(BT.drawHit(gt, 300, 250), null, 'not extended: nothing past the second point');
  const ge = BT.drawGeom({ ...t, ext: true }, X, Y, W, H); assert.equal(ge.xe, W); assert.equal(ge.ye, 400 - W / 2);
  assert.equal(BT.drawHit(ge, 300, 250), 'body', 'extended to the right: the extension is part of the line');
  const hr = BT.drawGeom({ type: 'hr', t1: T0 + 5 * SEC, p1: 2010 }, X, Y, W, H); assert.equal(BT.drawHit(hr, 700, 381), 'body'); assert.equal(BT.drawHit(hr, 20, 380), null, 'a ray starts at its point');
  const v = BT.drawGeom({ type: 'v', t1: T0 + 30 * SEC }, X, Y, W, H); assert.equal(BT.drawHit(v, 302, 20), 'body'); assert.equal(BT.drawHit(v, 320, 20), null);
  const h = BT.drawGeom({ type: 'h', price: 2025 }, X, Y, W, H); assert.equal(BT.drawHit(h, 790, 352), 'body');
  assert.equal(BT.drawGeom({ type: 't', t1: T0, p1: 2000, t2: T0 + SEC, p2: 2001 }, X, () => null, W, H), null);
  // a larger tolerance for touch
  assert.equal(BT.drawHit(gt, 15, 400), null); assert.equal(BT.drawHit(gt, 15, 400, 14, 22), 'a');
});

test('resize: ends, corners (both coordinates), edges (one), a vertical line by time, a horizontal line by price', () => {
  const r = { type: 'r', t1: 1, p1: 10, t2: 5, p2: 20, at: 7, col: 'up' };
  assert.deepEqual(BT.drawResize(r, 'c11', 2, 11), { ...r, t1: 2, p1: 11 });
  assert.deepEqual(BT.drawResize(r, 'c22', 6, 21), { ...r, t2: 6, p2: 21 });
  assert.deepEqual(BT.drawResize(r, 'c12', 0, 25), { ...r, t1: 0, p2: 25 });
  assert.deepEqual(BT.drawResize(r, 'c21', 9, 5), { ...r, t2: 9, p1: 5 });
  assert.deepEqual(BT.drawResize(r, 'ep1', 99, 12), { ...r, p1: 12 });
  assert.deepEqual(BT.drawResize(r, 'et2', 8, 99), { ...r, t2: 8 });
  const t = { type: 't', t1: 1, p1: 10, t2: 5, p2: 20, at: 3 };
  assert.deepEqual(BT.drawResize(t, 'a', 0, 9), { ...t, t1: 0, p1: 9 }); assert.deepEqual(BT.drawResize(t, 'b', 6, 22), { ...t, t2: 6, p2: 22 });
  assert.deepEqual(BT.drawResize({ type: 'v', t1: 4 }, 'body', 8, 1), { type: 'v', t1: 8 });
  assert.deepEqual(BT.drawResize({ type: 'h', price: 4 }, 'a', 8, 1), { type: 'h', price: 1 });
  assert.equal(BT.drawResize(r, 'c11', 2, 11).at, 7, 'a resize keeps the moment it was drawn');
  assert.deepEqual(BT.drawResize(r, 'c11', NaN, null), r, 'a missing point changes nothing');
});

test('move: every time and price through the mappers, style and stamp kept', () => {
  const t = { type: 't', t1: 100, p1: 10, t2: 200, p2: 20, at: 50, w: 2, ls: 'dash' }, m = BT.drawMove(t, (x) => x + 900, (p) => p + 1.5);
  assert.deepEqual(m, { ...t, t1: 1000, t2: 1100, p1: 11.5, p2: 21.5 });
  assert.deepEqual(BT.drawMove({ type: 'h', price: 5, at: 1 }, (x) => x + 1, (p) => p * 2), { type: 'h', price: 10, at: 1 });
  assert.deepEqual(BT.drawMove({ type: 'v', t1: 5 }, (x) => x + 1, (p) => p * 2), { type: 'v', t1: 6 });
  assert.deepEqual(t, { type: 't', t1: 100, p1: 10, t2: 200, p2: 20, at: 50, w: 2, ls: 'dash' }, 'the original is not changed');
});

test('label: price change, %, bars (with weekend gaps) and the angle', () => {
  const bars = [0, 1, 2, 3, 10, 11, 12].map((i) => ({ time: T0 + i * SEC }));
  assert.equal(BT.barsBetween(bars, 7, SEC, T0, T0 + 12 * SEC), 6, 'a gap counts as no bars');
  assert.equal(BT.barsBetween(bars, 7, SEC, T0 + 12 * SEC, T0), 6);
  assert.equal(BT.barsBetween(bars, 7, SEC, T0 + 3 * SEC, T0 + 15 * SEC), 6, 'past the last candle: one a step');
  assert.equal(BT.barsBetween(bars, 0, SEC, T0, T0 + SEC), 0);
  assert.equal(BT.drawInfo({ type: 'r', p1: 2000, p2: 2010 }, 4, null), '+10.00 (+0.50%) · 4 bars');
  assert.equal(BT.drawInfo({ type: 't', p1: 2000, p2: 1990 }, 1, 44.6), '−10.00 (−0.50%) · 1 bar · 45°');
  assert.equal(BT.drawInfo({ type: 'h', price: 1 }, 1, 0), '');
});

test('stored shapes: old sessions and the Mosha hand-over load unchanged; new fields are checked; junk is dropped', () => {
  const old = [{ type: 'h', price: 2010.5, at: 1767571200 }, { type: 't', t1: 1, p1: 2, t2: 3, p2: 4, at: 9 }, { type: 'r', t1: 1, p1: 2, t2: 3, p2: 4 }];
  assert.deepEqual(BT.drawNorm(old), old, 'pre-17 Nov drawings and hand-over shapes (no at) are kept as they are');
  const nw = [{ type: 'hr', t1: 5, p1: 6, at: 1, editedAt: 2, col: 'dn', w: 3, ls: 'dash', lock: true }, { type: 'v', t1: 5, at: 1 }, { type: 't', t1: 1, p1: 2, t2: 3, p2: 4, ext: true, lbl: true }];
  assert.deepEqual(BT.drawNorm(nw), nw);
  assert.deepEqual(BT.drawNorm([{ type: 'r', t1: 1, p1: 2, t2: 3, p2: 4, col: 'draw', w: 1, ext: true, ls: 'dotted', lock: 'yes', junk: 1 }]), [{ type: 'r', t1: 1, p1: 2, t2: 3, p2: 4 }]);
  assert.deepEqual(BT.drawNorm([null, { type: 'x', price: 1 }, { type: 'h' }, { type: 't', t1: 1, p1: 'a', t2: 3, p2: 4 }, { type: 'hr', t1: 1, p1: Infinity }]), []);
  assert.deepEqual(BT.drawNorm(undefined), []);
  // a session saved as JSON round-trips
  assert.deepEqual(BT.drawNorm(JSON.parse(JSON.stringify(nw))), nw);
});

test('trade coach: a horizontal ray is a level; a vertical line is not; it reads at, never editedAt', () => {
  const o = { side: 'buy', entry: 2000, stop: 1990, target: 2020 };
  const a = BT.coachDraw([{ type: 'hr', t1: 1, p1: 1999, at: 10 }, { type: 'v', t1: 5, at: 10 }], 100, o, 10);
  assert.equal(a.n, 1, 'the vertical line is not counted'); assert.equal(a.near.price, 1999); assert.equal(a.atLevel, true);
  assert.equal(BT.coachDraw([{ type: 'hr', t1: 1, p1: 1999, at: 150 }], 100, o, 10), null, 'drawn after the moment: not read');
  assert.equal(BT.coachDraw([{ type: 'hr', t1: 1, p1: 1999, at: 10, editedAt: 150 }], 100, o, 10).n, 1, 'an edit keeps its first moment');
});

test('page: tools, keys, magnet, the floating bar and the strip are wired; no drawing code touches an order or a stop', () => {
  for (const k of ['t', 'h', 'hr', 'v', 'r']) { assert.match(page, new RegExp(`id="drawdd"[\\s\\S]*?data-dt="${k}"`)); assert.match(page, new RegExp(`id="dstrip"[\\s\\S]*?data-dt="${k}"`)); }
  assert.match(page, /\{ KeyT: 't', KeyH: 'h', KeyJ: 'hr', KeyV: 'v', KeyR: 'r' \}\[e\.code\]/);
  assert.match(page, /e\.code === 'KeyM'\) \{ e\.preventDefault\(\); setMag\(MAG \+ 1\)/);
  for (const k of ['T', 'H', 'J', 'V', 'R', 'M']) assert.match(page, new RegExp(`<kbd>Alt</kbd>\\+<kbd>${k}</kbd>`), 'Help lists Alt+' + k);
  assert.match(page, /localStorage\.setItem\('btLab:magnet'/);
  assert.match(page, /draw: BT\.drawNorm\(s\.draw\)/, 'a resumed session goes through the one check');
  assert.match(page, /id="dsel" role="toolbar"/);
  for (const a of ['col', 'w', 'ls', 'ext', 'lbl', 'lock', 'clone', 'del']) assert.match(page, new RegExp(`data-ds="${a}"`));
  // an edit stamps editedAt and never at (only a new shape or a clone gets at)
  const blk = page.slice(page.indexOf('// ---- drawing tools like TradingView'), page.indexOf('window.ctBarAt'));
  assert.ok(blk.length > 4000);
  assert.deepEqual((blk.match(/\.at = mom\(\)/g) || []).length, 2);
  assert.match(blk, /S\.draw\[e\.k\]\.editedAt = mom\(\)/);
  // the drawing layer reads the account nowhere and calls no order function
  assert.ok(!/\b(place|instant|startDraft|closePartial|BT\.close|BT\.place|fixPos|fixOrd)\(/.test(blk), 'no order call');
  assert.ok(!/\.stop\s*=[^=]/.test(blk) && !/S\.acct/.test(blk), 'no stop move, no account access');
  // the CSS for the new parts sits outside the simple phone view's block, and its text is 12 px or more
  const css = page.slice(page.indexOf('/* Drawing tools like TradingView'), page.indexOf('/* Simple phone view (11 Nov 2026, owner'));
  assert.ok(css.length > 500 && !/data-phone/.test(css));
  for (const m of css.matchAll(/font:\s*\d+\s+(\d+)px/g)) assert.ok(+m[1] >= 12, m[0]);
  assert.match(css, /@media \(pointer: coarse\) \{ \.dstrip button, \.dsel button \{ width: 44px; height: 44px; \}/);
});
