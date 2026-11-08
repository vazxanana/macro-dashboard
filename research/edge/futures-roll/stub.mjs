// --import stub for ict/replay.mjs / ict/tracker.mjs: CNBC answered from the raw dump (council-data research/futures-roll/cnbc.json.gz),
// OANDA paper markets refused, sleeps skipped, the clock fixed. Env: ROLL_DUMP (dump path), ROLL_NOW (ISO clock),
// ROLL_NOVOL=1: bars without volume (the replay's liquidFrom then cuts nothing: the daily-roll fix alone); ROLL_XAU5: see below.
// ROLL_D1 (optional JSON file {"@ND.1": [[t,o,h,l,c],...]} that replaces the 1D series: the back-adjusted daily candles).
import fs from 'node:fs';
import zlib from 'node:zlib';
const T = Date.parse(process.env.ROLL_NOW); Date.now = () => T;
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(process.env.ROLL_DUMP)));
const D1 = process.env.ROLL_D1 ? JSON.parse(fs.readFileSync(process.env.ROLL_D1, 'utf8')) : {};
// ROLL_PROBE (optional): council-data research/futures-roll/probe.json.gz, for the cash-index daily candles (.NDX .SPX .DJI .RUT)
const PROBE = process.env.ROLL_PROBE ? JSON.parse(zlib.gunzipSync(fs.readFileSync(process.env.ROLL_PROBE))).series : {};
globalThis.setTimeout = ((st) => (f, ms, ...a) => st(f, 0, ...a))(globalThis.setTimeout);
const nyOff = (y, mo, d) => { const t = Date.UTC(y, mo, d, 12); const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(new Date(t)).find((p) => p.type === 'timeZoneName').value; return s.includes('-4') ? 4 : 5; };
const et = (s) => { const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8); return Date.UTC(y, mo, d, +s.slice(8, 10), +s.slice(10, 12)) / 1000 + nyOff(y, mo, d) * 3600; };
let XAU5 = null;
globalThis.fetch = async (u) => {
  u = String(u);
  // ROLL_XAU5 (optional): OANDA spot gold 5m [[t,o,h,l,c],...] (research/edge/ict-exits-replay/fetch-oanda.mjs) for /md/bars?sym=xau&tf=5m
  if (u.includes('/md/bars') && process.env.ROLL_XAU5 && /sym=xau&tf=5m/.test(u)) {
    XAU5 = XAU5 || JSON.parse(fs.readFileSync(process.env.ROLL_XAU5, 'utf8'));
    const q = new URL(u).searchParams, f = +q.get('from'), t = +q.get('to');
    return { ok: true, status: 200, json: async () => ({ bars: XAU5.filter((b) => b[0] >= f && b[0] < t && b[0] + 300 <= T / 1000).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] })) }) };
  }
  if (!u.includes('cnbc.com')) return { ok: false, status: 404, json: async () => ({ error: 'stub: offline' }) };
  const p = u.split('/'), i = p.indexOf('bars'), sym = decodeURIComponent(p[i + 1]), iv = p[i + 2], from = et(p[i + 3]), to = et(p[i + 4]);
  const src = iv === '1D' && D1[sym] ? D1[sym] : dump.series[`${sym}|${iv}|adjusted`] || PROBE[`${sym}|${iv}`] || [];
  const rows = src.filter((b) => b[0] >= from && b[0] <= to && b[0] < T / 1000);
  return { ok: true, status: 200, json: async () => (rows.length ? { barData: { priceBars: rows.map((b) => ({ open: b[1], high: b[2], low: b[3], close: b[4], volume: process.env.ROLL_NOVOL ? 0 : b[5] || 0, tradeTimeinMills: b[0] * 1000 })) } } : { statusMessage: 'stub: no bars' }) };
};
