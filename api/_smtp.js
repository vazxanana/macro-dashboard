// A small SMTP client for the site's own emails (sign-up links, password resets), 17 Nov 2026. Files starting with "_" under
// api/ are modules, not endpoints.
//
// Pure: it takes the socket function as an argument, so it never imports a host's socket module. On the Cloudflare Worker the
// Worker hands in `connect` from `cloudflare:sockets` (cloudflare/src/worker.mjs -> api/signup.js useSmtp); the tests hand in a
// fake socket. Gmail on port 465 with implicit TLS (`secureTransport: 'on'`), AUTH PLAIN, one message per connection.
//
// sendMail({ connect, user, pass, to, subject, text, html?, fromName?, host?, port?, timeoutMs?, now?, id? })
//   -> { ok: true, id } or throws (Error with `.code` = the SMTP reply code, or 'timeout' / 'bad-address').
// Header injection: every header value has CR, LF and other control characters removed; addresses must be one plain address
// (no spaces, angle brackets, commas or quotes); a subject that is not plain ASCII is sent RFC 2047-encoded. The body is dot-stuffed.
const crypto = require('node:crypto');

const ADDR = /^[^\s@<>()",;:\\[\]]{1,64}@[^\s@<>()",;:\\[\]]{1,190}\.[A-Za-z]{2,24}$/;
const oneLine = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
function address(a) { const s = oneLine(a); if (s.length > 254 || !ADDR.test(s)) throw Object.assign(new Error('not a plain email address'), { code: 'bad-address' }); return s; }
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
// a header word: ASCII as it is, anything else as one encoded word
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
// a display name inside quotes (quotes and backslashes taken out), or encoded
const nameOf = (s) => { const n = oneLine(s).replace(/["\\]/g, '').slice(0, 64); return /^[\x20-\x7e]*$/.test(n) ? `"${n}"` : word(n); };
// lines end in CRLF; a line that starts with "." gets a second one (RFC 5321 4.5.2)
const crlf = (s) => String(s).replace(/\r\n|\r|\n/g, '\r\n');
const dotStuff = (s) => crlf(s).split('\r\n').map((l) => (l.startsWith('.') ? '.' + l : l)).join('\r\n');

// the whole message (headers + body), CRLF line ends, not yet dot-stuffed
function build({ from, fromName = 'Aureum Desk', to, subject, text, html, now = Date.now(), id }) {
  const f = address(from), t = address(to), mid = id || `${crypto.randomBytes(12).toString('hex')}@${f.split('@')[1]}`;
  const head = [`From: ${nameOf(fromName)} <${f}>`, `To: <${t}>`, `Subject: ${word(oneLine(subject).slice(0, 150))}`, `Date: ${new Date(now).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${oneLine(mid).replace(/[<>\s]/g, '')}>`, 'MIME-Version: 1.0'];
  const plain = ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', crlf(text || '')].join('\r\n');
  if (!html) return crlf(head.join('\r\n') + '\r\n') + plain + '\r\n';
  const b = `=_aureum_${crypto.randomBytes(8).toString('hex')}`;
  return crlf(head.concat([`Content-Type: multipart/alternative; boundary="${b}"`, '', `--${b}`]).join('\r\n') + '\r\n') + plain
    + `\r\n--${b}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${crlf(html)}\r\n--${b}--\r\n`;
}

// reads SMTP replies (a reply may span lines "250-…" … "250 …") from a ReadableStream of bytes
function replies(readable) {
  const rd = readable.getReader(), dec = new TextDecoder(); let buf = '';
  return async function next() {
    const lines = [];
    for (;;) {
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); lines.push(line);
        if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) return { code: +line.slice(0, 3), text: lines.join('\n') };
        if (!/^\d{3}-/.test(line)) throw Object.assign(new Error('bad SMTP reply'), { code: 'protocol' });
      }
      const { value, done } = await rd.read();
      if (done) throw Object.assign(new Error('connection closed'), { code: 'closed' });
      buf += dec.decode(value, { stream: true });
      if (buf.length > 64e3) throw Object.assign(new Error('reply too long'), { code: 'protocol' });
    }
  };
}

async function sendMail(o) {
  if (typeof o.connect !== 'function') throw Object.assign(new Error('no socket'), { code: 'no-socket' });
  const user = address(o.user), to = address(o.to), msg = build({ ...o, from: user, to });
  const sock = o.connect({ hostname: o.host || 'smtp.gmail.com', port: o.port || 465 }, { secureTransport: 'on', allowHalfOpen: false });
  const w = sock.writable.getWriter(), enc = new TextEncoder(), next = replies(sock.readable);
  const send = (s) => w.write(enc.encode(s));
  const expect = async (want, what) => { const r = await next(); if (!want.includes(r.code)) throw Object.assign(new Error(`${what}: ${r.code}`), { code: r.code }); return r; };
  let timer;
  const run = (async () => {
    await expect([220], 'greeting');
    await send(`EHLO ${o.ehlo || 'aureumdesk.co.uk'}\r\n`); await expect([250], 'EHLO');
    await send(`AUTH PLAIN ${b64(`\u0000${user}\u0000${String(o.pass || '')}`)}\r\n`); await expect([235], 'AUTH');
    await send(`MAIL FROM:<${user}>\r\n`); await expect([250], 'MAIL FROM');
    await send(`RCPT TO:<${to}>\r\n`); await expect([250, 251], 'RCPT TO');
    await send('DATA\r\n'); await expect([354], 'DATA');
    await send(dotStuff(msg).replace(/\r\n$/, '') + '\r\n.\r\n'); await expect([250], 'message');
    try { await send('QUIT\r\n'); await next(); } catch (e) { /* the message is accepted; a lost goodbye does not matter */ }
    return { ok: true };
  })();
  try {
    return await Promise.race([run, new Promise((_, no) => { timer = setTimeout(() => no(Object.assign(new Error('timeout'), { code: 'timeout' })), o.timeoutMs || 15000); })]);
  } finally { clearTimeout(timer); run.catch(() => {}); try { w.releaseLock(); } catch (e) {} try { sock.close(); } catch (e) {} }
}

module.exports = { sendMail, build, dotStuff, address, oneLine, word };
