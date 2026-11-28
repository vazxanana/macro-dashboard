// The indicator legend on the Desk's charts (27 Nov 2026): one row a study under O H L C, values at the legend's candle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const lift = () => {
  const i = html.indexOf('window.msIndLegend = function'), j = html.indexOf('\n  };', i);
  const w = {}; new Function('window', html.slice(i, j + 4))(w); return w.msIndLegend;
};

test('a row a study: its name, its values at the candle, a dash before it has a value', () => {
  const f = lift(), fmt = (v) => v.toFixed(2);
  const rows = [{ name: 'SMA 3', osc: false, vals: [{ v: [null, null, 2, 3], color: '#2962ff' }] },
    { name: 'RSI 14', osc: true, vals: [{ v: [null, 55.123, 60.5, 70], color: 'rgba(1,2,3,0.5)' }, { v: [1, 2, 3, 4], color: null }] }];
  const at1 = f(rows, 1, 4, fmt);
  assert.match(at1, /SMA 3<\/span><b style="color:#2962ff">—<\/b>/);
  assert.match(at1, /RSI 14<\/span><b style="color:rgba\(1,2,3,0.5\)">55.12<\/b><b>2.00<\/b>/);
  assert.match(f(rows, 3, 4, fmt), /<b style="color:#2962ff">3.00<\/b>/);
  // a series of another length (another chart's bars) never shows a value from the wrong candle
  assert.match(f(rows, 3, 5, fmt), /—/);
});

test('names are escaped, a colour that is not a plain colour is dropped, at most eight rows', () => {
  const f = lift();
  const out = f([{ name: '<img src=x>', osc: true, vals: [{ v: [1], color: 'red;background:url(x)' }] }], 0, 1, null);
  assert.ok(!out.includes('<img')); assert.ok(!out.includes('url(')); assert.match(out, /&lt;img/);
  const many = Array.from({ length: 12 }, (_, k) => ({ name: 'S' + k, osc: true, vals: [] }));
  assert.equal((f(many, 0, 1, null).match(/ind-r/g) || []).length, 8);
});

test('wired: indDraw records the rows, the pane legend appends them, not during a replay', () => {
  assert.match(html, /out\.leg = \[\]; if \(!B \|\| B\.length < 30\) return;/);
  assert.match(html, /out\.leg\.push\(\{ name:/);
  assert.match(html, /const IL = P\._ind && P\._ind\.leg; if \(IL && IL\.length && !P\.rp\) hx \+= window\.msIndLegend\(IL, i, B\.length, fmt\);/);
  assert.match(html, /\.ch-lg \.ind-r \{ flex-basis: 100%/);
});

test('a guide line with one value everywhere (RSI 70 / 30) is left out of the legend', () => {
  const i = html.indexOf('const flatLine = '), j = html.indexOf('\n', i);
  const flatLine = new Function(html.slice(i, j) + '; return flatLine;')();
  assert.equal(flatLine([null, 70, 70, 70]), true);
  assert.equal(flatLine([null, 70, 71]), false);
  assert.match(html, /!flatLine\(o\.v\)\)\.slice\(0, 4\)/);
});

// the free charts' legend (28 Nov 2026): the single chart, Split's right chart and Markets side by side
test('free legend: O H L C, change against the previous close, newest candle away from the crosshair, indicator rows', () => {
  const i = html.indexOf('window.msFreeLegend = function'), j = html.indexOf('\n  };', i); assert.ok(i > 0);
  const raf = []; const w = { msIndLegend: lift() };
  const LG_FT = { format: () => '28 Nov, 10:00' }, LG_FD = LG_FT;
  const mk = new Function('window', 'LG_FT', 'LG_FD', 'FREE_LG', 'requestAnimationFrame', 'document', html.slice(i, j + 4) + '\n return window.msFreeLegend;');
  const el = { kids: [], appendChild(c) { this.kids.push(c); }, offsetParent: {} };
  const doc = { createElement: () => ({ setAttribute() {}, innerHTML: '' }) };
  let cb; const chart = { subscribeCrosshairMove: (f) => { cb = f; } };
  const bars = [{ time: 1, open: 10, high: 12, low: 9, close: 11 }, { time: 2, open: 11, high: 13, low: 10, close: 12.5 }];
  const L = mk(w, LG_FT, LG_FD, [], (f) => raf.push(f), doc)({ el, chart, bars: () => bars, fmt: (v) => v.toFixed(2), sec: () => 3600, TZ: 0,
    ind: () => [{ name: 'SMA 2', osc: false, vals: [{ v: [null, 11.75], color: '#2962ff' }] }] });
  L.refresh(); raf.shift()();
  const h = L.html();
  assert.match(h, /O<\/span><b class="up">11.00/); assert.match(h, /C<\/span><b class="up">12.50/);
  assert.match(h, /\+1.50 \(\+13.64%\)/); assert.match(h, /SMA 2<\/span><b style="color:#2962ff">11.75/);
  cb({ logical: 0, point: { x: 5 } }); raf.shift()();
  assert.match(L.html(), /C<\/span><b class="up">11.00/); assert.match(L.html(), /SMA 2<\/span><b[^>]*>—/);
  assert.equal(el.kids.length, 1);
});

test('free legend is wired to the single chart and Markets side by side', () => {
  assert.match(html, /SP\.lg = window\.msFreeLegend\(\{ el, chart: SP\.chart/);
  assert.match(html, /C\.lg = window\.msFreeLegend\(\{ el, chart, bars: \(\) => C\.bars/);
  assert.match(html, /\.mm-chart \{ position: relative; \}/);
});
