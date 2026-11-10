// The desk's assistant reads the Mosha lessons with this (api/mosha-lessons.js): the list and every screenshot into a folder,
// and a reply back under a lesson. It talks to the site with the assistant's key and can do nothing else.
//   node --use-env-proxy scripts/mosha-lessons.mjs pull <dir> [--all]     lessons.json + the pictures of the lessons not read yet
//   node --use-env-proxy scripts/mosha-lessons.mjs reply <lesson id> <file with the text>
// The key is never written here or pasted in a chat. Either the session's environment sends it by itself (a network secret
// saved for the host, as "Authorization: Bearer"), or MOSHA_READER_KEY holds it for a local run. MOSHA_BASE changes the site.
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.MOSHA_BASE || 'https://meridianx.dev').replace(/\/+$/, ''), URL_ = `${BASE}/api/mosha-lessons`, GAP = 2500;   // the site allows 30 API calls a minute
const headers = (extra = {}) => ({ ...(process.env.MOSHA_READER_KEY ? { Authorization: `Bearer ${process.env.MOSHA_READER_KEY}` } : {}), ...extra });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const stateOf = (l) => (!l.reply ? 'new' : (l.reply.shots || 0) < (l.shots || []).length ? 'more' : 'read');
export const safe = (s) => String(s).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'lesson';

async function call(url, init = {}) {
  const r = await fetch(url, { ...init, headers: headers(init.headers), signal: AbortSignal.timeout(30000) });
  if (r.status === 401) throw new Error('the site did not accept the key: the owner shows it on the Mosha desk ("Show the assistant\'s key") and saves it in the secure form for this host');
  if (r.status === 429) { await sleep(20000); return call(url, init); }
  return r;
}
async function pull(dir, all) {
  const r = await call(URL_); if (!r.ok) throw new Error(`lessons: ${r.status}`);
  const { lessons } = await r.json(); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'lessons.json'), JSON.stringify(lessons, null, 1));
  const todo = lessons.filter((l) => all || stateOf(l) !== 'read'); let n = 0;
  for (const l of todo) {
    const d = path.join(dir, `${l.at.slice(0, 10)}-${safe(l.title)}-${l.id}`); fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'lesson.txt'), [`${l.title}`, `by ${l.name || l.by}, ${l.at}`, '', l.note || '(no note)', '', ...l.shots.map((s, i) => `${i + 1}. ${s.caption || '(no caption)'}`), '', l.reply ? `Earlier reply (${l.reply.at}):\n${l.reply.text}` : 'Not read yet.'].join('\n'));
    for (const [i, s] of l.shots.entries()) {
      const have = fs.readdirSync(d).find((f) => f.includes(s.img)); if (have) continue;
      await sleep(GAP); const ir = await call(`${URL_}?img=${s.img}`); if (!ir.ok) { console.log(`  picture ${s.img}: ${ir.status}`); continue; }
      const ext = EXT[(ir.headers.get('content-type') || '').split(';')[0]]; if (!ext) { console.log(`  picture ${s.img}: not a picture`); continue; }
      fs.writeFileSync(path.join(d, `${String(i + 1).padStart(2, '0')}-${s.img}.${ext}`), Buffer.from(await ir.arrayBuffer())); n++;
    }
    console.log(`${stateOf(l).padEnd(4)} ${l.id}  ${l.title}  (${l.shots.length} pictures)  -> ${d}`);
  }
  console.log(`${lessons.length} lessons, ${todo.length} to read, ${n} pictures saved in ${dir}`);
}
async function reply(id, file) {
  const text = fs.readFileSync(file, 'utf8').trim(); if (!text) throw new Error('the reply is empty');
  const r = await call(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: { id, text } }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `reply: ${r.status}`); console.log(`reply saved under "${j.lesson.title}"`);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2);
  (cmd === 'pull' && a ? pull(a, process.argv.includes('--all')) : cmd === 'reply' && a && b ? reply(a, b) : Promise.reject(new Error('use: pull <dir> [--all]  |  reply <lesson id> <file>')))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
