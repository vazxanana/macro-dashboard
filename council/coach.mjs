// Council · Coach evolution (7 Nov 2026, owner: "the council members should evolve and get better, without overfitting").
// Pure helpers, no I/O; trader.mjs wires them into the Coach's learning steps and tests/coach-*.test.mjs cover them.
//
// 1. Shrinkage. A rule change is judged on the shrunk expectancy, not the raw mean: a Normal prior centred on 0R with
//    spread tau (estimated from the data, empirical Bayes) pulls a small or noisy sample toward 0. Posterior mean
//    = w * mean with w = tau² / (tau² + se²). The Coach's old bar (solid(): 30+ trades, |t| >= 2, both halves) stays the floor.
// 2. Champion / challenger. When the Coach changes one of its own paper filter rules (D1 / structure / session) the new
//    rule (challenger) trades and the old one (champion) is kept as a shadow: every signal is recorded whatever blocked it,
//    so both rules are judged on the SAME forward signals (only the ones where they disagree can differ). After CC.minN such
//    signals the challenger stays only if its shrunk edge per disagreeing signal is >= CC.edge; otherwise, or when CC.maxDays
//    pass without enough signals, the champion comes back on its own and the reason is logged.
// 3. Change ledger. Every Coach change (history entries by coach-*) gets a ledger entry in coach.json: before / after numbers,
//    the evidence it used and, 30 days later, what happened. analysis/latest.md shows it (ledgerSection).
// Owner rules (filters[k].src[...] === 'user') and setups that trade live (config.focusSetups) are never touched here.

export const CC = {
  minN: 20,        // forward signals where champion and challenger disagree, before the verdict
  edge: 0.05,      // challenger must beat the champion by this much shrunk R per disagreeing signal
  maxDays: 60,     // no verdict by then: back to the champion (not proven)
  effect: 0.10,    // a rule change also needs |shrunk expectancy| >= this on the group it acts on
  tau: 0.25,       // prior spread of true expectancies when it can't be estimated (R per trade)
  tauMin: 0.05, tauMax: 0.5,
  sdFloor: 0.5,    // a tiny sample of identical results must not look certain
  minGroup: 10,    // groups smaller than this don't inform the empirical-Bayes tau
  ledgerCap: 150,
  days30: 30,
};
const DAY = 86400;
const r3 = (v) => Number.isFinite(v) ? +v.toFixed(3) : v;
const r2 = (v) => Number.isFinite(v) ? +v.toFixed(2) : v;
const fR = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
const vals = (rs) => (rs || []).map((x) => typeof x === 'number' ? x : +(x && x.R)).filter(Number.isFinite);
const sec = (iso) => Math.floor(Date.parse(iso) / 1000);
const iso = (t) => new Date(t * 1000).toISOString();

