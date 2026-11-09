// Publishes the edge studies for /edge-lab.html. Run by the Vercel build (vercel.json buildCommand) after out/ is made.
// Copies only research/edge/<topic>/result.json and RESULT.md into <out>/research/edge/<topic>/ (scripts, data and
// anything else in a study folder stay private) and writes <out>/research/edge/index.json listing the topics found.
// Usage: node research/edge/build.mjs [outDir=out]
import { readdirSync, existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studyVerdict } from './verdict.mjs';
import { slimStudy } from './lab-summary.mjs';

const src = dirname(fileURLToPath(import.meta.url));
const out = join(process.argv[2] || 'out', 'research', 'edge');
mkdirSync(out, { recursive: true });

const topics = [], lab = [];
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
  const rec = { topic: d.name, result: hasResult, valid, report: hasReport, verdict: v.verdict, headline: v.headline, built: v.built };
  topics.push(rec);
  // the page's one-file summary: only the fields /edge-lab.html reads (see lab-summary.mjs)
  lab.push(valid ? { ...rec, data: slimStudy(data) } : rec);
}
topics.sort((a, b) => a.topic.localeCompare(b.topic));
lab.sort((a, b) => a.topic.localeCompare(b.topic));
// a rebuild of the same studies keeps the previous stamp, so out/ (tracked) stays byte-identical and CI can diff it
const prev = (f) => { try { return JSON.parse(readFileSync(join(out, f), 'utf8')); } catch (e) { return null; } };
const pi = prev('index.json'), pl = prev('lab.json');
const same = pi && pl && pi.generated === pl.generated && JSON.stringify(pi.topics) === JSON.stringify(topics) && JSON.stringify(pl.topics) === JSON.stringify(lab);
const generated = same ? pi.generated : new Date().toISOString();
writeFileSync(join(out, 'index.json'), JSON.stringify({ generated, topics }, null, 1));
writeFileSync(join(out, 'lab.json'), JSON.stringify({ generated, topics: lab }));
console.log(`edge: published ${topics.length} studies to ${out}`);
