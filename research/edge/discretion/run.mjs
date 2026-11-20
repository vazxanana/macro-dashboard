// discretion: do the signals a person TOOK do better than the ones they SKIPPED, on the same stream?
// Pre-registered in PREREGISTRATION.md (pushed alone first). Read-only: `node run.mjs <council-data dir>` reads files exported
// with `git show origin/council-data:<file>` (no network) and writes result.json + RESULT.md with AGGREGATES ONLY: never a
// trade id, a note or a person's name. Paper research; nothing live reads this. ICT is its own section, never pooled.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_SIDE = 20, T_BAR = 2, EFFECTS = [0.1, 0.2, 0.3, 0.5], Z80 = 1.96 + 0.8416;
export const GRADE = { 'A+': 6, A: 5, B: 4, C: 3, D: 2, F: 1 };
const DONE = new Set(['win', 'loss', 'be']);

// ---- small pure pieces ----
export function sec(x) {
  if (x == null || x === '') return null;
  if (typeof x === 'number') return Number.isFinite(x) ? (x > 1e11 ? x / 1000 : x) : null;
  const n = Number(x);
  if (Number.isFinite(n)) return n > 1e11 ? n / 1000 : n;
  const t = Date.parse(x);
  return Number.isFinite(t) ? t / 1000 : null;
}
export const unitR = (x) => (Number.isFinite(x?.Rraw) ? x.Rraw : Number.isFinite(x?.R) ? x.R : null);
export const closed = (x) => !!x && DONE.has(x.status) && unitR(x) != null;
export function stats(a) {
  const n = a.length;
  if (!n) return { n: 0, mean: null, sd: null };
  const mean = a.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd };
}
// Welch t of a minus b, with its degrees of freedom
export function welch(a, b) {
  const A = stats(a), B = stats(b);
  if (A.n < 2 || B.n < 2) return { diff: A.n && B.n ? A.mean - B.mean : null, t: null, df: null };
  const va = A.sd ** 2 / A.n, vb = B.sd ** 2 / B.n, se = Math.sqrt(va + vb);
  if (!(se > 0)) return { diff: A.mean - B.mean, t: null, df: null };
  return { diff: A.mean - B.mean, t: (A.mean - B.mean) / se, df: (va + vb) ** 2 / (va ** 2 / (A.n - 1) + vb ** 2 / (B.n - 1)) };
}
// one-sided p from a normal approximation (the bar needs n >= 20 a side, so df is never tiny when this is used)
export function pOneSided(t) {
  if (t == null) return null;
  const z = Math.abs(t), k = 1 / (1 + 0.2316419 * z);
  const tail = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * k * (0.31938153 + k * (-0.356563782 + k * (1.781477937 + k * (-1.821255978 + k * 1.330274429))));
  return t >= 0 ? tail : 1 - tail;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((x, y) => x[0] - y[0]), out = new Array(ps.length);
  let run = 0;
  idx.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, p * (ps.length - k))); out[i] = run; });
  return out;
}
export const actOf = (r) => { const a = String(r?.act || '').trim().toLowerCase(); return a === 'taken' ? 'taken' : a === 'skipped' ? 'skipped' : a === 'missed' ? 'missed' : ''; };
export function gradeOf(r) {
  if (Number.isFinite(Number(r?.score)) && r.score !== '' && r.score != null) { const s = Number(r.score); if (s >= 1 && s <= 10) return s; }
  const g = String(r?.grade || '').trim().toUpperCase();
  return GRADE[g] ?? null;
}
// B = stamped before the execution's close; B0 = at or before its open; H = hindsight (at or after the close, or no stamp)
export function classOf(review, exec) {
  const at = sec(review?.at), c = sec(exec?.closed), o = sec(exec?.opened);
  if (at == null || c == null || !(at < c)) return 'H';
  return o != null && at <= o ? 'B0' : 'B';
}
// the pre-registered power arithmetic
export function power(sd, d) {
  if (!(sd > 0) || !(d > 0)) return null;
  return { d, t2: Math.ceil(2 * (T_BAR * sd / d) ** 2), p80: Math.ceil(2 * (Z80 * sd / d) ** 2) };
}
export function ratePer30(times) {
  const t = times.filter((x) => x != null).sort((a, b) => a - b);
  if (t.length < 2) return { n: t.length, days: null, per30: null };
  const days = (t[t.length - 1] - t[0]) / 86400;
  return { n: t.length, days: +days.toFixed(1), per30: days > 0 ? t.length / days * 30 : null };
}
export function judge(a, b) {
  const A = stats(a), B = stats(b), w = welch(a, b);
  const judged = A.n >= MIN_SIDE && B.n >= MIN_SIDE;
  return { a: A, b: B, diff: w.diff, t: judged ? w.t : null, df: judged ? w.df : null, judged, p: judged ? pOneSided(w.t) : null, verdict: judged ? null : 'too few to judge' };
}

