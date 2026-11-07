// Edge research · timing: year-by-year check of the windows that were worse in BOTH halves (analyze.mjs "every window"),
// on each setup's baseline: inside vs outside, net and gross, per year.  node research/edge/timing/yearly.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
const OUT = process.argv[2];
const rows = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^[a-z]+-\d{4}\.json$/.test(f))) { const j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); for (const r of j.rows) rows.push(Object.fromEntries(j.cols.map((c, i) => [c, r[i]]))); }
const lastSun = (y, m) => { const d = new Date(Date.UTC(y, m + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };
const nthSun = (y, m, n) => { const d = new Date(Date.UTC(y, m, 1)); return (7 - d.getUTCDay()) % 7 + 1 + 7 * (n - 1); };
const usDst = (t) => { const y = new Date(t * 1000).getUTCFullYear(); return t >= Date.UTC(y, 2, nthSun(y, 2, 2), 7) / 1000 && t < Date.UTC(y, 10, nthSun(y, 10, 1), 6) / 1000; };
for (const x of rows) { const d = new Date(x.opened * 1000); x.h = d.getUTCHours(); x.year = d.getUTCFullYear(); const n = new Date((x.opened + (usDst(x.opened) ? -4 : -5) * 3600) * 1000); x.nymod = n.getUTCHours() * 60 + n.getUTCMinutes(); x.nywd = n.getUTCDay(); x.net = x.R_none - x.cost; }
const SET = {
  scalp: (x) => x.setup === 'scalp' && x.d1 === 'against' && x.market !== 'audusd' && x.rr >= 1.2 && !(x.h < 7 || (x.h >= 12 && x.h < 16)),
  intraday: (x) => x.setup === 'intraday' && x.rr >= 1.2 && x.rr <= 10,
};
const W = { 'after 17:00 UTC': (x) => x.h >= 17, 'NY afternoon 12:00-16:59 NY': (x) => x.nymod >= 720 && x.nymod < 1020, 'Friday after 12:00 NY': (x) => x.nywd === 5 && x.nymod >= 720 };
const m = (a, k = 'net') => a.length ? (a.reduce((q, x) => q + x[k], 0) / a.length).toFixed(3) : '-';
const lines = [];
for (const [s, f] of Object.entries(SET)) for (const [w, g] of Object.entries(W)) {
  const B = rows.filter(f);
  lines.push(`\n${s} · ${w}: per year net inside (n) | outside (n) | inside gross | inside mean cost`);
  let worse = 0, ys = 0;
  for (let y = 2018; y <= 2026; y++) { const a = B.filter((x) => x.year === y && g(x)), b = B.filter((x) => x.year === y && !g(x)); if (!a.length) continue; ys++; if (+m(a) < +m(b)) worse++;
    lines.push(`  ${y}: ${m(a)} (${a.length}) | ${m(b)} (${b.length}) | ${m(a, 'R_none')} | ${m(a, 'cost')} vs ${m(b, 'cost')}`); }
  lines.push(`  worse in ${worse}/${ys} years`);
}
console.log(lines.join('\n'));
