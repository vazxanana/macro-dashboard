// Roll detection on CNBC continuous futures vs the OANDA cash reference, exactly as research/edge/futures-roll/preregistration.md
// (measurement 1-6). node rolls.mjs <cnbc.json.gz> <oanda dir> [out.json]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { inHalt, cmeShut, dailyNY } from '../../../ict/tracker.mjs';

const [DUMP, OA, OUT] = process.argv.slice(2);
const dump = JSON.parse(zlib.gunzipSync(fs.readFileSync(DUMP)));
const ROOT = { nq: '@ND', es: '@SP', ym: '@DJ', rty: '@TFS', gc: '@GC' };
const closedBar = (t) => inHalt(t) || cmeShut(t);
const rows = (key, iv) => (dump.series[key] || []).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] })).filter((b) => iv === '1D' || !closedBar(b.time));
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
// the NY trading day a bar belongs to: the session that opens 18:00 New York belongs to the next date
const tday = (t) => nyDate.format(new Date((t + 6 * 3600) * 1000));
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');

// expected windows (preregistration "Roll calendar")
const thirdFri = (y, m) => { const d = new Date(Date.UTC(y, m, 1)); const w = d.getUTCDay(); return 1 + ((5 - w + 7) % 7) + 14; };
export function windows(k, y0 = 2024, y1 = 2027) {
  const out = [];
  for (let y = y0; y <= y1; y++) {
    if (k === 'gc') for (const m of [1, 3, 5, 7, 9, 11]) {   // delivery month (0-based): Feb Apr Jun Aug Oct Dec
      let first = new Date(Date.UTC(y, m, 1)); while ([0, 6].includes(first.getUTCDay())) first = new Date(first.getTime() + 86400e3);
      let d = first, n = 0; while (n < 10) { d = new Date(d.getTime() - 86400e3); if (![0, 6].includes(d.getUTCDay())) n++; }
      out.push({ contract: `${y}-${String(m + 1).padStart(2, '0')}`, from: d.toISOString().slice(0, 10), to: first.toISOString().slice(0, 10) });
    } else for (const m of [2, 5, 8, 11]) {
      const ex = thirdFri(y, m), roll = ex - 8, mon = roll - 3;
      out.push({ contract: `${y}-${String(m + 1).padStart(2, '0')}`, roll: new Date(Date.UTC(y, m, roll)).toISOString().slice(0, 10),
        from: new Date(Date.UTC(y, m, mon)).toISOString().slice(0, 10), to: new Date(Date.UTC(y, m, ex)).toISOString().slice(0, 10) });
    }
  }
  return out;
}
const inWin = (k, d) => windows(k).find((w) => d >= w.from && d <= w.to) || null;

// steps of a per-bar "basis" series (bars: [{time, v, px}]): preregistration 1-4
export function steps(bars, k) {
  const days = new Map(); for (const b of bars) { const d = tday(b.time); (days.get(d) || days.set(d, []).get(d)).push(b); }
  const D = [...days].map(([d, a]) => ({ d, v: med(a.map((b) => b.v)), px: med(a.map((b) => b.px)), n: a.length })).filter((x) => x.n >= 4);
  const ch = D.slice(1).map((x, i) => x.v - D[i].v), mad = med(ch.map(Math.abs));
  if (mad == null) return { mad: null, days: D.length, steps: [] };
  const out = [];
  for (let i = 1; i < D.length; i++) {
    const step = D[i].v - D[i - 1].v, thr = Math.max(6 * mad, 0.0015 * D[i].px);
    if (Math.abs(step) <= thr) continue;
    // roll hour: first bar of the two days whose basis is off the 24 bars before it by more than half the step
    const i0 = bars.findIndex((b) => tday(b.time) === D[i - 1].d);
    let h = null;
    for (let j = Math.max(i0, 24); j < bars.length && tday(bars[j].time) <= D[i].d; j++) {
      const pre = med(bars.slice(j - 24, j).map((b) => b.v)); if (Math.abs(bars[j].v - pre) > Math.abs(step) / 2 && Math.sign(bars[j].v - pre) === Math.sign(step)) { h = j; break; }
    }
    if (h == null) { out.push({ day: D[i].d, step: +step.toFixed(2), thr: +thr.toFixed(2), hour: null }); continue; }
    const jump = med(bars.slice(h, h + 24).map((b) => b.v)) - med(bars.slice(Math.max(0, h - 24), h).map((b) => b.v));
    out.push({ day: D[i].d, step: +step.toFixed(2), thr: +thr.toFixed(2), t: bars[h].time, at: iso(bars[h].time), jump: +jump.toFixed(2), pct: +(100 * jump / bars[h].px).toFixed(3), window: inWin(k, D[i].d) });
  }
  return { mad: mad == null ? null : +mad.toFixed(3), days: D.length, steps: out };
}

