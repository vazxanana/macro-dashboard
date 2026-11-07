// Edge research · gold-weekend: baseline (#530 replay.mjs, unchanged) against the intended weekend rule (replay-intended.mjs),
// both scored by #530's analyze.mjs, unchanged; the pre-registered decision (preregistration.md) and its diagnostics.
//   CANDLES=<#530 candle dir> node compare.mjs <base trades.json> <base analyze.json> <variant trades.json> <variant analyze.json> [<#530 result.json>] > result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spotClosed } from '../../../council/fills.mjs';

const [BT, BR, VT, VR, REF] = process.argv.slice(2);
const rd = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const bt = rd(BT), br = rd(BR), vt = rd(VT), vr = rd(VR), ref = REF ? rd(REF) : null;
const D1raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-1d.json.gz')))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
// trading days as replay-intended.mjs folds them (Saturday / Sunday into the next weekday): only their times matter here
const D1 = D1raw.filter((b) => ![0, 6].includes(new Date(b.time * 1000).getUTCDay()));
const lastClosed = (D, c) => { let lo = 0, hi = D.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (D[m].time + 86400 <= c) { k = m; lo = m + 1; } else hi = m - 1; } return D[k]; };
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const WIN = { oos: [T('2006-07-01'), T('2018-01-01')], cal: [T('2018-01-01'), T('2026-11-07')] };
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
const SYS = ['gtrend', 'geg', 'gtrend5'];

const out = { note: 'baseline = #530 replay.mjs unchanged; variant = replay-intended.mjs (intended weekend rule); both scored by #530 analyze.mjs. Net R a position; x1 = 0.30 per unit round trip, x2 = 0.60. 2006-17 = entries 2006-07-01..2017-12-31; 2018-26 = 2018-01-01..2026-11-06.', reproduction: {}, systems: {} };

// ── reproduction of #530 ──
if (ref) for (const k of [...SYS, 'gtl']) out.reproduction[k] = { periods: JSON.stringify(br.systems[k].periods) === JSON.stringify(ref.systems[k].periods), years: JSON.stringify(br.systems[k].years) === JSON.stringify(ref.systems[k].years) };
if (ref) out.reproduction.positions = JSON.stringify(br.positions) === JSON.stringify(ref.positions);
// Gold H4 trendline is untouched by the variant: its legs must be identical
const gtlKey = (L) => JSON.stringify(L.filter((x) => x.k === 'gtl').map((x) => [x.id, x.entry, x.stop, x.R, x.closed]));
out.reproduction.gtlIdenticalInVariant = gtlKey(bt) === gtlKey(vt);

