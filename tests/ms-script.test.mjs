// Members' own indicators (assets/ms-script.js): the Pine Script and MetaTrader interpreters against reference maths,
// the step budget, errors with their line, and the page wiring. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../assets/ms-script.js');
const SRC = fs.readFileSync(new URL('../assets/ms-script.js', import.meta.url), 'utf8');
const PAGE = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');

let r = 7; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
const B = []; { let c = 100; for (let i = 0; i < 400; i++) { const o = c; c = Math.max(5, c + (rnd() - 0.5) * 2); B.push({ time: 1700000000 + i * 3600, open: o, close: c, high: Math.max(o, c) + rnd(), low: Math.min(o, c) - rnd(), volume: 100 + Math.round(rnd() * 50) }); } }
const C = B.map((b) => b.close), near = (a, b) => a.length === b.length && a.every((v, i) => (v == null && b[i] == null) || (v != null && b[i] != null && Math.abs(v - b[i]) < 1e-9));
const err = (lang, code) => { try { S.run(lang, code, B); return null; } catch (e) { return e; } };

test('Pine: the example runs and its lines are the reference averages', () => {
  const o = S.run('pine', S.EXAMPLES.pine, B);
  assert.equal(o.name, 'My EMA cross'); assert.equal(o.overlay, true); assert.equal(o.plots.length, 4);
  assert.ok(near(o.plots[0].v, S.M.ema(C, 9))); assert.ok(near(o.plots[1].v, S.M.ema(C, 21)));
  assert.equal(o.plots[1].w, 2); assert.ok(o.plots[2].dots && o.plots[3].dots);
  const ups = o.plots[2].v.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0), a = S.M.ema(C, 9), b = S.M.ema(C, 21);
  assert.ok(ups.length > 0); for (const i of ups) assert.ok(a[i] > b[i] && a[i - 1] <= b[i - 1]);
});

test('Pine: variables, history, var, if / else, tuples, functions, colours by bar, levels', () => {
  const o = S.run('pine', ['indicator("x")', 'r = ta.rsi(close, 14)', 'm = ta.sma(close, 20)', 'd = close - close[1]', 'var float cum = 0', 'cum := cum + nz(d)', 'big = 0', 'if r > 70', '    big := 1', 'else if r < 30', '    big := -1', 'else', '    big := 0',
    'plot(r, "RSI", color = r > 50 ? color.green : color.red)', 'plot(m)', 'plot(cum, style=plot.style_histogram)', 'hline(70)', '[a, b, c] = ta.macd(close, 12, 26, 9)', 'plot(c)', 'f(x, n) => ta.sma(x, n) * 2', 'plot(f(close, 5))', 'plot(big)', 'plot(ta.highest(high, 10) - ta.lowest(low, 10))', 'plot(ta.atr(14))'].join('\n'), B);
  const rsi = S.M.rsi(C, 14);
  assert.equal(o.overlay, false);
  assert.ok(near(o.plots[0].v, rsi)); assert.ok(near(o.plots[1].v, S.M.sma(C, 20)));
  assert.ok(Math.abs(o.plots[2].v[399] - (C[399] - C[0])) < 1e-9); assert.equal(o.plots[2].hist, true);
  assert.ok(Array.isArray(o.plots[0].cols)); assert.equal(o.hlines[0].price, 70);
  const f = S.M.ema(C, 12), s = S.M.ema(C, 26), mc = C.map((_, i) => (f[i] == null || s[i] == null ? null : f[i] - s[i])), sg = S.M.ema(mc, 9);
  assert.ok(Math.abs(o.plots[3].v[399] - (mc[399] - sg[399])) < 1e-9);
  assert.ok(near(o.plots[4].v, S.M.sma(C, 5).map((v) => (v == null ? null : v * 2))));
  assert.ok(o.plots[5].v.every((v, i) => rsi[i] == null || v === (rsi[i] > 70 ? 1 : rsi[i] < 30 ? -1 : 0)));
  const hh = S.M.hh(B.map((x) => x.high), 10), ll = S.M.ll(B.map((x) => x.low), 10);
  assert.ok(Math.abs(o.plots[6].v[399] - (hh[399] - ll[399])) < 1e-9);
  assert.ok(Math.abs(o.plots[7].v[399] - S.M.rma(S.M.tr(B), 14)[399]) < 1e-9);
});

test('Pine: a value at bar i never depends on later candles', () => {
  const code = 'indicator("x")\nplot(ta.ema(close, 10) + ta.rsi(close, 7) + ta.stdev(close, 9) + nz(close[3]))';
  const full = S.run('pine', code, B).plots[0].v, cut = S.run('pine', code, B.slice(0, 250)).plots[0].v;
  assert.ok(near(full.slice(0, 250), cut));
});

