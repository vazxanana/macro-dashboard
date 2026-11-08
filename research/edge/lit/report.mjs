// Renders the tables of RESULT.md from result.json (node research/edge/lit/report.mjs [result.json] > tables.md). The verdict line and the
// reading at the top of RESULT.md are written by hand from the same numbers; this file only lays the numbers out.
import fs from 'node:fs';
const res = JSON.parse(fs.readFileSync(process.argv[2] || 'research/edge/lit/result.json', 'utf8'));
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '—' : (+x).toFixed(d));
const pct = (x) => (x == null ? '—' : (100 * x).toFixed(0) + '%');
const ci = (m) => (m ? `${f(m.margin, 3)} [${f(m.lo, 3)}, ${f(m.hi, 3)}]` : '—');
const row = (name, s, m) => `| ${name} | ${s.n} | ${pct(s.win)} | ${f(s.avgR)} | ${f(s.exp, 3)} | ${f(s.t)} | ${f(s.total, 1)} | ${f(s.exp2, 3)} | ${f(s.maxDD, 1)} | ${s.streak ?? '—'} | ${f(s.perYear, 1)} | ${ci(m)} |`;
const HEAD = '| set | n | win | avg R gross | exp net x1 | t | total R | exp x2 | max DD | streak | trades/yr | margin vs random [95% CI] |\n|---|---|---|---|---|---|---|---|---|---|---|---|';
const out = [];
for (const [mk, m] of Object.entries(res.markets)) {
  out.push(`\n## ${m.label} — ${m.m5.toLocaleString()} 5m candles ${m.from} … ${m.to}\n`);
  for (const [id, s] of Object.entries(m.sets)) {
    for (const cap of ['cap', 'uncapped']) {
      const S = s[cap]; if (!S) continue;
      const tag = `${s.set === 'div' ? 'XAG-div filter' : 'standard'}, ${s.variant}${cap === 'cap' ? '' : ', uncapped (S1)'}${s.primary && cap === 'cap' ? ' — PRIMARY' : ''}`;
      out.push(`\n### ${tag}\n\nOrders ${S.orders}, filled ${S.filled}, taken ${S.taken} (unfilled: ${Object.entries(S.unfilled).map(([k, v]) => `${k} ${v.n}`).join(', ') || 'none'}). Verdict on the bar: **${S.judge.verdict}**${S.judge.reasons.length ? ' — ' + S.judge.reasons.join('; ') : ''}.\n`);
      out.push(HEAD);
      for (const w of ['A', 'B']) {
        const W = S.windows[w]; if (!W.all.n) { out.push(`| ${W.label} | 0 | | | | | | | | | | |`); continue; }
        out.push(row(`**${W.label}**`, W.all, W.ctrl));
        for (const [h, hs] of Object.entries(W.halves)) if (hs.n) out.push(row(`  ${h}`, hs));
        for (const [k, v] of Object.entries(W.bySession)) out.push(row(`  ${W.label} ${k}`, v, v.ctrl));
        for (const [k, v] of Object.entries(W.byDir)) out.push(row(`  ${W.label} ${k}`, v, v.ctrl));
      }
      if (s.primary && cap === 'cap' || (cap === 'uncapped' && s.variant === 'wick-open')) {
        out.push(`\nBy year (net x1): ` + ['A', 'B'].flatMap((w) => Object.entries(S.windows[w].byYear).map(([y, v]) => `${y} ${v.n}/${f(v.exp, 2)}`)).join(' · '));
        out.push(`\nBy level (net x1, both windows): ` + ['A', 'B'].flatMap((w) => Object.entries(S.windows[w].byLevel).map(([y, v]) => `${w} ${y} ${v.n}/${f(v.exp, 2)}`)).join(' · '));
        out.push(`\nBy exit: ` + ['A', 'B'].flatMap((w) => Object.entries(S.windows[w].byExit).map(([y, v]) => `${w} ${y} ${v.n}/${f(v.exp, 2)}`)).join(' · '));
      }
    }
  }
  out.push(`\n### Funnel (${m.label})\n`);
  for (const [set, fu] of Object.entries(m.funnel)) out.push(`- ${set}: ${Object.entries(fu).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const [id, s] of Object.entries(m.sets)) out.push(`- ${id} build: ${Object.entries(s.build).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
process.stdout.write(out.join('\n') + '\n');
