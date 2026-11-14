// Edge research · lead-forward-plan, step 1: the four leads' own decisive-window trade lists, read from the pinned commits
// of their study branches with `git show` (read only, no network), written to inputs.json beside this file, plus the demo
// route's symbol list from origin/council-data ctrader/symbols.json (symbols only: never the account or a token).
//   git fetch origin gotobi-cost fx-weekend-gap fx-weekend-gap-replicate2 bond-month-end bond-month-end-futures index-futures-cost council-data
//   node research/edge/lead-forward-plan/extract.mjs
// Per trade: [key date, gross R, charged cost in R] (the cost each study charged = "1x"). Paper research only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(HERE, 'inputs.json');
export const SRC = {
  gotobi: { commit: 'e07e5ca02af9fc11c92323d31288e3256b4a6301', path: 'research/edge/gotobi-cost/trades.json' },
  fxg: { commit: '4c198377121f7ecc01b6fc503a6e90cdd3b8322b', path: 'research/edge/fx-weekend-gap/result.json' },
  fxg2: { commit: 'b70fc26fd77c0eb4b9318b810574271f83747ab6', path: 'research/edge/fx-weekend-gap-replicate2/result.json' },
  bond: { commit: '10805734ffa06cf3ce1d2f69907653d4a6308d58', path: 'research/edge/bond-month-end/result.json' },
  bondFut: { commit: '1e589f01bf9d62893ad0edf448f7ce3733d49e01', path: 'research/edge/bond-month-end-futures/result.json' },
  overnight: { commit: '96d99f7f47a198804dd8c59866fcc08e840e9ac2', path: 'research/edge/index-futures-cost/rows.json.gz' },
  symbols: { commit: 'origin/council-data', path: 'ctrader/symbols.json' },
};
const show = (s) => execFileSync('git', ['show', `${s.commit}:${s.path}`], { cwd: HERE, maxBuffer: 1 << 28 });
const json = (s) => JSON.parse(show(s).toString('utf8'));
const r6 = (x) => +x.toFixed(6);
const ymd = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const row = (k, g, c) => [k, r6(g), r6(c)];

// gotobi's frozen cost (research/edge/gotobi/run.mjs line 106-107, byte for byte in gotobi-cost/frozen.mjs)
export const GOTOBI = { PIP: 0.01, SPREAD_PIPS: 0.3, SLIP_PIPS: 0.5, COMMISSION: 22.5e-6 };
export const gotobiCostPx = (entry) => GOTOBI.SPREAD_PIPS * GOTOBI.PIP + 2 * GOTOBI.SLIP_PIPS * GOTOBI.PIP + 2 * GOTOBI.COMMISSION * entry;

