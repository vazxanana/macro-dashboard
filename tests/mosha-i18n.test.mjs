// The Mosha teacher's language and the tutorial (owner, 10 Nov 2026: "a proper tutorial because the better he knows how to work
// with you he would do better", "give him choice to choose french instead but the trading terms leave it as english").
// Offline: the dictionary (assets/mosha-i18n.js), the tutorial (assets/mosha-tutor.js), the pages that use them, and the
// language that travels with a lesson (api/mosha-lessons.js, scripts/mosha-lessons.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const I = require('../assets/mosha-i18n.js'), TU = require('../assets/mosha-tutor.js'), TEACH = require('../assets/mosha-teach.js'), L = require('../api/mosha-lessons.js');
const TOOLS = await import('../scripts/mosha-lessons.mjs');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PAGE = rd('../market-structure.html'), BT = rd('../backtest.html'), JS = rd('../assets/mosha-teach.js'), TUT = rd('../assets/mosha-tutor.js');
const lits = (src, fn) => [...src.matchAll(new RegExp('\\b' + fn + "\\('((?:[^'\\\\]|\\\\.)*)'", 'g'))].map((m) => m[1].replace(/\\'/g, "'"));
const SEC = PAGE.slice(PAGE.indexOf('<section class="view adm" id="v-mosha"'), PAGE.indexOf('</section>', PAGE.indexOf('id="mo-book"')));
const marked = (html) => [...html.matchAll(/<[a-z0-9]+\b[^>]*\sdata-tr(?=[\s>])[^>]*>([^<]+)</g)].map((m) => m[1].trim())
  .concat([...html.matchAll(/placeholder="([^"]*)"[^>]*data-tr-ph/g)].map((m) => m[1]), [...html.matchAll(/aria-label="([^"]*)"[^>]*data-tr-aria/g)].map((m) => m[1]), [...html.matchAll(/title="([^"]*)"[^>]*data-tr-title/g)].map((m) => m[1]));
const nb = (s) => s.replace(/ /g, ' ');
// a word of the method found in the English must be found in the French (case does not matter; "level" is the method's level, not "levels" = prices)
const TERM = { level: /\blevel\b(?!s)/i, high: /\bhigh\b/i, low: /\blow\b/i, stop: /\bstops?\b/i, buy: /\bbuy\b/i, sell: /\bsell\b/i, trade: /\btrades?\b(?! through)/i, entry: /\bentry\b/i, target: /\btargets?\b/i, replay: /\breplay\b/i, swing: /\bswing\b/i, BO: /\bBO\b/, VR: /\bvr\b/i, CF: /\bcf\b/i };
const keeps = (en, fr, where) => { for (const t of I.TERMS) { const re = TERM[t] || new RegExp('\\b' + t.replace(/[-/]/g, '\\$&') + '\\b', 'i'); if (re.test(en)) assert.ok(nb(fr).toLowerCase().includes(t.toLowerCase()), `${where}: "${t}" must stay English in: ${fr}`); } };

test('every phrase the teaching pages use has its French line', () => {
  const used = new Set([...lits(JS, 'L'), ...lits(BT, 'ML'), ...lits(TUT, 'T'), ...marked(SEC), ...marked(BT),
    ...Object.values(TEACH.STATE), ...Object.values(TEACH.KIND), ...Object.values(TEACH.FLT), ...TEACH.STEPS.flatMap((s) => [s.t, s.p, s.go]), ...L.SEED.map((b) => b.text)]);
  assert.ok(used.size > 230, `phrases found: ${used.size}`);
  const missing = [...used].filter((k) => !Object.prototype.hasOwnProperty.call(I.FR, k)); assert.deepEqual(missing, [], 'no French line for these');
  assert.ok(lits(JS, 'L').length > 140 && lits(BT, 'ML').length >= 14 && marked(SEC).length >= 28 && marked(BT).length >= 8);
  // nothing in the dictionary is dead weight except what the server may answer
  const all = JS + BT + TUT + rd('../api/mosha-lessons.js'), quoted = (k) => all.includes("'" + k.replace(/'/g, "\\'") + "'");
  const dead = Object.keys(I.FR).filter((k) => !used.has(k) && !quoted(k)); assert.deepEqual(dead, [], 'French lines nothing uses');
});

test('the French keeps the words of the method in English, the same blanks and the same marks', () => {
  assert.deepEqual(I.LANGS, ['en', 'fr']); assert.equal(I.NAMES.fr, 'Français');
  for (const [en, fr] of Object.entries(I.FR)) {
    assert.ok(fr && fr !== en || /^(Sent\.)$/.test(en) === false, en); keeps(en, fr, 'dictionary');
    assert.deepEqual((fr.match(/\{\w+\}/g) || []).sort(), (en.match(/\{\w+\}/g) || []).sort(), `blanks of: ${en}`);
    assert.deepEqual((fr.match(/<\/?b>/g) || []).length, (en.match(/<\/?b>/g) || []).length, `bold marks of: ${en}`);
    assert.ok(!/ [:;?!»]|« /.test(fr), `French spacing uses a non-breaking space: ${fr}`); assert.ok(!/[<>]/.test(fr.replace(/<\/?b>/g, '')), `no markup in: ${fr}`);
  }
  for (const w of ['VR', 'CF', 'BO sell', 'sweep', 'stop', 'target', 'entry', 'level', 'swing low', 'pullback', 'timeframe', 'top-down', 'zone of the break', 'barrier']) assert.ok(Object.values(I.FR).some((fr) => fr.includes(w)), w);
  // the choice: English unless French was chosen; a phrase with no French line stays English; a corrected book line is the teacher's own
  assert.equal(I.lang(), 'en'); assert.equal(I.tr('Your turn'), 'Your turn'); assert.equal(nb(I.tr('Your turn', 'fr')), 'À vous'); assert.equal(I.tr('not in the table', 'fr'), 'not in the table');
  assert.equal(I.fill('{n} answers to check', { n: 3 }), '3 answers to check'); assert.equal(I.seed({ text: 'x', status: 'corrected' }), 'x');
  assert.match(rd('../assets/mosha-i18n.js'), /'msMoLang:' \+ \(u \|\| me \|\| ''\)/, 'kept per account');
});

test('the tutorial: nine chapters, the same in both languages, with a picture, an example and a question', () => {
  const en = TU.TUT.en, fr = TU.TUT.fr; assert.equal(en.length, 9); assert.deepEqual(en.map((c) => c.k), ['start', 'lesson', 'form', 'see', 'answer', 'book', 'replay', 'habits', 'go']); assert.deepEqual(fr.map((c) => c.k), en.map((c) => c.k));
  const shape = (b) => Object.keys(b)[0] + (b.fig ? ':' + b.fig : '') + (Array.isArray(b.ul || b.ol) ? ':' + (b.ul || b.ol).length : '') + (b.dd ? ':' + b.dd.yes.length + '/' + b.dd.no.length : '');
  const flat = (x) => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(flat) : x && typeof x === 'object' ? Object.entries(x).filter(([k]) => !['k', 'fig', 'href', 'kind', 'ok'].includes(k)).flatMap(([, v]) => flat(v)) : []);
  en.forEach((c, i) => { const f = fr[i];
    assert.deepEqual(f.body.map(shape), c.body.map(shape), `${c.k}: the same blocks`); assert.ok(c.t.length <= 48 && c.lead.length >= 30, c.k);
    assert.equal(!!c.quiz, c.k !== 'go', `${c.k}: a question in every chapter but the last`);
    if (c.quiz) { assert.equal(c.quiz.o.length, 3); assert.equal(c.quiz.o.filter((o) => o.ok).length, 1, `${c.k}: one right answer`); assert.deepEqual(f.quiz.o.map((o) => !!o.ok), c.quiz.o.map((o) => !!o.ok), `${c.k}: the same right answer`); for (const o of [...c.quiz.o, ...f.quiz.o]) assert.ok(o.t && o.why && o.why.length >= 20, `${c.k}: every answer is explained`); }
    assert.deepEqual(f.go ? [f.go.k, f.go.href] : null, c.go ? [c.go.k, c.go.href] : null, `${c.k}: the same button`);
    const a = flat(c), b = flat(f); assert.equal(a.length, b.length, `${c.k}: the same number of sentences`); a.forEach((s, j) => { keeps(s, b[j], c.k); if (s === b[j]) assert.ok(s.split(/\s+/).every((w) => /^(H4|H1|M30|M15|M5|BO|sell|buy|sweep|high|low|vr|cf|·|\+)$/i.test(w)), `${c.k}: translated: ${s}`); assert.ok(!/ [:;?!»]|« /.test(b[j]), `French spacing: ${b[j]}`); });
    for (const s of [...a, ...b]) assert.ok(!/\b(guarantee[sd]?|profitable|win rate|edge|garanti[es]?|rentable|taux de réussite|gagnant à coup sûr)\b/i.test(s), `a tutorial for teaching, not a promise: ${s}`);
  });
  assert.ok(en.filter((c) => c.body.some((b) => b.fig)).length >= 7, 'a picture in most chapters'); assert.ok(en.filter((c) => c.body.some((b) => b.cmp || b.dd)).length >= 3, 'weak against good, shown');
  for (const fig of en.flatMap((c) => c.body.filter((b) => b.fig).map((b) => b.fig))) assert.match(TUT, new RegExp('\\b' + fig + ': function'), fig);
  // it says what the desk cannot do, in both languages
  assert.match(flat(en).join(' '), /never places, copies or changes a trade/); assert.match(nb(flat(fr).join(' ')), /ne place, ne copie et ne modifie jamais un trade/);
  assert.match(flat(en).join(' '), /does not answer the second you send/); assert.match(flat(en).join(' '), /tested separately, on years of data/);
  assert.deepEqual(Object.keys(TU.FIG.fr).sort(), Object.keys(TU.FIG.en).sort()); for (const k of Object.keys(TU.FIG.en)) { const a = [].concat(TU.FIG.en[k]), b = [].concat(TU.FIG.fr[k]); assert.equal(a.length, b.length, k); a.forEach((s, j) => keeps(s, b[j], 'picture ' + k)); }
  assert.deepEqual(TU.state('nobody'), { at: 0, done: false, ok: {} });
  // the buttons the French tutorial names are the buttons the French page shows
  const said = nb(flat(fr).join(' ')), shown = Object.values(I.FR).map(nb);
  for (const b of ['C\'est juste', 'Pas juste…', 'Ajouter des images', 'Comment enseigner', 'Relire le tutoriel', 'À vous', 'Enseigner ce trade', 'Voir la lecture du desk sur le graphique', 'Lecture du desk, non confirmée', 'issu d\'un replay ChronosTrade']) { assert.ok(said.includes(b), 'named: ' + b); assert.ok(shown.includes(b), 'shown: ' + b); }
  for (const b of ['That is right', 'Not right…', 'Add pictures', 'How to teach', 'Read the tutorial again', 'Your turn', 'Teach this trade']) assert.ok(flat(en).join(' ').includes(b) && Object.prototype.hasOwnProperty.call(I.FR, b), b);
});

test('the pages: the choice of language, the tutorial\'s button, and the same words in ChronosTrade', () => {
  const head = PAGE.slice(0, PAGE.indexOf('</head>')); assert.ok(head.indexOf('/assets/mosha-i18n.js') < head.indexOf('/assets/mosha-tutor.js') && head.indexOf('/assets/mosha-tutor.js') < head.indexOf('/assets/mosha-teach.js'), 'the dictionary loads first');
  assert.ok(SEC.includes('<div class="mo-lang-top" id="mo-lang-top" hidden></div>')); assert.match(JS, /function langHTML\(\)/); assert.match(JS, /function setLang\(k\)[^\n]*I\.set\(k, T\.who\); I\.apply\(\$\('v-mosha'\)\); draw\(\); drawPicks\(\);/);
  assert.match(JS, /data-g-tut="1">' \+ \(tut\.done \? L\('Read the tutorial again'\) : tut\.at \? L\('Continue the tutorial'\) : L\('Start the tutorial'\)\)/); assert.match(JS, /root\.MS_MOSHA_TUTOR\.open\(T\.who, \{ onLang: setLang, onClose: drawGuide, go: function \(k\) \{ showPart\(k\); \} \}\)/);
  assert.match(JS, /lang: root\.MS_MOSHA_I18N \? root\.MS_MOSHA_I18N\.lang\(\) : 'en'/, 'the language travels with the lesson'); assert.match(JS, /esc\(seen\(b\)\)/, 'the desk\'s own lines are shown in the teacher\'s language');
  assert.match(TUT, /d = document\.createElement\('dialog'\); d\.id = 'mo-tut'/); assert.match(TUT, /ev\.key === 'ArrowRight'/); assert.match(PAGE, /\.mo-tut \.mt-quiz-o button \{[^}]*min-height: 44px/); assert.match(PAGE, /@media \(max-width: 760px\) \{ \.mo-tut \{ width: 100vw; height: 100dvh;/);
  assert.ok(!/animation:[^;}]*infinite/.test(PAGE.slice(PAGE.indexOf('.mo-tut {'), PAGE.indexOf('#v-mosha .mo-guide[hidden]'))), 'nothing in the tutorial moves for ever');
  // ChronosTrade: the dictionary before the page's own script, the teacher's words through it, the language sent
  assert.ok(BT.indexOf('<script src="/assets/mosha-i18n.js"></script>') > 0 && BT.indexOf('<script src="/assets/mosha-i18n.js"></script>') < BT.indexOf('const MI = window.MS_MOSHA_I18N'));
  assert.match(BT, /if \(MI\) MI\.who\(me\.u\);/); assert.match(BT, /const add = \{ title, note, lang: MI \? MI\.lang\(\) : 'en',/); assert.match(BT, /if \(MI\) \{ MI\.apply\(\$\('teachd'\)\); MI\.apply\(\$\('tchip'\)\); MI\.apply\(\$\('tch-btn'\)\); \}/);
});

test('the language travels with the lesson, so the desk answers in it', async () => {
  let db = []; const store = { get: async () => JSON.parse(JSON.stringify(db)), put: async (v) => { db = JSON.parse(JSON.stringify(v)); }, getBook: async () => null, putBook: async () => {}, putImg: async () => {}, getImg: async () => null, delImg: async () => {} };
  let tick = 0; const ENV = { SESSION_SECRET: 'a-test-session-secret-0123456789' }, LUXUS = { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach' }, NOW = Date.UTC(2026, 10, 10, 16);
  const call = async (method, who, body, headers = {}) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; }, send: () => out };
    await L.handle({ method, headers: { host: 'meridianx.dev', ...headers }, query: {}, body }, res, { env: ENV, store, who: async () => who, sameOrigin: () => true, now: NOW + 1000 * ++tick }); return out; };
  const a = await call('POST', LUXUS, { add: { note: 'Jamais de sell avant la clôture du CF M5.', lang: 'fr' } }); assert.equal(a.code, 200); assert.equal(a.body.lesson.lang, 'fr'); assert.equal(a.body.lesson.title, 'Jamais de sell avant la clôture du CF M5');
  const b = await call('POST', LUXUS, { add: { note: 'An English one.' } }); assert.equal(b.body.lesson.lang, 'en'); assert.equal((await call('POST', LUXUS, { add: { note: 'A third one here.', lang: 'xx' } })).body.lesson.lang, 'en', 'an unknown language is English');
  await call('POST', null, { reply: { id: b.body.lesson.id, text: 'Understood.' } }, { authorization: `Bearer ${L.readerKey(ENV)}` });
  const c = await call('POST', LUXUS, { say: { id: b.body.lesson.id, text: 'Oui, mais dites-le en français.', lang: 'fr' } }); assert.equal(c.body.lesson.lang, 'fr', 'he switched: the lesson follows');
  assert.deepEqual(L.LANGS, I.LANGS); assert.equal(L.langOf('fr'), 'fr'); assert.equal(L.langOf('de'), null);
  const txt = TOOLS.lessonText(a.body.lesson); assert.match(txt, /Answer in FRENCH \(the teacher works in French\)\. Keep the words of the method in English/); for (const t of ['VR', 'CF', 'BO', 'sweep', 'stop', 'target', 'zone of the break']) assert.ok(txt.includes(t), t);
  assert.match(TOOLS.lessonText((await call('GET', LUXUS)).body.lessons.find((l) => l.lang === 'en')), /Answer in English\./);
});
