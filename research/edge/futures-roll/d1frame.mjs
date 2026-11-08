// CNBC 1D (front-month continuous) vs CNBC 1H (the current contract's own candles) and vs OANDA cash, per trading day.
// D1 - H1 is ~0 once the daily series is on the current contract and = -(current - front) before: it dates every daily switch
// that the 1H history covers and measures its spread from CNBC alone. node d1frame.mjs <cnbc.json.gz> <oanda dir> [out.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
const [DUMP, OA, OUT] = process.argv.slice(2);
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(DUMP)));
const ROOT = { nq: '@ND', es: '@SP', ym: '@DJ', rty: '@TFS', gc: '@GC' };
const nyP = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const parts = (t) => { const o = {}; for (const p of nyP.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return o; };
const ymd = (t) => { const o = parts(t); return `${o.year}-${o.month}-${o.day}`; };
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const res = {};
for (const [k, r] of Object.entries(ROOT)) {
  const D1 = dump.series[`${r}.1|1D|adjusted`], H1 = dump.series[`${r}.1|1H|adjusted`];
  // the H1 candle whose close matches the daily close best: try each New York hour as "last bar of the day" over the last 30 days
  const byDay = new Map(); for (const b of H1) { const o = parts(b[0]); const d = `${o.year}-${o.month}-${o.day}`; (byDay.get(d) || byDay.set(d, new Map()).get(d)).set(+o.hour % 24, b); }
  let best = null;
  for (let h = 0; h < 24; h++) { const e = D1.slice(-30).map((d) => { const m = byDay.get(ymd(d[0])); return m && m.get(h) ? Math.abs(d[4] - m.get(h)[4]) : null; }).filter((x) => x != null);
    if (e.length >= 15) { const m = med(e); if (!best || m < best.m) best = { h, m, n: e.length }; } }
  const rows = D1.map((d) => { const m = byDay.get(ymd(d[0])), h = m && best ? m.get(best.h) : null; return { d: ymd(d[0]), c: d[4], diff: h ? +(d[4] - h[4]).toFixed(2) : null }; });
  // daily switches: consecutive days where D1 - H1 moves from off-zero to ~zero (or between two plateaus)
  const sw = [];
  for (let i = 1; i < rows.length; i++) { const a = rows.slice(Math.max(0, i - 5), i).map((x) => x.diff).filter((x) => x != null), b = rows.slice(i, i + 5).map((x) => x.diff).filter((x) => x != null);
    if (a.length < 2 || b.length < 2) continue; const step = med(b) - med(a); if (Math.abs(step) > 0.002 * rows[i].c) sw.push({ day: rows[i].d, prevDay: rows[i - 1].d, before: med(a), after: med(b), spread: +step.toFixed(2), pct: +(100 * step / rows[i].c).toFixed(3) }); }
  // collapse runs of adjacent detections to the largest
  const sw2 = []; for (const s of sw) { const L = sw2.at(-1); if (L && Date.parse(s.day) - Date.parse(L.day) <= 6 * 86400e3) { if (Math.abs(s.spread) > Math.abs(L.spread)) sw2[sw2.length - 1] = s; } else sw2.push(s); }
  res[k] = { closeHourNY: best, switches: sw2, tail: rows.slice(-160).filter((x) => x.diff != null).map((x) => `${x.d.slice(5)}:${x.diff}`) };
  // OANDA: D1 close-to-close return minus cash return: the daily jump at every switch since 2024 (indices and gold)
  let O = null; try { O = JSON.parse(fs.readFileSync(`${OA}/${k}-1h.json`)); } catch (e) {}
  if (O && best) {
    const om = new Map(); for (const b of O) { const o = parts(b[0]); if (+o.hour % 24 === best.h) om.set(`${o.year}-${o.month}-${o.day}`, b[4]); }
    const J = []; for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], b = rows[i]; if (!om.has(a.d) || !om.has(b.d)) continue; J.push({ d: b.d, x: (b.c - a.c) - (om.get(b.d) - om.get(a.d)) * (b.c / om.get(b.d)) }); }
    const mad = med(J.map((j) => Math.abs(j.x)));
    res[k].cashJumps = { mad: +mad.toFixed(2), big: J.filter((j) => Math.abs(j.x) > Math.max(6 * mad, 0.003 * rows.find((r0) => r0.d === j.d).c)).map((j) => `${j.d} ${j.x.toFixed(1)}`) };
  }
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
for (const [k, v] of Object.entries(res)) { console.log(`== ${k} close hour NY ${JSON.stringify(v.closeHourNY)}`); for (const s of v.switches) console.log('  switch', JSON.stringify(s));
  if (v.cashJumps) console.log('  D1 vs cash jumps (mad', v.cashJumps.mad + '):', v.cashJumps.big.join(' | ')); console.log('  D1-H1 last days:', v.tail.slice(-120).join(' ')); }