// ---- the study on a set of loaded files (pure: everything handed in) ----
// execs: [{ id, src: 'live' | 'replay', ...record }]; reviews: { <id>: review } (the desk file's shape) or null when absent
export function ictStudy(execs, reviews) {
  const byId = new Map(execs.map((x) => [x.id, x]));
  const c = { reviews: 0, reviewers: 0, matched: 0, unmatched: 0, open: 0, taken: 0, skipped: 0, missed: 0, noAct: 0, B: 0, B0: 0, H: 0, live: 0, replay: 0 };
  const who = new Set(), rows = [];
  for (const [id, r] of Object.entries(reviews || {})) {
    c.reviews++; if (r?.by) who.add(String(r.by));
    const x = byId.get(id);
    if (!x) { c.unmatched++; continue; }
    c.matched++; c[x.src]++;
    const act = actOf(r);
    if (!act) c.noAct++; else c[act]++;
    if (!closed(x)) { c.open++; continue; }
    const cls = classOf(r, x);
    c[cls === 'H' ? 'H' : 'B']++; if (cls === 'B0') c.B0++;
    rows.push({ act, cls, R: unitR(x), aset: !!x.aset, grade: gradeOf(r) });
  }
  c.reviewers = who.size;
  const before = rows.filter((r) => r.cls !== 'H'), hind = rows.filter((r) => r.cls === 'H');
  const pick = (set, act, f = () => true) => set.filter((r) => r.act === act && f(r)).map((r) => r.R);
  const d1 = judge(pick(before, 'taken'), pick(before, 'skipped'));
  const d1a = judge(pick(before, 'taken', (r) => r.aset), pick(before, 'skipped', (r) => r.aset));
  const graded = before.filter((r) => r.grade != null), gs = graded.map((r) => r.grade).sort((a, b) => a - b);
  const med = gs.length ? (gs.length % 2 ? gs[(gs.length - 1) / 2] : (gs[gs.length / 2 - 1] + gs[gs.length / 2]) / 2) : null;
  const d2 = judge(graded.filter((r) => r.grade > med).map((r) => r.R), graded.filter((r) => r.grade <= med).map((r) => r.R));
  const tests = { D1: d1, D1a: d1a, D2: d2 };
  const jd = ['D1', 'D2'].filter((k) => tests[k].judged), hp = holm(jd.map((k) => tests[k].p));
  jd.forEach((k, i) => { const t = tests[k]; t.holm = hp[i]; t.verdict = t.diff > 0 && t.t >= T_BAR && hp[i] < 0.05 ? 'PASS' : 'FAIL'; });
  if (d1a.judged) d1a.verdict = 'reported';
  // hindsight marks: counted and described, never judged
  const hindsight = { n: hind.length, taken: stats(pick(hind, 'taken')), skipped: stats(pick(hind, 'skipped')), note: 'marked at or after the result: hindsight, not evidence' };
  return { counts: c, before: before.length, tests, hindsight, verdict: d1.judged ? d1.verdict : 'TOO FEW TO JUDGE' };
}

