// The desk's assistant learns from the Mosha teacher with this (api/mosha-lessons.js). It talks to the site with the
// assistant's key and can read, answer and propose lines for the book, nothing else.
//   node --use-env-proxy scripts/mosha-lessons.mjs pull <dir> [--all]
//        BOOK.md (what the desk knows: the teacher's lines first) + lessons.json + a folder per lesson that waits for the desk
//        (lesson.txt: the note, the levels, the captions and the whole conversation; the pictures beside it)
//   node --use-env-proxy scripts/mosha-lessons.mjs reply <lesson id> <file with the answer> [chart.json] [questions.json]
//        what was understood, in the teacher's words; chart.json = the same reading as marks and steps for the replay chart;
//        questions.json = up to 6 short questions the teacher answers with one tap: ["…", { "q": "…", "yn": true }]
//        (yn = "yes" or "no" answers it). Ask few, ask one thing each, and prefer yes / no: he teaches between trades.
//   node --use-env-proxy scripts/mosha-lessons.mjs ask <lesson id> <questions.json>
//        the questions alone, put under the desk's last answer (while the teacher has not answered it)
//   node --use-env-proxy scripts/mosha-lessons.mjs learn <term|step|rule|avoid> <file with one line> [lesson id,…]
//        a proposed line of the book (it is the desk's reading until the teacher confirms or corrects it)
// Order of work, every time: read BOOK.md first (a confirmed or corrected line is the teacher's word and overrides anything the
// desk thought before), then each waiting lesson with its pictures, then answer, then propose what is new.
// The key is never written here or pasted in a chat. Either the session's environment sends it by itself (a network secret
// saved for the host, as "Authorization: Bearer"), or MOSHA_READER_KEY holds it for a local run. MOSHA_BASE changes the site.
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.MOSHA_BASE || 'https://meridianx.dev').replace(/\/+$/, ''), URL_ = `${BASE}/api/mosha-lessons`, GAP = 2500;   // the site allows 30 API calls a minute
const headers = (extra = {}) => ({ ...(process.env.MOSHA_READER_KEY ? { Authorization: `Bearer ${process.env.MOSHA_READER_KEY}` } : {}), ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }, KIND = { term: 'Terms', step: 'Steps', rule: 'Rules', avoid: 'What to avoid' };
// Who teaches whom. The assistant reads this at the top of the book, before every lesson.
const WHO = 'The teacher teaches the Mosha method; the desk is the student. Mosha is the teacher\'s method, not the desk\'s. Restate what he showed in his own terms, read the levels off his pictures, and ask where something is unclear. Never teach the method back to him, never tell him what a term "should" mean, never judge whether a trade was good, and never bring the wording of the studies or of the desk\'s own first lines to a lesson as if it were his. Where the desk\'s reading differs from his, his is right.';
// the language the teacher works in: the desk answers in it, and proposes its book lines in it
const LANG = { en: 'Answer in English.', fr: 'Answer in FRENCH (the teacher works in French). Keep the words of the method in English, exactly as the teacher writes them: trade, sell, buy, entry, stop, target, level, sweep, VR, CF, BO, zone of the break, barrier, pullback, swing, high, low, timeframe, H4 / H1 / M30 / M15 / M5, backtest, replay.' };
export const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'lesson';
// the lessons the desk owes an answer: not read yet, or the teacher added something or said "not right"
export const waiting = (l) => l.state === 'new' || l.state === 'more';
// the book as the desk must read it: the teacher's lines first, its own unconfirmed readings last and marked as such
export function bookText(book) {
  const line = (b) => `- ${b.text}${b.status === 'corrected' && b.was ? `  (the desk had: ${b.was})` : ''}`;
  const part = (title, items) => (items.length ? [`## ${title}`, ...Object.keys(KIND).flatMap((k) => { const xs = items.filter((b) => b.kind === k); return xs.length ? [`### ${KIND[k]}`, ...xs.map(line), ''] : []; })] : []);
  return ['# What the desk knows about Mosha', '', WHO, '', ...part('The teacher\'s word (confirmed, corrected or taught): this overrides everything else', book.filter((b) => b.status !== 'proposed')),
    ...part('The desk\'s own reading, NOT confirmed: do not treat as the teacher\'s', book.filter((b) => b.status === 'proposed'))].join('\n');
}
// the questions under one of the desk's answers, each with the teacher's answer: his answer is his word on that point
const asked = (m) => (m.by === 'assistant' && Array.isArray(m.ask) ? m.ask.map((x, i) => `    Question ${i + 1}${x.yn ? ' (yes / no)' : ''}: ${x.q}\n      -> ${x.a != null ? `THE TEACHER ANSWERED: ${x.a}` : 'not answered'}`) : []);
// a file given to "reply": a list is the questions, an object is the chart
const extras = (files) => { const o = {}; for (const f of files.filter(Boolean)) { const j = JSON.parse(read(f)); if (Array.isArray(j)) o.ask = j; else o.chart = j; } return o; };
export function lessonText(l) {
  const t = l.trade, who = (m) => (m.by === 'assistant' ? 'THE DESK' : (m.name || m.by).toUpperCase());
  return [`${l.title}`, `by ${l.name || l.by}, ${l.at}  ·  state: ${l.state}  ·  id ${l.id}`, LANG[l.lang] || LANG.en, '', l.note || '(no note)', '',
    t ? `Levels: ${t.side} ${t.entry}, stop ${t.stop}${t.target != null ? `, target ${t.target}` : ''}, ${t.market}${t.tf ? ` ${t.tf}` : ''}, entry at ${new Date(t.at * 1000).toISOString()}${t.exit != null ? `, closed ${t.exit}${t.exitAt ? ` at ${new Date(t.exitAt * 1000).toISOString()}` : ''} = ${t.R > 0 ? '+' : ''}${t.R}R` : ''}${t.src === 'replay' ? '  (taken in a ChronosTrade replay: practice on past candles, not a live trade)' : ''}` : 'Levels: not given', '',
    ...(l.shots.length ? l.shots.map((s, i) => `Picture ${i + 1}: ${s.caption || '(no caption)'}`) : ['(a lesson in words: no picture)']), '',
    'Conversation:', ...(l.thread.length ? l.thread.flatMap((m) => [`[${m.at}] ${who(m)}${m.verdict ? ` (the teacher marked this ${m.verdict === 'right' ? 'RIGHT' : 'NOT RIGHT'})` : ''}: ${m.text}`, ...asked(m)]) : ['(nothing yet: the desk has not answered)'])].join('\n');
}

async function call(url, init = {}) {
  const r = await fetch(url, { ...init, headers: headers(init.headers), signal: AbortSignal.timeout(30000) });
  if (r.status === 401) throw new Error('the site did not accept the key: the owner shows it on the Mosha desk ("Show the assistant\'s key") and saves it in the secure form for this host');
  if (r.status === 429) { await sleep(20000); return call(url, init); }
  return r;
}
async function post(body) { const r = await call(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `the site answered ${r.status}`); return j; }
async function pull(dir, all) {
  const r = await call(URL_); if (!r.ok) throw new Error(`lessons: ${r.status}`);
  const { lessons, book, score } = await r.json(); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'lessons.json'), JSON.stringify(lessons, null, 1)); fs.writeFileSync(path.join(dir, 'book.json'), JSON.stringify(book, null, 1)); fs.writeFileSync(path.join(dir, 'BOOK.md'), bookText(book));
  const todo = lessons.filter((l) => all || waiting(l)); let n = 0;
  for (const l of todo) {
    const d = path.join(dir, `${l.at.slice(0, 10)}-${safe(l.title)}-${l.id}`); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'lesson.txt'), lessonText(l));
    for (const [i, s] of l.shots.entries()) {
      const have = fs.readdirSync(d).find((f) => f.includes(s.img)); if (have) continue;
      await sleep(GAP); const ir = await call(`${URL_}?img=${s.img}`); if (!ir.ok) { console.log(`  picture ${s.img}: ${ir.status}`); continue; }
      const ext = EXT[(ir.headers.get('content-type') || '').split(';')[0]]; if (!ext) { console.log(`  picture ${s.img}: not a picture`); continue; }
      fs.writeFileSync(path.join(d, `${String(i + 1).padStart(2, '0')}-${s.img}.${ext}`), Buffer.from(await ir.arrayBuffer())); n++;
    }
    console.log(`${l.state.padEnd(6)} ${l.id}  ${l.title}  (${l.shots.length} pictures, ${l.thread.length} messages)  -> ${d}`);
  }
  console.log(`${lessons.length} lessons, ${todo.length} waiting for the desk, ${n} pictures saved in ${dir}`);
  console.log(`book: ${score.book} lines, ${score.taught} the teacher's word, ${score.proposed} still the desk's reading  ·  right first time: ${score.right} of ${score.judged} judged`);
}
const read = (file) => { const t = fs.readFileSync(file, 'utf8').trim(); if (!t) throw new Error(`${file} is empty`); return t; };
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b, c, d] = process.argv.slice(2);
  const run = cmd === 'pull' && a ? pull(a, process.argv.includes('--all'))
    : cmd === 'reply' && a && b ? post({ reply: { id: a, text: read(b), ...extras([c, d]) } }).then((j) => { const la = j.lesson.thread.filter((m) => m.by === 'assistant').pop(); console.log(`answer saved under "${j.lesson.title}"${j.lesson.chart ? ' with its chart' : ''}${la && la.ask ? ` and ${la.ask.length} questions` : ''}`); })
    : cmd === 'ask' && a && b ? post({ reply: { id: a, ask: JSON.parse(read(b)) } }).then((j) => console.log(`questions put under the desk's last answer to "${j.lesson.title}"`))
    : cmd === 'learn' && a && b ? post({ learn: { kind: a, text: read(b), from: c ? c.split(',') : [] } }).then((j) => console.log(`proposed for the book (${j.item.kind}): ${j.item.text}`))
    : Promise.reject(new Error('use: pull <dir> [--all]  |  reply <lesson id> <file> [chart.json] [questions.json]  |  ask <lesson id> <questions.json>  |  learn <term|step|rule|avoid> <file> [lesson ids]'));
  run.catch((e) => { console.error(e.message); process.exit(1); });
}
