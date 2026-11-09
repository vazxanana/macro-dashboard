// Council / ICT rounds on Vercel (7 Nov 2026: the repo goes private, so the 24/7 loops leave GitHub Actions).
// A Vercel cron calls /api/run?job=council (every 4 min) and /api/run?job=ict (:04/:19/:34/:49). Each call:
//   1. downloads only the files that job reads from the council-data branch (not the 700 MB branch),
//   2. runs the unchanged script (council/trader.mjs or ict/tracker.mjs) on them in /tmp,
//   3. commits just the changed files back to council-data through the GitHub API (retrying if the branch moved).
// RUN_MODE=live commits and lets the alerts out for both jobs; RUN_MODE=ict (or council) does it for that job only; anything else is a dry run (no commit, no Telegram/ntfy), used to
// compare with the GitHub loop before switching it off. ?mode=dry forces a dry run.
// Edge Config (api/_flags.js) can pause a job or set the run mode without a redeploy; its runMode wins over RUN_MODE.
// Environment: CRON_SECRET, GH_TOKEN (fine-grained, this repo: Contents read/write), RUN_MODE, and the trader's own
// NTFY_TOPIC, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, FUT_ACCOUNT, FUT_RISK.
const flags = require('./_flags');
// every round (dry or live) leaves a small report in Blob (runs/<job>-*.json, newest 3 kept) so /api/status can show what the
// last round did even when it committed nothing (7 Nov: the council ran dry for hours with no way to see it)
async function report(job, rec) { const tok = process.env.BLOB_READ_WRITE_TOKEN; if (!tok) return;
  try { const { put, list, del } = require('@vercel/blob');
    await put(`runs/${job}-${Date.now()}.json`, JSON.stringify({ ...rec, at: new Date().toISOString() }), { access: 'private', addRandomSuffix: true, contentType: 'application/json', token: tok });
    const { blobs } = await list({ prefix: `runs/${job}-`, token: tok }); blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    if (blobs.length > 3) await del(blobs.slice(3).map((b) => b.url), { token: tok }); } catch (e) { console.error('report', e.message); } }
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const REPO = 'vazxanana/macro-dashboard', BR = 'council-data';
const JOBS = {
  council: { script: 'council/trader.mjs', arg: (d) => d, budget: 225e3, files: ['trades.json', 'state.json', 'config.json', 'coach.json', 'research.json', 'snapshot.json',
    'backtest.json', 'research/replay-2w.json', 'reviews/losses.json', 'reviews/analyst.json', 'ict/snapshot.json', 'mt5/signals.csv', 'analysis/latest.md', 'ctrader/mirror.json', 'ctrader/symbols.json'], writes: (f) => !f.startsWith('ict/') && !f.startsWith('ctrader/') },
  ict: { script: 'ict/tracker.mjs', arg: (d) => path.join(d, 'ict'), budget: 270e3, files: ['ict/trades.json', 'ict/bars.json', 'ict/snapshot.json', 'ict/shadow.json'], writes: (f) => f.startsWith('ict/') },
};
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const walk = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), b) : [path.relative(b, path.join(d, e.name)).split(path.sep).join('/')]);

