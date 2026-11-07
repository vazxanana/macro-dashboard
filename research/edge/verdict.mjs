// One headline and one pass / fail / inconclusive class per edge study, for /edge-lab.html (via research/edge/build.mjs).
// Studies write result.json in many shapes (a string verdict, an object, candidates only, or nothing), so the page used to
// show most pre-registered null results as "inconclusive". The RESULT.md "Verdict" line is the one thing every study has,
// and it is the author's final word: it outranks a candidate table in which one noisy row formally passed.

// strip markdown to plain text: **bold**, `code`, [text](url), headings and list bullets
export function plain(s) {
  return String(s || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]+/g, '').replace(/^\s*(#{1,6}\s*|[-*]\s+)/, '').replace(/\s+/g, ' ').trim();
}

// the first line that IS a verdict line (a heading, bold lead or bullet starting with "Verdict"), not a table cell mentioning one
const VERDICT_LINE = /^\s*(?:#{1,6}\s*)?(?:[-*]\s+)?\**verdicts?\**\s*[:.]?\s*/i;
const isTable = (l) => /^\s*\|/.test(l), isSep = (l) => /^\s*\|?\s*:?-{2,}/.test(l);
const cells = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => plain(c));

// The verdict as the author wrote it: one text, or one "name: verdict" piece per row when the Verdict section is a table.
// On the verdict line itself ("**Verdict: FAIL. ...**", "## Verdict: NQ-ONLY ..."), the text after the colon; after a bare
// heading ("## Verdict", "**Verdict.**", "## Verdicts (window ...)"), the next paragraph line, or the table that follows.
export function headlineParts(md) {
  const lines = String(md || '').split(/\r?\n/);
  const i = lines.findIndex((l) => VERDICT_LINE.test(l));
  if (i < 0) return [];
  let text = plain(lines[i].replace(VERDICT_LINE, ''));
  if (text && !/^\(/.test(text)) return [text];
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j]; if (!l.trim()) continue;
    if (/^\s*#/.test(l)) return [];
    if (isTable(l)) {
      const head = cells(l), vi = Math.max(0, head.findIndex((h) => /verdict/i.test(h))) || 1, rows = [];
      for (let k = j + 1; k < lines.length && isTable(lines[k]); k++) { if (isSep(lines[k])) continue; const c = cells(lines[k]); if (c[0] && c[vi]) rows.push(`${c[0]}: ${cut(c[vi], 90, 1)}`); }
      return rows;
    }
    return [plain(l.replace(VERDICT_LINE, ''))];
  }
  return [];
}
export function headlineOf(md) { const p = headlineParts(md); return p.length > 1 ? cut(p.join('; '), 220, 99) : p.length ? cut(p[0]) : ''; }

// the first one or two sentences, at most `max` characters
export function cut(text, max = 220, sentences = 2) {
  const parts = String(text || '').split(/(?<=[.!?])\s+(?=[A-Z"“(])/), out = [];
  for (const p of parts) { if (out.length && (out.join(' ') + ' ' + p).length > max) break; out.push(p); if (out.length >= sentences) break; }
  let s = out.join(' ');
  if (s.length > max) s = s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

// pass / fail / inc from the words a study wrote as its verdict ('' when there is nothing to read).
// A null result (nothing passed, the live rule stays) is the FAIL class: no candidate came out of the study.
export function classify(v) {
  const s = plain(v).toLowerCase();
  if (!s) return '';
  if (/\b(regime-bound|regime-dependent|not dead|none fails|inconclusive|mixed)\b/.test(s)) return 'inc';
  if (/^(fail|fails|failed|decayed|null result|no\b|none\b|nothing\b|not\b|keep\b|reject)/.test(s)) return 'fail';
  if (/\bnot an edge\b|\bno edge\b/.test(s)) return 'fail';   // "passes the letter of the bar, but is not an edge"
  if (/^(pass|passes|passed)/.test(s)) return 'pass';
  if (/\b(nothing|none|no \S+( \S+)?) passes\b|\bdoes not (pass|hold|carry)\b|\bfails?\b/.test(s)) return 'fail';
  if (/\bpass(es|ed)?\b/.test(s)) return 'pass';
  return 'inc';
}
// several pieces (one per table row): any pass → pass, all fail → fail, else inc
export function classifyAll(parts) {
  const vs = parts.map(classify).filter(Boolean);
  if (!vs.length) return '';
  if (vs.length === 1) return vs[0];
  return vs.includes('pass') ? 'pass' : vs.every((x) => x === 'fail') ? 'fail' : 'inc';
}

// a result.json `verdict` field: a string, or an object with the class under one of a few keys
export function verdictField(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    // not `answer` or `result`: a study may answer "yes" to its question and still fail its own bar (regime-switch), so an
    // object without an explicit class leaves the call to the RESULT.md headline
    for (const k of ['verdict', 'primary', 'label', 'status', 'decision']) if (typeof v[k] === 'string' && v[k]) return v[k];
  }
  return '';
}
// the class from a candidates table alone: any pass → pass, all fail → fail
export function verdictOfCandidates(d) {
  const cands = d && Array.isArray(d.candidates) ? d.candidates.filter((c) => c && typeof c === 'object' && c.verdict != null) : [];
  if (!cands.length) return '';
  const vs = cands.map((c) => classify(verdictField(c.verdict)));
  return vs.includes('pass') ? 'pass' : vs.every((x) => x === 'fail') ? 'fail' : 'inc';
}
// kept for callers that only have result.json: its verdict field, else its candidates
export function verdictOfData(d) {
  if (!d || typeof d !== 'object') return '';
  const own = classify(verdictField(d.verdict));
  return own === 'pass' || own === 'fail' ? own : verdictOfCandidates(d) || own;
}

// the date a study was built, as YYYY-MM-DD, from whichever field it used
export function builtOf(d) {
  if (!d || typeof d !== 'object') return null;
  for (const k of ['built', 'at', 'generated', 'replayAt']) { const v = d[k]; if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10); }
  return null;
}

// { verdict, headline, built } for one study. Order: the result.json verdict field (explicit), then the RESULT.md verdict
// (the author's final word), then the candidates table; the headline falls back to the result.json string when there is no report.
export function studyVerdict(data, md) {
  const parts = headlineParts(md), field = verdictField(data && data.verdict);
  let headline = headlineOf(md);
  if (!headline && field) headline = cut(plain(field));
  let verdict = classify(field);
  if (verdict !== 'pass' && verdict !== 'fail') { const h = classifyAll(parts); if (h === 'pass' || h === 'fail') verdict = h; else verdict = verdictOfCandidates(data) || h || verdict; }
  return { verdict: verdict || (headline ? 'inc' : ''), headline, built: builtOf(data) };
}
