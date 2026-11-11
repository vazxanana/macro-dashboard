// The council loop's own health (reliability, 8 Nov 2026): is the paper trader still running, and is it still doing its
// job? Pure decision on the council-data files + ONE phone alert per state change, deduplicated in council-data watchdog.json
// `healthSent` (like coach.json decaySent). Run by .github/workflows/watchdog.yml (its own cron, so it still fires when
// council.yml itself is broken) — never from inside the loop it watches. Status only: it changes no rule, trade or file the
// bots read, and never exits non-zero.
//   node council/health.mjs <council-data dir> [--dry]      --dry: print the decision, send and write nothing
//
// Problems it reports (each is a stable id; the alert key is the sorted set of ids):
//   loop            snapshot.json `at` older than CFG.stoppedMin (the loop saves every ~5.6 min on Actions, 4 min on Vercel)
//   run             the council.yml run that just completed failed or timed out (LOOP_RUN_* env from the workflow_run trigger)
//   ict             ict/snapshot.json `at` older than CFG.ictStoppedMin outside the futures weekend (the desk runs every 3rd round)
//   trades          open / pending trades on an OPEN market not re-checked for CFG.tradesStaleMin although the loop keeps saving
//   datacheck       health.json (council/datacheck.mjs, every 2nd round) older than CFG.datacheckMin while the loop keeps saving
//   errors:<key>    the same snapshot.errors key on CFG.errorRuns consecutive observed rounds (a feed or module failing every round)
//   feed:<market>   a market health.json calls stale for CFG.feedStaleMin or more (datacheck alerts first at 15; this is the escalation)
// A feed / trades / datacheck problem is not reported while the loop itself is stopped: the stop is the news.
import fs from 'node:fs';
import path from 'node:path';
import { sendAlerts, when, NTFY_DEFAULT, SITE } from './alerts.mjs';
import { writeAtomic } from './jsonio.mjs';

export const CFG = {
  expectMin: 10,          // a round at most this long ago when all is well (what the message quotes)
  stoppedMin: 20,         // the loop counts as stopped past this (api/status.js and the council.yml cron watchdog use 20 too)
  ictStoppedMin: 45, tradesStaleMin: 60, datacheckMin: 90, feedStaleMin: 30, errorRuns: 3,
  remindH: 12,            // the same problems again: a reminder at most this often
};
const ORDER = ['loop', 'run', 'ict', 'trades', 'datacheck', 'errors', 'feed'];
const min = (a, b) => Math.max(0, Math.round((b - a) / 60));
const ago = (m) => m >= 120 ? `${(m / 60).toFixed(m >= 600 ? 0 : 1)} h` : `${m} min`;
export const ACTIONS = 'https://github.com/vazxanana/macro-dashboard/actions/workflows/council.yml';
// the gold / NQ weekend break, as api/status.js counts it (UTC): Fri 21:00 – Sun 22:00
export const weekendShut = (now) => { const d = new Date(now * 1000), w = d.getUTCDay(), h = d.getUTCHours(); return w === 6 || (w === 5 && h >= 21) || (w === 0 && h < 22); };
const ts = (v) => { const t = typeof v === 'number' ? v * (v < 1e11 ? 1 : 1e-3) : Date.parse(v) / 1000; return Number.isFinite(t) ? t : null; };

