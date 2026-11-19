// Study index (14 Nov 2026): one owner-facing list of every pre-registered study in research/edge/<topic>/, merged on main or
// still on a branch (most new studies wait in open draft pull requests, so the Edge lab and the research ledger, which read
// main only, do not show them; two studies were nearly repeats of earlier ones for that reason).
//
// Read only: it lists the remote branches, diffs each against main, reads files with `git show` and, unless --no-gh, reads the
// open pull request numbers with `gh api` (read only; left blank when gh is not available). It writes two files and nothing else:
// research/proposals/study-index.json and research/proposals/study-index.md. No study, rule or trade is touched.
//
//   git fetch origin && node scripts/study-index.mjs [--repo <dir>] [--out <dir>] [--main origin/main] [--no-gh]
//
// The verdict class is the Edge lab's own reading (research/edge/verdict.mjs studyVerdict), with two extra labels read from the
// study's words: "not measurable" (the study says it could not measure its question) and the replicate-type flag (a study that
// repeats an earlier one on new data). Figures (n, net R, t) are only what the study's verdict text states; nothing is computed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { studyVerdict, headlineParts, plain, cut } from '../research/edge/verdict.mjs';

export const REPO_SLUG = 'vazxanana/macro-dashboard';
export const CLASSES = ['gold', 'indices', 'forex', 'rates', 'commodities', 'crypto', 'cross-asset', 'meta'];
export const CLASS_NAMES = {
  gold: 'Gold', indices: 'Indices', forex: 'Forex', rates: 'Rates', commodities: 'Commodities', crypto: 'Crypto',
  'cross-asset': 'Cross-asset', meta: 'Accounting / meta',
};
export const VERDICT_NAMES = { pass: 'PASS', fail: 'FAIL', inc: 'Inconclusive', nm: 'Not measurable', '': 'Verdict not read' };

// ---------- git ----------
function git(repo, args, opts = {}) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}
function gitOr(repo, args, dflt = null) { try { return git(repo, args); } catch { return dflt; } }
export function show(repo, ref, file) { return gitOr(repo, ['show', `${ref}:${file}`]); }

// remote branches, without HEAD and main
export function remoteBranches(repo, remote = 'origin', main = 'main') {
  const out = gitOr(repo, ['for-each-ref', `refs/remotes/${remote}`, '--format=%(refname:short)%09%(committerdate:iso-strict)'], '');
  return out.split('\n').filter(Boolean).map((l) => { const [ref, date] = l.split('\t'); return { ref, name: ref.slice(remote.length + 1), date }; })
    .filter((b) => b.name && b.name !== 'HEAD' && b.name !== main && b.ref !== remote);
}

// topics (folders directly under research/edge/) a ref holds with a RESULT.md or result.json
export function topicsAt(repo, ref) {
  const out = gitOr(repo, ['ls-tree', '-r', '--name-only', ref, '--', 'research/edge/'], '');
  const set = new Set();
  for (const f of out.split('\n')) { const m = /^research\/edge\/([^/]+)\/(RESULT\.md|result\.json)$/.exec(f); if (m) set.add(m[1]); }
  return set;
}