const res = { dump: dump.at, coverage: {}, markets: {} };
for (const [k, r] of Object.entries(ROOT)) {
  const M = (res.markets[k] = {});
  for (const key of Object.keys(dump.series).filter((s) => s.startsWith(r + '.'))) { const s = dump.series[key]; res.coverage[key] = s.length ? `${s.length} ${iso(s[0][0])} .. ${iso(s.at(-1)[0])}` : 'none'; }
  const h1 = rows(`${r}.1|1H|adjusted`, '1H'), h1u = rows(`${r}.1|1H|unadjusted`, '1H'), h2 = rows(`${r}.2|1H|adjusted`, '1H');
  const by = (a) => new Map(a.map((b) => [b.time, b]));
  // adjusted vs unadjusted (does CNBC back-adjust?)
  { const U = by(h1u); const d = h1.filter((b) => U.has(b.time)).map((b) => b.close - U.get(b.time).close);
    M.adjMinusUnadj = { n: d.length, nonzero: d.filter((x) => Math.abs(x) > 1e-9).length, min: d.length ? Math.min(...d) : null, max: d.length ? Math.max(...d) : null }; }
  // CNBC vs OANDA cash
  let O = null; try { O = by(JSON.parse(fs.readFileSync(`${OA}/${k}-1h.json`)).map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))); } catch (e) { O = null; }
  if (O) {
    M.cash = steps(h1.filter((b) => O.has(b.time)).map((b) => ({ time: b.time, v: b.close - O.get(b.time).close, px: b.close })), k);
    if (h1u.length) M.cashUnadj = steps(h1u.filter((b) => O.has(b.time)).map((b) => ({ time: b.time, v: b.close - O.get(b.time).close, px: b.close })), k);
    // daily: CNBC 1D close vs the OANDA 17:00 New York day close
    const od = new Map(dailyNY([...O.values()].sort((a, b) => a.time - b.time)).map((b) => [tday(b.time + 86400 - 3600), b]));
    const d1 = rows(`${r}.1|1D|adjusted`, '1D').map((b) => ({ ...b, d: tday(b.time + 12 * 3600) }));
    M.cashDaily = steps(d1.filter((b) => od.has(b.d)).map((b) => ({ time: b.time + 12 * 3600, v: b.close - od.get(b.d).close, px: b.close })), k);
  }
  // second month minus front month (the calendar spread; it collapses to ~0 / flips at a switch)
  if (h2.length) { const F = by(h1); M.spread2 = h2.filter((b) => F.has(b.time)).map((b) => ({ time: b.time, v: b.close - F.get(b.time).close, px: b.close }));
    const days = new Map(); for (const b of M.spread2) { const d = tday(b.time); (days.get(d) || days.set(d, []).get(d)).push(b.v); }
    M.spread2Daily = [...days].map(([d, a]) => [d, +med(a).toFixed(2)]); M.spread2Steps = steps(M.spread2, k); delete M.spread2; }
  // non-roll H1 close -> next open gaps (consecutive bars within one session)
  const g = []; for (let i = 1; i < h1.length; i++) if (h1[i].time - h1[i - 1].time === 3600) g.push(Math.abs(h1[i].open - h1[i - 1].close));
  g.sort((a, b) => a - b); M.gapP95 = g.length ? +g[Math.floor(0.95 * g.length)].toFixed(2) : null; M.gapP99 = g.length ? +g[Math.floor(0.99 * g.length)].toFixed(2) : null;
  M.windows = windows(k, 2025, 2026);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.coverage, null, 1));
for (const [k, M] of Object.entries(res.markets)) {
  console.log(`\n== ${k}  adj-unadj ${JSON.stringify(M.adjMinusUnadj)}  gap p95 ${M.gapP95} p99 ${M.gapP99}`);
  for (const [nm, S] of [['cash H1', M.cash], ['cash H1 unadj', M.cashUnadj], ['cash D1', M.cashDaily], ['.2-.1', M.spread2Steps]]) {
    if (!S) continue; console.log(` ${nm}: days ${S.days} mad ${S.mad}`);
    for (const s of S.steps) console.log(`   ${s.day} step ${s.step} (thr ${s.thr}) hour ${s.at || '-'} jump ${s.jump ?? '-'} (${s.pct ?? '-'}%) window ${s.window ? s.window.contract : 'NONE'}`);
  }
}