export function extract() {
  const out = { built: '2026-11-14', note: 'per trade [key date, gross R, charged cost R]; read from the pinned commits by extract.mjs', sources: SRC, streams: {} };
  const S = out.streams;
  // L1 / L1b gotobi: [Tokyo day, entry, D, gross R]
  const G = json(SRC.gotobi).trades;
  const gRow = (t) => row(t[0], t[3], gotobiCostPx(t[1]) / t[2]);
  S.L1 = { lead: 'L1', name: 'Gotobi fade, USD/JPY (T2, #878)', src: 'gotobi', from: '2016-01-01', key: 'Tokyo day', tDef: 'month', trades: G.usdjpy.filter((t) => t[0] >= '2016-01-01').map(gRow) };
  S.L1b = { lead: 'L1', name: 'Gotobi fade, four yen crosses pooled (#889 R1)', src: 'gotobi', from: '2010-01-01', key: 'Tokyo day', tDef: 'month',
    trades: ['gbpjpy', 'audjpy', 'cadjpy', 'chfjpy'].flatMap((k) => G[k].filter((t) => t[0] >= '2010-01-01')).map(gRow).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) };
  // L2 / L2b rule G: [pair, Friday, side, entry, r0 pips, target, exit, gross, net base, net stress]
  const fRow = (t) => row(t[1], t[7], t[7] - t[8]);
  const byDay = (a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  S.L2 = { lead: 'L2', name: 'Sunday-gap fade rule G, six majors (#880)', src: 'fxg', from: '2020-01-01', to: '2026-11-12', key: 'Friday', tDef: 'month',
    trades: json(SRC.fxg).trades.G.filter((t) => t[1] >= '2020-01-01').sort(byDay).map(fRow) };
  S.L2b = { lead: 'L2', name: 'Sunday-gap fade rule G, six new pairs (#938 S2)', src: 'fxg2', from: '2016-01-01', to: '2026-11-06', key: 'Friday', tDef: 'month',
    trades: json(SRC.fxg2).trades.S2.filter((t) => t[1] >= '2016-01-01').sort(byDay).map(fRow) };
  // L3 / L3b bond month-end: [entry day, exit day, entry, stop, exit, how, gross, CFD net]
  const B = json(SRC.bond).markets.usb10y.trades.filter((t) => t[0] >= '2016-01-01');
  const rt = json(SRC.bondFut).markets.usb10y.roundTripPts;
  S.L3 = { lead: 'L3', name: 'Bond month-end, USB10Y CFD (#939 T1)', src: 'bond', from: '2016-01-01', key: 'entry day', tDef: 'trade', trades: B.map((t) => row(t[0], t[6], t[6] - t[7])) };
  S.L3b = { lead: 'L3', name: 'Bond month-end, same trades at assumed ZN futures cost (#943)', src: 'bondFut', from: '2016-01-01', key: 'entry day', tDef: 'trade', roundTripPts: rt,
    trades: B.map((t) => row(t[0], t[6], rt / (t[2] - t[3]))) };
  // L4 / L4b overnight: [date, t0, t1, entry, stop, exit, how, gross, CFD net, spreadR, finR, nights]
  const O = JSON.parse(zlib.gunzipSync(show(SRC.overnight))).overnight.tests;
  const oRow = (t) => row(ymd(t[1]), t[7], t[7] - t[8]);
  const oWin = (t) => t[0] >= '2016-01-01' && t[0] <= '2026-10-31';
  S.L4 = { lead: 'L4', name: 'Index overnight long, NAS100 CFD (T2)', src: 'overnight', from: '2016-01-01', to: '2026-10-31', key: 'entry time (UTC date)', tDef: 'month', trades: O.T2.rows.filter(oWin).map(oRow) };
  S.L4b = { lead: 'L4', name: 'Index overnight long, US500 CFD (T1)', src: 'overnight', from: '2016-01-01', to: '2026-10-31', key: 'entry time (UTC date)', tDef: 'month', trades: O.T1.rows.filter(oWin).map(oRow) };
  for (const s of Object.values(S)) { s.to = s.to || s.trades.at(-1)[0]; s.monthFrom = s.from.slice(0, 7); s.monthTo = s.to.slice(0, 7); s.n = s.trades.length; }
  S.L3.monthTo = S.L3b.monthTo = '2026-10';
  // the demo route: symbols only
  const Y = json(SRC.symbols);
  out.demo = { at: Y.at, broker: typeof Y.broker === 'string' ? Y.broker : null, councilDataCommit: execFileSync('git', ['rev-parse', 'origin/council-data'], { cwd: HERE }).toString().trim(),
    markets: Y.markets, symbols: Object.fromEntries(Object.entries(Y.symbols || {}).map(([k, v]) => [k, {
      description: v.description, scheduleTimeZone: v.scheduleTimeZone, schedule: v.scheduleText, commissionRT: v.commissionRT ?? null,
      swapLong: v.swap ? v.swap.long : null, swapType: v.swap ? v.swap.type : null,
      spreadTypical: v.spreadTypical ? { n: v.spreadTypical.n, median: v.spreadTypical.median, from: v.spreadTypical.from, to: v.spreadTypical.to } : null,
      spreadLogWeekdaysUtc: [...new Set((v.spreadLog || []).map((e) => new Date(e[0] * 1000).getUTCDay()))].sort(),
    }])) };
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = extract();
  fs.writeFileSync(OUT, JSON.stringify(o) + '\n');
  for (const [k, s] of Object.entries(o.streams)) console.log(k, s.n, s.monthFrom, s.monthTo);
}
