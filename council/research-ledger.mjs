// Research ledger (8 Nov 2026, owner: the council ran ~20 pre-registered studies in two days and the only place to see them was
// PR history). One row per study in research/edge/<topic>/ (result.json and/or RESULT.md): what was tested, when it landed, the
// verdict, a one-line headline, the systems it touches and the PR that merged it. Pure functions build the rows from the files;
// `main` writes them to council-data research/ledger.json from the council loop (council.yml, every 3rd round), where the site
// (/cdata/research/ledger.json), the daily digest ("New study: …") and the week pane ("Studies") read them. Nothing here changes
// a rule, a trade or a study: it only reads the studies' own words.
//
// The verdict class (pass / fail / inc) and the headline are the Edge lab's own reading of each study (research/edge/verdict.mjs
// studyVerdict: result.json `verdict`, else the RESULT.md "Verdict" line, else the candidates table), so the ledger, the digest, the
// week pane and /edge-lab.html say the same thing; a study with no readable verdict is 'inc' with a note for its headline.
//
//   node council/research-ledger.mjs <council-data dir> [--dry]      --dry prints the rows and writes nothing
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { studyVerdict as edgeVerdict, plain } from '../research/edge/verdict.mjs';

export const EDGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge');
export const REPO = 'vazxanana/macro-dashboard';
export const VERDICTS = { pass: 'Pass', fail: 'Fail', inc: 'Inconclusive' };   // the Edge lab's classes (research/edge/verdict.mjs)
const VERDICT_ORDER = ['pass', 'inc', 'fail'];
export const EDGE_LAB = 'edge-lab.html#';
// readable names for topics whose folder name says too little (the rest are title-cased)
export const NAMES = {
  'ict-oos-2008': 'ICT A-setups 2008-17 (out of sample)', 'replica-oos': 'Gold replica out of sample', 'gold-systems-oos': 'Gold daily systems out of sample',
  'nq-open-oos': 'NQ open run 22 years', 'nq-open-exits': 'NQ open run exits', 'open-run-breadth': 'Open run on other indices', 'ict-breadth': 'ICT on other markets',
  'ict-smile': 'ICT x Dollar Smile', 'ict-macro': 'ICT x macro regime', 'ict-exits-replay': 'ICT exits on the desk replay', 'ict-index-longonly': 'ICT index long-only',
  'ict-trend-side': 'ICT trend-side filter', 'crypto-trend-decay': 'Crypto trend decay', 'decay-monitor': 'Edge-decay monitor', 'param-drift': 'Parameter-drift audit',
  'coach-learning': 'Coach self-learning', 'setups-promote': 'Setup promotion', 'macro-vol': 'Macro move-size models', 'macro-gold': 'Macro gold rule (real yields)',
  'gold-weekend': 'Gold weekend handling', 'event-risk': 'Event risk (CPI / NFP / FOMC)', 'regime-switch': 'Regime switch indicators', 'portfolio-v2': 'Portfolio v2 (walk-forward weights)',
};
const UPPER = { ict: 'ICT', nq: 'NQ', oos: 'OOS', fx: 'FX', es: 'ES', adx: 'ADX' };
export const titleCase = (t) => String(t).split(/[-_]+/).map((w, i) => UPPER[w] || (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
export const nameOf = (topic) => NAMES[topic] || titleCase(topic);

const clean = (s) => String(s || '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
// trim to n characters at a sentence or word boundary
export function trim(s, n = 160) {
  s = clean(s); if (s.length <= n) return s;
  const cut = s.slice(0, n), dot = cut.search(/[.;:!?](?=\s[^.;:!?]*$)/);
  if (dot > n * 0.35) return cut.slice(0, dot + 1);
  return cut.replace(/\s+\S*$/, '').replace(/[,;:(\-–—\s]+$/, '') + '…';
}
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const isoDate = (v) => { const t = Date.parse(v); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null; };
// "(7 Nov 2026)" / "8 November 2026" in a report title
export function dateInText(s) {
  const m = /\b(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(20\d{2})\b/.exec(String(s || '')), mo = m && MONTHS[m[2].toLowerCase()];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// ─── reading a study folder ───
export function readStudy(edgeDir, topic) {
  const dir = path.join(edgeDir, topic), rd = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { return null; } };
  const raw = rd('result.json'), md = rd('RESULT.md');
  let result = null, valid = raw == null;
  if (raw != null) { try { result = JSON.parse(raw); valid = !!result && typeof result === 'object'; } catch (e) { valid = false; } }
  if (raw == null && md == null) return null;
  return { topic, result: valid ? result : null, md, hasResult: raw != null, valid, hasReport: md != null, prereg: fs.existsSync(path.join(dir, 'preregistration.md')) };
}
export const listTopics = (edgeDir = EDGE_DIR) => fs.readdirSync(edgeDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[a-z0-9][a-z0-9_-]*$/i.test(d.name)).map((d) => d.name).sort();

// ─── verdict + headline (the Edge lab's reading, research/edge/verdict.mjs) ───
const verdictText = (v) => typeof v === 'string' ? v : v && typeof v === 'object' ? [v.verdict, v.primary, v.label, v.status, v.decision].filter((x) => typeof x === 'string').join('; ') : '';
const cutTwo = (s) => { const m = /^(?:[^.!?]*[.!?]){1,2}/.exec(String(s)); return m ? m[0] : String(s); };
// {verdict, headline, built, title} for one study: studyVerdict of research/edge/verdict.mjs, with a headline and a built date
// filled in where it has none (a report without a "Verdict" line takes its opening sentence; numbers only, a note)
export function studyVerdict({ topic, result, md }) {
  const R = result || {}, v = edgeVerdict(result, md || '');
  const title = md ? clean((/^#\s+(.+)$/m.exec(md) || [])[1]) : '';
  let headline = v.headline || '';
  if (!headline) {
    const opening = md ? (md.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^#/.test(l) && !/^[|>]/.test(l))[0] || '') : '';
    headline = opening ? cutTwo(plain(opening)) : verdictText(R.verdict) || (typeof R.note === 'string' && clean(R.note)) || (R.system ? `Numbers only (no RESULT.md): ${clean(R.system)}` : 'Numbers only, no RESULT.md yet');
  }
  const verdict = VERDICTS[v.verdict] ? v.verdict : 'inc';
  return { verdict, headline: capital(trim(headline, 220)), built: v.built || dateInText(title) || null, title: trim(title, 140) };   // 220 = verdict.mjs cut: the Edge lab's headline stays whole
}

// ─── the rest of a row ───
// the systems a study touches, from its topic and title (the `system` line of result.json names data sources too, so it only
// adds the systems it names outright)
const SYSTEMS = [[/\bict\b|ifvg/i, /\bICT\b/, 'ICT desk'], [/nq[- ]open|open run|nyflip|new york open/i, /nq[- ]open|open run/i, 'NQ open run'],
  [/\bgold\b|replica|gtrend|\bgeg\b|\bgtl\b|mosha/i, /replica|gtrend|\bgeg\b|\bgtl\b|mosha|gold (book|systems|trend|daily|replica)/i, 'Gold book'],
  [/meridian|scalp|swing|intraday|coach|engine setups?/i, /meridian|scalp|swing|intraday|coach/i, 'Meridian'], [/crypto|\bbtc\b/i, /crypto/i, 'Crypto trend'],
  [/macro|dollar smile|real yield/i, /macro|dollar smile/i, 'Macro desk']];
export function systemsOf({ topic, result, title }) {
  const own = `${titleCase(topic)} ${title || ''}`, sys = (result && typeof result.system === 'string') ? result.system : '';
  const out = SYSTEMS.filter(([re, re2]) => re.test(own) || re2.test(sys)).map(([, , n]) => n);
  if (/^(portfolio|sizing|decay-monitor|robustness|costs|param-drift|seasonality|regime-switch|event-risk|news-filter)/.test(topic) || !out.length) out.push('Council-wide');
  return out;
}
export const citedPRs = (md) => [...new Set((String(md || '').match(/(?<![\w/])#(\d{2,4})\b/g) || []).map((s) => +s.slice(1)))].sort((a, b) => a - b);

export function studyRow(study) {
  if (!study) return null;
  const v = studyVerdict(study);
  return { topic: study.topic, name: nameOf(study.topic), title: v.title || nameOf(study.topic), built: v.built, verdict: v.verdict, headline: v.headline,
    systems: systemsOf({ topic: study.topic, result: study.result, title: v.title }), pr: null, cites: citedPRs(study.md), prereg: study.prereg, report: study.hasReport,
    result: study.hasResult && study.valid, link: EDGE_LAB + encodeURIComponent(study.topic) };
}
// every committed study as a row (studies with neither result.json nor RESULT.md are skipped, as research/edge/build.mjs does)
export const ledgerRows = (edgeDir = EDGE_DIR) => listTopics(edgeDir).map((t) => studyRow(readStudy(edgeDir, t))).filter(Boolean);

// ─── when it landed, and which PR ───
// From git when the checkout has the history: the last commit on the study's report / result; the squash-merge subject "… (#550)"
// names the PR. In a shallow clone a file untouched since the boundary resolves to the boundary commit, which says nothing
// about the study, so such answers are refused (the Actions checkout is depth 1: every answer is refused and the API is asked).
export function gitLanded(edgeDir, topic) {
  try {
    const cwd = path.dirname(path.dirname(edgeDir)), git = (a) => execFileSync('git', a, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const out = git(['log', '-1', '--format=%H%n%cI%n%s', '--', `research/edge/${topic}/RESULT.md`, `research/edge/${topic}/result.json`]);
    if (!out) return null;
    const [hash, at, subject = ''] = out.split('\n');
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
      let shallow = ''; try { shallow = fs.readFileSync(git(['rev-parse', '--git-path', 'shallow']), 'utf8'); } catch (e) { shallow = ''; }
      if (!shallow || shallow.includes(hash)) return null;
    }
    const m = /\(#(\d+)\)\s*$/.exec(subject);
    return { at: new Date(at).toISOString(), pr: m ? +m[1] : null };
  } catch (e) { return null; }
}
// From the GitHub commits API (the council loop's shallow checkout; GH_TOKEN is the Actions token, read only here)
export async function apiLanded(topic, { fetchFn = fetch, token = null, repo = REPO } = {}) {
  try {
    const q = `path=${encodeURIComponent(`research/edge/${topic}`)}&sha=main&per_page=1`;
    const r = await fetchFn(`https://api.github.com/repos/${repo}/commits?${q}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'council-research-ledger', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const J = await r.json(), c = Array.isArray(J) && J[0];
    if (!c || !c.commit) return null;
    const m = /\(#(\d+)\)\s*$/.exec(String(c.commit.message || '').split('\n')[0]);
    return { at: new Date(c.commit.committer && c.commit.committer.date || c.commit.author.date).toISOString(), pr: m ? +m[1] : null };
  } catch (e) { return null; }
}

// ─── the ledger file ───
// prev: the last ledger.json (its first-seen times and PRs are kept); rows: today's rows; landed(topic) → { at, pr } | null, asked
// only for topics the last ledger did not resolve. first = when the study landed (git / API), else its built date, else now.
export async function buildLedger(rows, prev, { now = Math.floor(Date.now() / 1000), landed = async () => null } = {}) {
  const P = Object.fromEntries(((prev && prev.rows) || []).map((r) => [r.topic, r])), out = [];
  for (const r of rows) {
    const p = P[r.topic] || {};
    let first = p.first || null, pr = p.pr || null;
    if (!first || (!pr && !p.looked)) {
      const g = await landed(r.topic);
      if (g) { first = first || g.at; pr = pr || g.pr; }
    }
    if (!first) first = r.built ? `${r.built}T00:00:00.000Z` : new Date(now * 1000).toISOString();
    out.push({ ...r, pr, first, looked: true });
  }
  out.sort((a, b) => (b.first < a.first ? -1 : b.first > a.first ? 1 : a.topic.localeCompare(b.topic)));
  const byVerdict = {}; for (const k of VERDICT_ORDER) byVerdict[k] = out.filter((r) => r.verdict === k).length;
  return { at: new Date(now * 1000).toISOString(), count: out.length, byVerdict, rows: out };
}
// the studies that landed in (from, to] (unix seconds), newest first
export const landedIn = (ledger, from, to) => ((ledger && Array.isArray(ledger.rows)) ? ledger.rows : []).filter((r) => { const t = Date.parse(r.first || (r.built && `${r.built}T00:00:00Z`)) / 1000; return t > from && t <= to; })
  .sort((a, b) => Date.parse(b.first || 0) - Date.parse(a.first || 0));
const countTxt = (L) => VERDICT_ORDER.map((k) => [k, L.filter((r) => r.verdict === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${VERDICTS[k].toLowerCase()}`).join(', ');
// Digest lines. daily: one line on the day a study lands ("New study: <name> — <headline>"); preview (Sunday): a "Research this
// week" block, the count by verdict and up to three studies. Nothing when nothing landed (the preview says so in one line).
export function researchLines(ledger, now, kind = 'daily') {
  const L = landedIn(ledger, now - (kind === 'preview' ? 7 : 1) * 86400, now);
  if (kind !== 'preview') return L.length ? [`New study: ${L[0].name} — ${trim(L[0].headline, 120)}${L.length > 1 ? ` (+${L.length - 1} more)` : ''}`] : [];
  if (!ledger || !Array.isArray(ledger.rows)) return [];
  if (!L.length) return ['Research this week: no new study.'];
  return [`Research this week: ${L.length} stud${L.length === 1 ? 'y' : 'ies'} (${countTxt(L)}):`, ...L.slice(0, 3).map((r) => `• ${r.name}: ${trim(r.headline, 100)}`), ...(L.length > 3 ? [`• +${L.length - 3} more in the Edge lab`] : [])];
}

export async function main(dir, { edgeDir = EDGE_DIR, now = Math.floor(Date.now() / 1000), dry = false, fetchFn = fetch, env = process.env } = {}) {
  const file = path.join(dir, 'research', 'ledger.json');
  let prev = null; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { prev = null; }
  const rows = ledgerRows(edgeDir), token = env.GH_TOKEN || env.GITHUB_TOKEN || null;
  const landed = async (topic) => gitLanded(edgeDir, topic) || (env.LEDGER_NO_API ? null : apiLanded(topic, { fetchFn, token }));
  const ledger = await buildLedger(rows, prev, { now, landed });
  const prevSig = prev && JSON.stringify((prev.rows || []).map((r) => [r.topic, r.verdict, r.headline, r.built, r.pr, r.first]));
  const sig = JSON.stringify(ledger.rows.map((r) => [r.topic, r.verdict, r.headline, r.built, r.pr, r.first]));
  if (dry) return { dry: true, ledger };
  if (prevSig === sig) return { unchanged: true, count: ledger.count };   // the loop commits only real changes
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 1) + '\n');
  return { written: true, count: ledger.count, byVerdict: ledger.byVerdict, file };
}

if (process.argv[1] && process.argv[1].endsWith('research-ledger.mjs')) {
  const args = process.argv.slice(2), dir = args.find((a) => !a.startsWith('--')) || 'data';
  main(dir, { dry: args.includes('--dry') }).then((r) => {
    if (r.dry) { for (const x of r.ledger.rows) console.log(`${x.first.slice(0, 10)} ${x.verdict.padEnd(6)} ${x.pr ? `#${x.pr}` : '    '} ${x.topic.padEnd(20)} ${x.systems.join('+').padEnd(26)} ${x.headline}`); console.log(JSON.stringify(r.ledger.byVerdict)); return; }
    console.log(`Research ledger: ${r.unchanged ? 'unchanged' : 'written'} (${r.count} studies${r.byVerdict ? `: ${JSON.stringify(r.byVerdict)}` : ''})`);
  }).catch((e) => { console.log('Research ledger failed:', (e && e.message) || e); });   // never fails the round
}
