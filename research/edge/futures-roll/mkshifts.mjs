// For the chained tracker proof: when CNBC's '.1' moved to a new contract (the first daily candle of each front-month segment) and how
// far the then-front contract's intraday prices sat below the dumped (current = Dec 2026) contract's, per segment: the median of
// (dumped 1H close at 15:00 New York - front-month 1D close) over the segment's days. The stub serves intraday candles at clock T as
// dump - offset(segment of T), i.e. the front contract a live run at T would have read. node mkshifts.mjs <cnbc.json.gz> <probe.json.gz> <out.json>
import fs from 'node:fs';
import zlib from 'node:zlib';
import { MARKETS, rollAdjust } from '../../../ict/tracker.mjs';
const [DUMP, PROBE, OUT] = process.argv.slice(2);
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(DUMP))).series, probe = JSON.parse(zlib.gunzipSync(fs.readFileSync(PROBE))).series;
const rows = (a) => (a || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }));
const nyP = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
const parts = (t) => { const o = {}; for (const p of nyP.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return o; };
const key = (t) => { const o = parts(t); return `${o.year}-${o.month}-${o.day}`; };
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const out = {};
for (const [k, M] of Object.entries(MARKETS)) {
  const sym = M.cnbc[0], d1 = rows(dump[`${sym}|1D|adjusted`]), h1 = rows(dump[`${sym}|1H|adjusted`]);
  let starts;
  if (M.cash) starts = rollAdjust(d1, rows(probe[`${M.cash}|1D`])).rolls.map((r) => r.day);
  else { // gold: the front changes where GCZ26 (the dumped contract) minus the continuous close changes level
    const Z = new Map(rows(probe['GCZ26|1D']).map((b) => [b.time, b.close])); const d = d1.filter((b) => Z.has(b.time)).map((b) => ({ day: key(b.time), v: Z.get(b.time) - b.close }));
    starts = d.slice(1).filter((x, i) => Math.abs(x.v - d[i].v) > 0.004 * d1.at(-1).close).map((x) => x.day); }
  const at15 = new Map(h1.filter((b) => +parts(b.time).hour % 24 === 15).map((b) => [key(b.time), b.close]));
  const seg = []; let cur = { from: null, days: [] };
  for (const b of d1) { const day = key(b.time); if (starts.includes(day)) { seg.push(cur); cur = { from: day, days: [] }; } if (at15.has(day)) cur.days.push(at15.get(day) - b.close); }
  seg.push(cur);
  // switch moment: the first candle of the new contract's session, 18:00 New York the evening before its first daily candle's date
  const t18 = (day) => { const t = Date.parse(`${day}T00:00:00Z`) / 1000; for (let h = 20; h <= 24; h++) { const x = t - 86400 + h * 3600; const o = parts(x); if (+o.hour % 24 === 18) return x; } return t; };
  out[sym] = seg.map((s) => ({ from: s.from ? t18(s.from) : 0, day: s.from, offset: s.days.length >= 3 ? +med(s.days).toFixed(2) : null, n: s.days.length }));
  // the last segment is the dumped contract itself: offset 0 by definition
  out[sym].at(-1).offset = 0;
  console.log(k, JSON.stringify(out[sym].slice(-4)));
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
