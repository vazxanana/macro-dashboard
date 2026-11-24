// tests/edge-desks-2.test.mjs - the seven desks of the passing edges (council/edge-desks-2.mjs): each adapter gives its study's
// own trades (same fill, stop and R as the study's own functions on the same candles), every record has its stop on the losing
// side, no look-ahead (the candles cut at a date give the same trades up to it), and the page / loop wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D2 from '../council/edge-desks-2.mjs';
import { DESKS, ELEVEN } from '../council/edge-desks.mjs';
import { clean, merge } from '../council/mosha-desk.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { COSTS } from '../research/edge/combo-grid-2/run.mjs';
import { startIdx, manage, atr14 } from '../research/edge/dom-trade-through/run.mjs';
import * as FADE from '../research/edge/grid7-wide-fade/run.mjs';
import * as BIG from '../research/edge/big-candle-fade/run.mjs';
import * as RND from '../research/edge/round-number-breaks/run.mjs';
import * as BOX from '../research/edge/grid6-box-in-box/run.mjs';
import { CELLS as FB } from '../research/edge/fade-breaks-holdout/run.mjs';
import * as FVG from '../research/edge/grid7-fvg-wide/run.mjs';
import * as GO from '../research/edge/gold-vol-breakout-hourcost/original.mjs';

const T0 = Date.UTC(2025, 2, 3) / 1000;   // a Monday; the studies' windows end 1 Nov 2026
function market(seed = 7, days = 28, p0 = 2000, vol = 0.9) {
  let a = seed >>> 0; const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = []; let p = p0, drift = 0;
  for (let t = T0; t < T0 + days * 86400; t += 300) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    if (rnd() < 0.01) drift = (rnd() - 0.5) * vol * 0.6;
    const o = p, big = rnd() < 0.004 ? 8 : 1, c = o + drift + (rnd() - 0.5) * 2 * vol * big, h = Math.max(o, c) + rnd() * vol * 0.7, l = Math.min(o, c) - rnd() * vol * 0.7;
    out.push({ time: t, open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2) }); p = c; }
  return out;
}
const M = market(), B = { '5m': M }, K5 = D2.toK(M), F = frames(K5), cost = COSTS.xau, FROM = T0 + 5 * 86400;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const byId = (L) => new Map(L.map((r) => [r.id, r]));

test('the adapters read the studies\' own cells', () => {
  assert.deepEqual(D2.FADE_CELL, { tf: 1, cx: 0, st: 1, rr: 2 }); assert.equal(FADE.TFS[1], '15m'); assert.equal(FADE.CTXS[0], 'none'); assert.equal(FADE.STOPS[1], 'atr');
  assert.equal(BIG.TFS[D2.BIG_CELL.tf], '15m'); assert.equal(BIG.KS[D2.BIG_CELL.k], 1.5);
  assert.deepEqual(FB.F1, { ch: 2, trig: 0, sess: 2, ei: 0, si: 0, x: 0 });
  const med = D2.fvgMedians(); assert.equal(Object.keys(med).length, 10); assert.ok(med.xau['1h'] > 0);
  assert.deepEqual(Object.keys(D2.DESKS2), ['fade', 'bigfade', 'roundfade', 'boxfade', 'fvg', 'goldvb', 'jpyvb', 'lyriac', 'dom']);
  for (const k of ['fade', 'bigfade', 'roundfade', 'boxfade', 'fvg']) assert.deepEqual(D2.DESKS2[k].markets, FADE.MARKETS);
  assert.deepEqual(D2.DESKS2.goldvb.markets, ['xau']); assert.deepEqual(D2.DESKS2.jpyvb.markets, ['usdjpy']);
  for (const k of Object.keys(D2.DESKS2)) assert.equal(DESKS[k], D2.DESKS2[k]);
  assert.equal(DESKS.lit.markets, ELEVEN); assert.equal(DESKS.msnr.markets, ELEVEN); assert.equal(ELEVEN.length, 11);
});

test('fade: the study\'s signals, fill, stop and 2R result', () => {
  const R = D2.fadeTrades(B, { from: FROM, market: 'xau' }), got = byId(R); let cmp = 0, n = 0;
  for (const g of FADE.signals(F)) { if (g.tf !== 1 || g.cx !== 0) continue; const fi = startIdx(K5, g.ts); if (fi >= K5.length || K5[fi].t < FROM) continue;
    const fill = K5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop); if (!(risk > 0) || risk < cost) continue; n++;
    const r = [...got.values()].find((x) => x.t === K5[fi].t && x.side === s); assert.ok(r, 'a study trade is missing'); assert.ok(near(r.entry, fill) && near(r.stop, stop));
    const x = FADE.exits(K5, s, fi, stop, [fill + s * risk, fill + 2 * s * risk, NaN], FADE.CAP['15m']);
    if (x && Number.isFinite(x.R[1])) { assert.ok(near(r.R, x.R[1]), `R ${r.R} vs ${x.R[1]}`); cmp++; } }
  assert.equal(R.length, n); assert.ok(cmp > 10, 'too few compared: ' + cmp);
});

