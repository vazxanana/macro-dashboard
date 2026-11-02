// Replay one morning minute by minute on real candles, to see which rule reproduces one of the trader's trades.
//   node council/replay.mjs [market] [day] [from HH:MM UTC] [to HH:MM UTC]
// Gold is Binance PAXG (as in the backtest), shifted onto the trader's XAU/USD spot chart with one reference M30
// candle, so the levels read like the trader's chart. For each minute it runs the engine's setups on the 720-candle
// views (closed candles plus the forming one, as the Trader sees them) and several CHoCH definitions, then plays every
// candidate entry forward on 1m candles to the stop or the trader's target.
import { msAnalyze, PAIRS, RETR, buildSetup, buildRetrace, setMarket } from './engine.mjs';
import { m15Choch } from './choch.mjs';
import fs from 'node:fs';

const [market = 'xau', day = '2026-11-02', fromS = '05:00', toS = '14:30'] = process.argv.slice(2);
const MK = { xau: { label: 'XAU/USD', sym: 'PAXGUSDT', dec: 1, spot: true }, btc: { label: 'BTC/USD', sym: 'BTCUSDT', dec: 1 }, eth: { label: 'ETH/USD', sym: 'ETHUSDT', dec: 2 } }[market];
// the trader's trade and a reference candle from their chart (XAU/USD spot, Pyth, M30), per day
const REF = { '2026-11-02': { m30: { time: '14:30', open: 3947.910, high: 3965.037, low: 3946.822 },
  trade: { side: 'buy', entry: 3900.709, stop: 3896.786, target: 3965.077, from: '11:15', to: '12:15' } } };
