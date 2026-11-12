// node --test tests/no-model-names.test.mjs — absolute rule 6 of CLAUDE.md: no AI model names in repository files (code,
// comments, docs, page text). Commit attribution lines are not files. Offline: reads `git ls-files`, skips out/ (rebuilt
// from the sources) and binary files.
// The names are built from parts below so that this file does not trip its own check. The pattern is kept narrow on
// purpose: a model family name with a version or tier, a vendor-prefixed model id, or an assistant's name used as a
// word in prose. A product named as a place to connect from (a chat app, its web address, a coding tool) is not a
// model name; the few such places are allowed by file AND word below, each with its reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const j = (...p) => p.join('');
const A = j('Cla', 'ude'), X = j('Co', 'dex');                      // assistant names, as words in prose
const FAM = [j('op', 'us'), j('son', 'net'), j('hai', 'ku'), j('fa', 'ble')].join('|');
const NOT_PATH_BEFORE = '(?<![\\w./-])', NOT_PATH_AFTER = '(?![./-])';

// [key, regex]: the key names the rule in a failure and in the allowlist
export const RULES = [
  ['gp-family', new RegExp('\\b' + j('g', 'pt') + '-?\\d', 'i')],                                   // e.g. family + version
  ['o-series', new RegExp('\\bo[134]-(mini|preview|pro)\\b', 'i')],
  ['vendor-id', new RegExp(NOT_PATH_BEFORE + '(' + A + '|' + j('anth', 'ropic') + ')[- ]?(' + FAM + '|instant|\\d)', 'i')],
  ['family-version', new RegExp('\\b(' + FAM + ')[- ]?\\d', 'i')],
  ['assistant-word', new RegExp(NOT_PATH_BEFORE + A + '\\b(?! Code)' + NOT_PATH_AFTER)],              // case-sensitive
  ['coder-word', new RegExp(NOT_PATH_BEFORE + X + '\\b' + NOT_PATH_AFTER)],                           // case-sensitive
  ['gem-family', new RegExp('\\b' + j('gem', 'ini') + '[- ](\\d|pro|flash|ultra|nano)', 'i')],
  ['lla-family', new RegExp('\\b' + j('lla', 'ma') + '[- ]?\\d', 'i')],
  ['mis-family', new RegExp('\\b(' + j('mis', 'tral') + '|' + j('mix', 'tral') + ')[- ](large|medium|small|\\d)', 'i')],
  ['other-vendor', new RegExp('\\b(' + [j('deep', 'seek'), j('qw', 'en') + '-?\\d', j('gr', 'ok') + '-?\\d', '(text|code)-' + j('da', 'vinci')].join('|') + ')', 'i')],
];

// Allowed: a path prefix (or exact path) + the rule keys it may hit + why. Keep it short; never allow a whole rule.
export const ALLOW = [
  { path: '.claude/skills/impeccable/', keys: ['assistant-word', 'coder-word'], why: 'vendored third-party design skill; names coding-agent tools it integrates with (hooks, CLIs), not models' },
  { path: '.claude/skills/design-motion-principles/', keys: ['assistant-word'], why: 'vendored third-party skill text addressed to the coding tool that loads it' },
  { path: '.claude/skills/ui-ux-pro-max/', keys: ['assistant-word'], why: 'vendored third-party skill script (a docstring naming the tool that reads its output)' },
  { path: 'api/mcp.js', keys: ['assistant-word'], why: 'names a chat app as one of the MCP clients that may connect (a destination, beside two others)' },
  { path: 'docs/fred-mcp.md', keys: ['assistant-word'], why: 'setup steps for connecting from that chat app (a destination)' },
  { path: 'research/macro-veteran/references/treasury-cpi-study-protocol-2022-2024.json', keys: ['coder-word'],
    why: 'frozen pre-registration of the owner\'s batch, pinned by sha256 (.sha256 file, EXPECTED_PROTOCOL in its study script); one byte changed breaks the freeze' },
];

const allowed = (file, key) => ALLOW.some((a) => (a.path.endsWith('/') ? file.startsWith(a.path) : file === a.path) && a.keys.includes(key));

export function scanText(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => { for (const [key, re] of RULES) { const m = re.exec(line); if (m) hits.push({ line: i + 1, key, word: m[0] }); } });
  return hits;
}

function tracked() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter((f) => f && !f.startsWith('out/'));
}

test('the pattern finds model names and leaves ordinary words alone', () => {
  const bad = [j('G', 'PT') + '-4o said', j('Cl', 'aude') + ' 3 ' + j('Op', 'us'), 'the ' + j('son', 'net') + '-4 run', j('Cla', 'ude') + ' wrote it',
    'via ' + j('Gem', 'ini') + ' 1.5 Pro', j('Lla', 'ma') + '-3 70B', j('Mis', 'tral') + ' Large', j('Deep', 'Seek') + ' R1', 'o3-mini', j('Co', 'dex') + ' built it'];
  for (const s of bad) assert.ok(scanText(s).length, 'should flag: ' + s);
  const ok = ['gptmacro_v.1 skill', 'magnum ' + j('op', 'us'), 'a ' + j('hai', 'ku') + ' about gold', 'a ' + j('son', 'net'), 'see CLAUDE.md',
    '.claude/skills/ICT/SKILL.md', 'https://' + j('cla', 'ude') + '.ai', j('Cla', 'ude') + ' Code', 'branch ' + j('cla', 'ude') + '/msnr-study',
    '/tmp/' + j('cla', 'ude') + '-0/x', 'ChatGPT connector', 'j.bars', 'stopUsd', 'Gemini Observatory', 'llamas'];
  for (const s of ok) assert.deepEqual(scanText(s), [], 'should not flag: ' + s);
});

test('no model name in any tracked text file (absolute rule 6)', () => {
  const found = [];
  let n = 0;
  for (const f of tracked()) {
    let buf; try { buf = readFileSync(path.join(ROOT, f)); } catch { continue; }     // deleted in the working tree
    if (buf.includes(0)) continue;                                                    // binary
    n++;
    for (const h of scanText(buf.toString('utf8'))) if (!allowed(f, h.key)) found.push(`${f}:${h.line} [${h.key}] ${h.word}`);
  }
  assert.ok(n > 500, 'read the tracked files (' + n + ')');
  assert.deepEqual(found, [], 'rule 6: write "an assistant" or "a language model" instead:\n' + found.join('\n'));
});

test('every allowlist entry still matches something (no stale exceptions)', () => {
  const used = new Set();
  for (const f of tracked()) {
    const a = ALLOW.find((x) => (x.path.endsWith('/') ? f.startsWith(x.path) : f === x.path)); if (!a) continue;
    let buf; try { buf = readFileSync(path.join(ROOT, f)); } catch { continue; }
    if (buf.includes(0)) continue;
    if (scanText(buf.toString('utf8')).some((h) => a.keys.includes(h.key))) used.add(a.path);
  }
  for (const a of ALLOW) { assert.ok(a.why.length > 20, 'reason for ' + a.path); assert.ok(used.has(a.path), 'stale allowlist entry: ' + a.path); }
});