// standard normal CDF (Abramowitz-Stegun 7.1.26, |error| < 1.5e-7)
export function Phi(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// shrunk expectancy of a set of R results (numbers or trades with R)
export function shrink(rs, tau = CC.tau) {
  const a = vals(rs), n = a.length;
  if (!n) return { n: 0, mean: 0, sd: 0, se: Infinity, w: 0, post: 0, postSd: tau, pPos: 0.5, tau };
  const mean = a.reduce((s, x) => s + x, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  const se = Math.max(sd, CC.sdFloor) / Math.sqrt(n), w = tau * tau / (tau * tau + se * se), post = w * mean, postSd = Math.sqrt(w) * se;
  return { n, mean, sd, se, w, post, postSd, pPos: postSd > 0 ? Phi(post / postSd) : post > 0 ? 1 : post < 0 ? 0 : 0.5, tau };
}

// empirical-Bayes tau from many groups (setup x condition value): E[mean²] = tau² + se² under a prior centred on 0.
// Fewer than 3 usable groups -> the default prior. Clamped so one odd group can't switch shrinkage off or make it total.
export function ebTau(groups, opt = {}) {
  const minN = opt.minN || CC.minGroup, def = opt.tau || CC.tau;
  const G = (groups || []).map(vals).filter((a) => a.length >= minN);
  if (G.length < 3) return def;
  let m2 = 0, s2 = 0;
  for (const a of G) { const s = shrink(a, 1); m2 += s.mean ** 2; s2 += s.se ** 2; }
  const t2 = (m2 - s2) / G.length;
  return Math.min(CC.tauMax, Math.max(CC.tauMin, Math.sqrt(Math.max(0, t2))));
}

// the shrinkage bar on top of the floor: sign * shrunk mean >= CC.effect
export const shrunkClear = (rs, sign, tau = CC.tau) => sign * shrink(rs, tau).post >= CC.effect;

// ─── Rules: fe is 'd1', 'struct' or 'session:<name>'; val is the filter value (d1/struct: string or null = no rule;
//     session: true = skip that session, false = trade it) ───
const isSess = (fe) => String(fe).startsWith('session:');
const normVal = (fe, val) => isSess(fe) ? !!val : (val || null);
export function takes(fe, val, t) {
  const f = (t && t.feat) || {};
  if (isSess(fe)) return !val || f.session !== fe.slice(8);
  if (!val) return true;
  if (fe === 'struct') return !f.struct || f.struct === 'n/a' || f.struct === val;   // as the Trader blocks: n/a passes
  return f[fe] === val;
}
export function ruleState(fl, fe) { fl = fl || {}; return isSess(fe) ? (fl.noSession || []).includes(fe.slice(8)) : (fl[fe] || null); }
export const sameRule = (fl, fe, val) => ruleState(fl, fe) === normVal(fe, val);
export function setRule(fl, fe, val, at) {
  val = normVal(fe, val);
  if (isSess(fe)) {
    const v = fe.slice(8), s = (fl.noSession || []).filter((x) => x !== v);
    if (val) s.push(v);
    if (s.length) fl.noSession = s; else delete fl.noSession;
  } else if (val) fl[fe] = val; else delete fl[fe];
  if (val) (fl.since = fl.since || {})[fe] = at; else if (fl.since) { delete fl.since[fe]; if (!Object.keys(fl.since).length) delete fl.since; }
  return fl;
}
export function descRule(fe, val) {
  val = normVal(fe, val);
  if (isSess(fe)) return `${val ? 'skip' : 'trade'} the ${fe.slice(8)} session`;
  const nm = fe === 'd1' ? 'D1' : 'structure';
  return val ? `only ${val} ${nm}` : `no ${nm} rule`;
}

const isClosed = (t) => t && (t.status === 'win' || t.status === 'loss' || t.status === 'be') && Number.isFinite(+t.R);
export function record(arr) { const a = vals(arr), R = a.reduce((s, x) => s + x, 0); return { n: a.length, R: r2(R), exp: a.length ? r2(R / a.length) : 0 }; }
export const ruleRecord = (arr, fe, val) => record((arr || []).filter((t) => takes(fe, val, t)));

// forward signals of a trial: the setup's closed signals opened since the start (and before `until`, if given);
// d = (challenger takes - champion takes) * R on each signal where the two rules disagree
export function trialDeltas(tr, trades, until = Infinity) {
  const t0 = sec(tr.start), F = (trades || []).filter((t) => t.k === tr.k && isClosed(t) && t.opened >= t0 && t.opened < until);
  const d = [];
  for (const t of F) { const c = takes(tr.fe, tr.challenger, t), p = takes(tr.fe, tr.champion, t); if (c !== p) d.push((c ? 1 : -1) * +t.R); }
  return { signals: F.length, n: d.length, deltaR: d.reduce((s, x) => s + x, 0), d, F };
}

// the verdict on a running trial: 'running' | 'kept' | 'reverted'
export function judgeTrial(tr, trades, now, tau = CC.tau, opt = {}) {
  const P = { ...CC, ...opt }, D = trialDeltas(tr, trades), s = shrink(D.d, tau), age = (now - sec(tr.start)) / DAY;
  const base = { n: D.n, signals: D.signals, deltaR: r2(D.deltaR), shrunk: r3(s.post), pPos: r3(s.pPos), days: r2(age) };
  const rule = `${descRule(tr.fe, tr.challenger)} (challenger) vs ${descRule(tr.fe, tr.champion)} (champion)`;
  if (D.n >= P.minN) {
    if (s.post >= P.edge) return { ...base, status: 'kept', why: `${rule}: on the ${D.n} forward signals where they disagree the challenger made ${fR(D.deltaR)} more in total; shrunk edge ${fR(s.post)} a signal (needs ${fR(P.edge)}). The change stays.` };
    return { ...base, status: 'reverted', why: `${rule}: on the ${D.n} forward signals where they disagree the challenger made ${fR(D.deltaR)} against the champion; shrunk edge ${fR(s.post)} a signal, short of ${fR(P.edge)}. Back to the champion.` };
  }
  if (age > P.maxDays) return { ...base, status: 'reverted', why: `${rule}: only ${D.n} forward signals where they disagree in ${P.maxDays} days (needs ${P.minN}); not proven, back to the champion.` };
  return { ...base, status: 'running', why: `${rule}: ${D.n} of ${P.minN} disagreeing forward signals so far, challenger ${fR(D.deltaR)} against the champion.` };
}

// ─── Ledger ───
const stat = (rs, tau) => { const s = shrink(rs, tau), t = s.se > 0 && Number.isFinite(s.se) ? s.mean / s.se : 0; return { n: s.n, exp: r2(s.mean), t: r2(t), shrunk: r3(s.post), pPos: r3(s.pPos) }; };
// a filter change that runs as a trial: in-sample numbers for both rules on the sample the Coach looked at
export function ledgerStart({ at, by = 'coach-stats', k, fe, champion, challenger, what, why, sample, group, tau = CC.tau, rest }) {
  return { id: `cc-${k}-${fe}-${sec(at)}`, at, by, change: what, setup: k, fe, champion: normVal(fe, champion), challenger: normVal(fe, challenger),
    evidence: { why, sample: (sample || []).length, window: '30 days, every closed signal of the setup (live and shadow)', tau: r3(tau), group: group ? stat(group, tau) : null, rest: rest ? record(rest) : null },
    before: ruleRecord(sample, fe, champion), after: ruleRecord(sample, fe, challenger),
    trial: { status: 'running', n: 0, deltaR: 0 }, d30: { due: iso(sec(at) + CC.days30 * DAY) } };
}
// which trades a history change is about: setups ("scalp, rscalp: ..."), a market ("Paused market xau"), or the whole engine
export function scopeOf(change) {
  const c = String(change || '');
  const p = c.match(/^(Paused|Resumed)( market)? ([\w-]+)/); if (p) return p[2] ? { market: p[3] } : { setups: [p[3]] };
  const m = c.match(/^([\w-]+(?:, [\w-]+)*):\s/); if (m) return { setups: m[1].split(', ') };
  return { all: true };
}
const inScope = (sc, t) => sc.setups ? sc.setups.includes(t.k) : sc.market ? t.market === sc.market : true;
// any other Coach change (stop buffer, minimum stop, break-even, pauses, backtest filters): the scope's record before;
// the 30-day result is the same scope's record after (a before/after, not a controlled test)
export function ledgerFromHistory(h, pool, opt = {}) {
  const at = sec(h.at), sc = scopeOf(h.change);
  const before = record((pool || []).filter((t) => isClosed(t) && inScope(sc, t) && t.opened >= at - CC.days30 * DAY && t.opened < at && (t.closed || 0) <= at));
  return { id: `ch-${at}-${String(h.change).replace(/[^\w]+/g, '-').slice(0, 40)}`, at: h.at, by: h.by, change: h.change, scope: sc,
    evidence: { why: h.why || '' }, before, ...(opt.backfilled ? { backfilled: true } : {}), d30: { due: iso(at + CC.days30 * DAY) } };
}
// fill the 30-day result once it is due. Trial entries: champion vs challenger on the same 30 days of forward signals.
export function settle(e, pool, now) {
  if (!e || !e.d30 || e.d30.at || now < sec(e.d30.due)) return false;
  const t0 = sec(e.at), t1 = sec(e.d30.due);
  if (e.fe) {
    const F = (pool || []).filter((t) => t.k === e.setup && isClosed(t) && t.opened >= t0 && t.opened < t1);
    const cp = ruleRecord(F, e.fe, e.champion), ch = ruleRecord(F, e.fe, e.challenger), deltaR = r2(ch.R - cp.R);
    e.d30 = { due: e.d30.due, at: iso(now), champion: cp, challenger: ch, deltaR, helped: F.length ? deltaR > 0 : null };
  } else {
    const after = record((pool || []).filter((t) => isClosed(t) && inScope(e.scope || {}, t) && t.opened >= t0 && t.opened < t1));
    const deltaExp = after.n && e.before && e.before.n ? r2(after.exp - e.before.exp) : null;
    e.d30 = { due: e.d30.due, at: iso(now), after, deltaExp, helped: deltaExp == null ? null : deltaExp > 0 };
  }
  return true;
}
// add ledger entries for Coach history changes not in the ledger yet (trial reverts carry `trial` and are logged on their
// trial's entry instead), settle due entries, keep the newest CC.ledgerCap
export function syncLedger(ledger, history, pool, now, opt = {}) {
  const L = (ledger || []).slice(), have = new Set(L.map((e) => e.at + '|' + e.change));
  const oldest = L.length >= CC.ledgerCap ? L.reduce((m, e) => e.at < m ? e.at : m, L[0].at) : '';
  for (const h of history || []) {
    if (!/^coach/.test(h.by || '') || h.trial || have.has(h.at + '|' + h.change) || h.at < oldest) continue;
    L.push(ledgerFromHistory(h, pool, { backfilled: !!opt.backfillBefore && h.at < opt.backfillBefore })); have.add(h.at + '|' + h.change);
  }
  for (const e of L) settle(e, pool, now);
  return L.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0).slice(-CC.ledgerCap);
}

// ─── analysis/latest.md block ───
export const LEDGER_START = '<!-- coach-ledger:start -->', LEDGER_END = '<!-- coach-ledger:end -->';
const cell = (s) => String(s == null ? '' : s).replace(/\|/g, '/').replace(/\n/g, ' ');
const rec = (r) => r && r.n ? `${r.n} at ${fR(r.exp)}` : 'no trades';
export function ledgerSection({ ledger = [], trials = {}, now = Math.floor(Date.now() / 1000), rows = 20 }) {
  const when = iso(now).slice(0, 16).replace('T', ' ');
  const out = [LEDGER_START, '## Coach change ledger', '',
    `Built by the Trader at ${when} UTC. Every rule the Coach changed by itself, the evidence it used and what happened 30 days later. Filter changes run as champion/challenger trials: the old rule keeps running as a shadow and the change stays only if it beats it on the same forward signals (${CC.minN} where they disagree, shrunk edge ≥ ${fR(CC.edge)} a signal; else back to the old rule after ${CC.maxDays} days). Owner rules and live setups are not Coach changes.`, ''];
  const T = Object.values(trials || {});
  if (T.length) {
    out.push('**Trials running**', '', '| Setup | Challenger (in force) | Champion (shadow) | Since | Disagreeing signals | Challenger vs champion |', '|---|---|---|---|---|---|');
    for (const tr of T) { const e = ledger.find((x) => x.id === tr.id) || {}, s = e.trial || {};
      out.push(`| ${cell(tr.k)} | ${cell(descRule(tr.fe, tr.challenger))} | ${cell(descRule(tr.fe, tr.champion))} | ${String(tr.start).slice(0, 10)} | ${s.n || 0} of ${CC.minN} | ${fR(s.deltaR || 0)}${s.shrunk != null ? ` (shrunk ${fR(s.shrunk)} a signal)` : ''} |`); }
    out.push('');
  }
  const L = (ledger || []).slice(-rows).reverse();
  if (!L.length) { out.push('No Coach changes recorded yet.', LEDGER_END); return out.join('\n'); }
  out.push('| Date | Change | Evidence | Before → after (the sample it used) | Trial | 30 days later |', '|---|---|---|---|---|---|');
  for (const e of L) {
    const ev = e.evidence && e.evidence.group ? `${e.evidence.group.n} trades at ${fR(e.evidence.group.exp)} (t ${String(e.evidence.group.t).replace('-', '−')}, shrunk ${fR(e.evidence.group.shrunk)})` : cell((e.evidence && e.evidence.why || '').slice(0, 110));
    const ba = e.fe ? `${rec(e.before)} → ${rec(e.after)}` : `${rec(e.before)} in the 30 days before`;
    const tr = e.trial ? `${e.trial.status}${e.trial.n ? ` (${e.trial.n} signals, ${fR(e.trial.deltaR || 0)})` : ''}` : '—';
    const d = e.d30 || {};
    const res = !d.at ? `due ${String(d.due || '').slice(0, 10)}` : e.fe ? `challenger ${rec(d.challenger)} vs champion ${rec(d.champion)}: ${d.helped == null ? 'no signals' : d.helped ? `helped ${fR(d.deltaR)}` : `hurt ${fR(d.deltaR)}`}`
      : `${rec(d.after)}${d.helped == null ? '' : d.helped ? ` (better by ${fR(d.deltaExp)} a trade)` : ` (worse by ${fR(-d.deltaExp)} a trade)`}`;
    out.push(`| ${e.at.slice(0, 10)} | ${cell(e.change)}${e.backfilled ? ' (from history)' : ''} | ${cell(ev)} | ${cell(ba)} | ${cell(tr)} | ${cell(res)} |`);
  }
  const S = (ledger || []).filter((e) => e.d30 && e.d30.at && e.d30.helped != null), up = S.filter((e) => e.d30.helped).length;
  const net = S.filter((e) => e.fe).reduce((s, e) => s + (e.d30.deltaR || 0), 0);
  out.push('', S.length ? `${S.length} change${S.length > 1 ? 's' : ''} with a 30-day result: ${up} helped, ${S.length - up} did not${S.some((e) => e.fe) ? `; trial changes net ${fR(net)} against keeping the old rule` : ''}. Changes outside the trials (stop buffer, minimum stop, pauses) are a before/after, not a controlled test.` : 'No 30-day results yet.', LEDGER_END);
  return out.join('\n');
}
