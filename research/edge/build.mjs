// Publishes the edge studies for /edge-lab.html. Run by the Vercel build (vercel.json buildCommand) after out/ is made.
// Copies only research/edge/<topic>/result.json and RESULT.md into <out>/research/edge/<topic>/ (scripts, data and
// anything else in a study folder stay private) and writes <out>/research/edge/index.json listing the topics found.
// Usage: node research/edge/build.mjs [outDir=out]
import { readdirSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyVerdict } from './verdict.mjs';

const src = dirname(fileURLToPath(import.meta.url));
const out = join(process.argv[2] || 'out', 'research', 'edge');
mkdirSync(out, { recursive: true });

const topics = [];
for (const d of readdirSync(src, { withFileTypes: true })) {
  if (!d.isDirectory() || !/^[a-z0-9][a-z0-9_-]*$/i.test(d.name)) continue;
  const dir = join(src, d.name), res = join(dir, 'result.json'), md = join(dir, 'RESULT.md');
  const hasResult = existsSync(res), hasReport = existsSync(md);
  if (!hasResult && !hasReport) continue;
  mkdirSync(join(out, d.name), { recursive: true });
  let valid = false, data = null;
  if (hasResult) {
    copyFileSync(res, join(out, d.name, 'result.json'));
    try { data = JSON.parse(readFileSync(res, 'utf8')); valid = true; } catch (e) { console.warn(`edge: ${d.name}/result.json is not valid JSON`); }
  }
  if (hasReport) copyFileSync(md, join(out, d.name, 'RESULT.md'));
  // the one-line verdict and its class (pass / fail / inc), read from result.json and the RESULT.md "Verdict" line
  const v = studyVerdict(data, hasReport ? readFileSync(md, 'utf8') : '');
  topics.push({ topic: d.name, result: hasResult, valid, report: hasReport, verdict: v.verdict, headline: v.headline, built: v.built });
}
topics.sort((a, b) => a.topic.localeCompare(b.topic));
writeFileSync(join(out, 'index.json'), JSON.stringify({ generated: new Date().toISOString(), topics }, null, 1));
console.log(`edge: published ${topics.length} studies to ${out}`);