// The problems now. `d` = { snapshot, health, trades, ict, run }, `prev` = the previous watchdog.json, `now` unix seconds.
// Returns { problems: [{ id, text }], errStreak, snapshotAt } — errStreak is the per-key count of consecutive observed rounds with
// that snapshot.errors key, advanced only when a new round was saved since the last observation.
export function problems(d, prev, now) {
  const P = [], s = d.snapshot, sAt = s ? ts(s.at) : null, prevAt = prev && prev.snapshotAt ? ts(prev.snapshotAt) : null;
  const loopAge = sAt != null ? min(sAt, now) : null, stopped = loopAge == null || loopAge > CFG.stoppedMin;
  if (stopped) P.push({ id: 'loop', text: loopAge == null ? 'Council stopped: no snapshot.json saved' : `Council stopped: last run ${ago(loopAge)} ago (expected ≤ ${CFG.expectMin} min)` });
  const r = d.run;
  if (r && r.id && ['failure', 'timed_out', 'startup_failure'].includes(String(r.conclusion || ''))) P.push({ id: `run:${r.id}`, text: `Council loop run ${r.conclusion.replace('_', ' ')}${r.url ? ` (${r.url})` : ''}` });
  const iAt = d.ict ? ts(d.ict.at) : null, iAge = iAt != null ? min(iAt, now) : null;
  if (!stopped && d.ict && !weekendShut(now) && (iAge == null || iAge > CFG.ictStoppedMin)) P.push({ id: 'ict', text: `ICT desk stopped: last round ${iAge == null ? 'unknown' : ago(iAge) + ' ago'} (expected about every 35 min, alert after ${CFG.ictStoppedMin} min)` });
  // errors repeating round after round
  const errStreak = {}, pst = (prev && prev.errStreak) || {}, newRound = sAt != null && (prevAt == null || sAt > prevAt), errs = (s && s.errors && typeof s.errors === 'object') ? s.errors : {};
  for (const k of Object.keys(errs)) errStreak[k] = newRound ? (pst[k] || 0) + 1 : (pst[k] || 1);
  if (!stopped) for (const [k, n] of Object.entries(errStreak)) if (n >= CFG.errorRuns) P.push({ id: `errors:${k}`, text: `Trader error ${n} rounds in a row: ${k} — ${String(errs[k]).slice(0, 120)}` });
  if (!stopped && Array.isArray(d.trades) && s && s.markets) {
    const open = d.trades.filter((x) => x && (x.status === 'open' || x.status === 'pending') && s.markets[x.market] && s.markets[x.market].open === true);
    if (open.length) { const last = Math.max(...open.map((x) => x.checked || x.filled || x.opened || 0)), lag = min(last, sAt);
      if (lag > CFG.tradesStaleMin) P.push({ id: 'trades', text: `Trade records not updated for ${ago(lag)} while ${open.length} trade${open.length > 1 ? 's are' : ' is'} open on an open market` }); }
  }
  if (!stopped && d.health) {
    const hAt = ts(d.health.at), hAge = hAt != null ? min(hAt, now) : null;
    if (hAge == null || hAge > CFG.datacheckMin) P.push({ id: 'datacheck', text: `Data check not run for ${hAge == null ? 'unknown' : ago(hAge)} (expected every ~23 min: every 2nd round)` });
    else for (const F of Object.values(d.health.feeds || {})) for (const m of Object.values(F.markets || {}))
      if (m && m.status === 'bad' && (m.staleMin || 0) >= CFG.feedStaleMin) P.push({ id: `feed:${m.sym || m.label}`, text: `Feed stale: ${m.label} ${ago(m.staleMin)} (${F.label})` });
  }
  P.sort((a, b) => ORDER.indexOf(a.id.split(':')[0]) - ORDER.indexOf(b.id.split(':')[0]) || a.id.localeCompare(b.id));
  return { problems: P, errStreak, snapshotAt: sAt != null ? new Date(sAt * 1000).toISOString() : (prev && prev.snapshotAt) || null };
}

