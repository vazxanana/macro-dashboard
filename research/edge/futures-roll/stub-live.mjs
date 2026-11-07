// --import stub for chained ict/tracker.mjs runs at clock ROLL_NOW: CNBC answered as a live run at that time would have seen it.
// Intraday (5M/1H): the dumped current contract minus the then-front offset (mkshifts.mjs), so the series moves to the new contract
// at each switch, as CNBC's '.1' does; 1D: the continuous front-month daily candles up to the clock; cash-index 1D from the probe.
// Env: ROLL_DUMP, ROLL_PROBE, ROLL_SHIFTS, ROLL_NOW.
import fs from 'node:fs';
import zlib from 'node:zlib';
const T = Date.parse(process.env.ROLL_NOW) / 1000; Date.now = () => T * 1000;
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.env.ROLL_DUMP))).series;
const probe = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.env.ROLL_PROBE))).series;
const shifts = JSON.parse(fs.readFileSync(process.env.ROLL_SHIFTS, 'utf8'));
globalThis.setTimeout = ((st) => (f, ms, ...a) => st(f, 0, ...a))(globalThis.setTimeout);
const nyOff = (y, mo, d) => (new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(new Date(Date.UTC(y, mo, d, 12))).find((p) => p.type === 'timeZoneName').value.includes('-4') ? 4 : 5);
const et = (s) => { const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8); return Date.UTC(y, mo, d, +s.slice(8, 10), +s.slice(10, 12)) / 1000 + nyOff(y, mo, d) * 3600; };
const offsetAt = (sym) => { const s = (shifts[sym] || []).filter((x) => x.from <= T).at(-1); return s && s.offset != null ? s.offset : 0; };
globalThis.fetch = async (u) => {
  u = String(u);
  if (!u.includes('cnbc.com')) return { ok: false, status: 404, json: async () => ({ error: 'stub: offline' }) };
  const p = u.split('/'), i = p.indexOf('bars'), sym = decodeURIComponent(p[i + 1]), iv = p[i + 2], from = et(p[i + 3]), to = et(p[i + 4]);
  let rows;
  if (iv === '1D') rows = (dump[`${sym}|1D|adjusted`] || probe[`${sym}|1D`] || []).filter((b) => b[0] >= from && b[0] <= Math.min(to, T));
  else { const o = offsetAt(sym), step = iv === '5M' ? 300 : 3600;
    rows = (dump[`${sym}|${iv}|adjusted`] || []).filter((b) => b[0] >= from && b[0] <= to && b[0] + step <= T).map((b) => [b[0], b[1] - o, b[2] - o, b[3] - o, b[4] - o, b[5]]); }
  return { ok: true, status: 200, json: async () => (rows.length ? { barData: { priceBars: rows.map((b) => ({ open: b[1], high: b[2], low: b[3], close: b[4], volume: b[5] || 0, tradeTimeinMills: b[0] * 1000 })) } } : { statusMessage: 'stub: no bars' }) };
};
