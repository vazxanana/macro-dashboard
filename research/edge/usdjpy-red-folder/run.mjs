// Edge research · usdjpy-red-folder: red-folder-surprise's design on USD/JPY (PREREGISTRATION.md, pushed alone first).
// Paper research only.
//   node research/edge/usdjpy-red-folder/run.mjs <dir with usdjpy-hd-5m.json.gz from usdjpy-vb-feed fetch>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { loadInputs } from '../../../council/redfolder.mjs';
import { events, firstPrints, analyse } from '../red-folder-surprise/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
export const COST = 0.015;
// returns in % of price around release time t from 5-minute candles keyed by start time
export function around(c5, t) {
  const p0 = c5.get(t - 300), p5 = c5.get(t), p60 = c5.get(t + 3300);
  if (!p0 || !p5 || !p60) return null;
  const a = p0[4], b = p5[4], c = p60[4], pct = (x, y) => (100 * (y - x)) / x;
  return { j5: pct(a, b), j5to60: pct(b, c), j60: pct(a, c) };
}
// the gold study's releases, re-priced on USD/JPY: hot = dollar up = USD/JPY up (the gold study's dir is the opposite)
export function usdjpyEvents(E, c5) {
  const out = []; let missing = 0;
  for (const e of E) {
    const r = around(c5, e.t); if (!r) { missing++; continue; }
    const dir = -e.dir;
    out.push({ type: e.type, d: e.d, t: e.t, cons: e.cons, act: e.act, actSrc: e.actSrc, surprise: e.surprise, dir, g5: +r.j5.toFixed(4), g5to60: +r.j5to60.toFixed(4), g60: +r.j60.toFixed(4), R: +(dir * r.j5to60 - COST).toFixed(4), oos: e.oos });
  }
  return { E: out, missing };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.argv[2], 'usdjpy-hd-5m.json.gz'))));
  const c5 = new Map(rows.map((r) => [r[0], r]));
  const G = events(J('../../../council/event-base.json'), J('../../../council/consensus-history.json'), firstPrints(loadInputs()));
  const { E, missing } = usdjpyEvents(G, c5), A = analyse(E), T2 = A.T2, T1 = A.T1;
  const pp = (p) => (p < 0.0001 ? '< 0.0001' : p), f = (s) => `${s.mean >= 0 ? '+' : '−'}${Math.abs(s.mean).toFixed(3)} % (n ${s.n}, t ${s.t})`;
  const verdict = `${A.verdict}: USD/JPY T+5 → T+60 with the miss after US core CPI and payrolls, after ${COST} %: 2018-21 ${f(T2.inSample)}, 2022 → Apr 2025 ${f(T2.outOfSample)}; the first 5 minutes went the way of the miss on ${T1.all.agree} of ${T1.all.n} (p ${pp(T1.all.p)})`;
  const res = { study: 'usdjpy-red-folder', built: '2026-11-20', cost: COST, gold: G.length, missing, verdict, ...A, events: E };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const R = A.reported, s = (x) => (x && x.n ? f(x) : '—');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Red folder surprise on USD/JPY (20 Nov 2026)', '',
    'Paper research only. Design, cost and bar fixed in `PREREGISTRATION.md` before any USD/JPY return around these releases was computed; releases, consensus and first prints are `red-folder-surprise`\'s own (imported). Nothing live changed.', '',
    `**Verdict: ${verdict}**`, '',
    `Releases: ${G.length} with a miss in the gold study; ${missing} dropped for a missing USD/JPY candle; ${E.length} used.`, '',
    '| | 2018-2021 | 2022 → Apr 2025 |', '|---|---|---|',
    `| T2: T+5 → T+60 with the miss, net | ${s(T2.inSample)} | ${s(T2.outOfSample)} |`,
    `| Gross T+5 → T+60 | ${s(R.grossT5toT60.inSample)} | ${s(R.grossT5toT60.outOfSample)} |`,
    `| Release → T+60 (not tradable) | ${s(R.releaseToT60NotTradable.inSample)} | ${s(R.releaseToT60NotTradable.outOfSample)} |`,
    `| CPI only, net | ${s(T2.byType.CPI.inSample)} | ${s(T2.byType.CPI.outOfSample)} |`,
    `| Payrolls only, net | — | ${s(T2.byType.NFP.outOfSample)} |`, '',
    `T1, the first 5 minutes the way of the miss: ${T1.all.agree} of ${T1.all.n} (${Math.round(T1.all.share * 100)} %, p ${pp(T1.all.p)}); 2018-21 ${T1.inSample.agree} of ${T1.inSample.n}, 2022 → ${T1.outOfSample.agree} of ${T1.outOfSample.n}.`, '',
    `By size of the miss (net, all years): above the median ${s(R.bySize.above)}, at or below ${s(R.bySize.atOrBelow)} (reported after the fact, not tested; the calendar rounds misses, so many sit exactly at the median).`, '',
    'HistData quotes are bid prices; the 0.015 % cost is assumed (the demo\'s USD/JPY spread at a release was not read). A calendar consensus, not a verified survey.', ''].join('\n'));
  console.log(verdict);
}
