// The desk's assistant learns from the Mosha teacher with this (api/mosha-lessons.js). It talks to the site with the
// assistant's key and can read, answer and propose lines for the book, nothing else.
//   node --use-env-proxy scripts/mosha-lessons.mjs pull <dir> [--all]
//        BOOK.md (what the desk knows: the teacher's lines first) + lessons.json + a folder per lesson that waits for the desk
//        (lesson.txt: the note, the levels, the captions and the whole conversation; the pictures beside it)
//   node --use-env-proxy scripts/mosha-lessons.mjs reply <lesson id> <file with the answer> [chart.json]
//        what was understood, in the teacher's words; chart.json = the same reading as marks and steps for the replay chart
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
export const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'lesson';
// the lessons the desk owes an answer: not read yet, or the teacher added something or said "not right"
export const waiting = (l) => l.state === 'new' || l.state === 'more';
// the book as the desk must read it: the teacher's lines first, its own unconfirmed readings last and marked as such
export function bookText(book) {
  const line = (b) => `- ${b.text}${b.status === 'corrected' && b.was ? `  (the desk had: ${b.was})` : ''}`;
  const part = (title, items) => (items.length ? [`## ${title}`, ...Object.keys(KIND).flatMap((k) => { const xs = items.filter((b) => b.kind === k); return xs.length ? [`### ${KIND[k]}`, ...xs.map(line), ''] : []; })] : []);
  return ['# What the desk knows about Mosha', '', ...part('The teacher\'s word (confirmed, corrected or taught): this overrides everything else', book.filter((b) => b.status !== 'proposed')),
    ...part('The desk\'s own reading, NOT confirmed: do not treat as the teacher\'s', book.filter((b) => b.status === 'proposed'))].join('\n');
}
export function lessonText(l) {
  const t = l.trade, who = (m) => (m.by === 'assistant' ? 'THE DESK' : (m.name || m.by).toUpperCase());
  return [`${l.title}`, `by ${l.name || l.by}, ${l.at}  ·  state: ${l.state}  ·  id ${l.id}`, '', l.note || '(no note)', '',
    t ? `Levels: ${t.side} ${t.entry}, stop ${t.stop}${t.target != null ? `, target ${t.target}` : ''}, ${t.market}, entry at ${new Date(t.at * 1000).toISOString()}` : 'Levels: not given', '',
    ...(l.shots.length ? l.shots.map((s, i) => `Picture ${i + 1}: ${s.caption || '(no caption)'}`) : ['(a lesson in words: no picture)']), '',
    'Conversation:', ...(l.thread.length ? l.thread.map((m) => `[${m.at}] ${who(m)}${m.verdict ? ` (the teacher marked this ${m.verdict === 'right' ? 'RIGHT' : 'NOT RIGHT'})` : ''}: ${m.text}`) : ['(nothing yet: the desk has not answered)'])].join('\n');
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
  const [cmd, a, b, c] = process.argv.slice(2);
  const run = cmd === 'pull' && a ? pull(a, process.argv.includes('--all'))
    : cmd === 'reply' && a && b ? post({ reply: { id: a, text: read(b), ...(c ? { chart: JSON.parse(read(c)) } : {}) } }).then((j) => console.log(`answer saved under "${j.lesson.title}"${j.lesson.chart ? ' with its chart' : ''}`))
    : cmd === 'learn' && a && b ? post({ learn: { kind: a, text: read(b), from: c ? c.split(',') : [] } }).then((j) => console.log(`proposed for the book (${j.item.kind}): ${j.item.text}`))
    : Promise.reject(new Error('use: pull <dir> [--all]  |  reply <lesson id> <file> [chart.json]  |  learn <term|step|rule|avoid> <file> [lesson ids]'));
  run.catch((e) => { console.error(e.message); process.exit(1); });
}
