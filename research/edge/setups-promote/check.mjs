// Checks fastms.mjs against the live engine's msAnalyze on real windows of every timeframe, and times both.
//   node check.mjs <candle .csv.gz>
import fs from 'node:fs';
import zlib from 'node:zlib';
import { msAnalyze } from '../../../council/engine.mjs';
import { fastAnalyze } from './fastms.mjs';
const txt = zlib.gunzipSync(fs.readFileSync(process.argv[2])).toString();
const m1 = [];
for (const line of txt.split('\n')) { if (line.length < 20) continue; const [dt, o, h, l, c] = line.split(';');
  m1.push({ time: Date.UTC(+dt.slice(0, 4), +dt.slice(4, 6) - 1, +dt.slice(6, 8), +dt.slice(9, 11), +dt.slice(11, 13)) / 1000, open: +o, high: +h, low: +l, close: +c }); }
const agg = (sec) => { const out = []; let cur = null; for (const b of m1) { const s = Math.floor(b.time / sec) * sec; if (!cur || cur.time !== s) { cur = { ...b, time: s }; out.push(cur); } else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } } return out; };
let bad = 0, tot = 0;
for (const sec of [60, 300, 900, 1800, 3600, 14400, 86400]) {
  const a = sec === 60 ? m1 : agg(sec), N = Math.min(400, a.length - 100); let to = 0, tf = 0;
  for (let i = 0; i < N; i++) {
    const s = Math.min(a.length, 100 + Math.floor(i * (a.length - 100) / N)), w = a.slice(Math.max(0, s - 720), s);
    let t = performance.now(); const x = JSON.stringify(msAnalyze(w, 6)); to += performance.now() - t;
    t = performance.now(); const y = JSON.stringify(fastAnalyze(w, 6)); tf += performance.now() - t;
    tot++; if (x !== y) bad++;
  }
  console.log(`tf ${sec}s: engine ${(to / N).toFixed(3)} ms, fast ${(tf / N).toFixed(3)} ms`);
}
console.log(`${tot} windows, ${bad} differ`);
