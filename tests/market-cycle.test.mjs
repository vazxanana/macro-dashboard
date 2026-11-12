// Meridian markup: the market cycle (msCycle in market-structure.html). A higher timeframe's move, the lower timeframe's ChoCh
// against it (the pullback starts), the lower timeframe breaking back (the pullback is over), and the targets of each.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = html.slice(html.indexOf('function msCycle'), html.indexOf('function msNextSetup'));
const msCycle = new Function(`${src}; return msCycle;`)();
const H4 = { id: '4h', label: 'H4', dir: -1, ext: 4000, move: { level: 4100, top: 4150, bot: 4100, t: 100 }, events: [] };
const H1 = (events) => ({ id: '1h', label: 'H1', dir: 1, events });

test('H4 move down, H1 agrees: the move runs', () => {
  const [r] = msCycle([H4, H1([{ dir: -1, level: 4120, t: 100, structure: true }])]);
  assert.equal(r.phase, 'move'); assert.deepEqual(r.target, { p50: 4075, origin: 4100, far: 4150, ext: 4000 });
});
test('H1 ChoCh up after the H4 break: the H4 pullback started, targets 50% then the origin', () => {
  const [r] = msCycle([H4, H1([{ dir: -1, level: 4120, t: 100 }, { dir: 1, level: 4030, t: 200, fromT: 150, structure: true }])]);
  assert.equal(r.phase, 'pullback'); assert.equal(r.choch.level, 4030); assert.equal(r.target.p50, 4075);
});
test('H1 breaks back down after its ChoCh: the pullback is over, target the H4 low', () => {
  const [r] = msCycle([H4, H1([{ dir: 1, level: 4030, t: 200, structure: true }, { dir: -1, level: 4010, t: 300, fromT: 250, structure: true }])]);
  assert.equal(r.phase, 'resumed'); assert.equal(r.resume.level, 4010); assert.equal(r.target.ext, 4000);
});
test('a break before the H4 move does not count; every pair down the chain is read', () => {
  const M15 = { id: '15m', label: 'M15', dir: 1, events: [] };
  const out = msCycle([H4, H1([{ dir: 1, level: 4300, t: 50, structure: true }]), M15]);
  assert.equal(out[0].phase, 'move'); assert.equal(out.length, 2); assert.equal(out[1].phase, 'none', 'H1 has no move of its own here');
});
test('wired into the Meridian markup, with its own layer switch, hidden for guests and the other markups', () => {
  assert.match(html, /data-show="cycle" checked/); assert.match(html, /show: \{[^}]*cycle: true/);
  assert.match(html, /id="ms-cycle"/); assert.match(html, /html\[data-role="public"\] #ms-cycle/);
  assert.match(html, /G\.show\.cycle !== false/); assert.match(html, /not a tested rule/);
});

// 12 Nov 2026, owner: "price must close below, if it doesn't close it is not a BO". The forming candle is left out.
const fn = (name) => { const i = html.indexOf(`function ${name}(`); let d = 0; for (let k = html.indexOf('{', i); ; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && !--d) return html.slice(i, k + 1); } };
const msClosedN = new Function(`${fn('msClosedN')}; return msClosedN;`)();
const msAnalyze = new Function(`${fn('msAnalyze')}; return msAnalyze;`)();
test('closed candles only: a forming candle is never counted, whatever the display shift', () => {
  const bars = [0, 3600, 7200].map((time) => ({ time }));
  assert.equal(msClosedN(bars, 3600, 10799), 2, 'the 2h candle closes at 10800');
  assert.equal(msClosedN(bars, 3600, 10800), 3);
  assert.equal(msClosedN(bars.map((b) => ({ time: b.time + 7200 })), 3600, 10799, 7200), 2, 'shifted display times');
  assert.equal(msClosedN([], 3600, 1), 0);
});
test('a body that has not closed through the protected low is not a BO; once it closes below, it is', () => {
  // a rising zigzag (swings every 10 candles), so the engine has an up trend and a protected low
  const B = []; for (let i = 0; i < 120; i++) { const c = 100 + i * 0.6 + 8 * Math.sin(i * Math.PI / 10); B.push({ time: i * 3600, open: c, high: c + 1, low: c - 1, close: c }); }
  const base = msAnalyze(B, 6); assert.equal(base.trend, 1, 'still up'); const prot = base.prot.p;
  const live = { time: 120 * 3600, open: B.at(-1).close, high: B.at(-1).close, low: prot - 10, close: prot - 5 };
  const all = B.concat(live), now = 120 * 3600 + 1800;   // half way through the last candle
  const k = msClosedN(all, 3600, now); assert.equal(k, B.length);
  const A = msAnalyze(all.slice(0, k), 6); assert.equal(A.trend, 1, 'no BO while the candle is forming');
  assert.ok(!A.events.some((e) => e.dir < 0 && e.structure && e.breakIdx === B.length));
  const after = msAnalyze(all.slice(0, msClosedN(all, 3600, 121 * 3600)), 6);
  assert.equal(after.trend, -1, 'the closed candle below the protected low is the BO'); assert.equal(after.last.level, prot);
});
test('every live structure reading on the Desk uses closed candles only', () => {
  assert.match(html, /P\.A = msAnalyze\(k < bars\.length \? bars\.slice\(0, k\) : bars, PIVOT\)/);
  assert.match(html, /k = msClosedN\(bars, tf\.sec, Date\.now\(\) \/ 1000, TZ\)/);
  assert.match(html, /const kc = msClosedN\(B, tf\.sec, Date\.now\(\) \/ 1000, TZ\), A = msAnalyze\(kc < B\.length/, 'split chart');
  assert.match(html, /const kc = msClosedN\(bars, TFS\[k\]\.sec, Date\.now\(\) \/ 1000\);/, 'scanner');
});
test('the cycle line joins the BO line of the same break, and a target already traded through says so', () => {
  assert.match(html, /same = items\.lines\.find\(\(x\) => x\.bo && x\.p === r\.resume\.level\)/);
  assert.match(html, /reached, no close beyond/);
});

// 12 Nov 2026, owner: "a low that failed to break a low becomes the new low"
test('a wick through the protected low with no close below moves the protected low to that wick', () => {
  const B = []; for (let i = 0; i < 120; i++) { const c = 100 + i * 0.6 + 8 * Math.sin(i * Math.PI / 10); B.push({ time: i * 3600, open: c, high: c + 1, low: c - 1, close: c }); }
  const base = msAnalyze(B, 6), prot = base.prot.p, last = B.at(-1).close; assert.equal(base.trend, 1);
  const sweep = { time: 120 * 3600, open: last, high: last + 0.5, low: prot - 4, close: prot + 0.5 };   // wick 4 below, closes above
  const A = msAnalyze(B.concat(sweep), 6);
  assert.equal(A.trend, 1, 'no BO without a close below'); assert.equal(A.prot.p, prot - 4, 'the swept low is the new protected low');
  assert.equal(A.last.bot, prot - 4, 'the Origin edge follows it');
  const between = { time: 121 * 3600, open: prot, high: prot + 0.5, low: prot - 2, close: prot - 1 };   // closes below the OLD low only
  assert.equal(msAnalyze(B.concat(sweep, between), 6).trend, 1, 'a close between the old and the new low is not a BO');
  const below = { time: 122 * 3600, open: prot - 1, high: prot - 0.5, low: prot - 6, close: prot - 5 };
  const C = msAnalyze(B.concat(sweep, between, below), 6);
  assert.equal(C.trend, -1, 'the close below the new low is the BO'); assert.equal(C.last.level, prot - 4);
});
test('chart type: candles, a line of closes, or both, kept per device', () => {
  assert.match(html, /<select id="ms-cs"[^>]*><option value="candles">Candles<\/option><option value="line">Line \(closes\)<\/option><option value="both">Candles \+ line<\/option><\/select>/);
  assert.match(html, /localStorage\.setItem\('ms-cs', G\.cs\)/);
  assert.match(html, /P\.setLine = \(B\) =>/); assert.match(html, /series\.setData\(P\.view\(P\.bars\)\); P\.setLine\(P\.bars\); P\.setStyle\(\);/);
  assert.match(html, /if \(p\.setStyle\) p\.setStyle\(\)/, 'a theme change keeps the chart type');
});

// 12 Nov 2026, owner: "it needs to show more previous data"
test('more history: 1,500 candles at load, older ones on scroll back, a refresh keeps them, every earlier break marked', () => {
  assert.match(html, /const BARS = 1500, PIVOT = 6, CAP = 6000;/);
  const line = html.split('\n').find((l) => l.includes('const mergeBars = '));
  const mergeBars = new Function('CAP', `${line.trim()} return mergeBars;`)(6000);
  const bar = (t) => ({ time: t, close: t });
  assert.deepEqual(mergeBars([1, 2, 3, 4].map(bar), [3, 4, 5].map(bar)).map((b) => b.time), [1, 2, 3, 4, 5], 'old kept, fresh wins from its first candle');
  assert.deepEqual(mergeBars(null, [5].map(bar)).map((b) => b.time), [5]);
  assert.match(html, /P\.raw = r\.src === G\.source \? mergeBars\(P\.raw, r\.bars\) : r\.bars;/);
  assert.match(html, /P\.loadOlder = async function/); assert.match(html, /from=\$\{first - 2000 \* tf\.sec\}&to=\$\{first - 1\}/);
  assert.match(html, /r\.from < 25 && P\.fitted && P\.vis !== false\) P\.loadOlder\(\)/);
  assert.match(html, /data-show="hist" checked/); assert.match(html, /text: e\.structure \? 'ChoCh' : 'BOS'/);
});