test('big-candle fade: the study\'s trade() and its "half" exit', () => {
  const R = D2.bigTrades(B, { from: FROM, market: 'xau' }); let n = 0, cmp = 0;
  for (const g of BIG.signals(F).big) { if (g.tf !== 0 || g.brk || g.kmax < 0) continue; const fi = startIdx(K5, g.ts); if (fi >= K5.length || K5[fi].t < FROM) continue;
    const x = BIG.trade(K5, g, cost); if (!x || (x.skip && x.skip !== 'open')) continue;
    const fill = K5[fi].o, s = -g.d, stop = g.ext + g.d * 0.1 * g.a; if (!((s * (g.mid - fill)) / (s * (fill - stop)) >= 1)) continue; n++;
    const r = R.find((y) => y.t === K5[fi].t && y.side === s); assert.ok(r); assert.ok(near(r.entry, fill) && near(r.stop, stop) && near(r.target, g.mid));
    if (!x.skip) { assert.ok(near(r.R, x.R[2]), `R ${r.R} vs ${x.R[2]}`); cmp++; } }
  assert.equal(R.length, n); assert.ok(cmp > 0);
});

test('round-number fade: the study\'s simEvent, outside 07-17 UTC, 2R', () => {
  const R = D2.roundTrades(B, { from: FROM, market: 'xau' }), T = F['15m'], atr = atr14(T); let n = 0, cmp = 0;
  for (const ev of RND.events(T, atr, { off: 0, S: 10, ratio: 5 })) { if (ev.type !== 'cross') continue; const fi = startIdx(K5, ev.ts); if (fi >= K5.length || K5[fi].t < FROM || FADE.sessionOf(K5[fi].t) !== 2) continue;
    const fill = K5[fi].o, s = -ev.d, stop = ev.ext + ev.d * 0.1 * ev.a, risk = s * (fill - stop); if (!(risk > 0) || risk < cost) continue; n++;
    const r = R.find((y) => y.t === K5[fi].t && y.side === s); assert.ok(r); assert.ok(near(r.stop, stop));
    const x = RND.simEvent(K5, ev, 1, cost, []); if (x && x.R) { assert.ok(near(r.R, x.R[1])); cmp++; } }
  assert.equal(R.length, n); assert.ok(n > 0);
});

test('box fade: F1, the placebo of the box-in-box cell, the study\'s trade()', () => {
  const R = D2.boxTrades(B, { from: FROM, market: 'xau' }); let n = 0;
  for (const sg of BOX.signals(F, { from: FROM, to: Infinity })) { if (sg.ch !== 2 || sg.trig !== 0 || sg.sess !== 2) continue;
    const d = sg.d, stop = d > 0 ? sg.box.lo - cost / 2 : sg.box.hi + cost / 2; if (!(d * (sg.c0 - stop) >= 2 * cost)) continue;
    let oppR = (d * ((d > 0 ? sg.top.hi : sg.top.lo) - sg.c0)) / (d * (sg.c0 - stop)); if (!(oppR >= 1)) oppR = 2;
    const s = -d, sp = 2 * sg.c0 - stop, fi = startIdx(K5, sg.ts); if (fi >= K5.length || K5[fi].t < FROM) continue;
    const x = BOX.trade(K5, s, 'mkt', null, sp, sg.ts, sg.ts + BOX.LIFE * 300, oppR, cost, BOX.CAPS[2]);
    const r = R.find((y) => y.t === K5[fi].t && y.side === s && near(y.stop, sp));
    if (x) { n++; assert.ok(r, 'a study trade is missing'); assert.ok(near(r.R, x.R[0]), `R ${r.R} vs ${x.R[0]}`); } }
  assert.ok(n > 0, 'no box signal on the test market');
});

test('FVG return: the study\'s signals and manage(), 1R', () => {
  const R = D2.fvgTrades(B, { from: FROM, market: 'xau' }), med = D2.fvgMedians().xau; let n = 0, cmp = 0;
  for (const sg of FVG.signals(K5, 'xau', med).sigs) { if (sg.ctl || sg.g !== 1 || sg.kind !== 0 || !sg.large || K5[sg.fi].t < FROM) continue;
    const risk = sg.s * (sg.fill - sg.stop); if (!(risk > 0) || risk < cost) continue; n++;
    const r = R.find((y) => y.t === K5[sg.fi].t && y.side === sg.s && near(y.stop, sg.stop)); assert.ok(r);
    const x = manage(K5, sg.s, sg.fi, sg.fill, sg.stop, FVG.CAP['1h'], sg.firstFull); if (x) { assert.ok(near(r.R, x.R[0])); cmp++; } }
  assert.equal(R.length, n); assert.ok(cmp > 0);
});

