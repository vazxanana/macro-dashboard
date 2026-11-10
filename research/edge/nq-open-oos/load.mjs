// Day maps for the open-run replay: Map<NY date, [{time, open, high, low, close, vol, m}]> (09:30-11:05 ET candles plus the
// candles the midnight-open filter reads: m = 0 is the 00:00 ET candle; m = -1 the last candle before midnight (OANDA only)).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { nyParts, nyMidnight } from './lib.mjs';
import { histStampUtc, usDaylight } from '../../../council/histdata.mjs';   // HistData clock: UTC-5, UTC-4 in Europe's summer (2018: New York time)

// OANDA NAS100_USD mid candles written by fetch.mjs
export function loadOanda(dir) {
  const days = new Map();
  for (const f of fs.readdirSync(dir).filter((f) => /^nas100-\d{4}\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [d, rows] of Object.entries(j)) days.set(d, rows.map(([time, open, high, low, close, vol]) => ({ time, open, high, low, close, vol, m: nyParts(time).d === d ? nyParts(time).m : -1 })));
  }
  return days;
}

// HistData NSXUSD M1 (council-data research/candles/nsxusd-histdata/*.csv.gz), converted with council/histdata.mjs (9 Nov: the
// files are UTC-5, UTC-4 while Europe is on summer time, New York time in 2018; the 5 Nov reading as New York wall-clock time
// put the 09:30 open an hour early in the ~4 weeks a year the US and Europe switch apart).
export function loadHistData(dir) {
  const days = new Map();
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.csv.gz')).sort()) {
    const txt = zlib.gunzipSync(fs.readFileSync(path.join(dir, f))).toString();
    for (const line of txt.split('\n')) {
      if (line.length < 20) continue; const [ts, o, h, l, c] = line.split(';');
      const time = histStampUtc(ts), loc = time - (usDaylight(time) ? 4 : 5) * 3600, d = new Date(loc * 1000).toISOString().slice(0, 10), m = Math.floor((loc % 86400) / 60);
      if (!(m === 0 || (m >= 570 && m <= 665))) continue;
      let a = days.get(d); if (!a) { a = []; days.set(d, a); }
      a.push({ time, open: +o, high: +h, low: +l, close: +c, vol: 0, m });
    }
  }
  for (const [d, a] of days) { const p = nyParts(nyMidnight(d) + 12 * 3600); if (p.wd === 'Sat' || p.wd === 'Sun') days.delete(d); else a.sort((x, y) => x.time - y.time); }
  return new Map([...days].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}
