// node --test tests/farm.test.mjs: the Agent Farm page (25 Nov 2026; Portuguese voices, new characters and office 26 Nov 2026):
// display only, signed-in members, built and routed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RULES } from './no-model-names.test.mjs';
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const page = read('farm.html');
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
test('the page is built, routed and offered as a home-screen shortcut', () => {
  assert.match(read('scripts/build.sh'), /farm\.html/);
  assert.match(read('vercel.json'), /"source": "\/farm"[\s\S]{0,40}"destination": "\/farm\.html"/);
  assert.match(read('app.webmanifest'), /"url": "\/farm"/);
});
test('only a signed-in member sees it, and it reads research files only', () => {
  assert.match(page, /fetch\('\/api\/me'/);
  assert.match(page, /\$\('gate'\)\.hidden = false/);
  const urls = [...page.matchAll(/'\/cdata\/' \+ file/g)]; assert.equal(urls.length, 1);
  assert.equal([...page.matchAll(/fetch\(/g)].length, 2, 'two requests only: the session and the research files');
  assert.match(page, /'research\/auto\/worker-' \+ d\.id \+ '\.json'/);
  assert.match(page, /'research\/auto\/worker-' \+ d\.id \+ '-' \+ l \+ '\.json'/, 'every lane file');
  assert.match(page, /'If-None-Match'/);
  assert.ok(!/research\/auto\/(?!worker-)/.test(page));
  assert.deepEqual(JSON.parse(page.match(/var IDS = (\[[\d,]+\])/)[1]), [1, 2, 3, 4, 5, 6, 11, 8, 12, 10]);
});
test('display only: no order, broker, storage or post to the server', () => {
  for (const bad of [/method:\s*'(POST|PUT|DELETE)'/i, /localStorage|sessionStorage|indexedDB|document\.cookie/, /ctrader|broker|placeOrder|\.stop\s*=/i, /eval\(|new Function/, /XMLHttpRequest|sendBeacon|WebSocket/]) assert.ok(!bad.test(page), String(bad));
});
test('km per hour and the made-up scale are named on the page', () => {
  assert.match(page, /kmh = function \(d\) \{ return Math\.round\(d\.rate \* 3\.6\)/);
  assert.match(page, /one try is one metre/);
});
test('the jokes and the race change nothing in the research', () => {
  assert.match(page, /for fun only; they change nothing in the research/);
  assert.match(page, /Nothing here trades\./);
});
test('the widget view and the view without WebGL stay', () => {
  assert.match(page, /location\.hash === '#widget'/);
  assert.match(page, /html\.widget #stage/);
  assert.match(page, /catch \(e\) \{ gl = false; return; \}/);
  assert.match(page, /classList\.add\('nogl'\)/);
});
test('results are counted from the newest research version only, and named honestly', () => {
  assert.match(page, /if \(verOf\(j\) !== vmax\) return;/);
  assert.match(page, /n\.res \+= j\.cPasses \|\| 0/);
  assert.match(page, /results \(low bar: many are luck\)/);
  // the version reader, run
  const verOf = new Function(script.match(/function verOf\(j\) \{[^\n]*\}/)[0] + '; return verOf;')();
  assert.equal(verOf({ version: 'auto-2' }), 2); assert.equal(verOf({ version: 'auto-1' }), 1); assert.equal(verOf({}), 0);
});
test('the agents speak Portuguese through the browser, off until switched on', () => {
  assert.match(page, /speechSynthesis\.speak\(u\)/);
  assert.match(page, /new SpeechSynthesisUtterance\(it\.text\)/);
  assert.match(page, /find\(\/\^pt-PT\/i\) \|\| find\(\/\^pt-BR\/i\) \|\| find\(\/\^pt\/i\)/, 'Portugal first, then Brazil, then any Portuguese voice');
  assert.match(page, /var VO = \{ on: false,/, 'sound is off by default');
  assert.match(page, /id="b-snd" type="button" aria-pressed="false"/);
  assert.match(page, /if \(VO\.on && VO\.ok && \(VO\.voice \|\| pickVoice\(\)\)\)/, 'no voice or sound off: the bubble alone');
  assert.match(page, /This device has no Portuguese voice: the lines show as speech bubbles only\./);
  assert.match(page, /u\.pitch = PITCH\[it\.i\]; u\.rate = PACE\[it\.i\]; u\.volume = VO\.vol/);
  assert.equal(new Set(JSON.parse(page.match(/var PITCH = (\[[^\]]+\])/)[1].replace(/(^|[\[,])\./g, '$10.'))).size, 10, 'ten different voices');
  assert.match(page, /if \(VO\.cur\) \{ if \(now > VO\.cur\.dead\) endTalk\(\); return; \}/, 'one speaker at a time');
});
test('at least 60 distinct Portuguese lines, and every spoken number comes from the files', () => {
  const block = page.split('/* PT-LINES */')[1].split('/* END PT-LINES */')[0];
  const lines = new Set([...block.matchAll(/'([^'\n]{6,})'/g)].map((m) => m[1]).filter((s) => /\s/.test(s)));
  assert.ok(lines.size >= 60, 'lines: ' + lines.size);
  const pt = [...lines].filter((s) => /[ãõçáéíóúâêô]/i.test(s) || /\b(que|não|um|uma|de|do|da|em|com|para|mais|isto|já|vou|tudo)\b/i.test(s));
  assert.ok(pt.length >= 60, 'Portuguese lines: ' + pt.length);
  // a line carries no digit of its own: numbers come in through {tokens} filled from the live data
  for (const s of lines) assert.ok(!/\d/.test(s.replace(/nas100|spx500|S&P/gi, '')), 'a number written into a line: ' + s);
  for (const s of lines) for (const t of s.match(/\{\w\}/g) || []) assert.ok('trklcaTRLmn'.includes(t[1]), 'unknown token ' + t);
  // fill() run on made-up state: a missing number gives no line at all
  const mk = new Function('D', 'TOT', 'MKT', script.match(/function ptNum\(n\) \{[\s\S]*?\n\}/)[0] + script.match(/function fill\(line, i, extra\) \{[\s\S]*?\n\}/)[0] + '; return { fill: fill, ptNum: ptNum };');
  const D = [{ tries: 2345678, res: 0, rate: 100, alive: 3, looks: 40, A: 5000, mkt: 'xau' }], F = mk(D, { tries: 9e6, res: 12, alive: 7 }, { xau: 'no ouro' });
  assert.equal(F.fill('Já fiz {t} tentativas até agora.', 0), 'Já fiz 2,3 milhões de tentativas até agora.');
  assert.equal(F.fill('Tenho {r} resultados.', 0), null, 'no results on file: the line is not spoken');
  assert.equal(F.fill('Encontrei mais um resultado {m}!', 0), 'Encontrei mais um resultado no ouro!');
  assert.equal(F.fill('{a} regras', 0), '5 mil regras'); assert.equal(F.ptNum(1000000), '1 milhão de'); assert.equal(F.ptNum(312), '312');
});
test('the site look, reduced motion and a light frame loop', () => {
  assert.match(page, /<link rel="stylesheet" href="\/assets\/soft\.css">/);
  assert.match(page, /--au-bg:/); assert.match(page, /var\(--au-surface\)/);
  for (const m of page.match(/<style>[\s\S]*?<\/style>/)[0].matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, 'text under 12 px: ' + m[0]);
  assert.match(page, /button\{[^}]*min-height:44px/);
  assert.match(page, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(page, /if \(auto && !reduce\)/); assert.match(page, /var dance = !reduce &&/);
  assert.match(page, /Math\.min\(devicePixelRatio \|\| 1, 2\)/);
  assert.match(page, /if \(document\.hidden\) \{ running = false; return; \}/);
  const frame = script.match(/function frame\(\) \{[\s\S]*?\n\}/)[0];
  assert.ok(!/\.map\(|\.filter\(|new THREE\.(?!Vector3\(-10)/.test(frame.replace(/if \(mode\.race !== raceNow\) \{[\s\S]*?\n  \}/, '')), 'the frame loop allocates nothing of its own');
});
test('no model or assistant product names on the page', () => {
  for (const [key, re] of RULES) assert.ok(!re.test(page), key);
  assert.ok(!/\b(chatbot|LLM|language model)\b/i.test(page));
});