// 12 Nov 2026, owner: internal BO lines ("I mean iBO"); after a pullback the first ChoCh back = the continuation starts
test('the first ChoCh back after the pullback is labelled the start of the continuation', () => {
  assert.match(html, /\$\{r\.pl\} continuation starts/); assert.match(html, /the H4 continuation has started/);
});
test('internal breaks: every close beyond a labelled swing, closed candles only, iChoCh flips the internal trend', () => {
  const msInternal = new Function(`${fn('msInternal')}; return msInternal;`)();
  // swing high 10 at 3, swing low 5 at 8, a close above 10 (iBO up), then a swing low 7 at 14 and a close under it (iChoCh down)
  const P = [6, 7, 8, 10, 8, 7, 6, 5.5, 5, 6, 7, 8, 9, 11, 7, 8, 9, 10, 9, 8, 6, 6, 6];
  const B = P.map((c, i) => ({ time: i, open: c, high: c, low: c, close: c }));
  const ev = msInternal(B, B.length, 2);
  assert.deepEqual(ev.map((e) => [e.dir, e.level, e.structure]), [[1, 10, false], [-1, 7, true]]);
  assert.equal(ev[0].fromIdx, 3); assert.equal(ev[0].breakIdx, 13);
  assert.equal(msInternal(B, 20, 2).length, 1, 'a candle past the closed count is never read');
  assert.match(html, /data-show="ibos" checked/); assert.match(html, /show: \{ bo: true, hist: true, ibos: true,/);
  assert.match(html, /text: `iBO \$\{sell \? '▼' : '▲'\}`/); assert.doesNotMatch(html, /'iChoCh'/, 'an internal break is an i.BO, never a ChoCh (Mosha)'); assert.match(html, /!major\.has\(e\.level\)/);
});

// The Mosha layer (12 Nov 2026, owner: "build the mosha layer"): the storyline of the timeframe above read on this one.
const msMosha = new Function(`${fn('msMosha')}; return msMosha;`)();
const bar = (time, high, low) => ({ time, high, low });
const H4S = { dir: -1, level: 4100, t: 100, ext: 3950 };
const path = [bar(110, 4090, 4060), bar(120, 4070, 4000), bar(130, 4040, 4010), bar(140, 4050, 4030), bar(150, 4045, 4020), bar(160, 4035, 4015)];
test('Mosha: no break against the HTF BO yet, waiting for the VR; barriers are the breaks with it', () => {
  const M = msMosha(H4S, { events: [{ dir: -1, level: 4050, t: 115, fromT: 105, top: 4080, bot: 4050 }], bars: path });
  assert.equal(M.state, 'wait-vr'); assert.deepEqual(M.barriers, [{ level: 4050, t: 115 }]);
});
test('Mosha: the VR box runs from the extreme the BO made to the level the VR broke; then the CF zone, stop, target', () => {
  const ev = [{ dir: 1, level: 4035, t: 140, fromT: 125, top: 4030, bot: 4000 }, { dir: -1, level: 4025, t: 160, fromT: 145, top: 4050, bot: 4030 }];
  const M = msMosha(H4S, { events: ev, bars: path.concat([bar(170, 4031, 4012), bar(180, 4020, 3995)]) }, 0.3);
  assert.equal(M.vr.ext, 4000); assert.equal(M.vr.lo, 4000); assert.equal(M.vr.hi, 4035);
  assert.equal(M.case, 2, 'the CF level sits inside the VR box');
  assert.deepEqual([M.trade.entry, M.trade.stop, M.trade.target], [4030, 4050.3, 4000]);
  assert.ok(M.trade.stop > M.trade.entry, 'a sell has its stop above the entry');
  assert.equal(M.trade.status, 'target'); assert.equal(M.trade.fillT, 170);
});
test('Mosha: a CF that breaks through the VR extreme is case 3 and targets the HTF extreme; stop first when one candle holds both', () => {
  const ev = [{ dir: 1, level: 4035, t: 140, fromT: 125, top: 4030, bot: 4000 }, { dir: -1, level: 3990, t: 160, fromT: 145, top: 4040, bot: 4020 }];
  const M = msMosha(H4S, { events: ev, bars: path.concat([bar(170, 4045, 3940)]) });
  assert.equal(M.case, 3); assert.equal(M.trade.target, 3950); assert.equal(M.trade.status, 'stopped');
});
test('Mosha layer wired: its own switch, Meridian markup only, said to be display only', () => {
  assert.match(html, /data-show="mosha" checked/); assert.match(html, /mosha: true/); assert.match(html, /G\.show\.mosha !== false/);
  assert.match(html, /function moshaNow\(/); assert.match(html, /not a tested rule \(the mechanical Mosha studies failed\)/);
});

// 12 Nov 2026, owner: "make the chart cleaner, let me choose colour background and candle, I can't find the line chart option"
test('Style button on the charts toolbar: chart type, colours saved per device, a reversible clean look', () => {
  assert.match(html, /id="ms-sty-btn"[^>]*aria-controls="ms-sty-pop"/);
  for (const v of ['candles', 'line', 'both']) assert.match(html, new RegExp(`data-cs="${v}"`));
  for (const id of ['ms-sty-bg', 'ms-sty-up', 'ms-sty-dn', 'ms-sty-ln']) assert.match(html, new RegExp(`id="${id}" value="#`));
  assert.match(html, /localStorage\.setItem\('ms-colors'/); assert.match(html, /function setCs\(m\)/);
  assert.match(html, /const BUSY = \['ms-show-hist', 'ms-show-ibos', 'ms-show-vol', 'ms-show-shade', 'ms-show-kl', 'ms-show-news'\]/);
  assert.match(html, /const candleCols = \(\) => \{ const K = themeCols\(\); if \(!hexOk\(CUS\.up\) && !hexOk\(CUS\.dn\)\) return K;/);
});