test('MetaTrader: the example, an MQL4 indicator with start() and an MQL5 one with a handle', () => {
  const o = S.run('mql', S.EXAMPLES.mql, B), rsi = S.M.rsi(C, 14);
  assert.equal(o.name, 'My RSI'); assert.equal(o.overlay, false); assert.equal(o.hlines.length, 2);
  for (const i of [399, 300, 100]) assert.ok(Math.abs(o.plots[0].v[i] - rsi[i]) < 1e-9);
  const m4 = S.run('mql', '#property strict\n#property indicator_chart_window\n#property indicator_buffers 2\n#property indicator_color1 Red\nextern int P=10;\ndouble A[],Bf[];\nint init(){SetIndexBuffer(0,A);SetIndexBuffer(1,Bf);SetIndexStyle(1,DRAW_LINE,STYLE_SOLID,2,clrBlue);return(0);}\nint start(){int counted=IndicatorCounted();int limit=Bars-counted-1;for(int i=limit;i>=0;i--){A[i]=iMA(NULL,0,P,0,MODE_SMA,PRICE_CLOSE,i);double s=0;if(i<=Bars-P){for(int k=0;k<P;k++)s+=Close[i+k];Bf[i]=s/P;}}return(0);}', B), sma = S.M.sma(C, 10);
  assert.equal(m4.dialect, 'MQL4'); assert.equal(m4.overlay, true); assert.equal(m4.plots.length, 2); assert.equal(m4.plots[1].w, 2);
  for (const i of [399, 250, 20]) { assert.ok(Math.abs(m4.plots[0].v[i] - sma[i]) < 1e-9); assert.ok(Math.abs(m4.plots[1].v[i] - sma[i]) < 1e-9); }
  assert.equal(m4.plots[0].v[3], null);
  const m5 = S.run('mql', '#property indicator_separate_window\n#property indicator_buffers 1\n#property indicator_plots 1\ninput int P=14;\ndouble Buf[];\nint h;\nint OnInit(){SetIndexBuffer(0,Buf,INDICATOR_DATA);h=iATR(_Symbol,_Period,P);return(INIT_SUCCEEDED);}\nint OnCalculate(const int rates_total,const int prev_calculated,const datetime &time[],const double &open[],const double &high[],const double &low[],const double &close[],const long &tick_volume[],const long &volume[],const int &spread[]){if(CopyBuffer(h,0,0,rates_total,Buf)<=0)return(0);return(rates_total);}', B), atr = S.M.rma(S.M.tr(B), 14);
  assert.equal(m5.dialect, 'MQL5'); for (const i of [399, 200, 30]) assert.ok(Math.abs(m5.plots[0].v[i] - atr[i]) < 1e-9);
  const own = S.run('mql', '#property indicator_separate_window\ndouble R[];\nint OnInit(){SetIndexBuffer(0,R);return 0;}\ndouble rng(int i){ return High[i]-Low[i]; }\nint OnCalculate(const int n,const int p,const datetime &t[],const double &o[],const double &h[],const double &l[],const double &c[],const long &tv[],const long &v[],const int &s[]){ for(int i=0;i<n;i++){ double x=rng(i); R[i] = x > 1.2 ? x : -x; } return n; }', B);
  for (const i of [399, 0, 77]) { const x = B[i].high - B[i].low; assert.ok(Math.abs(own.plots[0].v[i] - (x > 1.2 ? x : -x)) < 1e-9); }
});

test('errors say what and where; a script cannot hang the page or reach it', () => {
  assert.match(err('pine', 'indicator("a")\nplot(nope)').message, /Unknown name "nope" \(line 2\)/);
  assert.equal(err('pine', 'indicator("a")\nplot(nope)').line, 2);
  assert.match(err('pine', 'indicator("a")\nwhile true\n    x = 1\nplot(close)').message, /too long/);
  assert.match(err('pine', 'indicator("a")\nx = close').message, /draws nothing/);
  assert.match(err('pine', 'indicator("a")\nx = request.security("X", "D", close)\nplot(x)').message, /not supported/);
  assert.match(err('mql', 'int OnCalculate(){ while(true){} return 0; }').message, /too long/);
  assert.match(err('mql', 'double b[]; int OnInit(){SetIndexBuffer(0,b);return 0;} int OnCalculate(const int n,const int p,const int begin,const double &price[]){ b[n+5]=1; return n; }').message, /out of range/);
  assert.match(err('mql', 'double b[];\nint OnCalculate(const int n,const int p,const int g,const double &q[]){ fetch("x"); return n; }').message, /Unknown function "fetch"/);
  assert.match(err('pine', 'indicator("a")\nplot(window)').message, /Unknown name/);
  assert.match(err('pine', '').message, /Write some code/);
  assert.match(err('pine', 'x'.repeat(20001)).message, /too long/);
  assert.ok(!/\beval\s*\(|new Function|Function\s*\(|\bfetch\s*\(|XMLHttpRequest|localStorage|document\.|import\s*\(/.test(SRC), 'the interpreters never eval, fetch or touch the page');
});

test('the language is guessed from the code', () => {
  assert.equal(S.guess(S.EXAMPLES.mql), 'mql'); assert.equal(S.guess(S.EXAMPLES.pine), 'pine');
});

test('page wiring: the editor, the list, the indicator types, and nothing that trades', () => {
  for (const id of ['ms-ind-my', 'ms-sc', 'ms-sc-code', 'ms-sc-run', 'ms-sc-save', 'ms-sc-msg']) assert.ok(PAGE.includes(`id="${id}"`), id);
  assert.ok(PAGE.includes('<script src="/assets/ms-script.js" defer></script>'));
  assert.ok(/custom: \{ name: 'My indicator'/.test(PAGE) && /customosc: \{ name: 'My indicator', p: \{\}, osc: true/.test(PAGE));
  const a = PAGE.indexOf("// Members' own indicators (24 Nov 2026"), b = PAGE.indexOf('window.msInd = {', a);
  assert.ok(a > 0 && b > a);
  const blk = PAGE.slice(a, b);
  assert.ok(!/\.stop\s*=|placeOrder|\/api\/|fetch\(/.test(blk), 'display only');
  assert.ok(/ms-scripts-/.test(blk));
});
