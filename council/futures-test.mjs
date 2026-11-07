// Sends one sample futures ticket (a pretend gold buy at the latest price, stop 1 H1-sized move away) to the council's phone
// alerts, so the owner can check the format and the TradingView link. Run from the "Futures ticket test" workflow.
import fs from 'node:fs';
import { ticket } from './futures.mjs';
const DIR = process.argv[2] || 'data', rd = (f) => { try { return JSON.parse(fs.readFileSync(`${DIR}/${f}`, 'utf8')); } catch (e) { return null; } };
const snap = rd('snapshot.json'), gs = rd('ict/snapshot.json'), now = Math.floor(Date.now() / 1000);
const px = snap && snap.markets && snap.markets.xau && snap.markets.xau.price; if (!px) { console.log('no gold price'); process.exit(1); }
const gc = gs && gs.markets && gs.markets.gc && gs.markets.gc.price, basis = gc && Math.abs(gc - px) < 60 ? +(gc - px).toFixed(1) : null;
const x = { market: 'xau', side: 'buy', status: 'open', k: 'replica', entry: px, stop: +(px - 12).toFixed(2), t1: +(px + 24).toFixed(2) };
const tk = ticket(x, now, { account: +process.env.FUT_ACCOUNT || 10000, risk: +process.env.FUT_RISK || 0.25, basis });
const title = `TEST ticket · BUY ${tk.n} ${tk.c.code}`, body = `${tk.text}\n(Test only: not a council signal. Tap to open the chart in TradingView.)`;
console.log(title + '\n' + body + '\n' + tk.url);
const topic = process.env.NTFY_TOPIC || 'mosha-council-d200fdc484';
const r = await fetch(`https://ntfy.sh/${topic}`, { method: 'POST', body, headers: { Title: title, Tags: 'test_tube', Click: tk.url } });
console.log('ntfy', r.status);
const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID || (rd('state.json') || {}).tgChat;
if (tok && chat) { const t = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text: `${title}\n${body}\n${tk.url}`, disable_web_page_preview: true }) }); console.log('telegram', t.status); }