export function lossReviewCount(reviews, isHuman = () => true) {
  const out = { n: 0, authors: 0, before: 0, after: 0, noStamp: 0, losses: 0, shadow: 0 };
  const who = new Set();
  for (const r of Object.values(reviews || {})) {
    if (!isHuman(r)) continue;
    out.n++; if (r.by) who.add(String(r.by));
    const at = sec(r.at), c = sec(r.closed);
    if (at == null || c == null) out.noStamp++; else if (at < c) out.before++; else out.after++;
    if (Number(r.R) < 0) out.losses++;
    if (r.shadow) out.shadow++;
  }
  out.authors = who.size;
  return out;
}
export function powerTable(Rs, forwardTimes) {
  const s = stats(Rs), rate = ratePer30(forwardTimes);
  return {
    n: s.n, mean: s.mean == null ? null : +s.mean.toFixed(4), sd: s.sd == null ? null : +s.sd.toFixed(4), forward: rate,
    rows: EFFECTS.map((d) => {
      const p = power(s.sd, d);
      if (!p) return { d, t2: null, p80: null };
      const m = (n) => (rate.per30 > 0 ? +(2 * n / rate.per30).toFixed(1) : null);
      return { ...p, monthsT2: m(p.t2), months80: m(p.p80) };
    }),
  };
}

