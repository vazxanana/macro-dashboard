// Publishes the Macro veteran's research library (research/macro-veteran/, gptmacro_v.1 rev 1.3) to <out>/veteran/ with an
// index.json the Macro desk reads: every document with its title and group, the batch version, the validation summary,
// "what's new" (README.md) and the state of the batch's real CPI pilot. Usage: node scripts/veteran-index.mjs out   (part of scripts/build.sh)
import fs from 'node:fs';
import path from 'node:path';
const SRC = path.resolve(process.argv[2] && process.argv[3] ? process.argv[3] : 'research/macro-veteran');
const OUT = path.join(path.resolve(process.argv[2] || 'out'), 'veteran');
const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), b) : [path.relative(b, path.join(d, e.name)).split(path.sep).join('/')]);
const title = (p, s) => { const m = /^#\s+(.+)$/m.exec(s) || /^title:\s*(.+)$/m.exec(s); return (m ? m[1] : path.basename(p)).replace(/[*`]/g, '').trim().slice(0, 140); };
// groups, in display order; a document lands in the first that matches
const GROUPS = [
  ['Start here', /^(SKILL|BATCH_INDEX|README|START_HERE)\.md$|references\/(research-pack-index|latest-research-batch-status|research-analyst-operating-standard|research-brief-template)/],
  ['Gold and macro frameworks', /references\/(gold-driver-map|cross-asset-macro-regime|funding-collateral|derivatives-positioning|market-expectations|probability-forecast|macro-gold-source|advanced-market|hard-to-get|issuer-and-physical|issuer-fundamental|source-gap|empirical-market|meridianx-research-system)/],
  ['Release integrity and rates study', /references\/(bls-release-integrity|cpi-first-print|treasury-cpi|scripts\/(treasury-cpi|test_treasury))/],
  ['Briefs and cases',/references\/(gold-market-brief|japan-boj|china-|us-bank|gold-producer|integrated-oil|snc-credit|gdp-revision|newmont-cash-flow-model|us-october-2026)/],
  ['CPI pilot and forecast tools', /references\/(cpi-pilot|core-cpi|bls-publication|forecast-|scripts\/)/],
  ['Working notes', /^notes\//],
  ['Data and models', /references\/(newmont-cash-flow-2026|gdp-vintage|research-evidence|research-validation|research-corrections|claude-update)|\.(json|jsonl|xlsx)$/],
  ['Package', /./],
];
export function buildIndex(src = SRC) {
  const files = walk(src).filter((p) => !/\.(zip|sha256)$/.test(p)).sort();
  const docs = files.map((p) => { const full = path.join(src, p), st = fs.statSync(full), text = /\.(md|json|jsonl|mjs|py|txt|tap)$/.test(p) ? fs.readFileSync(full, 'utf8') : '';
    const ext = path.extname(p).slice(1), kind = ext === 'md' ? 'doc' : ext === 'mjs' || ext === 'py' ? 'script' : ext === 'xlsx' ? 'workbook' : ext === 'tap' ? 'log' : 'data';
    return { path: p, title: ext === 'md' ? title(p, text) : path.basename(p), group: GROUPS.find(([, re]) => re.test(p))[0], kind, bytes: st.size, date: (/(20\d\d-\d\d(?:-\d\d)?)/.exec(p) || [])[1] || null }; });
  const skill = fs.readFileSync(path.join(src, 'SKILL.md'), 'utf8'), ver = (/version:\s*"?([\d.]+)/.exec(skill) || [])[1] || null;
  let validation = null; try { validation = JSON.parse(fs.readFileSync(path.join(src, 'validation.json'), 'utf8')); } catch (e) {}
  // README.md's "## What's new in <version>" bullets: plain words for the owner
  let whatsNew = []; try { const rd = fs.readFileSync(path.join(src, 'README.md'), 'utf8'), m = /^## What's new in [\d.]+[^\n]*\n([\s\S]*?)(?=\n## |(?![\s\S]))/m.exec(rd);
    if (m) whatsNew = m[1].split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim()); } catch (e) {}
  const py = validation && validation.packaged_python_tests;
  const tests = validation && (validation.forecast_tests || (py && { tests: py.passed + py.failed, passed: py.passed, kind: 'packaged Python tests' }));
  return { v: 1, builtAt: new Date().toISOString(), skill: 'gptmacro-v-1', version: ver, prepared: (validation && validation.checked_at_utc || '').slice(0, 10) || null, whatsNew, groups: GROUPS.map((g) => g[0]).filter((g) => docs.some((d) => d.group === g)), docs, cpiPilot: cpiPilot(src),
    validation: validation && { checkedAt: validation.checked_at_utc, tests, intervalTests: validation.packaged_interval_tests || null, cpiStatus: validation.cpi_status || null, limits: validation.limits } };
}
// the batch's one real prospective forecast: October 2026 core CPI m/m, issued 8 Nov 2026, resolved by the BLS first print
export function cpiPilot(src = SRC) {
  try {
    const recs = fs.readFileSync(path.join(src, 'references', 'cpi-pilot-forecast-ledger.jsonl'), 'utf8').split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
    const issued = recs.filter((r) => r.record_type === 'issued'), res = recs.filter((r) => r.record_type === 'resolved' || r.record_type === 'resolution');
    return issued.map((r) => { const f = r.forecast || {}, d = f.distribution || {}, rr = res.find((x) => x.forecast_id === r.forecast_id);
      return { forecastId: r.forecast_id, issuedAt: f.issued_at_utc, cutoff: f.information_cutoff_utc, variable: f.target && f.target.variable, reference: 'October 2026', point: d.point_estimate ?? null, unit: d.unit || (f.target && f.target.unit) || null,
        releaseUtc: '2026-11-10T13:30:00Z', deadline: f.target && f.target.deadline_utc, rule: f.resolution_rule && f.resolution_rule.rule, status: rr ? 'resolved' : 'unresolved', outcome: rr ? (rr.resolution && rr.resolution.outcome) ?? null : null, publisherUrl: f.resolution_rule && f.resolution_rule.direct_url }; });
  } catch (e) { return []; }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const idx = buildIndex();
  // unchanged library: keep the previous builtAt, so out/ (tracked) stays byte-identical and CI can diff it
  try { const old = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8'));
    if (JSON.stringify({ ...old, builtAt: 0 }) === JSON.stringify({ ...idx, builtAt: 0 })) idx.builtAt = old.builtAt; } catch (e) {}
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  for (const d of idx.docs) { const to = path.join(OUT, d.path); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(SRC, d.path), to); }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(idx, null, 1));
  // the library page itself (9 Nov 2026): /veteran/ answered 404; it now opens a reader over the same index, #<path> deep links
  fs.copyFileSync(new URL('./veteran-library.html', import.meta.url), path.join(OUT, 'index.html'));
  console.log(`veteran library: ${idx.docs.length} files, version ${idx.version}, CPI pilot ${idx.cpiPilot.length} issued -> ${OUT}`);
}