test('gold breakout: the study\'s buildDays / vbTrade, day by day', () => {
  const R = D2.goldTrades(B, { from: FROM, market: 'xau' }), rows = M.map((b) => [b.time, b.open, b.high, b.low, b.close]), last = M[M.length - 1].time;
  const days = GO.buildDays(rows).filter((d) => d.d0 + 86400 > FROM && d.d0 + GO.EXIT_S <= last && !GO.daySkip(d)); let n = 0;
  for (const d of days) { const x = GO.vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip || x.fillT < FROM) continue; n++;
    const r = R.find((y) => y.t === x.fillT); assert.ok(r); assert.equal(r.side, x.side); assert.ok(near(r.entry, x.entry) && near(r.stop, x.stop) && near(r.R, x.R)); assert.equal(r.target, null);
    assert.ok(r.endT >= r.t && r.endT < d.d0 + GO.EXIT_S); }
  assert.ok(n > 5); assert.equal(D2.jpyTrades(B, { from: FROM, market: 'xau' }).length, 0);
});

test('every record: its stop on the losing side, stored by clean(), each id once', () => {
  for (const [k, d] of Object.entries(D2.DESKS2)) { const L = d.read(B, { from: FROM, market: d.markets[0] === 'usdjpy' ? 'usdjpy' : 'xau' }); if (k !== 'jpyvb') assert.ok(L.length > 0, k + ': no trade on the test market');
    const ids = new Set();
    for (const r of L) { assert.ok(r.side > 0 ? r.stop < r.entry : r.stop > r.entry, `${k}: stop on the wrong side`); assert.ok(!ids.has(r.id), `${k}: id twice`); ids.add(r.id);
      const c = clean(r); assert.ok(c, `${k}: clean() refused a record`); assert.equal(c.kind, r.kind); assert.equal(c.id, r.id);
      if (r.R != null) assert.ok(Number.isFinite(r.R) && r.endT >= r.t); } }
  assert.equal(clean({ id: 'x', kind: 'fade-m15', side: 1, entry: 100, stop: 101 }), null);
});

test('no look-ahead: candles cut at a date give the same trades up to a day before it', () => {
  for (const cut of [T0 + 12.4 * 86400, T0 + 19.7 * 86400]) {
    const Bc = { '5m': M.filter((b) => b.time + 300 <= cut) };
    for (const [k, d] of Object.entries(D2.DESKS2)) { if (k === 'jpyvb') continue;
      const key = (r) => [r.id, r.side, r.entry, r.stop, r.target].join('|');
      const A = new Set(d.read(B, { from: FROM, market: 'xau' }).filter((r) => r.t <= cut - 86400).map(key));
      const C = new Set(d.read(Bc, { from: FROM, market: 'xau' }).filter((r) => r.t <= cut - 86400).map(key));
      assert.deepEqual([...C].sort(), [...A].sort(), `${k} differs at the cut`); } }
});

test('merge keeps two passing-edge trades near in time (not one re-read)', () => {
  const a = { id: 'fade-m15-b1', kind: 'fade-m15', side: 1, t: 1000, entry: 100, stop: 99, target: 102, status: 'open' };
  const b = { ...a, id: 'fade-m15-b1300', t: 1300 };
  const one = merge([], [a], 2000), two = merge(one, [a, b], 2600);
  assert.equal(two.length, 2);
});

test("DOM zone: the demo job's own zones, plan and arming rule", async () => {
  const J = await import('../council/dom-demo.mjs');
  for (const k of ['RR', 'ATR_K', 'NEAR_ATR', 'LIFE_S', 'MAX_MARKET']) assert.equal(D2.DOM[k], J[k], k);
  assert.deepEqual(D2.DOM_MARKETS, Object.keys(J.MARKETS));
  const R = D2.domTrades(B, { from: FROM, market: 'xau' }); assert.ok(R.length > 3, 'no DOM trade on the test market: ' + R.length);
  const rows = M.map((b) => [b.time, b.open, b.high, b.low, b.close]);
  for (const r of R) {
    // the zone and the order the job itself would give: read() on the H1 candles closed by the order's time, plan(), armable()
    const placed = r.log[1].t, H1 = [];
    for (const b of M) { const h = Math.floor(b.time / 3600) * 3600; if (h + 3600 > placed) break; const x = H1[H1.length - 1];
      if (!x || x[0] !== h) H1.push([h, b.open, b.high, b.low, b.close]); else { x[2] = Math.max(x[2], b.high); x[3] = Math.min(x[3], b.low); x[4] = b.close; } }
    const at = J.read(H1, placed), z = at.zones.find((q) => r.id.endsWith(`dom-${q.side === 'buy' ? 'b' : 's'}${q.t}`)); assert.ok(z, 'the job has no such zone');
    const p = J.plan(z, at.atr, COSTS.xau); assert.ok(near(p.entry, r.entry) && near(p.stop, r.stop) && near(p.target, r.target), 'plan differs');
    assert.ok(z.stands); const price = M.find((b) => b.time + 300 === placed).close;
    assert.equal(J.armable('xau', { ...at, price }, new Set()).some((q) => q.t === z.t && q.side === z.side), true, 'the job would not arm it then');
    assert.ok(r.side > 0 ? r.stop < r.entry : r.stop > r.entry); assert.ok(r.t >= placed); }
  // one order per zone, ever
  assert.equal(new Set(R.map((r) => r.id)).size, R.length);
});