// topics a branch adds or changes against main (three dots: since the merge base); two dots when there is no merge base
export function changedTopics(repo, mainRef, ref) {
  let out = gitOr(repo, ['diff', '--name-only', `${mainRef}...${ref}`, '--', 'research/edge/']);
  if (out == null) out = gitOr(repo, ['diff', '--name-only', mainRef, ref, '--', 'research/edge/'], '');
  const set = new Set();
  for (const f of out.split('\n')) { const m = /^research\/edge\/([^/]+)\//.exec(f); if (m) set.add(m[1]); }
  return set;
}
const blob = (repo, ref, file) => { const s = gitOr(repo, ['rev-parse', '--verify', '-q', `${ref}:${file}`]); return s ? s.trim() : null; };

// ---------- reading one study ----------
const stripMd = (s) => plain(String(s || '').replace(/^#+\s*/, ''));
export function titleOf(md) {
  const l = String(md || '').split(/\r?\n/).find((x) => /^#\s+/.test(x));
  if (!l) return '';
  return stripMd(l).replace(/^(pre-?registration|result|results)\s*[:.-]\s*/i, '').replace(/\s*[:.-]\s*pre-?registration\s*$/i, '')
    .replace(/\s*\((\d{1,2} \w{3,9} \d{4}|pre-registered)\)\s*$/i, '').replace(/\s*[:.-]\s*results?\s*$/i, '').trim();
}
// the first paragraph under the first heading that names the rule (or the first paragraph after the title)
export function ruleParagraph(md) {
  const lines = String(md || '').split(/\r?\n/);
  let i = lines.findIndex((l) => /^#{2,4}\s.*\b(rule|rules|signal|question|hypothes|what is tested|design|method)\b/i.test(l));
  if (i < 0) i = lines.findIndex((l) => /^#\s/.test(l));
  if (i < 0) return '';
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (/^#/.test(l)) { if (out.length) break; continue; }
    if (!l.trim()) { if (out.length) break; continue; }
    if (/^\s*\|/.test(l)) { if (out.length) break; continue; }
    out.push(l.trim());
  }
  return stripMd(out.join(' '));
}

// n, net R, t: only figures the verdict text states (first of each)
export function figuresOf(text) {
  const s = String(text || '').replace(/−/g, '-');
  const f = {};
  const n = /\bn\s*=?\s*(\d[\d,]*)\b/i.exec(s); if (n) f.n = Number(n[1].replace(/,/g, ''));
  const r = /([+-]\d+(?:\.\d+)?|\d+\.\d+)\s?R\b(?:\s+(?:a|per)\s+(trade|position|year|signal|day|month))?/.exec(s);
  if (r) { f.R = Number(r[1]); if (r[2]) f.Rper = r[2]; }
  const t = /\bt\s*=?\s*([+-]?\d+(?:\.\d+)?)\b/.exec(s); if (t) f.t = Number(t[1]);
  return f;
}

const NM_RE = /\bnot measurable\b|\bcould not be measured\b|\bcannot be measured\b|\bunmeasurable\b|\bharness not validated\b|\bnot testable\b/i;
const REPLICATE_RE = /\breplicat(e|es|ed|ion)\b|\breplicate\b|\breproduc(e|es|ed|tion)\b|\brepeat(s|ed)? (?:of|on)\b/i;
export function verdictClass(edgeClass, headline) {
  if (NM_RE.test(headline || '')) return 'nm';
  return edgeClass || '';
}
export const isReplicate = (topic, title) => /replicat/i.test(topic) || /^\s*(replicat|reproduc)/i.test(title || '') || /\breplication of\b/i.test(title || '');

// ---------- asset class ----------
const KW = {
  gold: /\b(gold|xau|xauusd|gtrend\w*|geg|gtl|gmp|mosha|msnr|gc|bullion|drd)\b/i,
  indices: /\b(nq|nas100|nasdaq|es|spx|spx500|s&p|sp500|ym|us30|dow|rty|us2000|russell|dax|de40|ftse|uk100|nikkei|jp225|index|indices|equity|equities|stock|stocks|vix|open[- ]run)\b/i,
  forex: /\b(fx|forex|currency|currencies|eurusd|eur\/usd|gbpusd|gbp\/usd|usdjpy|usd\/jpy|audusd|usdcad|usdchf|nzdusd|eur|gbp|jpy|aud|cad|chf|nzd|dxy|dollar|yen|carry trade|ny cut|fix)\b/i,
  rates: /\b(treasury|treasuries|yield|yields|bond|bonds|rates|bund|tips|auction|2y|10y|fomc|sofr|fed funds)\b/i,
  commodities: /\b(silver|xag|oil|wti|wtico|brent|bco|crude|copper|xcu|natgas|gas|wheat|corn|soy\w*|sugar|platinum|xpt|palladium|commodit\w*|energy|energies|metals|grain|grains|cocoa|coffee|cotton)\b/i,
  crypto: /\b(crypto|btc|bitcoin|eth|ether|ethereum|coin|coins|xrp|sol|altcoin\w*)\b/i,
};
const META_RE = /(^|-)(clock|costs?|carry|financing|accounting|academy|academy-\w+|coach|coach-learning|fidelity|futures-roll|audit|sizing|ledger|honest-book|parity|param-drift|calibration|expectations|decay-monitor|multiple-testing|route-map|forward-plan|cost-floor|shadow-cost|robustness)(-|$)/i;
const tokens = (s) => String(s || '').replace(/[-_]/g, ' ');
const classesIn = (s) => Object.keys(KW).filter((k) => KW[k].test(tokens(s)));
// The topic name decides first, then the title, then the rule paragraph: one class there is the class, two or more is
// cross-asset. A study of costs, clocks, the Academy, the Coach and the like is accounting / meta whatever market it names.
export function assetClass(topic, title, rule, verdictText = '') {
  if (META_RE.test(String(topic)) || /\b(no rule tested|cost accounting|accounting only)\b/i.test(verdictText)) return 'meta';
  for (const s of [topic, title, rule]) {
    const c = classesIn(s);
    if (c.length === 1) return c[0];
    if (c.length > 1) {
      // gold with silver only (the precious metals) stays gold; copper, oil and the rest make it cross-asset
      const other = tokens(s).replace(/\b(silver|xag|metals)\b/gi, '');
      if (c.length === 2 && c.includes('gold') && c.includes('commodities') && !KW.commodities.test(other)) return 'gold';
      return 'cross-asset';
    }
  }
  return 'cross-asset';
}
export function marketsOf(topic, title, rule) {
  const s = tokens([topic, title, rule].join(' '));
  const out = [];
  const add = (name, re) => { if (re.test(s) && !out.includes(name)) out.push(name); };
  add('gold', KW.gold); add('silver', /\b(silver|xag)\b/i);
  add('NQ', /\b(nq|nas100|nasdaq)\b/i); add('ES', /\b(es|spx|spx500|s&p|sp500)\b/i); add('YM', /\b(ym|us30|dow)\b/i);
  add('RTY', /\b(rty|us2000|russell)\b/i); add('DAX', /\b(dax|de40)\b/i);
  add('forex', /\b(fx|forex|currency|currencies|eurusd|gbpusd|usdjpy|audusd|usdcad|usdchf|nzdusd|eur|gbp|jpy|aud|cad|chf|nzd|yen)\b/i);
  add('dollar', /\b(dxy|dollar)\b/i); add('rates', KW.rates); add('oil', /\b(oil|wti|wtico|brent|bco|crude)\b/i);
  add('crypto', KW.crypto);
  return out;
}

// one study at one ref
export function readStudy(repo, ref, topic) {
  const dir = `research/edge/${topic}`;
  const md = show(repo, ref, `${dir}/RESULT.md`), jsonText = show(repo, ref, `${dir}/result.json`), pre = show(repo, ref, `${dir}/PREREGISTRATION.md`);
  let data = null; let jsonErr = false;
  if (jsonText != null) { try { data = JSON.parse(jsonText); } catch { jsonErr = true; } }
  const v = studyVerdict(data, md || '');
  const fullHead = headlineParts(md || '').join(' ');
  const vText = data && typeof data.verdict === 'string' ? plain(data.verdict) : v.headline;
  const title = titleOf(md) || titleOf(pre) || topic;
  const rule = ruleParagraph(pre) || ruleParagraph(md);
  const headline = v.headline || '';
  const cls = verdictClass(v.verdict, `${vText} ${headline}`);
  return {
    topic, title, rule: rule ? cut(rule, 200, 1) : '', markets: marketsOf(topic, title, rule),
    assetClass: assetClass(topic, title, rule, `${vText} ${headline}`),
    verdict: cls, verdictText: headline || (vText ? cut(vText, 220, 2) : ''), figures: Object.keys(figuresOf(vText)).length ? figuresOf(vText) : figuresOf(fullHead),
    replicate: isReplicate(topic, title), built: v.built || null,
    files: { result: md != null, json: jsonText != null, prereg: pre != null, jsonError: jsonErr || undefined },
  };
}

// ---------- pull requests ----------
export function openPulls(repo, slug = REPO_SLUG) {
  const map = new Map();
  for (let page = 1; page <= 20; page++) {
    let out;
    try {
      out = execFileSync('gh', ['api', `repos/${slug}/pulls?state=open&per_page=100&page=${page}`, '--jq', '.[] | "\\(.number)\\t\\(.head.ref)\\t\\(.draft)"'],
        { cwd: repo, encoding: 'utf8', timeout: 60e3, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { return page === 1 ? null : map; }
    const rows = out.split('\n').filter(Boolean);
    for (const r of rows) { const [n, head, draft] = r.split('\t'); if (!map.has(head)) map.set(head, { number: Number(n), draft: draft === 'true' }); }
    if (rows.length < 100) break;
  }
  return map;
}

// ---------- the index ----------
export function buildIndex({ repo = process.cwd(), mainRef = 'origin/main', remote = 'origin', pulls = null } = {}) {
  const mainName = mainRef.startsWith(`${remote}/`) ? mainRef.slice(remote.length + 1) : mainRef;
  const onMain = topicsAt(repo, mainRef);
  const studies = new Map();   // topic -> entry
  for (const t of [...onMain].sort()) studies.set(t, { ...readStudy(repo, mainRef, t), branch: mainName, merged: true, pr: null, otherBranches: [] });

  const branches = remoteBranches(repo, remote, mainName).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.name.localeCompare(b.name));
  const found = new Map();   // topic -> [{ branch, pr, date }]
  for (const b of branches) {
    const has = topicsAt(repo, b.ref);
    for (const t of changedTopics(repo, mainRef, b.ref)) {
      if (!has.has(t)) continue;
      const pr = pulls ? pulls.get(b.name) || null : null;
      if (onMain.has(t)) {
        // a branch that changes a merged study: kept only while its pull request is open and its result differs from main's
        if (!pr) continue;
        const same = ['RESULT.md', 'result.json'].every((f) => blob(repo, b.ref, `research/edge/${t}/${f}`) === blob(repo, mainRef, `research/edge/${t}/${f}`));
        if (same) continue;
      }
      if (!found.has(t)) found.set(t, []);
      found.get(t).push({ branch: b.name, ref: b.ref, pr, date: b.date });
    }
  }
  for (const [t, list] of found) {
    // the open pull request first, then the newest branch
    list.sort((a, b) => (b.pr ? 1 : 0) - (a.pr ? 1 : 0) || String(b.date).localeCompare(String(a.date)) || a.branch.localeCompare(b.branch));
    const pick = list[0], others = list.slice(1).map((x) => x.branch);
    if (onMain.has(t)) {
      const e = studies.get(t);
      e.revision = { branch: pick.branch, pr: pick.pr ? pick.pr.number : null, verdict: readStudy(repo, pick.ref, t).verdict };
      e.otherBranches = others.concat(pick.branch);
      continue;
    }
    studies.set(t, { ...readStudy(repo, pick.ref, t), branch: pick.branch, merged: false, pr: pick.pr ? pick.pr.number : null, draft: pick.pr ? pick.pr.draft : undefined, otherBranches: others });
  }
  const rows = [...studies.values()].sort((a, b) => CLASSES.indexOf(a.assetClass) - CLASSES.indexOf(b.assetClass) || a.topic.localeCompare(b.topic));
  const counts = { total: rows.length, merged: rows.filter((r) => r.merged).length, unmerged: rows.filter((r) => !r.merged).length,
    verdict: { pass: 0, fail: 0, inc: 0, nm: 0, '': 0 }, replicate: 0, byClass: Object.fromEntries(CLASSES.map((c) => [c, 0])) };
  for (const r of rows) { counts.verdict[r.verdict || '']++; if (r.replicate) counts.replicate++; counts.byClass[r.assetClass]++; }
  const head = gitOr(repo, ['log', '-1', '--format=%H%x09%cI', mainRef], '').trim().split('\t');
  return { title: 'Study index: every pre-registered study, merged or not', regenerate: 'git fetch origin && node scripts/study-index.mjs',
    main: { ref: mainRef, sha: head[0] || null, at: head[1] || null }, branchesRead: branches.length, prsRead: pulls ? pulls.size : null,
    counts, unread: rows.filter((r) => !r.verdict).map((r) => r.topic), studies: rows };
}

// ---------- markdown ----------
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
export function figText(f) {
  const p = [];
  if (f.n != null) p.push(`n ${f.n}`);
  if (f.R != null) p.push(`${f.R > 0 ? '+' : ''}${f.R}R${f.Rper ? ` a ${f.Rper}` : ''}`);
  if (f.t != null) p.push(`t ${f.t}`);
  return p.join(', ');
}
export function toMarkdown(idx) {
  const c = idx.counts, L = [];
  L.push(`# ${idx.title}`, '');
  L.push(`Generated from \`${idx.main.ref}\` at ${idx.main.sha ? idx.main.sha.slice(0, 10) : '?'} (${idx.main.at || '?'}) and ${idx.branchesRead} remote branches` +
    `${idx.prsRead == null ? ' (open pull requests not read)' : `, ${idx.prsRead} open pull requests`}. Paper research only: this list changes no rule or trade.`, '');
  L.push(`**${c.total} studies** (${c.merged} on main, ${c.unmerged} only on a branch): ` +
    `${c.verdict.pass} PASS · ${c.verdict.fail} FAIL · ${c.verdict.inc} inconclusive · ${c.verdict.nm} not measurable` +
    `${c.verdict[''] ? ` · ${c.verdict['']} verdict not read` : ''} · ${c.replicate} replicate-type.`, '');
  L.push('By asset class: ' + CLASSES.map((k) => `${CLASS_NAMES[k]} ${c.byClass[k]}`).join(' · ') + '.', '');
  L.push(`Regenerate: \`${idx.regenerate}\` (read only; writes this file and study-index.json).`, '');
  L.push('Verdicts are the Edge lab\'s reading of each study (`research/edge/verdict.mjs`); "not measurable" and "replicate-type" are read from the study\'s own words. ' +
    'Figures are the first n, R and t the verdict text states, nothing recomputed; read the study before quoting one. A PASS is never a live rule without the owner.', '');
  for (const k of CLASSES) {
    const rows = idx.studies.filter((r) => r.assetClass === k);
    if (!rows.length) continue;
    L.push(`## ${CLASS_NAMES[k]} (${rows.length})`, '');
    L.push('| Topic | PR | Rule | Verdict | Key figures |', '|---|---|---|---|---|');
    for (const r of rows) {
      const where = r.merged ? 'main' : r.pr ? `#${r.pr}` : `branch \`${r.branch}\``;
      const rev = r.revision ? ` (revision on ${r.revision.pr ? `#${r.revision.pr}` : r.revision.branch})` : '';
      const said = cut(r.verdictText || '', 160, 1), cls = VERDICT_NAMES[r.verdict || ''];
      const v = (said && said.toLowerCase().startsWith(cls.toLowerCase()) ? said : `${cls}${said ? `: ${said}` : ''}`) + (r.replicate ? ' (replicate-type)' : '');
      L.push(`| \`${r.topic}\` | ${where}${rev} | ${esc(cut(r.title, 110, 1))} | ${esc(v)} | ${esc(figText(r.figures))} |`);
    }
    L.push('');
  }
  if (idx.unread.length) L.push('## Verdict not read', '', idx.unread.map((t) => `\`${t}\``).join(', '), '');
  return L.join('\n');
}

// ---------- command line ----------
function arg(argv, name, dflt) { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; }
export function main(argv = process.argv.slice(2)) {
  const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const repo = path.resolve(arg(argv, '--repo', process.cwd()));
  const out = path.resolve(arg(argv, '--out', path.join(here, 'research', 'proposals')));
  const mainRef = arg(argv, '--main', 'origin/main');
  const pulls = argv.includes('--no-gh') ? null : openPulls(repo);
  const idx = buildIndex({ repo, mainRef, pulls });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'study-index.json'), JSON.stringify(idx, null, 1) + '\n');
  fs.writeFileSync(path.join(out, 'study-index.md'), toMarkdown(idx));
  const c = idx.counts;
  console.log(`${c.total} studies (${c.merged} on main, ${c.unmerged} on branches): pass ${c.verdict.pass}, fail ${c.verdict.fail}, inc ${c.verdict.inc}, not measurable ${c.verdict.nm}, unread ${c.verdict['']}, replicate ${c.replicate}`);
  console.log('by class:', JSON.stringify(c.byClass));
  if (idx.unread.length) console.log('verdict not read:', idx.unread.join(', '));
  return idx;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
