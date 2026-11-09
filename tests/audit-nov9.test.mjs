// node --test tests/audit-nov9.test.mjs — 9 Nov audit of sign-in, notifications, sounds and veteran rev 1.3
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { captureExpectations } from '../council/veteran.mjs';
const req = createRequire(import.meta.url);
const resOf = () => { const out = { headers: {} }; const res = { setHeader: (k, v) => { out.headers[k] = v; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } }; return { out, res }; };

test('logout refuses a cross-site POST (no forced sign-out) and still works same-site', async () => {
  const logout = req('../api/logout.js');
  let { out, res } = resOf(); await logout({ method: 'POST', headers: { origin: 'https://evil.example', host: 'meridianx.dev' } }, res);
  assert.equal(out.code, 403); assert.equal(out.headers['Set-Cookie'], undefined);
  ({ out, res } = resOf()); await logout({ method: 'POST', headers: { origin: 'https://meridianx.dev', host: 'meridianx.dev' } }, res);
  assert.equal(out.code, 200); assert.match(out.headers['Set-Cookie'], /Max-Age=0/);
});

test('sounds: cross-site POST refused; a JSON string body is read', async () => {
  const { handle } = req('../api/sounds.js'); let db = null; const store = { get: async () => db, put: async (v) => { db = v; } };
  const MP3 = 'data:audio/mpeg;base64,' + 'A'.repeat(40);
  let { out, res } = resOf(); await handle({ method: 'POST', headers: { origin: 'https://evil.example', host: 'meridianx.dev' }, body: { ownerPw: 'right', kind: 'sl', data: MP3 } }, res, { env: {}, store, isOwner: (p) => p === 'right' });
  assert.equal(out.code, 403); assert.equal(db, null);
  ({ out, res } = resOf()); await handle({ method: 'POST', headers: {}, body: JSON.stringify({ ownerPw: 'right', kind: 'sl', data: MP3, name: 'x.mp3' }) }, res, { env: {}, store, isOwner: (p) => p === 'right' });
  assert.equal(out.code, 200); assert.equal(db.sl.name, 'x.mp3');
});

// a failed Blob read must not look like an empty store: the next POST would overwrite every stored item with one
for (const [file, name] of [['../api/notify.js', 'notify'], ['../api/sounds.js', 'sounds'], ['../api/profile.js', 'profile']]) {
  test(`${name}: a failed Blob read throws instead of returning empty`, async () => {
    const m = req(file); assert.equal(typeof m.blobStore, 'function', 'blobStore exported');
    const io = { blob: { list: async () => ({ blobs: [{ pathname: name === 'notify' ? 'notices/list.json' : name === 'sounds' ? 'sounds/config.json' : 'profiles/fred.json', url: 'https://b/x' }] }) }, fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }) };
    const s = m.blobStore({ BLOB_READ_WRITE_TOKEN: 't' }, io);
    await assert.rejects(() => s.get('fred'));
  });
}

test('notify: POST after a failed read answers 5xx and saves nothing', async () => {
  const { handle } = req('../api/notify.js'); let put = 0;
  const store = { get: async () => { throw new Error('blob 500'); }, put: async () => { put++; } };
  const { out, res } = resOf(); await handle({ method: 'POST', body: { title: 'x' } }, res, { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true });
  assert.equal(out.code, 500); assert.equal(put, 0);
});

test('veteran: a consensus posted after capture but before the release is filled in; never after', () => {
  const t = Date.parse('2026-11-10T13:30:00Z') / 1000, ev = { at: '2026-11-10T13:30:00Z', title: 'CPI m/m', previous: '0.2%' };
  let h = captureExpectations([], { playbook: [ev] }, t - 3 * 86400).hist; assert.equal(h[0].expectation.consensus, null);
  h = captureExpectations(h, { playbook: [{ ...ev, consensus: '0.3%' }] }, t - 86400).hist;
  assert.equal(h[0].expectation.consensus, '0.3%'); assert.ok(Date.parse(h[0].expectation.capturedAtUtc) / 1000 < t);
  const h2 = captureExpectations(h, { playbook: [{ ...ev, consensus: '0.5%', actual: '0.4%' }] }, t + 3600).hist;
  assert.equal(h2[0].expectation.consensus, '0.3%', 'never edited once captured'); assert.equal(h2[0].firstPrint.value, '0.4%');
  // no consensus before the release: one appearing afterwards is not back-filled
  let k = captureExpectations([], { playbook: [ev] }, t - 86400).hist; k = captureExpectations(k, { playbook: [{ ...ev, consensus: '0.3%' }] }, t + 60).hist;
  assert.equal(k[0].expectation.consensus, null);
});