const ref = (market === 'xau' && REF[day]) || null;
const T = (hm) => Date.parse(`${day}T${hm}:00Z`) / 1000;
const t0 = T(fromS), t1 = T(toS), WIN = 720;
const TFS = [['1d', 86400], ['4h', 14400], ['1h', 3600], ['30m', 1800], ['15m', 900], ['5m', 300], ['1m', 60]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hm = (t) => new Date(t * 1000).toISOString().slice(11, 16), f = (v) => v == null ? '-' : v.toFixed(MK.dec + 1);

async function klines(sym, iv, start, end) {
  const out = []; let from = start * 1000;
  while (from < end * 1000) {
    let raw = null;
    for (let a = 0; a < 5 && !raw; a++) {
      try { const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${iv}&startTime=${from}&endTime=${end * 1000}&limit=1000`); if (!r.ok) throw new Error(`HTTP ${r.status}`); raw = await r.json(); }
      catch (e) { if (a === 4) throw e; await sleep(1000 * (a + 1)); }
    }
    if (!raw.length) break;
    for (const k of raw) out.push({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4] });
    from = raw[raw.length - 1][0] + 1;
    if (raw.length < 1000) break;
    await sleep(120);
  }
  return out;
}
const atr = (bars, n = 14) => { const b = bars.slice(-n - 1); let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return b.length > 1 ? s / (b.length - 1) : 0; };

// a CHoCH up with a given swing width: the leg down from the last 12 h's high to the lowest low after it, then a close
// above the last lower high before that low (w candles each side) -- choch.mjs uses w = 2 on M15
function chochW(B, w, L) {
  const n = B.length; if (n < L + 5) return null;
  const piv = (j) => { for (let k = 1; k <= w; k++) { if (j - k < 0 || j + k > n - 2) return false; if (B[j - k].high > B[j].high || B[j + k].high >= B[j].high) return false; } return true; };
  let iS = n - 2; for (let j = n - 2; j >= n - 1 - L; j--) if (B[j].high > B[iS].high) iS = j;
  let iE = iS; for (let j = iS + 1; j <= n - 2; j++) if (B[j].low < B[iE].low) iE = j;
  if (iS === iE || B[iS].high - B[iE].low < 2 * atr(B)) return { leg: false };
  let iP = -1; for (let j = iE - 1; j > iS; j--) if (piv(j)) { iP = j; break; }
  const lvl = iP >= 0 ? B[iP].high : B[iS].high;
  let iC = -1; for (let j = iE + 1; j <= n - 2; j++) if (B[j].close > lvl) { iC = j; break; }
  // the bounce high after the low (the first swing high after it), the other reading of "the last high"
  let iB = -1; for (let j = iE + 1; j <= n - 2; j++) if (piv(j)) { iB = j; break; }
  let iC2 = -1; if (iB >= 0) for (let j = iB + 1; j <= n - 2; j++) if (B[j].close > B[iB].high) { iC2 = j; break; }
  return { leg: true, iS, iE, iP, lvl, iC, iB, iC2, low: B[iE].low };
}

const data = {};
for (const [id, sec] of TFS) {
  data[id] = await klines(MK.sym, id, t0 - (WIN + 2) * sec - (id === '1m' ? 3 * 86400 : 0), t1 + 6 * 3600);
  console.log(`${id}: ${data[id].length} candles`);
}
// shift onto the trader's spot chart with the reference M30 candle
let off = 0;
if (ref) {
  const c = data['30m'].find((b) => b.time === T(ref.m30.time));
  if (c) off = ((c.open - ref.m30.open) + (c.high - ref.m30.high) + (c.low - ref.m30.low)) / 3;
  console.log(`PAXG -> spot: ${ref.m30.time} M30 PAXG O ${f(c && c.open)} H ${f(c && c.high)} L ${f(c && c.low)} vs spot O ${ref.m30.open} H ${ref.m30.high} L ${ref.m30.low}: shift ${off.toFixed(2)}`);
}
for (const id of Object.keys(data)) data[id] = data[id].map((b) => ({ time: b.time, open: b.open - off, high: b.high - off, low: b.low - off, close: b.close - off }));
const m1 = data['1m'];
setMarket(MK);

// play an entry forward on 1m candles: target or stop first
function play(side, entry, stop, target, from) {
  const s = side === 'sell' ? -1 : 1, r = Math.abs(entry - stop);
  for (const b of m1) {
    if (b.time < from) continue;
    if (s > 0 ? b.low <= stop : b.high >= stop) return { out: 'stop', R: -1, at: hm(b.time) };
    if (s > 0 ? b.high >= target : b.low <= target) return { out: 'target', R: +((target - entry) * s / r).toFixed(2), at: hm(b.time) };
  }
  return { out: 'open', R: null, at: '-' };
}
if (ref) {
  const tr = ref.trade, fill = m1.find((b) => b.time >= T(tr.from) && b.time <= T(tr.to) && b.low <= tr.entry);
  console.log(`\nThe trader's ${tr.side} ${tr.entry} / ${tr.stop} / ${tr.target}: ${fill ? `fills ${hm(fill.time)} -> ${JSON.stringify(play(tr.side, tr.entry, tr.stop, tr.target, fill.time))}` : 'no fill in this data in its window'}`);
}

const BUILDERS = PAIRS.map((p) => [p, buildSetup]).concat(RETR.map((p) => [p, buildRetrace]));
const ptr = Object.fromEntries(TFS.map(([id]) => [id, 0])), last = {}, cands = [];
let i1 = 0;
console.log(`\nTimeline ${fromS}-${toS} UTC (spot terms; buy side; a line is printed when something changes)`);
for (let t = t0; t <= t1; t += 60) {
  while (i1 < m1.length && m1[i1].time < t) i1++;
  const src = {}; let bad = false;
  for (const [id, sec] of TFS) {
    const arr = data[id]; let p = ptr[id];
    while (p < arr.length && arr[p].time + sec <= t) p++;
    ptr[id] = p;
    const bars = arr.slice(Math.max(0, p - (WIN - 1)), p);
    if (id !== '1m') {
      const fz = Math.floor(t / sec) * sec; let fb = null;
      for (let j = i1 - 1; j >= 0 && m1[j].time >= fz; j--) { const b = m1[j]; fb = fb ? { time: fz, open: b.open, high: Math.max(fb.high, b.high), low: Math.min(fb.low, b.low), close: fb.close } : { time: fz, open: b.open, high: b.high, low: b.low, close: b.close }; }
      if (fb) bars.push(fb);
    }
    if (bars.length < 60) { bad = true; break; }
    src[id] = { bars, A: msAnalyze(bars, 6) };
  }
  if (bad) continue;
  const price = src['1m'].bars.at(-1).close;
  const say = (key, text) => { if (last[key] !== text) { last[key] = text; console.log(`${hm(t)} @${f(price)}  ${text}`); } };
  // the engine's buy setups
  const st = BUILDERS.map(([pr, fn]) => { try { return fn(pr, price, src); } catch (e) { return null; } }).filter((v) => v && !v.sell);
  say('setups', 'setups: ' + st.map((v) => `${v.k} ${v.state}${v.state === 'READY' ? ` (${f(v.entry)}/${f(v.stop)}/${f(v.t1)})` : ''}`).join(', '));
  // CHoCH definitions: M15 and M5, swing width 2 and 1, last lower high before the low (lh) or the bounce high after it (bh)
  for (const [id, w, L] of [['15m', 2, 48], ['15m', 1, 48], ['5m', 2, 144], ['5m', 1, 144]]) {
    const B = src[id].bars, c = chochW(B, w, L), sec = id === '15m' ? 900 : 300, tag = `${id.toUpperCase()} w${w}`;
    if (!c || !c.leg) { say(tag, `${tag}: no leg down of 2 ATR`); continue; }
    const desc = `${tag}: low ${f(c.low)} ${hm(B[c.iE].time)}, last lower high ${f(c.lvl)}${c.iP >= 0 ? ` ${hm(B[c.iP].time)}` : ' (leg start)'}`
      + (c.iC >= 0 ? `, CHoCH(lh) ${hm(B[c.iC].time + sec)}` : '') + (c.iC2 >= 0 ? `, CHoCH(bh ${f(B[c.iB].high)}) ${hm(B[c.iC2].time + sec)}` : '');
    say(tag, desc);
    for (const [kind, idx] of [['lh', c.iC], ['bh', c.iC2]]) {
      if (idx < 0) continue;
      const tc = B[idx].time + sec, key = `${tag} ${kind} ${tc}`;
      if (t >= tc && t < tc + 60 && !last[key]) {   // the first minute after the CHoCH candle closes: a market entry
        last[key] = 1;
        const buf = Math.max(0.1 * atr(src['15m'].bars), 0.3), stopLow = c.low - buf;
        const m5 = src['5m'].bars.slice(-7, -1), stopM5 = Math.min(...m5.map((b) => b.low)) - buf;   // under the last half hour
        cands.push({ at: hm(t), rule: `${tag} CHoCH(${kind})`, entry: price, stops: { 'past the low': stopLow, 'past last 30 min (M5)': stopM5 } });
      }
    }
  }
}
console.log('\nCandidate entries (market, first minute after the CHoCH closes), played to the trader\'s target ' + (ref ? ref.trade.target : '-') + ':');
for (const c of cands) {
  if (!ref) break;
  const parts = Object.entries(c.stops).map(([k, s]) => { const r = c.entry - s, rr = (ref.trade.target - c.entry) / r, o = play('buy', c.entry, s, ref.trade.target, T(c.at)); return `${k} ${f(s)} (risk ${r.toFixed(1)}, ${rr.toFixed(1)}R): ${o.out} ${o.at}${o.R != null ? ` ${o.R}R` : ''}`; });
  console.log(`${c.at} ${c.rule.padEnd(18)} buy ${f(c.entry)} | ${parts.join(' | ')}`);
}
if (process.env.REPLAY_OUT) fs.writeFileSync(process.env.REPLAY_OUT, JSON.stringify({ market, day, off, cands }, null, 1));
