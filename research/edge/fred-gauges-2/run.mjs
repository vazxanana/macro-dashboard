// Edge research · fred-gauges-2: policy uncertainty, breakevens, the St. Louis stress index, steepening after an inversion
// → next 20 sessions (PREREGISTRATION.md, pushed alone first)
//   node --use-env-proxy research/edge/fred-gauges-2/run.mjs fetch <dir>
//   node research/edge/fred-gauges-2/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { parseFred } from '../rulebook-gauges/run.mjs';
import { lastKnown, fridays, tests, classes, MARKETS } from '../fred-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FROM = '2007-01-05';
export const LAG = { USEPUINDXD: 2, T10YIE: 1, STLFSI4: 7, T10Y3M: 1 }, SERIES = Object.keys(LAG);
export const TESTS = [['U', 'xau', 1], ['B', 'xau', 1], ['S', 'usdjpy', -1], ['S', 'spx500', -1], ['Y', 'xau', 1]];
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function readings(F, toT) {
  const fr = fridays(FROM, toT), at = (id, t) => { const i = lastKnown(F[id], t, LAG[id]); return i < 0 ? null : F[id][i].v; };
  const raw = fr.map((f) => { const i = lastKnown(F.USEPUINDXD, f.t, LAG.USEPUINDXD);
    return { ...f, u5: i >= 4 ? mean(F.USEPUINDXD.slice(i - 4, i + 1).map((o) => o.v)) : null, be: at('T10YIE', f.t), st: at('STLFSI4', f.t), yc: at('T10Y3M', f.t) }; });
  return raw.map((r, k) => {
    const p4 = k >= 4 ? raw[k - 4] : null, p13 = k >= 13 ? raw[k - 13] : null, prev = k >= 52 ? raw.slice(k - 52, k) : null;
    let U = null; if (prev && r.u5 != null && prev.every((x) => x.u5 != null)) { const s = prev.map((x) => x.u5).sort((a, b) => a - b); U = r.u5 > s[Math.floor(0.9 * (s.length - 1))]; }
    const B = p4 && r.be != null && p4.be != null ? r.be - p4.be > 0.10 : null;
    const S = p4 && r.st != null && p4.st != null ? r.st > 0 && r.st > p4.st : null;
    const Y = prev && p13 && r.yc != null && p13.yc != null && prev.every((x) => x.yc != null) ? prev.some((x) => x.yc < 0) && r.yc - p13.yc > 0.50 : null;
    return { day: r.day, t: r.t, U, B, S, Y };
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const id of SERIES) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    for (const k of MARKETS) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 }));
    console.log('fetched');
  } else if (cmd === 'run') {
    const F = Object.fromEntries(SERIES.map((id) => [id, parseFred(fs.readFileSync(path.join(dir, id + '.csv'), 'utf8'))]));
    const PX = Object.fromEntries(MARKETS.map((k) => [k, dailyRows(JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')))]));
    const R = readings(F, PX.xau.at(-1).t), T = tests(R, PX, TESTS), C = classes(R, PX, ['U', 'B', 'S', 'Y']), pass = T.filter((o) => o.pass).length;
    const NAME = { U: 'Policy uncertainty spike', B: 'Breakevens rising', S: 'Stress rising (St. Louis)', Y: 'Steepening after an inversion' }, MK = { xau: 'gold', spx500: 'S&P 500', usdjpy: 'USD/JPY' };
    const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const verdict = `${pass ? 'PASS' : 'FAIL'}, ${pass} of ${T.length}: ` + T.map((o) => `${o.sig} → ${MK[o.mk]} ${o.want > 0 ? 'higher' : 'lower'} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm})`).join('; ');
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'fred-gauges-2', built: '2026-11-24', verdict, tests: T, classes: C }, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Policy uncertainty, breakevens, the stress index, steepening after an inversion: the next 20 sessions (24 Nov 2026)', '',
      'Paper research only. Signals, outcome and bar fixed in `PREREGISTRATION.md` before any return was split. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '',
      '| Test | Weeks | Signal weeks | Slope (20 sessions) | t | Holm p | 2007-16 t | 2017 on t | |', '|---|---|---|---|---|---|---|---|---|',
      ...T.map((o) => `| ${NAME[o.sig]} → ${MK[o.mk]} ${o.want > 0 ? 'higher' : 'lower'} | ${o.all.n} | ${o.all.nX} | ${pct(o.all.slope)} | ${o.all.t} | ${o.holm} | ${o.first.t} | ${o.second.t} | ${o.pass ? 'PASS' : 'FAIL'} |`), '',
      '## Class means, next 20 sessions (signal on / off)', '', '| Signal | Weeks on (episodes) | Gold | S&P 500 | USD/JPY |', '|---|---|---|---|---|',
      ...Object.entries(C).map(([s, c]) => `| ${NAME[s]} (from ${c.from}) | ${c.on} of ${c.weeks} (${c.episodes}) | ${pct(c.xau.on.fwd)} / ${pct(c.xau.off.fwd)} | ${pct(c.spx500.on.fwd)} / ${pct(c.spx500.off.fwd)} | ${pct(c.usdjpy.on.fwd)} / ${pct(c.usdjpy.off.fwd)} |`), '',
      'Limits: the stress index is re-estimated over its history; Y has few episodes; consecutive 20-session outcomes overlap.', ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(C));
  }
}