// The alert to send now, if any. `sent` = watchdog.json healthSent ({ key, at, items }). Returns { ev | null, mark } where mark is
// the healthSent to save once a channel took the message (or straight away when ev is null: nothing changed).
export function decide(P, sent, now) {
  const key = P.map((p) => p.id).sort().join('|'), prev = sent && typeof sent === 'object' && typeof sent.key === 'string' ? sent : { key: '', at: null, items: [] };
  const last = prev.at ? ts(prev.at) : null, items = P.map((p) => p.text), mark = { key, at: new Date(now * 1000).toISOString(), items };
  const at = when(now), lines = items.map((t) => '• ' + t).join('\n');
  const how = 'Restart: GitHub → Actions → Council trader → Run workflow (the cron watchdog does it too when GitHub runs it; the Vercel runner takes over on its own).';
  if (key === prev.key) {
    if (!key || last == null || now - last < CFG.remindH * 3600) return { ev: null, mark: prev };
    return { mark, ev: { title: `Council problem continues: ${P[0].text.split(':')[0]}`, msg: `${lines}\n${at}`, tags: 'warning', click: ACTIONS } };
  }
  if (!key) return { mark, ev: { title: 'Council back', msg: `Running again: ${(prev.items || []).map((t) => t.split(':')[0]).join(', ') || 'all clear'}.\n${at}`, tags: 'white_check_mark', click: SITE } };
  const prevIds = new Set(prev.key ? prev.key.split('|') : []), fresh = P.filter((p) => !prevIds.has(p.id));
  if (!fresh.length) return { mark, ev: { title: `Council: still ${P.length} problem${P.length > 1 ? 's' : ''}`, msg: `${lines}\n${at}`, tags: 'warning', click: ACTIONS } };
  const head = fresh[0], stopped = P.some((p) => p.id === 'loop' || p.id.startsWith('run:'));
  return { mark, ev: { title: head.text.length > 60 ? head.text.slice(0, 57) + '…' : head.text, msg: `${lines}${stopped ? '\n' + how : ''}\n${at}`, tags: stopped ? 'rotating_light' : 'warning', click: stopped ? ACTIONS : SITE } };
}

export async function main(dir, { env = process.env, fetchFn = fetch, now = Math.floor(Date.now() / 1000), dry = false } = {}) {
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  const prev = rd('watchdog.json') || {};
  const run = env.LOOP_RUN_ID ? { id: env.LOOP_RUN_ID, conclusion: env.LOOP_RUN_CONCLUSION || '', url: env.LOOP_RUN_URL || '' } : null;
  const d = { snapshot: rd('snapshot.json'), health: rd('health.json'), trades: rd('trades.json'), ict: rd('ict/snapshot.json'), run };
  const pr = problems(d, prev, now), dec = decide(pr.problems, prev.healthSent, now);
  const out = { at: new Date(now * 1000).toISOString(), status: pr.problems.length ? 'problem' : 'ok', problems: pr.problems, snapshotAt: pr.snapshotAt, errStreak: pr.errStreak, healthSent: prev.healthSent || { key: '', at: null, items: [] }, lastAlert: prev.lastAlert || null };
  if (dec.ev) {
    const quiet = env.COUNCIL_ALERTS === 'off', topic = quiet ? null : env.NTFY_TOPIC || NTFY_DEFAULT, tgTok = quiet ? null : env.TELEGRAM_BOT_TOKEN || null;
    const tgChat = env.TELEGRAM_CHAT_ID || (rd('state.json') || {}).tgChat || null, tried = (topic ? 1 : 0) + (tgTok && tgChat ? 1 : 0);
    const errors = dry || !tried ? {} : await sendAlerts([dec.ev], { topic, tgTok, tgChat, fetchFn });
    // every channel failed: keep the old mark so the next run tries again; otherwise (sent, or alerts off) mark it
    if (tried && Object.keys(errors).length >= tried) out.alertError = errors;
    else { out.healthSent = dec.mark; if (tried) out.lastAlert = { at: out.at, title: dec.ev.title }; }
  }
  if (!dry) { fs.mkdirSync(dir, { recursive: true }); writeAtomic(path.join(dir, 'watchdog.json'), JSON.stringify(out, null, 1)); }
  return { ...out, ev: dec.ev };
}

if (process.argv[1] && process.argv[1].endsWith('health.mjs')) {
  const dry = process.argv.includes('--dry');
  main(process.argv[2] || 'data', { dry }).then((h) => {
    console.log(`Council health ${h.status}${h.problems.length ? ': ' + h.problems.map((p) => p.text).join(' | ') : ''}`);
    if (h.ev) console.log(`${dry ? 'would send' : h.alertError ? 'NOT sent ' + JSON.stringify(h.alertError) : 'alert'}: [${h.ev.tags}] ${h.ev.title}\n${h.ev.msg}`);
  }).catch((e) => { console.log('Council health check failed:', (e && e.message) || e); });
}