test('Equinox: its own page with the eight desks; the Desk keeps its five', () => {
  const src = fs.readFileSync(new URL('../equinox.html', import.meta.url), 'utf8'), keys = Object.keys(D2.DESKS2);
  assert.deepEqual(keys, ['fade', 'bigfade', 'roundfade', 'boxfade', 'fvg', 'goldvb', 'jpyvb', 'lyriac', 'dom']);
  for (const k of keys) { const i = src.indexOf(`id="v-${k}"`); assert.ok(i > 0, k); const sec = src.slice(i, src.indexOf('</section>', i));
    for (const dk of ['open', 'trades', 'chart']) assert.ok(sec.includes(`data-dk="${dk}"`), `${k}: ${dk}`); assert.ok(src.includes(`"k":"${k}"`) || src.includes(`"k": "${k}"`), k + ' tab'); }
  for (const a of ['mosha-sop.js', 'mosha-replay.js', 'desk-trades.js', 'desk-live.js', 'mx-nav.js', 'lightweight-charts-4.1.3.js']) assert.ok(src.includes(a), a);
  assert.match(src, /Sign in on the desk first/); assert.match(src, /localStorage\.setItem\('eq-desk'/);
  // the build copies the Desk's data reader, Mosha styles and replay card into it
  const built = fs.readFileSync(new URL('../out/equinox.html', import.meta.url), 'utf8');
  assert.ok(built.includes('id="mo-replay"') && built.includes('id="ms-mosha-css"') && built.includes('window.msDataMake = function'));
  assert.match(fs.readFileSync(new URL('../scripts/build.sh', import.meta.url), 'utf8'), /node scripts\/equinox-page\.mjs out/);
  const vj = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vj.rewrites.some((r) => r.source === '/equinox' && r.destination === '/equinox.html'));
  // the Desk: no new desk view or switch tab, one Equinox link gated on the desks permission
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  for (const k of keys) { assert.ok(!html.includes(`id="v-${k}"`), k + ' on the Desk'); assert.ok(!html.includes(`data-dsw="${k}"`)); }
  assert.match(html, /<a href="\/equinox" class="hdr-eq adm"/); assert.match(html, /html\[data-deny~="desks"\] \.hdr-eq \{ display: none !important; \}/);
  for (const f of ['edge-lab.html', 'macro-desk.html', 'backtest.html', 'academy.html', 'scripts/veteran-library.html']) {
    const t = fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8'); assert.match(t, /<a href="\/equinox" class="hdr-eq" data-mx-desks hidden/, f); assert.ok(t.includes('mx-nav.js'), f); }
  assert.match(fs.readFileSync(new URL('../assets/mx-nav.js', import.meta.url), 'utf8'), /\[data-mx-desks\]/);
  const dt = fs.readFileSync(new URL('../assets/desk-trades.js', import.meta.url), 'utf8'), dl = fs.readFileSync(new URL('../assets/desk-live.js', import.meta.url), 'utf8');
  for (const k of keys) { assert.ok(dt.includes(`${k}: { file: '${k}/desk.json'`), k); assert.ok(dl.includes(`${k}: { passing: true, file: '${k}/desk.json'`), k); }
  assert.equal((dt.match(/passing: true/g) || []).length, 9); assert.doesNotMatch(dt, /#v-lit, #v-eg, #v-msnr/);
  assert.match(dt, /dom-tick-exec: -0\.111R a filled trade, n 1,706, month t -3\.73/);
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(yml, /node council\/edge-desks\.mjs data --only eg,msnr,lit/);
  assert.match(yml, /timeout 150 node council\/edge-desks\.mjs data --only fade,bigfade,roundfade,boxfade,fvg,goldvb,jpyvb,lyriac,dom/);
  const src2 = fs.readFileSync(new URL('../council/edge-desks-2.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src2, /from '\.\/(ctrader|dom-demo|gotobi|trader)|placeOrder|NEW_ORDER/);
});