const pick = (s, w) => ({ n: s.periods[w].x1.n, win: s.periods[w].x1.win, x1: s.periods[w].x1.mean, x2: s.periods[w].x2.mean, R: s.periods[w].x1.R, R2: s.periods[w].x2.R, t: s.periods[w].x1.t, maxDD: s.periods[w].x1.maxDD });
for (const k of SYS) {
  const B = br.systems[k], V = vr.systems[k], S = { windows: {} };
  for (const w of ['oos', 'cal', 'h1', 'h2']) S.windows[w] = { base: pick(B, w), intended: pick(V, w) };
  const tot = (s) => r2(s.periods.oos.x1.R + s.periods.cal.x1.R), tot2 = (s) => r2(s.periods.oos.x2.R + s.periods.cal.x2.R);
  const nAll = (s) => s.periods.oos.x1.n + s.periods.cal.x1.n;
  S.total = { base: { n: nAll(B), R: tot(B), R2: tot2(B), mean: r3(tot(B) / nAll(B)) }, intended: { n: nAll(V), R: tot(V), R2: tot2(V), mean: r3(tot(V) / nAll(V)) } };
  const tests = {
    '1 2006-17 x1 R/position not lower': V.periods.oos.x1.mean >= B.periods.oos.x1.mean,
    '1 2006-17 x2 R/position not lower': V.periods.oos.x2.mean >= B.periods.oos.x2.mean,
    '2 2018-26 x1 R/position not lower': V.periods.cal.x1.mean >= B.periods.cal.x1.mean,
    '2 2018-26 x2 R/position not lower': V.periods.cal.x2.mean >= B.periods.cal.x2.mean,
    '3 total x1 R 2006-26 higher': tot(V) > tot(B),
  };
  S.decision = { tests, verdict: k === 'gtrend5' ? 'reference only (no verdict)' : Object.values(tests).every(Boolean) ? 'ADOPT intended rule' : 'KEEP current rule', missed: Object.entries(tests).filter(([, v]) => !v).map(([t]) => t) };

  // ── signal day of every position (first leg; the last closed day at the entry run) ──
  const pos = (L, D) => L.filter((x) => x.k === k && !x.addOf && x.status !== 'expired' && x.status !== 'missed').map((x) => {
    const c = x.opened - 240, d = lastClosed(D, c), t = x.filled ?? x.opened;
    return { id: x.id, t, entry: x.entry, stop: x.stop, sig: d.time, wd: WD[new Date(d.time * 1000).getUTCDay()], shutEntry: x.entryMode === 'market' && spotClosed(c), w: t >= WIN.oos[0] && t < WIN.oos[1] ? 'oos' : t >= WIN.cal[0] && t < WIN.cal[1] ? 'cal' : null };
  });
  const netOf = (res) => new Map(res.positions.filter((p) => p.sys === k).map((p) => [p.id, p]));
  const bN = netOf(br), vN = netOf(vr);
  const bp = pos(bt, D1raw).filter((p) => p.w).map((p) => ({ ...p, n: bN.get(p.id)?.n, n2: bN.get(p.id)?.n2 })), vp = pos(vt, D1).filter((p) => p.w).map((p) => ({ ...p, n: vN.get(p.id)?.n, n2: vN.get(p.id)?.n2 }));
  const share = (P, wd) => Object.fromEntries(['oos', 'cal', 'all'].map((w) => { const a = P.filter((p) => w === 'all' || p.w === w); const f = a.filter((p) => p.wd === wd); return [w, { n: a.length, [wd]: f.length, share: r3(f.length / Math.max(1, a.length)), R: r2(f.reduce((s, p) => s + p.n, 0)), R2: r2(f.reduce((s, p) => s + p.n2, 0)) }]; }));
  const wdCount = (P) => P.reduce((m, p) => ({ ...m, [p.wd]: (m[p.wd] || 0) + 1 }), {});
  S.signals = {
    intendedFridayShare: share(vp, 'Fri'),
    baseSundayStubShare: share(bp, 'Sun'), baseFridayShare: share(bp, 'Fri'), baseSaturdayShare: share(bp, 'Sat'),
    baseWeekday: wdCount(bp), intendedWeekday: wdCount(vp),
    baseEntriesOnShutCandle: bp.filter((p) => p.shutEntry).length,
    baseAllPlacementsOnShutCandle: bt.filter((x) => x.k === k && spotClosed(x.opened - 240)).length,
  };
  // ── paired breakdown (positions 2006-07-01..2026-11-06) ──
  const bm = new Map(bp.map((p) => [p.id, p])), vm = new Map(vp.map((p) => [p.id, p]));
  const grp = (rows, key = 'n') => ({ n: rows.length, R: r2(rows.reduce((s, p) => s + p[key], 0)), mean: rows.length ? r3(rows.reduce((s, p) => s + p[key], 0) / rows.length) : null });
  const same = bp.filter((p) => vm.has(p.id) && vm.get(p.id).entry === p.entry && vm.get(p.id).stop === p.stop);
  const changed = bp.filter((p) => vm.has(p.id) && !(vm.get(p.id).entry === p.entry && vm.get(p.id).stop === p.stop));
  const onlyB = bp.filter((p) => !vm.has(p.id)), onlyV = vp.filter((p) => !bm.has(p.id));
  S.paired = {
    identicalSetup: { base: grp(same), intended: grp(same.map((p) => vm.get(p.id))) },
    changedSetup: { base: grp(changed), intended: grp(changed.map((p) => vm.get(p.id))) },
    onlyBase: { ...grp(onlyB), byWeekday: wdCount(onlyB), sundayStub: grp(onlyB.filter((p) => p.wd === 'Sun')) },
    onlyIntended: { ...grp(onlyV), byWeekday: wdCount(onlyV), friday: grp(onlyV.filter((p) => p.wd === 'Fri')) },
  };
  // identical setup but a different outcome = path dependence (a different stop ratchet / add on the folded candles)
  S.paired.identicalSetupDifferentR = same.filter((p) => Math.abs(p.n - vm.get(p.id).n) > 1e-9).length;
  // ── POST-HOC diagnostics (added after the results; not part of the decision) ──
  // (a) is the difference larger than noise? monthly net R (x1, by close month) of each version; the month-by-month difference,
  // its t, and a bootstrap over months (10,000, deterministic) of the total difference
  const months = []; for (let y = 2006; y <= 2026; y++) for (let m = 1; m <= 12; m++) { const s = `${y}-${String(m).padStart(2, '0')}`; if (s >= '2006-07' && s <= '2026-11') months.push(s); }
  const monthly = (res, w) => { const m = new Map(months.map((x) => [x, 0])); for (const p of res.positions.filter((q) => q.sys === k)) { const t = Date.parse(p.t + ':00Z') / 1000; if (t < WIN[w][0] || t >= WIN[w][1]) continue; const mo = p.c.slice(0, 7); if (m.has(mo)) m.set(mo, m.get(mo) + p.n); } return m; };
  S.posthoc = { monthlyDifference: {}, medianStop: {} };
  for (const w of ['oos', 'cal']) {
    const mb = monthly(br, w), mv = monthly(vr, w), d = months.map((x) => mv.get(x) - mb.get(x)).filter((_, i) => { const s = months[i]; return w === 'oos' ? s <= '2018-02' : s >= '2018-01'; });
    const n = d.length, mean = d.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(d.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
    let s = 123456789; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    let le0 = 0; const sums = []; for (let b = 0; b < 10000; b++) { let t = 0; for (let i = 0; i < n; i++) t += d[Math.floor(rnd() * n)]; sums.push(t); if (t <= 0) le0++; }
    sums.sort((a, b) => a - b);
    S.posthoc.monthlyDifference[w] = { months: n, totalDiffR: r2(mean * n), t: r2(mean / sd * Math.sqrt(n)), ci95: [r2(sums[250]), r2(sums[9750])], pDiffLE0: r3(le0 / 10000) };
  }
  // (b) stop size: the first leg's r0 (price units), median by window
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? r2(b[Math.floor(b.length / 2)]) : null; };
  for (const w of ['oos', 'cal']) S.posthoc.medianStop[w] = { base: med(bt.filter((x) => x.k === k && !x.addOf && bp.some((p) => p.id === x.id && p.w === w)).map((x) => x.r0)), intended: med(vt.filter((x) => x.k === k && !x.addOf && vp.some((p) => p.id === x.id && p.w === w)).map((x) => x.r0)) };
  out.systems[k] = S;
}
console.log(JSON.stringify(out, null, 1));