module.exports = async (req, res) => {
  if (!require('./_guard').bearerOk(req.headers && req.headers.authorization, process.env.CRON_SECRET)) return res.status(401).json({ error: 'unauthorised' });   // constant time
  const job = String((req.query && req.query.job) || ''), J = JOBS[job]; if (!J) return res.status(400).json({ error: 'unknown job' });
  const F = await flags(), paused = [].concat(F.paused || []);
  if (paused.includes(job) || paused.includes('all')) { console.log(JSON.stringify({ job, paused: true })); return res.status(200).json({ job, paused: true }); }
  const RM = String(F.runMode || process.env.RUN_MODE || '').split(',').map((x) => x.trim()), live = (RM.includes('live') || RM.includes(job)) && req.query.mode !== 'dry', tok = process.env.GH_TOKEN || process.env.GH_DISPATCH_TOKEN, t0 = Date.now();
  // network errors (GitHub's HTTP/2 GOAWAY mid-upload, 7 Nov) are retried with backoff; HTTP errors are not
  const gh = async (u, o = {}) => { let r; for (let a = 0; ; a++) { try { r = await fetch(`https://api.github.com/repos/${REPO}${u}`, { ...o, headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'aurum-desk-runner', ...(o.body ? { 'Content-Type': 'application/json' } : {}), ...(o.headers || {}) } }); break; } catch (e) { if (a >= 3) throw e; await new Promise((ok) => setTimeout(ok, 800 * (a + 1) ** 2)); } }
    if (!r.ok && !(o.ok || []).includes(r.status)) throw new Error(`GitHub ${r.status} ${u}: ${(await r.text()).slice(0, 200)}`); return r; };
  let STEP = 'start', SUM = null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `${job}-`)), before = {};
  try {
    if (live && !tok) throw new Error('GH_TOKEN not set');
    // owner (7 Nov): one runner at a time. While the GitHub Actions council loop is committing (it saved a round in the last
    // 10 minutes), the Vercel council round stands down: no trading, no alerts, no commit. If Actions stops (e.g. the repo goes
    // private), Vercel takes over by itself on the next cron.
    if (job === 'council') { try { const r = await gh(`/commits?sha=${BR}&per_page=1`); const c = (await r.json())[0];
      const who = c && ((c.author && c.author.login) || (c.commit && c.commit.author && c.commit.author.name) || ''), at = c && Date.parse(c.commit.committer.date);
      if (/github-actions|mosha-council/.test(who) && Date.now() - at < 10 * 60e3) { const sk = { job, mode: 'skipped', why: `GitHub Actions saved ${Math.round((Date.now() - at) / 60e3)} min ago`, seconds: 0 };
        console.log(JSON.stringify(sk)); await report(job, sk); return res.status(200).json(sk); } } catch (e) { console.error('actions check', e.message); } }
    STEP = 'download';
    // 1. the files this job reads, at the branch's current commit
    const head = (await (await gh(`/git/ref/heads/${BR}`)).json()).object.sha;
    await Promise.all(J.files.map(async (f) => {
      const enc = f.split('/').map(encodeURIComponent).join('/');
      const r = tok ? await gh(`/contents/${enc}?ref=${head}`, { headers: { Accept: 'application/vnd.github.raw' }, ok: [404] }) : await fetch(`https://raw.githubusercontent.com/${REPO}/${head}/${enc}`);
      if (r.status === 404) return; if (!r.ok) throw new Error(`download ${f}: ${r.status}`);
      const b = Buffer.from(await r.arrayBuffer()); fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), b); before[f] = sha1(b); }));
    STEP = 'script';
    // 2. one round of the unchanged script
    const env = { ...process.env };
    // dry run: no alerts. Deleting NTFY_TOPIC alone was not enough: the trader then falls back to its default ntfy topic.
    if (!live) { delete env.NTFY_TOPIC; delete env.TELEGRAM_BOT_TOKEN; delete env.TELEGRAM_CHAT_ID; env.COUNCIL_ALERTS = 'off'; }
    let out = '', failed = null;
    try { out = execFileSync(process.execPath, [path.join(process.cwd(), J.script), J.arg(dir)], { env, cwd: process.cwd(), timeout: J.budget, maxBuffer: 32 << 20, encoding: 'utf8' }); }
    catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); failed = e.killed ? 'timed out' : `exit ${e.status}`; }
    console.log(`[${job}] ${failed || 'ok'} in ${Math.round((Date.now() - t0) / 1000)} s\n` + out.slice(-3000));
    // 3. what changed (only this job's own files)
    const changed = walk(dir).filter((f) => J.writes(f) && sha1(fs.readFileSync(path.join(dir, f))) !== before[f]);
    const summary = { job, mode: live ? 'live' : 'dry', base: head.slice(0, 7), seconds: Math.round((Date.now() - t0) / 1000), failed, changed: changed.map((f) => `${f} (${fs.statSync(path.join(dir, f)).size} B)`) };
    if (job === 'council' && changed.includes('trades.json')) { try { const a = JSON.parse(fs.readFileSync(path.join(dir, 'trades.json'), 'utf8')); summary.trades = a.length; summary.open = a.filter((x) => x.status === 'open').length; } catch (e) {} }
    if (job === 'council') { try { const sn = JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8')); if (sn.d1src) summary.d1src = sn.d1src; if (sn.errors && Object.keys(sn.errors).length) summary.errors = sn.errors; } catch (e) {} }
    SUM = summary;
    if (!live || !changed.length || failed) { console.log(JSON.stringify(summary)); await report(job, summary); return res.status(200).json(summary); }
    STEP = 'commit';
    // 4. commit the changed files on top of whatever the branch is at now (the other job may have committed meanwhile)
    // one file at a time (parallel uploads of the large JSON files made GitHub drop the HTTP/2 connection)
    const blobs = []; for (const f of changed) blobs.push(({ path: f, mode: '100644', type: 'blob', sha: (await (await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: fs.readFileSync(path.join(dir, f)).toString('base64'), encoding: 'base64' }) })).json()).sha }));
    for (let a = 0; a < 4; a++) {
      const cur = (await (await gh(`/git/ref/heads/${BR}`)).json()).object.sha, tree = (await (await gh(`/git/commits/${cur}`)).json()).tree.sha;
      const nt = (await (await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: tree, tree: blobs }) })).json()).sha;
      const c = (await (await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message: `${job === 'ict' ? 'ICT desk' : 'Council run'} ${new Date().toISOString().slice(0, 16)}Z (Vercel)`, tree: nt, parents: [cur] }) })).json()).sha;
      const u = await gh(`/git/refs/heads/${BR}`, { method: 'PATCH', body: JSON.stringify({ sha: c, force: false }), ok: [422] });
      if (u.ok) { summary.commit = c.slice(0, 7); console.log(JSON.stringify(summary)); await report(job, summary); return res.status(200).json(summary); }
      await new Promise((r) => setTimeout(r, 1500 * (a + 1)));
    }
    throw new Error('branch kept moving; commit not saved');
  } catch (e) { const cause = e && e.cause ? `${e.cause.code || ''} ${e.cause.message || e.cause}`.trim() : ''; console.error(`[${job}] ${e.message} ${cause}`); await report(job, { ...(SUM || {}), job, error: String(e.message || e), cause, stack: String(e.stack || '').split('\n').slice(1, 4).join(' | ').slice(0, 300), step: STEP }); return res.status(500).json({ job, error: String(e.message || e), cause }); }
  finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
};