// ---- file part ----
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return undefined; } };
const list = (j) => (Array.isArray(j) ? j : Array.isArray(j?.trades) ? j.trades : j && typeof j === 'object' ? Object.values(j).filter((x) => x && typeof x === 'object' && x.id) : []);
const f2 = (v, d = 2) => (v == null || !Number.isFinite(v) ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const num = (v) => (v == null ? 'n/a' : v.toLocaleString('en-US'));

export function build(dir, meta = {}) {
  const J = (f) => readJson(path.join(dir, f));
  const desk = J('ict/desk.json'), notes = J('ict/mcp-notes.json'), losses = J('reviews/losses.json'), analyst = J('reviews/analyst.json');
  const live = list(J('ict/trades.json')).map((x) => ({ ...x, src: 'live' }));
  const rp = J('ict/replay.json'), replay = list(rp).map((x) => ({ ...x, src: 'replay' }));
  const council = list(J('trades.json'));
  const ict = ictStudy([...live, ...replay], desk?.reviews || (desk && !desk.updated ? desk : null));
  const cLive = council.filter((x) => DONE.has(x.status) && !x.shadow && !x.void && Number.isFinite(x.R));
  const taken = council.filter((x) => 'act' in x || 'taken' in x || 'decision' in x).length;
  const inventory = {
    'ict/desk.json': { present: desk !== undefined, reviews: ict.counts.reviews },
    'ict/mcp-notes.json': { present: notes !== undefined, notes: notes === undefined ? 0 : Array.isArray(notes?.notes) ? notes.notes.length : Array.isArray(notes) ? notes.length : Object.keys(notes || {}).length },
    'reviews/losses.json': { present: losses !== undefined, ...lossReviewCount(losses?.reviews) },
    'reviews/analyst.json': { present: analyst !== undefined, n: Object.keys(analyst?.reviews || {}).length, human: false },
    'trades.json take / skip fields': { records: council.length, withDecision: taken },
    notOnCouncilData: ['Mosha log (private store)', 'Mosha lessons (private store)', 'ChronosTrade sessions (browser)', 'Academy store (private store)', 'the old browser journal (removed 17 Nov 2026)'],
  };
  const asetRp = replay.filter((x) => closed(x) && x.aset), allRp = replay.filter(closed);
  const powerIct = {
    aSetups: powerTable(asetRp.map(unitR), live.filter((x) => x.aset).map((x) => sec(x.opened))),
    everySignal: powerTable(allRp.map(unitR), live.map((x) => sec(x.opened))),
    perUnitNote: { n: asetRp.length, sdOfRDividedBySize: +(stats(asetRp.map((x) => (x.size > 0 ? x.R / x.size : x.R))).sd || 0).toFixed(4) },
  };
  const powerCouncil = { liveBook: powerTable(cLive.map((x) => x.R), cLive.map((x) => sec(x.opened))) };
  return {
    title: 'Discretion: do the signals a person took beat the ones they skipped?',
    system: 'human take / skip decisions recorded before the outcome, per signal stream (ICT its own section)',
    built: meta.built || new Date().toISOString().slice(0, 10), prereg: 'PREREGISTRATION.md', councilData: meta.commit || null,
    bar: { minSide: MIN_SIDE, t: T_BAR, holm: 0.05 }, inventory,
    ict: { executions: { live: live.length, liveClosed: live.filter(closed).length, replay: replay.length, replayClosed: allRp.length }, ...ict, power: powerIct },
    council: { D3: taken ? 'records found: not pre-registered beyond a count' : 'no record exists', decisionsBeforeOutcome: 0, power: powerCouncil },
    decisionsBeforeOutcome: ict.before, verdict: ict.verdict,
  };
}

export function report(r) {
  const inv = r.inventory, L = inv['reviews/losses.json'], c = r.ict.counts, T = r.ict.tests;
  const pw = (p) => p.rows.map((x) => `| ${x.d.toFixed(2)}R | ${num(x.t2)} | ${num(x.p80)} | ${x.monthsT2 == null ? 'n/a' : num(x.monthsT2)} | ${x.months80 == null ? 'n/a' : num(x.months80)} |`).join('\n');
  const head = '| Taken beats skipped by | n a side for t = 2 (about a coin flip to show it) | n a side for 80 % power | months to t = 2 | months to 80 % |\n|---|---|---|---|---|';
  const tl = (k, name) => { const t = T[k]; return `| ${name} | ${t.a.n} | ${t.b.n} | ${t.judged ? f2(t.diff) + 'R' : 'n/a'} | ${t.judged ? f2(t.t) : 'n/a'} | ${t.verdict} |`; };
  const A = r.ict.power.aSetups, E = r.ict.power.everySignal, C = r.council.power.liveBook;
  return `# Result: discretion, taken against skipped signals (20 Nov 2026)

**Verdict: ${r.verdict}.** ${r.decisionsBeforeOutcome} human take / skip decisions recorded before the outcome exist on council-data (ICT: ${r.ict.before}; council systems: ${r.council.decisionsBeforeOutcome}); the bar needs ${r.bar.minSide} a side. The owner's view (the edges work when a person chooses) can be neither confirmed nor refuted today: nothing records the choosing.

Pre-registered in \`PREREGISTRATION.md\` (pushed alone before any figure here). council-data commit \`${r.councilData}\`. Paper research only; read-only; nothing live changed. Aggregates only: no trade, note or name of any person is in this folder. Not an edge, and not evidence against one: an absence of records.

## 1. What exists (the exact count)

| Source | On council-data | Records | Stamped before the outcome | Usable |
|---|---|---|---|---|
| \`ict/desk.json\` (Taken / Skipped / Missed, grade, score per ICT signal) | ${inv['ict/desk.json'].present ? 'yes' : 'no (absent from the branch and its history)'} | ${c.reviews} | ${r.ict.before} | ${r.ict.before} |
| \`ict/mcp-notes.json\` (connector notes) | ${inv['ict/mcp-notes.json'].present ? 'yes' : 'no'} | ${inv['ict/mcp-notes.json'].notes} | n/a (free text, no take / skip) | 0 |
| \`reviews/losses.json\` (human loss reviews) | ${L.present ? 'yes' : 'no'} | ${L.n} by ${L.authors} reviewer${L.authors === 1 ? '' : 's'} | ${L.before} (after the close: ${L.after}) | 0: hindsight, and losing trades only (${L.losses} of ${L.n} are losses, ${L.shadow} on shadow trades), so no "taken vs skipped" can be read from them |
| \`reviews/analyst.json\` (post-mortems) | ${inv['reviews/analyst.json'].present ? 'yes' : 'no'} | ${inv['reviews/analyst.json'].n} | n/a | 0: written by a program, not a person |
| \`trades.json\` (council systems) | yes | ${num(inv['trades.json take / skip fields'].records)} | ${inv['trades.json take / skip fields'].withDecision} carry a take / skip field | 0 |
| ${inv.notOnCouncilData.join('; ')} | no | not readable here | not known | not counted, never guessed |

The ICT desk page keeps its Taken / Skipped marks in the browser (localStorage) and writes \`ict/desk.json\` only when a GitHub token is pasted in; the connector's \`ict_desk_update\` writes the same file. Neither has written it once. The Mosha desk's own record already says the same on its side (17 Nov 2026: 0 trades logged before entry).

## 2. ICT (a separate edge, its own section)

${r.ict.executions.live} forward signals (${r.ict.executions.liveClosed} closed) and ${r.ict.executions.replay} replay records. Reviews matched to an execution: ${c.matched} (Taken ${c.taken}, Skipped ${c.skipped}, Missed ${c.missed}); before the outcome ${r.ict.before}, hindsight ${r.ict.hindsight.n}.

| Test | n taken / higher grade | n skipped / lower grade | difference | Welch t | verdict |
|---|---|---|---|---|---|
${tl('D1', 'D1 taken vs skipped, every decided signal (primary)')}
${tl('D1a', 'D1 on A-setups alone (reported)')}
${tl('D2', 'D2 grade above the median vs at or below')}

**How many decisions it would take.** Per-unit R of the ${num(A.n)} closed replay A-setups has a standard deviation of ${A.sd}R (mean ${f2(A.mean, 3)}R; every signal: sd ${E.sd}R, n ${num(E.n)}). The forward desk recorded ${A.forward.n} A-setups in ${A.forward.days} days (${A.forward.per30 == null ? 'n/a' : A.forward.per30.toFixed(1)} a 30 days; every signal ${E.forward.per30 == null ? 'n/a' : E.forward.per30.toFixed(1)}). Months assume EVERY A-setup gets a decision before its exit and half are taken:

${head}
${pw(A)}

On every signal instead of A-setups (rate ${E.forward.per30 == null ? 'n/a' : E.forward.per30.toFixed(1)} a 30 days):

${head}
${pw(E)}

Note: replay records carry no \`Rraw\`, so the pre-registered "Rraw, else R" reads their sized R; divided by \`size\` the A-setup sd is ${r.ict.power.perUnitNote.sdOfRDividedBySize}R.

## 3. Council systems (own section, never pooled with ICT)

D3: ${r.council.D3}. No council system has a place where a person says "take" or "skip" before the outcome (alerts go out; nothing comes back). For scale only: the ${num(C.n)} closed live-book records of \`trades.json\` (legacy engine setups included) have a per-trade sd of ${C.sd}R (mean ${f2(C.mean, 3)}R before costs), ${C.forward.per30 == null ? 'n/a' : C.forward.per30.toFixed(1)} a 30 days over ${C.forward.days} days:

${head}
${pw(C)}

Caveat: that rate is the pre-registered arithmetic on what is on file, and most of those records are the legacy engine setups of 1-4 Nov (retired). Today's live paper book is two gold systems that close a few positions a month, so on the book as it stands the months are many times longer; the shadow and research streams are where signals are frequent.

## 4. Reading

- **Count: ${r.decisionsBeforeOutcome}.** The claim "discretion is the difference" is untested, not failed. Every past example of a person's good picks in this repository was chosen after the result (the Mosha examples, the loss reviews), which is what this count means.
- **The sample needed is large.** With R this noisy, a real advantage of 0.3R a trade (large) needs about ${num(A.rows[2].t2)} decided A-setups a side for an even chance of t = 2; 0.5R needs ${num(A.rows[3].t2)}. A 20-a-side reading can only show an effect of about ${A.sd == null ? 'n/a' : (2 * A.sd * Math.sqrt(2 / 20)).toFixed(1)}R a trade. So the capture has to start now and cover every signal, or it will never be judged.
- **Limits.** The desk file keeps one \`at\` per review (the last save), so a mark edited after the result would look late and one made early then left alone looks early: only a server stamp of the FIRST decision settles it. "Skipped" must be a recorded choice; an unmarked signal is not a skip. Taken-vs-skipped measures selection among the system's signals, not a person's own entries, exits or sizing.
- The owner's proposal is \`research/proposals/2026-11-20-discretion.md\`. Nothing is built by this study.

To repeat: export the files with \`git show origin/council-data:<file>\` into a folder (same paths), then \`node research/edge/discretion/run.mjs <folder> <commit>\`.
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: node run.mjs <council-data dir> [commit]'); process.exit(1); }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const r = build(dir, { commit: process.argv[3] || null, built: process.argv[4] });
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(r, null, 1) + '\n');
  fs.writeFileSync(path.join(here, 'RESULT.md'), report(r));
  console.log(r.verdict, JSON.stringify(r.ict.counts), JSON.stringify(r.ict.power.aSetups), JSON.stringify(r.council.power.liveBook));
}
