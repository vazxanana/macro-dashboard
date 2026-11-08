// Edge research · gold-systems-oos: verification of the replay against the council's own record (council-data, read 7 Nov 2026
// 21:28 UTC): every gtrend / gtrend5 / gtl / geg trade in trades.json since each rule went live, and the state values the live
// Trader wrote to snapshot.json at 21:26:49 UTC (the 20- and 5-day highs, the last close, the engulf zone and 20-day average).
//   CANDLES=<dir> node check.mjs <replay trades.json> <council-data trades.json> <council-data snapshot.json> <council-data config.json>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [REP, TR, SNAP, CONF] = process.argv.slice(2);
const DIR = process.env.CANDLES;
const D1 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, 'xau-1d.json.gz')))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const rep = JSON.parse(fs.readFileSync(REP, 'utf8')), live = JSON.parse(fs.readFileSync(TR, 'utf8')), snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')), conf = JSON.parse(fs.readFileSync(CONF, 'utf8'));
const iso = (t) => t == null ? null : new Date(t * 1000).toISOString().slice(0, 16);
// when each rule went live (config.history, by: user)
const since = {}; for (const h of conf.history || []) { const c = h.change || '';
  if (/^Gold trend \(new paper system\)/.test(c)) since.gtrend = Date.parse(h.at) / 1000;
  if (/^Gold trend fast/.test(c)) since.gtrend5 = Date.parse(h.at) / 1000;
  if (/^Gold H4 trendline/.test(c)) since.gtl = Date.parse(h.at) / 1000;
  if (/^Gold daily engulf/.test(c)) since.geg = Date.parse(h.at) / 1000; }
const out = { since: Object.fromEntries(Object.entries(since).map(([k, v]) => [k, iso(v)])), systems: {} };
const pick = (t) => ({ id: t.id, status: t.status, opened: iso(t.opened), filled: iso(t.filled), entry: t.entry, stop: t.stop, r0: t.r0 && +t.r0.toFixed(2), zone: t.zone, R: t.R, closed: iso(t.closed), exit: t.exit });
for (const k of ['gtrend', 'gtrend5', 'gtl', 'geg']) {
  const L = live.filter((x) => x.k === k && x.market === 'xau' && !x.shadow);
  // a replay trade "overlaps" if it is alive at any time after the rule went live
  const R = rep.filter((x) => x.k === k && (x.closed == null || x.closed >= since[k]) && x.opened <= Date.parse('2026-11-07T21:27:00Z') / 1000);
  out.systems[k] = { live: L.map(pick), replay: R.map(pick), sameIds: L.every((x) => R.some((y) => y.id === x.id)) && R.filter((x) => x.opened >= since[k]).every((y) => L.some((x) => x.id === y.id)),
    // the live order was placed on Kraken PAXG candles + basis (the OANDA feed took over on 7 Nov); the replay's is OANDA's
    priceDiff: L.map((x) => { const y = R.find((q) => q.id === x.id); return y ? { entry: +(x.entry - y.entry).toFixed(2), stop: +(x.stop - y.stop).toFixed(2) } : null; }) };
}
// the live state at the snapshot time: the daily window as the live Trader read it (candles that had started, minus the last one)
const at = Date.parse(snap.at || '2026-11-07T21:26:49Z') / 1000;
const D = D1.filter((b) => b.time <= at).slice(-720).slice(0, -1), n = D.length, last = D[n - 1];
const hiN = (N) => Math.max(...D.slice(n - 1 - N, n - 1).map((b) => b.high));
let base = null;
if (last.close > last.open) for (let j = n - 2; j >= n - 1 - 3 && j >= 0; j--) { const b = D[j]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } }
const sma = D.slice(n - 20).reduce((a, b) => a + b.close, 0) / 20;
const r2 = (v) => +v.toFixed(2);
out.state = {
  at: iso(at), lastDaily: iso(last.time),
  goldTrend_hi20: { live: snap.goldTrend?.state?.hi20, replay: r2(hiN(20)) },
  goldTrendFast_hi5: { live: snap.goldTrendFast?.state?.hi20, replay: r2(hiN(5)) },
  lastClose: { live: snap.goldTrend?.state?.lastClose, replay: last.close },
  goldEG_sma20: { live: snap.goldEG?.state?.sma, replay: r2(sma) },
  goldEG_zone: { live: snap.goldEG?.state?.zone, replay: base ? [base.low, base.high] : null, baseDay: base ? iso(base.time) : null },
  feed: snap.feed?.xau,
};
console.log(JSON.stringify(out, null, 1));
