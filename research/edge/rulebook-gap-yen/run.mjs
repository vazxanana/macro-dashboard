// Edge research · rulebook-gap-yen: the 2-year against the policy rate, on the yen (PREREGISTRATION.md, pushed alone first).
//   node --use-env-proxy research/edge/rulebook-gap-yen/run.mjs fetch <dir>   (FRED csv + council-data USD/JPY daily)
//   node research/edge/rulebook-gap-yen/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { parseFred, gapRows, testB } from '../rulebook-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FRED = ['DGS2', 'DFEDTARU', 'DFEDTAR'];
// the yen's price in dollars, so the imported tests' signs read the rule book's dollar claims
export const yen = (rows) => rows.map((o) => ({ ...o, v: 1 / o.v }));
const pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const id of FRED) { const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`); if (!r.ok) throw new Error(id + ' ' + r.status); fs.writeFileSync(path.join(dir, id + '.csv'), await r.text()); }
    fs.writeFileSync(path.join(dir, 'usdjpy.json'), execFileSync('git', ['show', 'origin/council-data:research/daily/usdjpy.json'], { maxBuffer: 1 << 28 }));
    console.log('fetched');
  } else if (cmd === 'run') {
    const F = Object.fromEntries(FRED.map((id) => [id, parseFred(fs.readFileSync(path.join(dir, id + '.csv'), 'utf8'))]));
    const Y = yen(dailyRows(JSON.parse(fs.readFileSync(path.join(dir, 'usdjpy.json'), 'utf8'))));
    const rows = gapRows(F.DGS2, F.DFEDTARU, F.DFEDTAR, Y, Y), B = testB(rows);
    // USD/JPY change = minus the yen's log change
    const cls = Object.fromEntries(Object.entries(B.classes).map(([k, c]) => [k, { n: c.n, usdjpy20: c.gold == null ? null : +(-c.gold).toFixed(5) }]));
    const tt = B.tests, line = (k, o) => `${k} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm}, halves t ${o.first.t} / ${o.second.t})`;
    const verdict = `${line('B1 hikes priced → USD/JPY up', tt.B1)}; ${line('B2 cuts priced → USD/JPY down', tt.B2)}`;
    const span = Object.fromEntries(FRED.map((id) => [id, [F[id][0].d, F[id].at(-1).d]]));
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'rulebook-gap-yen', built: '2026-11-20', span, verdict, tests: tt, classes: cls, weeks: rows.length }, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# The 2-year against the policy rate, and the yen (20 Nov 2026)', '',
      'Paper research only. Gauge, sample and bar fixed in `PREREGISTRATION.md`; `rulebook-gauges`\' `gapRows` and `testB` imported unchanged, run on the yen\'s price in dollars (1 / USD/JPY). Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '',
      '| Class (2-year vs the upper policy target) | Weeks | USD/JPY next 20 sessions |', '|---|---|---|',
      ...['hikes', 'flat', 'cuts', 'all'].map((k) => `| ${k === 'all' ? 'All weeks' : k === 'hikes' ? 'Hikes priced (> +25 bp)' : k === 'cuts' ? 'Cuts priced (< −25 bp)' : 'Flat'} | ${cls[k].n} | ${pct(cls[k].usdjpy20)} |`), '',
      'A test passes only with |t| >= 2 in the rule book\'s direction, Holm p < 0.05 and the same sign in 2007-16 and 2017 on.', ''].join('\n'));
    console.log(verdict, JSON.stringify(cls));
  }
}
