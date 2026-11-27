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
