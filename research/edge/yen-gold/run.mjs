// Edge research · yen-gold: does a 4-week fall in USD/JPY lead gold? (PREREGISTRATION.md, pushed alone first)
//   node research/edge/yen-gold/run.mjs fetch <dir>   (git show from origin/council-data, no network)
//   node research/edge/yen-gold/run.mjs run <dir>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dailyRows } from '../../../council/macroscore.mjs';
import { nwSlope } from '../rulebook-gauges/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), FROM = '2007-01-05', HALF = '2017-01-01', TH = 0.02, N = 20, DAY = 86400;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null), r4 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(4));
const pN = (t) => { const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z), d = 0.3989423 * Math.exp(-z * z / 2); return 2 * d * k * (0.3193815 + k * (-0.3565638 + k * (1.781478 + k * (-1.821256 + k * 1.330274)))); };
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
export function rows(fx, gold) {
  const gi = new Map(gold.map((o, i) => [o.t, i])), out = [];
  for (let i = N; i < fx.length; i++) {
    const o = fx[i], d = iso(o.t); if (d < FROM || new Date(o.t * 1000).getUTCDay() !== 5) continue;
    const g0 = gi.get(o.t); if (g0 == null || g0 < N) continue;            // gold's same Friday close
    if (g0 + 1 + N >= gold.length || gold[g0 + 1].t - o.t > 4 * DAY) continue;
    const y4 = Math.log(o.v / fx[i - N].v), fwd = Math.log(gold[g0 + 1 + N].v / gold[g0 + 1].v), co = Math.log(gold[g0].v / gold[g0 - N].v);
    out.push({ day: d, y4: +y4.toFixed(5), cls: y4 < -TH ? 'strong' : y4 > TH ? 'weak' : 'flat', fwd: +fwd.toFixed(5), co: +co.toFixed(5) });
  }
  return out;
}
export function tests(R) {
  const one = (rs, cls) => { const w = nwSlope(rs.map((r) => r.fwd), rs.map((r) => (r.cls === cls ? 1 : 0))); return { n: rs.length, nX: rs.filter((r) => r.cls === cls).length, slope: r4(w.b), t: w.t == null ? null : +w.t.toFixed(2) }; };
  const T = { S: { cls: 'strong', want: 1 }, W: { cls: 'weak', want: -1 } }, out = {};
  for (const [k, d] of Object.entries(T)) out[k] = { want: d.want, all: one(R, d.cls), first: one(R.filter((r) => r.day < HALF), d.cls), second: one(R.filter((r) => r.day >= HALF), d.cls) };
  const ps = Object.values(out).map((o) => (o.all.t == null ? 1 : pN(o.all.t))), idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let run = 0; const H = [];
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, p * (ps.length - r))); H[i] = run; });
  Object.values(out).forEach((o, i) => { o.holm = +H[i].toFixed(4); o.pass = o.all.t != null && Math.sign(o.all.t) === o.want && Math.abs(o.all.t) >= 2 && o.holm < 0.05 && Math.sign(o.first.slope) === o.want && Math.sign(o.second.slope) === o.want; });
  return out;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch') { fs.mkdirSync(dir, { recursive: true }); for (const k of ['xau', 'usdjpy']) fs.writeFileSync(path.join(dir, k + '.json'), execFileSync('git', ['show', `origin/council-data:research/daily/${k}.json`], { maxBuffer: 1 << 28 })); console.log('fetched'); }
  else if (cmd === 'run') {
    const L = (k) => dailyRows(JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')));
    const R = rows(L('usdjpy'), L('xau')), T = tests(R), pct = (x) => (x == null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(100 * (Math.exp(x) - 1)).toFixed(2)} %`);
    const cls = Object.fromEntries(['strong', 'flat', 'weak'].map((c) => { const xs = R.filter((r) => r.cls === c).map((r) => r.fwd); return [c, { n: xs.length, fwd: r4(mean(xs)), upShare: xs.length ? +(xs.filter((v) => v > 0).length / xs.length).toFixed(3) : null }]; }));
    cls.all = { n: R.length, fwd: r4(mean(R.map((r) => r.fwd))) };
    const mx = mean(R.map((r) => r.y4)), my = mean(R.map((r) => r.co)), corr = R.reduce((s, r) => s + (r.y4 - mx) * (r.co - my), 0) / Math.sqrt(R.reduce((s, r) => s + (r.y4 - mx) ** 2, 0) * R.reduce((s, r) => s + (r.co - my) ** 2, 0));
    const line = (k, lbl, o) => `${k} ${lbl} ${o.pass ? 'PASS' : 'FAIL'} (t ${o.all.t}, Holm ${o.holm}, halves t ${o.first.t} / ${o.second.t})`;
    const verdict = `${line('S', 'USD/JPY down > 2 % in 4 weeks → gold higher', T.S)}; ${line('W', 'USD/JPY up > 2 % → gold lower', T.W)}`;
    const res = { study: 'yen-gold', built: '2026-11-20', span: [R[0].day, R.at(-1).day], verdict, tests: T, classes: cls, coincidentCorr: r4(corr), weeks: R.length };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# Does a falling USD/JPY lead gold? (20 Nov 2026)', '',
      'Paper research only. Signal, outcome and bar fixed in `PREREGISTRATION.md` before any gold return was split by USD/JPY moves. Nothing live changed; the Gold Macro Score is unchanged.', '',
      `**Verdict: ${verdict}**`, '', `Weekly readings ${res.span[0]} → ${res.span[1]} (${R.length}).`, '',
      '| USD/JPY over the last 4 weeks | Weeks | Gold next 20 sessions | Share up |', '|---|---|---|---|',
      ...['strong', 'flat', 'weak'].map((c) => `| ${c === 'strong' ? 'Down > 2 % (yen strong)' : c === 'weak' ? 'Up > 2 % (yen weak)' : 'Flat'} | ${cls[c].n} | ${pct(cls[c].fwd)} | ${Math.round(100 * cls[c].upShare)} % |`),
      `| All weeks | ${R.length} | ${pct(cls.all.fwd)} | |`, '',
      `Reported: same-4-week correlation of USD/JPY's change with gold's change ${r4(corr)}.`, ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(cls), 'corr', r4(corr));
  }
}
