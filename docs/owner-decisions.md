# Owner decisions (checked against the code on 11 Nov 2026)

One list of what waits on your yes or no. Each item says what it is, why it matters, the options and the one I recommend.
Item numbers never change (other documents point to them). An item that is settled stays here, ticked, with the answer.
Everything is paper and demo only; no item below puts real money at risk.

How to read the boxes: `[ ]` open, `[x]` decided or done, `[~]` partly done (what is left is said in its status line).
Every item has a "Status, 11 Nov" line: that line is the current truth; the text under it is the original write-up.

## What needs you now (most important first)

1. **Change every password, yours first (item 1).** If nothing is decided: the scrambled passwords stay readable in the
   public repository's history, and a short one can be worked out and used to sign in as you.
2. **Give Fred's connector its own limited key and protect the main branch (item 7).** If nothing is decided: his changes,
   which now merge without your review (item 26), keep travelling on whatever key is set, possibly the council's own.
3. **Thirteen ICT replay results built before a market's price history starts: keep or drop (item 29).** If nothing is
   decided: they stay in the ICT record (11 gold results worth +7.49R and 2 Russell 2000 results worth -2R) and the fix
   waits unmerged.
4. **Mosha: who reads Luxus's lessons, and when (item 28).** If nothing is decided: his lessons are stored but nobody reads
   or answers them until a session is started for it, and each new session needs a key set again.
5. **Mosha: log your own trades (item 27).** If nothing is decided: the only evidence on Mosha stays the five failed
   rule tests; your own selection is never measured.
6. **Confirm or undo the rebuilt monitoring baselines (item 19).** If nothing is decided: the rebuilt ones stay in use
   (they are the corrected ones; this is the outcome I recommend).
7. **The "council stopped" alert can be hours late (items 15 and 31).** If nothing is decided: it keeps depending on
   GitHub's timer, which fires only a few times a day; so do the daily ICT replay and the weekly data jobs.
8. **The ICT demo account mixes A-setups with weaker signals (item 9), and copies ICT trades late without a check
   (item 10).** If nothing is decided: the ICT demo balance does not show the rule the desk follows.
9. **A 10-lot gold buy on the Replica demo account that the mirror did not place (item 41).** If nothing is decided:
   that account's balance and record do not measure the replica, and nobody knows who has its password.
   (Mosha BO as a live paper system, item 33, was here: it became a paper shadow on 11 Nov with items 37 and 40.)
10. **Shadow streams and LIT (items 11 and 12).** If nothing is decided: streams that cost more than they can earn keep
    being recorded and copied to the demo shadow account.
11. **Public or private repository (item 32).** If nothing is decided: it stays public, which is what keeps the council's
    loop free to run.

Everything else below is smaller, or already answered and only needs a tick.

Grouped: **Security** (1-8 and 26; 7, 8 and 26 are Fred's connector), **Trading on paper and demo** (9-14), **Reliability
and data** (15-16), **Council proposals the study already answered** (17-18), **The research candle clock** (19-25),
**Mosha** (27-28), **Added 11 Nov 2026** (29-36), **The edge review of 11 Nov 2026** (37-41: three approved, two open).

---

## Security

### [ ] 1. Change every password, including the owner's

- **Status, 11 Nov: OPEN.** The scrambled passwords in `api/_accounts.js` are the same as on 9 Nov (the file changed since only to add permissions), so no built-in password has been changed there. A member's password changed on the Users page is not visible from the code.

- **Context.** Until the 9 Nov security fix the password hashes (unsalted SHA-256) were readable by anyone, and they are still
  in this repository's history; the built-in members' hashes and `OWNER_HASH` are still in `api/_accounts.js` today, and the repo
  is public. A short password can be recovered from its SHA-256 hash offline.
- **Options.** (a) Members change theirs on the Users page ("New password"); the owner computes the SHA-256 of a new password and
  replaces `OWNER_HASH` in `api/_accounts.js`. (b) Same, but first move the owner's hash out of the repo into a Vercel environment
  variable (small code change in `api/_accounts.js`; every reader imports it from `api/_accounts.js`). (c) Leave as is.
- **Recommended: (b), then (a) for everyone.** A new owner hash committed to a public repo is exposed the same way the old one
  was. Changing a password also ends that account's old sessions (the session carries a fingerprint of the hash).
- **Related.** Making the repo private (the owner's stated plan) would stop GitHub Actions minutes being free for the council
  loop; decide that separately.

### [ ] 2. Stronger password hashing

- **Status, 11 Nov: OPEN.** Still plain SHA-256, 4-character minimum (`api/users.js`).

- **Context.** Passwords are stored as plain SHA-256 with no salt (`api/_accounts.js` `sha`, `api/users.js`), and the Users page
  accepts passwords of 4 characters. The 9 Nov fix keeps hashes off the page, but a leaked user list (Blob, repo history) is easy
  to crack.
- **Options.** (a) Switch to `scrypt` from Node's built-in `crypto` (free, no new package) with a per-user salt; re-hash each
  account the next time it signs in, keep SHA-256 only for accounts not yet upgraded. (b) Only raise the minimum length.
  (c) Leave as is.
- **Recommended: (a) plus a 10-character minimum.** One change in `api/_accounts.js` / `api/users.js` / `api/_session.js` with
  tests in `tests/auth.test.mjs`; nobody has to do anything except sign in once.

### [ ] 3. Per-permission gating of `/cdata`

- **Status, 11 Nov: OPEN.** `api/data.js` still serves any file to any signed-in member.

- **Context.** Since 9 Nov every council-data file except the guest allowlist needs a session (`api/data.js`), but any signed-in
  member can read any file, whatever their permissions (only `ctrader/tokens.json` and `users.json` are never served). A viewer
  with Council switched off can still fetch the loss reviews, `analysis/latest.md` or `coach.json`; a member without ICT access
  can fetch `ict/*`; anyone signed in can read the demo mirror's full order logs (`ctrader/mirror*.json`). The page hides these
  views, the data endpoint does not.
- **Options.** (a) Map path prefixes to the permission keys in `api/data.js` (`ctrader/*` → owner, or `ct` for the summary files;
  `ict/*` → `ict`; `reviews/`, `analysis/`, `coach.json`, … → `council`; `macro/*` → `macro`). (b) Owner-only for `ctrader/mirror*`,
  everything else as now. (c) Leave as is (members are trusted people).
- **Recommended: (b) now, (a) next.** (b) is a few lines; (a) needs a prefix list kept in step with what each page reads, plus a
  test per permission in `tests/auth.test.mjs`.

### [ ] 4. cTrader link: add the OAuth `state` check

- **Status, 11 Nov: OPEN.** No `state` value in `api/ctrader-link.js`.

- **Context.** "Link my cTrader account" (`api/ctrader-link.js`) sends the browser to cTrader without a `state` value. The return
  is already tied to a 15-minute HttpOnly link cookie for the signed-in member, which blocks most abuse, but `state` is the
  standard guard against a forged return carrying someone else's grant code.
- **Options.** (a) Put a random value in the link cookie, send it as `state`, refuse a return whose `state` differs.
  (b) Leave as is.
- **Recommended: (a).** Small and standard; check once that cTrader passes `state` back on the redirect.

### [ ] 5. Vercel firewall rule for `/api/login`

- **Status, 11 Nov: OPEN as far as the code shows** (a firewall rule is set in Vercel, not in the repository; not checked there).

- **Context.** Password guessing is limited to 10 failures per 10 minutes per IP by `api/_guard.js`, but that table lives in
  memory per server instance, so several instances each allow 10. The firewall's general `/api` limit is 30 a minute per IP.
- **Options.** (a) Add a firewall rate-limit rule just for `POST /api/login` (and `/api/ctrader-link`, `/api/mcp` key requests),
  for example 10 a minute per IP, deny. (b) Leave it to the in-memory guard.
- **Recommended: (a).** Set in Vercel → Firewall; no code change, no extra cost on the current plan. Keep it a rate limit, not a
  timed block (a shared mobile IP must never lose the site for an hour).

### [ ] 6. Who may see `/api/status`

- **Status, 11 Nov: OPEN.** Still public with the run mode, the last error line and step.

- **Context.** `/api/status` is public and edge-cached. Since 9 Nov it no longer carries error stacks, but it still tells anyone
  how old each bot's last round is, the run mode, and the last run's error line, step and commit.
- **Options.** (a) Public answer reduced to "ok / behind"; the details only with a signed-in session. (b) Session only.
  (c) Keep as is.
- **Recommended: (a).** The page shows "Council bot behind" to signed-in users only, so nothing visible changes.

### [ ] 7. Fred's connector: GitHub token scopes

- **Status, 11 Nov: OPEN, and more urgent** since the apply path is on (item 26). Which keys are set on Vercel was not checked from here.

- **Context.** The ChatGPT connector (`api/mcp.js`) reads with `GH_READ_TOKEN` and writes with `GH_MCP_TOKEN`, falling back to
  `GH_TOKEN` (the council's own Contents-write token) when `GH_MCP_TOKEN` is not set. The server only ever writes to
  `mcp/<name>/…` branches, pull requests, PR comments and two council-data files (`ict/mcp-notes.json`, `ict/desk.json`), but
  the token itself could write anywhere it is allowed.
- **Without a write token nothing writes.** If neither `GH_MCP_TOKEN` nor `GH_TOKEN` is set on Vercel, no write tool can work:
  `ict_note`, `ict_desk_update`, `ict_propose_change` and `ict_proposal_comment` all answer with a GitHub error (401 or 404).
  How to check: Vercel → project `macro-dashboard` → Settings → Environment Variables, Production: one of the two names must be
  there. Or from the connector: `ict_note` with a test line. "saved" means Contents write works; a proposal that answers
  "Branch pushed; the token could not open the PR" means the token lacks Pull requests write.
- **More important since 10 Nov (item 26).** If the apply path is ever switched on, this token opens pull requests that a
  workflow merges without review. It must then be the dedicated token, and it must NOT have the Workflows permission: GitHub
  then refuses any push from it that changes a workflow file.
- **Options.** (a) A dedicated fine-grained `GH_MCP_TOKEN`: this repository only, Contents read/write, Pull requests read/write,
  Issues read/write (comments), Checks read, no Workflows, with an expiry; plus branch protection (or a ruleset) on `main`:
  pull request required, the status checks `test` (tests.yml), `build` and `pages` (ci.yml) required, no direct pushes, so no
  token can push there directly. Do not require an approving review if item 26 is ever switched on (the apply merge has no
  reviewer); the required checks still hold for it. (b) Keep using `GH_TOKEN`.
- **Recommended: (a).** It keeps Fred's write path separate from the council's and makes revoking it a one-token job.

### [ ] 8. Fred's connector: candles and costs

- **Status, 11 Nov: OPEN.** The lab's costs are unchanged (`api/_ictlab.js`); `docs/fred-mcp.md` says the two cost tables differ.

- **Context.** `ict_backtest` / `ict_compare` need `OANDA_TOKEN` on the server (the same token `/md/bars` uses; `OANDA_ENV`
  unset = practice account). Without it NQ / ES / YM fall back to research candles from 2023 only. The lab's round-trip costs
  (`api/_ictlab.js` `COST`: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5, silver 0.03) differ from the CME micro round trip the
  digest and the portfolio study use (`ICT_COST_PTS`: NQ 1.37, ES 1.0, YM 5.5, RTY 0.55, gold 0.42), so a lab result looks
  better on ES, YM and RTY than the desk's own reports.
- **Options.** (a) Keep `OANDA_TOKEN` a practice-account token and set the lab's costs to `ICT_COST_PTS` (silver stays 0.03).
  (b) Keep the lab's numbers and say so in the guide. (c) Use the higher of the two per market.
- **Recommended: (a).** One cost table for every ICT number Fred and the owner compare. Update `docs/fred-mcp.md` with it.

### [x] 26. Fred may apply ICT changes without review: ON (your decision, 10 Nov 2026)

- **Status, 11 Nov: unchanged, ON for Fred.** Checked: his built-in record carries the permission and `council/ict-apply.json` lists only `fred`.
- **Status: ON for Fred, off for everyone else.** You asked for it on 10 Nov ("mcp of fred he should be able to change and
  edit anything regarding the ict desk such a edge"), first kept it disabled, then approved it the same day: "let fred have
  100% control of ict he can change the edge and what he want, update his mcp to allow him doing that."
- **What was switched on.** Fred's built-in record carries the apply permission (the Users page shows the box ticked for
  him; unticking it stores an explicit "off" that wins), and `council/ict-apply.json` on `main` lists `fred`.
- **How to switch it off again.** Untick the box (stops the next call at once: the connector reads the stored list on every
  apply call), or remove the name from `council/ict-apply.json` (the hard off-switch: the workflows refuse the branch even
  if a pull request exists).
- **What it allows.** Through the connector Fred can change the ICT edge's own files only (`ict/*.mjs`, the ICT skill,
  `tests/ict-*.test.mjs`, `tests/fixtures/ict/*`, `research/ict/*`, `research/edge/ict-*/*`) and have the change merged to
  `main` without you. The council loop then runs the new ICT code from its next round, and the ICT A-setups are copied to the
  demo account as today. He can also revert his own applied changes. At most 6 an hour (with proposals) and 10 a day.
- **What it never allows.** The council's systems, the page, `api/`, workflows, scripts, users, tokens, cTrader orders, the
  members file itself, the stop guard. Paper and demo only.
- **The locks, in order.** (1) The connector: ICT write, the box, the name in the file, the path allowlist
  (`api/_ictrules.js`), sizes, syntax, no new network / environment / process access, a test for a rule change, risk and
  evidence, the limits; it only pushes a branch `mcp/<name>/apply-…` and opens a pull request, it never merges.
  (2) `.github/workflows/ict-apply.yml` (read-only token, no secrets): main's own copy of the verifier
  (`scripts/ict-apply-check.mjs`) checks the pull request again before any of its code runs; then the stop guard
  `tests/desk-ict-guard.test.mjs` from main's copy (every signal and simulated trade has a stop on the right side; ICT imports
  nothing from the council, the API or the mirror; no order call), the whole test suite, and the built site unchanged.
  (3) `.github/workflows/ict-apply-merge.yml` (the only write token; runs from main's definition, no checkout): refuses unless
  the checks passed for exactly the head commit, the pull request is open, not a draft, from this repository, the name is in
  the file, every file is in the allowlist, and main's ICT files did not move; squash-merge bound to that commit. A refusal
  is one comment; the pull request stays open for you.
- **What it needs to work.** The connector needs a GitHub token on Vercel (`GH_MCP_TOKEN`, or `GH_TOKEN`) that may push a branch
  and open a pull request; without one `ict_apply_change` answers with the reason and changes nothing. See item 7 (the dedicated token without the Workflows permission, and branch protection
  with required checks). GitHub Actions needs no extra setting for the merge: the merge workflow asks for `contents: write`,
  `pull-requests: write` and `actions: write` in its own file, which works with the read-only default too; "Allow GitHub
  Actions to create and approve pull requests" is not needed (the workflow creates and approves nothing). Not verified from
  here: your repository's current Actions settings and branch protection, and whether an organisation or ruleset policy
  blocks a workflow token from merging; the first applied change would show it (a refusal comment with GitHub's reason).
- **Worth doing now that it is on.** Read the merged pull requests whose titles start with "ICT (fred, applied):" (each one
  is one squash commit you can revert), and do item 7 (a dedicated connector token without the Workflows permission, and
  branch protection on `main` with required checks and no required review).

---

## Trading on paper and demo

### [ ] 9. Non-A ICT signals on the demo account

- **Status, 11 Nov: OPEN.** Unchanged in `council/ctrader-mirror.mjs`.

- **Context.** The mirror treats ICT signals that are not A-setups as shadows (`council/ctrader-mirror.mjs` `ictCandidates`),
  and the code comment says they are "never sent". But shadows are mirrored by default (config `mirrorShadow` is not `false`), and
  every ICT trade is routed to the ICT book, so the non-A signals are copied to the ICT demo account next to the A-setups.
- **Options.** (a) Do not copy non-A ICT signals at all (one line in `ictCandidates`). (b) Copy them to a separate account.
  (c) Keep copying them; read the ICT account knowing it mixes both. (d) `mirrorShadow: false` (stops every shadow copy, the
  council shadows too).
- **Recommended: (a).** The ICT demo account should show the A-rule the desk actually follows; non-A results are already tracked
  on paper.

### [ ] 10. Late-copy check for ICT trades

- **Status, 11 Nov: OPEN.** Unchanged.

- **Context.** A council trade copied late is skipped when the price is already past its stop or target or has run more than 1R
  from the entry (`LIMITS.maxDriftR`). ICT trades skip that check (their levels are futures prices, the demo trades the cash CFD),
  so an ICT trade copied hours late (closed market, capacity wait) goes in at the price then, with the original distances.
- **Options.** (a) Apply the same check on the futures side: compare the ICT desk's latest futures price (`ict/snapshot.json`)
  with the trade's futures entry, stop and target, and skip when past the stop / target or more than 1R in. (b) A time limit
  instead (for example, no copy more than 30 minutes after the signal). (c) Leave as is.
- **Recommended: (a).** Same rule as the council trades, and it cannot loosen a stop.

### [ ] 11. Shadow streams after the cost study (proposals 3a-3e)

- **Status, 11 Nov: OPEN.** No answer recorded; nothing changed.

Evidence: `research/proposals/2026-11-09-council-edge.md` and `research/edge/shadow-cost/`. Paper and demo only; nothing live.

- [ ] **3a. Keep a "cost ≤ 0.10R" column on the engine shadow book**, judged after 200 forward trades. **Recommended: yes.**
- [ ] **3b. Stop recording the engine scalp, retrace scalp, intraday, retrace intraday and M30→M1 shadows** (they cost 0.14-0.40R
  a trade). **Recommended: yes, except keep the scalp on paper only as long as 3a needs it**, and stop copying all five to the
  demo shadow account.
- [ ] **3c. Retire the engine swing, retrace swing and position shadows** (cheap, but losing in their own replay).
  **Recommended: yes.**
- [ ] **3d. LIT**: see item 12.
- [ ] **3e. Keep the five ICT shadows and the NQ trend-on shadow unchanged**, look again at 30 forward trades each.
  **Recommended: yes.**

### [ ] 12. LIT: keep or retire

- **Status, 11 Nov: OPEN.** Your 8 Nov choice (keep it as a paper shadow) stands until you say otherwise.

- **Context.** The LIT study was inconclusive (27 gold fills in 19 years; what can be measured is negative), and LIT costs about
  0.25R a trade, well over the owner's 0.10R limit; no LIT trade in 19 years was cheaper than 0.10R. On 8 Nov the owner chose to keep
  it as a paper shadow, and it also has a demo account and a "study" replay with loosened rules.
- **Options.** (a) Keep it on paper as decided, knowing it fails the cost limit. (b) Retire the stream and its demo copies; keep
  the study and the replay page for learning.
- **Recommended: (b).** By the owner's own 0.10R rule it cannot become a system; the replay keeps it available for study.

### [ ] 13. Proposal 4: damp the Coach's session flips on paper engine setups

- **Status, 11 Nov: OPEN.** Not built.

- **Context.** 37 Coach changes on 17 rules in one week, 4 rules flipped back and forth 3+ times; a fair session rule tested on
  2020-26 found almost nothing to switch off, and the Coach's choices did no better than random (`research/edge/coach-learning`).
- **Proposal.** A session is switched only after at least 15 trades and a clearly losing record (t ≤ −1) over a fixed window.
- **Recommended: yes.** Main systems and owner rules are already outside the Coach's reach; this only slows the shadow-book churn.

### [ ] 14. Proposal 5: size the replica for its real drawdown

- **Status, 11 Nov: OPEN.** Since 10 Nov the replica's paper trades are also copied to the Replica demo account when it has its own account, at the mirror's usual size.

- **Context.** 2020-26: worst drawdown −45R at normal costs, −62R at doubled costs, two losing years in a row (2022-23); the rule
  also failed before 2023 (`research/edge/replica-oos`).
- **Options.** (a) Cut the replica's risk so a −60R run stays inside the drawdown the owner accepts. (b) Keep the size.
- **Recommended: (a).** A sizing decision only, no rule change.

---

## Reliability and data

### [ ] 15. Trigger the watchdog from a Vercel cron

- **Status, 11 Nov: OPEN.** See also item 31 (the same weakness in the other timed jobs).

- **Context.** `watchdog.yml` runs on a GitHub cron at :11 / :41 (GitHub fires this repo's crons only a few times a day) and after
  every completed council run. If the loop hangs inside a run, nothing completes, and the "council stopped" alert can be hours late.
  The old `api/kick.js` that dispatched workflows from Vercel is gone.
- **Options.** (a) A Vercel cron every 15-30 minutes that dispatches `watchdog.yml` (a small function or a new `api/run.js` job;
  needs a token with Actions write, never committed). (b) Keep GitHub's cron.
- **Recommended: (a).** Costs nothing extra on the current plan and makes the watchdog independent of GitHub's scheduler.

### [~] 16. Dead FRED series `BSCICP03DEM665S` (German business confidence)

- **Status, 11 Nov: MOSTLY DONE.** Fixed on 9 Nov (pull request #703): the gold terminal now ignores a value more than about four months old, so it no longer shows the 2024 number as today's. The "Eurozone growth pulse" row is empty on both pages. Still open, low priority: find a free, live replacement series, or remove the row. The "Context" below describes the state before the fix.

- **Context.** This OECD series stopped at 2024-01-01. The Macro strategist already drops it as "no data" (`council/macro.mjs`
  `MAX_AGE`), so its "Eurozone growth pulse" driver is empty; but the gold terminal (`gold-trading.html` `refreshFundamentalsX`)
  still fetches it and shows its 2024 value as today's Eurozone growth pulse.
- **Options.** (a) Retire the driver on both pages until a live, free replacement is found (the ECB data API already used for the
  euro 2-year yield is the first place to look). (b) Replace it now with another free series. (c) Leave it.
- **Recommended: (a).** A 2024 reading shown as current is worse than no reading.

---

## Council research proposals already answered by the study (for the record)

### [ ] 17. Proposal 1: keep the time exit at the candle's close

- **Status, 11 Nov: answered by the study; only your tick is missing.** Nothing changes either way.

No difference (−0.001R a position over 719 positions). **Recommended: yes, close the question.** Nothing changes in the code.

### [ ] 18. Proposal 2: no cost gate on the gold systems

- **Status, 11 Nov: answered by the study; only your tick is missing.** Nothing changes either way.

The trades a 0.10R cost gate would skip made +0.42R each. **Recommended: yes.** Nothing changes in the code.

---

## The research candle clock (10 Nov 2026)

The HistData research candles were being read on the wrong clock. A pre-registered audit settled the rule and every study
loader now uses one converter (`council/histdata.mjs`); the audit and the before → after table of every study are in
`research/edge/histdata-clock/RESULT.md`, the Academy's part in `docs/academy/DATA-CLOCK.md`. No trading rule, live member
or config was changed. The items below are what that work leaves for the owner.

### [ ] 19. Monitoring baselines rebuilt on the corrected clock (already committed: confirm or revert)

- **Status, 11 Nov: IN USE, waiting for your confirm.** The rebuilt files are on `main` and the council reads them.

- **Context.** Three baseline files the council reads were rebuilt with their own build scripts, because their source studies
  moved. They are monitoring baselines, not trading rules. A control build on the old study files reproduced each published
  file exactly, so every change is the clock.

  | File | What moved | Before | After |
  |---|---|---|---|
  | `council/decay-base.json` (decay monitor), `council/expect-base.json` ("What to expect", backtest block) | Mosha BO: n, R a trade, SD, worst drawdown, drawdown limit | 147, +0.009, 2.040, 39.2R, 39.2R | 157, −0.064, 1.969, 46.0R, 46.0R |
  | same | Gold H4 trendline | 302, +0.142, 1.241, 19.2R, 19.4R | 304, +0.106, 1.169, 20.2R, 21.0R |
  | same | Gold daily engulf | 217, +0.197, 1.698, 14.8R, 22.3R | 217, +0.198, 1.698, 14.7R, 22.3R |
  | same | Gold momentum pullback | 1,003, +0.041, 1.282, 40.0R, 50.6R | 1,004, +0.043, 1.286, 40.1R, 49.7R |
  | same | Gold replica, gold trend N20 / N5, NQ open run, ICT A-setups, crypto trend | unchanged | identical |
  | `council/expect-base.json` | Momentum pullback, built-on window 2023-26 | 370 trades, +0.185R, t 2.74 | 370, +0.191R, t 2.80 |
  | `council/event-base.json` (veteran's event playbook) | CPI rows | 85 (13 Mar 2018 dropped by the spike check) | 86 (13 Mar 2018 kept: the 2018 files are on New York time) |
  | same | The one pre-registered test | FAILED, 34 of 72, p 0.72 | FAILED, 34 of 73, p 0.76 |

- **What it means.** The decay monitor now watches Mosha BO against a baseline of −0.064R a trade and a 46R drawdown limit
  (was +0.009R and 39R). Nothing else of weight moved.
- **Options.** (a) Keep the rebuilt files. (b) Revert the commit titled "Monitoring baselines rebuilt on the corrected candle
  clock" and keep the old-clock baselines.
- **Recommended: (a).** The old numbers were computed on bars an hour off in four weeks a year. Separately, a live system
  whose 8-year rebuild makes nothing (Mosha BO) is worth a look of its own.

### [ ] 20. ICT variant "sweep into an unfilled D1/H4 FVG" now passes its pre-registered bar (index book)

- **Status, 11 Nov: OPEN.** Option (a) is what happens by default. Note that since 10 Nov Fred may add an ICT paper variant or change the ICT rule himself (item 26); this item is about what you want.

- **Context.** `research/edge/ict-variants` was pre-registered and failed on 9 Nov. On the corrected clock its script gives
  PASS for one of nine verdicts: V3 htffvg, index book: in-sample n 80, +0.273R, t 1.44; out-of-sample n 84, +0.355R, t 1.92;
  2024 lost (21 trades, −0.5R); not "strong". The plan itself warns that with nine tries one pass by luck is plausible. The
  ict-filters study, on the same corrected clock, no longer picks this filter in-sample. The desk already records the
  feature on every signal (`feat.htfFvg`, skill §29), so a forward record is building.
- **Options.** (a) Do nothing new: keep forward-testing the recorded feature. (b) Add a paper shadow variant for it
  (never alerted, as the other shadows). (c) Change the live A-rule.
- **Recommended: (a).** One pass of nine with t under 2 in both halves is a hypothesis. Never (c) on this evidence.

### [ ] 21. `ict/replay.mjs` still reads HistData files with the old clock (live code, not changed)

- **Status, 11 Nov: OPEN, still no effect.** The line has moved: it is now line 95 of `ict/replay.mjs` (the pair list is line 83). The line numbers in the text below are from 10 Nov.

- **Where.** `ict/replay.mjs` line 79: `... / 1000 + 5 * 3600` on the HistData stamp, inside the back-fill for `HD`
  (line 67: EUR/USD and GBP/USD only).
- **Effect today: none.** Both pairs left the desk's markets on 7 Nov, so no market reaches this branch. If a pair came
  back, its back-filled candles would be one hour late for the whole of Europe's summer (session tags, kill zones, the
  halt hour and the 18:00 New York day would all be off by an hour for those months).
- **Proposed fix.** Replace the expression with `histStampUtc(d)` from `council/histdata.mjs` (one import, one line), or
  delete the dead branch. The test `tests/histdata-clock.test.mjs` lists this file as the one allowed exception; remove
  it from `MAY_PARSE` when fixed.
- **Recommended: fix it the next time the replay is touched.** It is a one-line change to a file that runs live.

### [ ] 22. Academy: 101 setups stay flagged (weeks nobody could verify)

- **Status, 11 Nov: OPEN.** As built (option a) until you say otherwise.

- **Context.** `rule.clockShift` now means "the week of this setup could not be checked against a second feed": 24 weeks
  for gold and 25 for NAS100, almost all in the hole of the 2023 files (20 Feb to 30 Jul 2023). They stay out of lists,
  tests, training and research. Separately, five symbol-years miss one of the audit's strict criteria (gold 2023; NAS100
  2018, 2020, 2023, 2024) although every week of them that could be read agrees with the converter; their verified weeks
  ARE in the working pool (`docs/academy/DATA-CLOCK.md` section 3 has both readings side by side).
- **Options.** (a) Keep it as built. (b) Stricter: also drop every setup of the five uncertified years (the "certified
  years only" column: nq-open would fall from 545 usable trades to 326). (c) Looser: unflag the 101.
- **Recommended: (a).** (b) throws away 53 verified NAS100 weeks a year for one misread release; (c) trusts weeks nobody
  could check.

### [ ] 23. Studies still on the old clock

- **Status, 11 Nov: OPEN.** None of them has been re-run.

- **Context.** Their loaders are fixed, but these were not re-run (each RESULT.md says so in a line under its title):
  the long engine replays `scalp-filters`, `scalp-exits`, `timing`, `regime`, `setups-promote`, `confluence`, `costs`
  (hours of machine time between them; every one is a FAIL on the Scalp or on a setup that is not live), `ict-smile`
  (needs FRED), `ict-sessions` (inputs cannot be reproduced; its verdict fields do not move with the clock).
- **Options.** (a) Re-run them on a free runner when convenient (the commands are in each RESULT.md). (b) Leave them.
- **Recommended: (a), low priority.** None of them carries a live rule. Until then, read their numbers as old-clock numbers.

### [ ] 24. The dollar-index file of 2018 is not a usable series

- **Status, 11 Nov: OPEN.** The eight 2018 rows are still in the event base.

- **Context.** The clock audit could not check `UDXUSD` 2018: its hourly returns do not follow EUR/USD at any offset
  (correlation near zero in 50 weeks) and its weekly reopen matches in 3 of 52 weekends. From 2019 the file is fine.
  The veteran's event playbook (`council/event-base.json`) uses it for the dollar's first read on the eight 2018 CPI rows.
- **Options.** (a) Drop the 2018 rows from the event base (a change to the event-reaction study's pre-registered data
  window: needs an amendment). (b) Keep them, labelled. (c) Find another 2018 dollar-index series.
- **Recommended: (a) with a dated amendment.** Eight of 86 CPI rows; the playbook's figures are descriptive only.

### [ ] 25. COT release lag in the Macro strategist (found by the unmerged `wip/data-clock-fixes` branch; not changed here)

- **Status, 11 Nov: OPEN.** `council/macro.mjs` lines 59 and 245 are unchanged.

- **Where.** `council/macro.mjs` line 59 (`COT_LAG = 4`) and line 245 (`r.t <= D - COT_LAG * DAY`).
- **Effect.** A CFTC report dated Tuesday is taken as public four days later. In a holiday week the CFTC publishes on the
  following Monday, so the strategist's COT driver can read a report up to two days before it was public. The same lines
  compute the "3-year" percentile over the last 60 rows of a pull that mixes two contracts. `council/cot.mjs` already has
  the right release clock (`usableAt`, `RELEASE_LAG`).
- **Proposed fix.** Use `cot.mjs` `usableAt` for the cut and its 156-week percentile, as the wip branch drafted
  (unverified; it also changed `council/veteran.mjs` staleness and added tests). This is not the HistData clock and it
  changes what a live member computes, so it was left for the owner.
- **Recommended: yes, as its own reviewed change with tests.** Paper only either way.

## Mosha as you expected it (10 Nov 2026)

### [ ] 27. Your Mosha trading, tested as fixed rules in five studies: no edge. Log your own trades of it?

- **Status, 11 Nov: the place is built (Desks → Mosha); the logging is yours to do.** The five studies are final: none is an edge.

- **What you told me.** With the charts of your gold sell of 10 Nov (sell 4120.42, stop 4128.92, target 4072.84, about 5.6R):
  "This is how I was expecting Mosha to work." The method is top-down order only: after an H4 BO, H1 shows when the
  retracement starts, M15 or M5 gives the entry at the zone of the break, the target is the H4 barrier; at the barrier you
  close and buy with the H4, and that buy is the main trade.
- **What the live Mosha BO does instead.** Same first two steps, then it trades back with the H4 without waiting for the
  barrier, on M15, in the weekly direction only. It could not have taken your sell and has placed no live trade since 4 Nov.
- **Three pre-registered tests on gold, 2020 to October 2026, after costs:**
  - `research/edge/mosha-level/` (my first, wrong reading: a tap of an H4 level, then M5 breaks): 365 trades, −0.35R a
    trade, t −3.10.
  - `research/edge/mosha-retrace/` (your first half, the retracement trade; it finds your own trade): 445 trades, +0.02R a
    trade, t 0.17. Break-even.
  - `research/edge/mosha-cycle/` (your main trade, the buy at the barrier): 132 trades, −0.22R a trade, t −0.99.
  - Both halves together: 577 trades, −0.03R a trade, t −0.29.
- **What that means.** Taken every time by fixed rules, the cycle does not make money: about one trade in six reaches its
  target and the 5R winners only just pay for the losers. It says nothing about the trades YOU pick; the rules cannot see
  why you take one cycle and skip another.
#### Your own example trades, checked on our candles (added 10 Nov, after "check the trades I sent you")

The screenshots you sent on 2 Nov ("Some marking examples", "More examples", "Learn this and let it be your new guide",
"Study this scenario") and on 10 Nov, read off the charts and replayed on OANDA 5-minute gold candles:

| Trade (your label) | Entry / stop / target | Plan | On our candles |
|---|---|---|---|
| 28 Oct sell ("M5 cf for sell", "2000 pips") | 4048.59 / 4076.69 / 3971.09 | 2.8R | Filled 29 Oct 02:25 UTC, target 30 Oct 07:50: +2.8R. Worst point 0.18R against. |
| 29 Oct sell (the zone after the break) | 4035.72 / 4045.96 / 3988.44 | 4.6R | Filled 11:05 UTC, target 30 Oct 04:05: +4.6R. Worst point 0.36R against. |
| 2 Nov sell ("M30 sweep high", "i just took entry after bo sell") | 3908.27 / 3916.10 / first 3878.42, then 3891.46 | 3.8R, taken 2.1R | Reached 2.2R in favour (08:20 UTC), never the first target; price later went through the stop. Closing at 3891.46 is what made it a winner. |
| 2 Nov buy ("Learn this") | 3900.71 / 3896.79 / 3965.08 | 16.4R | Target reached 14:35 UTC. Our feed's lows at 13:00 and 13:15 UTC were 3896.47 and 3896.53, $0.30 under your stop: on our prices it survives only if entered after 13:20. |
| 10 Nov sell | 4120.42 / 4128.92 / 4072.84 | 5.6R | Filled 05:20 UTC, target 10:55: +5.6R. Worst point 0.89R against. |

Five trades, five winners, about +31R as you took them. They are examples you picked, so they show the pattern, not the
win rate.

What they show that my three tests did not hold:

- **The trigger is the VR and its CF, on M5 or M15** (your red "5 mn" box: from the extreme to the last swing inside it; a
  close out of the box is the CF). It comes before the H1 break, at a better price. Two of my tests waited for the H1 break.
- **Every sell starts from a swept high**: 28 Oct the spike to 4082 over the earlier 4070 highs, 2 Nov the M30 high 3913
  taken to 3918, 10 Nov the H4 high 4147 taken to 4148.7. I tested touches of H4 levels, not sweeps of an earlier high.
- **The main trade is entered where the pullback ends, by the same VR and CF**: on 28 Oct the H4 was a sell (BO sell
  22 Oct), price pulled back up to the broken level (about 4068) and the M5 CF there was the sell with the H4. My test of the
  main trade used an H4 engulf zone as the barrier and an H1 break as the trigger.
- **You manage the exit** (the 2 Nov sell was closed at 2.1R, not held for 3.8R), and the stops are a few dollars, so the
  price feed matters ($0.30 decided the 2 Nov buy on our feed).

**That reading, tested** (you: "Test both"; `research/edge/mosha-sweep/`, pre-registered, OANDA gold from 2006 so that
2006-19 is data none of the earlier tests had read):

| Entry | Trades | Win rate | R a trade after costs | t | 2006-19 | 2020 to now |
|---|---|---|---|---|---|---|
| At the CF, stop above the high | 6,260 | 25.7 % | −0.11 | −4.62 | −0.10 | −0.12 |
| On the return to the zone, tight stop | 6,478 | 18.0 % | −0.21 | −7.36 | −0.23 | −0.18 |

Both fail, in both windows. The detector finds your 28 Oct and 10 Nov sells; your 2 Nov trades were read on M1 and M30 and
are outside it. A swept H1 high or low with an M5 CF happens about five times a trading day, so your five winners are
five out of thousands of look-alikes, and what sets them apart is not in any rule written so far.

**Is there a simple way to pick the good ones?** (you: "Keep going"; `research/edge/mosha-select/`, pre-registered.) The same
setups, split by four things you can see when the order is placed, each tried on 2006-12, then 2013-19, then 2020 to now:

| Condition | What happened |
|---|---|
| With the last H4 BO, or against it | Both lose in all three periods (at the CF, with the H4: −0.07R, −0.07R, −0.16R a trade). |
| The sweep also took an H4 swing, or only an H1 swing | Both lose; they swap places from period to period. |
| Asia, London or New York | All three lose; no session stays best. |
| Target 4R or more away, or nearer | Both lose; the far targets lose more (12 to 19 % winners). |

Eighteen filtered versions, three periods each: 54 results, all negative, the best −0.05R a trade. None of these simple
conditions is what makes your trades win.

- **Options.** (a) Log your own trades of this pattern for a few weeks (ChronosTrade or the Academy keep entry, stop,
  target and result), so we measure your selection instead of a rule's. (b) Tell me what makes you skip a setup, and I test
  that one filter. (c) Leave it. Five studies and thirty-three tests are enough; I do not recommend another mechanical one.
- **Recommended: (a).** Nothing live changes on any option; the live Mosha BO is untouched.
- **The place for (a), built 10 Nov ("And a place to mosha"):** Desks → **Mosha** on the desk. Write each trade down as you take
  it (side, entry, stop, target; a trade without a stop is refused) and close it there when it is over. Only trades logged while
  still open count in the record; it says "too few to judge" until 20 are closed and calls nothing more than luck below a t of
  2. Reviewers can read it; only you can write it.

### [~] 28. Luxus teaches on the Mosha desk: who reads the lessons, and when

- **Status, 11 Nov: the teaching side is built and Luxus is using it. What is open is the reading.**
  - **A correction.** The update of 10 Nov below says the assistant keeps its own key in the site's settings and a later
    session can use it again. That last part was wrong: the setting is stored as "sensitive", and Vercel never shows a
    sensitive value again, not even to the assistant. So a new session cannot read the old key back.
  - **What that means.** Each new session either sets a new key (replace the `MOSHA_ASSISTANT_KEY` setting and redeploy the
    site, a few minutes), or uses a key you saved once in the secure form for meridianx.dev (the original step below:
    Lessons card → "Show the assistant's key"). The second way survives from session to session; the first does not.
  - **Options.** (a) Save the key once in the secure form, so any later session can read the lessons without touching the
    site's settings. (b) Leave it: every session that should read lessons sets a new key first. (c) Either way, decide
    whether you want the reading on a schedule (it uses your plan's usage each time).
  - **Recommended: (a).** One step, once. If nothing is decided, lessons wait unread until a session is told to read them.
  - **Also still open:** a read-through of the French tutorial by Luxus (it was checked by tests, not by a French speaker).

- **What is built (10 Nov, your words: the Mosha desk "will be main page of" Luxus, "he will train u, allow him to send you
  trades images so u can learn"):** Luxus signs in and lands on the Mosha desk. There he sends a trade as screenshots, each
  with a caption, and a note on what the desk should learn. Under each lesson the desk writes what it understood, so he can
  correct it. He stays a viewer everywhere else; your trade log stays yours.
- **Your step, once:** the desk's assistant reads the lessons with a key that only you can see. On the Mosha desk, in the
  Lessons card, press "Show the assistant's key", copy it, and paste it into the secure form the assistant opens for
  meridianx.dev (never into a chat). Until then the lessons arrive and are stored, but nobody reads them.
- **"The functionality is only to work for" Luxus, "the key is his password" (10 Nov):** done. Only Luxus's account can
  teach: send lessons, say right or not right, decide the book, teach from ChronosTrade. His password is all he needs.
  You and the other members who may open the desk read it; you can also remove a lesson or a picture, and switch his
  access on the Users page. Giving "teaches" to anyone else has no effect.
- **Update, 10 Nov ("No need for key u can read and do whaeva"; corrected in the status above: the key does not carry
  over to a later session):** you no longer have to copy anything. The assistant
  makes its own key and saves it in the site's settings on Vercel (`MOSHA_ASSISTANT_KEY`). It opens only the lessons
  (read, answer, propose book lines). The one cost: that key is visible in the assistant's private session log, where
  the hand-copied one would not have been. To end it, delete that variable on Vercel, or set `MOSHA_READER=off`.
- **To change or stop it:** Users → Luxus → Permissions → "Mosha desk" (no access / read only / may send lessons). On Vercel,
  `MOSHA_READER=off` switches the assistant's key off; `MOSHA_READER_SALT=<anything>` replaces it.
- **"He needs to be 100% teachable" (10 Nov, built the same day):** Luxus can teach in pictures or in words alone, give the
  trade's levels, and talk back under each lesson: "right", or "not right" and why, until the desk has it. The desk can show
  its reading of a lesson on the chart with the replay. "What the desk knows" is the whole of what it holds, line by line:
  twelve lines of its own to start with, each marked as its reading until Luxus (or you) confirms, corrects or erases it.
  The Lessons card counts how often the desk was right first time.
- **"And do backtest with him, he will teach you" (10 Nov):** Luxus can backtest in ChronosTrade and teach from there.
  Every closed trade in his journal has a "Teach" button: it sends the trade to the desk with its chart picture, exact
  entry, stop, target, exit and result, and his note. A second button sends the chart as it stands, with no trade, for
  "look at this moment". On the desk such a lesson is marked "from a ChronosTrade replay" and opens on the replay chart.
  These are practice trades on past candles: they teach the desk how he trades and are never counted as a record.
- **"Do better and easier for" Luxus "to work with" (10 Nov):** teaching now takes fewer steps. On the desk he drops,
  pastes or chooses screenshots, taps a caption, writes a few words and presses Send; a name and the levels are optional.
  A strip at the top says what waits on him ("2 answers to check", "11 lines of the book to check") and takes him there.
  "Not right" is typed right under the desk's answer. What he types is kept on his device until sent. In ChronosTrade a
  "Teach this trade" button appears on the chart the moment a trade closes (or key T), and a number on the teach button
  shows how many of the desk's answers wait for him.
- **The tutorial (10 Nov, your words: "a tutorial to help him understand how to use the teaching and what he needs to
  do"):** the first thing on his page is "How to teach the desk": five steps in plain words, each with a "Show me" button
  that takes him to that part of the page. Steps tick themselves as he really does them, and the one that is his to do
  next is marked "Next". He can hide it and bring it back with "How to teach". ChronosTrade shows a one-time hint the
  first time a trade of his closes.
- **The full tutorial, in English or French (10 Nov, your words: "a proper tutorial because the better he knows how to
  work with you he would do better", "give him choice to choose french instead but the trading terms leave it as
  english"):** "How to work with the desk" is a nine-chapter course opened from the top of his page. Each chapter has a
  picture of what to press, a weak example beside a good one where that helps, and one question with the answer
  explained. It covers what makes a lesson easy to learn from, what the desk can and cannot read on a screenshot, how to
  correct it, the book, teaching from a replay, and the habits that help. He chooses English or Français at the top of
  his page; the choice also covers his teaching buttons and messages, ChronosTrade's teach dialog, and the language the
  desk answers him in. The words of the method (trade, sell, buy, entry, stop, target, level, sweep, VR, CF, BO…) stay in
  English in both. The rest of the site (menus, charts, other desks) is still English only: say if you want more of it
  in French. The French was written by the assistant and checked by tests for the method's words, not by a French
  speaker: a read-through by Luxus is the real check.
- **"Remember he is the one teaching you mosha strategy" (10 Nov):** written in as a standing rule. Luxus is the
  teacher and the desk is his student; Mosha is his method. The desk restates what he shows, in his terms, and asks where
  it is unclear. It never teaches the method back to him, never judges a trade, and never treats its own first lines of
  the book or the earlier studies' wording as his method. The tutorial opens by telling him so, and shows only how to
  teach, never what Mosha is.
- **What "100 %" cannot mean:** the desk reads and answers only when the assistant runs with the key. Without a key (see the status at the top of this item)
  nothing is read, and with one a lesson waits until the next reading. Say if you want the reading on a schedule
  (it uses your plan's usage each time, so it is your call how often).
- **What the lessons are not:** proof. They are the teacher's picks, so they show the pattern, not how often it wins. A rule
  drawn from them gets its own pre-registered test before it is called an edge, and nothing live changes without you.

---

## Added 11 Nov 2026

Open points that were written down elsewhere (developer notes, study results, open pull requests) but not in this list.

### [ ] 29. ICT replay: thirteen results from before a market's price history starts. Keep or drop?

- **Context.** The ICT replay re-plays history since August 2025. For gold, real candle history on file starts on
  21 Dec 2025; for the Russell 2000 it starts on 7 Jun 2026. Before those dates the price feed returns only stray candles,
  different ones on each run, and thirteen results were built from them: 11 gold results (30 Sep to 24 Nov 2025, together
  +7.49R) and 2 Russell 2000 results (27 and 29 May 2026, together -2R). Since 11 Nov booked results are kept as booked, so
  these thirteen are now frozen into the record as they happened to fall that day.
- **What is ready.** Pull request #726 (open, not merged): each market is recorded only from where its candles really
  start; the thirteen leave once, listed by id in the replay's correction log; signals before the start are counted, not
  hidden. Headline effect: about +124.6R over 815 closed results becomes about +119.1R over 800. No ICT rule, stop or size
  changes.
- **Options.** (a) Merge it: drop the thirteen. (b) Keep them: close the pull request. (c) Keep them but mark them on the
  desk as "built from incomplete candles".
- **Recommended: (a).** A result nobody can rebuild from saved candles should not be in the record, and the change lowers
  the headline rather than flattering it. Either way the ICT record is a replay, not proof (the rule broke even on 2008-17).
- **If nothing is decided.** The thirteen stay in, and the pull request waits.

### [ ] 30. ICT replay: keep its own archive of candles (designed, not built)

- **Context.** The replay reads history from the futures feed each time, and the feed does not return the same old candles
  twice. Freezing booked results (11 Nov) stops the record from drifting day to day. But a full rebuild, which happens by
  itself whenever the ICT tracker, replay or calendar code changes (and Fred can now change those, item 26), draws the
  feed's noise again: about plus or minus 25R on the whole record. So the effect of a rule change on old history cannot be
  told from noise.
- **What exists.** A design for a small archive (about 3.6 MB) that saves each run's candles so a rebuild always uses the
  same ones. Not built: at each futures contract switch it needs a price shift measured on the live feed, and that could
  not be checked from the build environment. It needs one live contract switch to verify.
- **Options.** (a) Build it and verify it at the next contract switch, on paper, before trusting it. (b) Leave it and read
  every rebuild's before / after difference as noise unless it is far larger than 25R.
- **Recommended: (a).** Until then: judge an ICT rule change by the connector's side-by-side comparison on the same
  candles, never by the replay total before and after.
- **If nothing is decided.** Option (b) is what happens.

### [ ] 31. Timed jobs depend on GitHub's timer, which often does not fire

- **Context.** GitHub runs this repository's timed jobs only a few times a day at best (measured 6 to 7 Nov: a 15-minute
  timer fired 3 times in 22 hours). The council loop does not depend on it (it restarts itself, and the website's host
  takes over if it stops). These do: the watchdog (item 15), the daily ICT replay (06:41 UTC), the weekly candle cache for
  research (Saturdays), the crypto history back-fill (every 30 minutes) and the daily backtest.
- **Why it matters.** A late replay means "update pending" results stay pending longer; a late watchdog means a late
  "council stopped" alert; a late cache means research reads older candles. Nothing trades wrongly because of it.
- **Options.** (a) Let the website's host start these jobs on time (a small scheduled function with a narrow key that may
  only start workflows; free on the current plan). (b) Run the ICT replay from inside the council loop once a day, as the
  ICT tracker already is. (c) Leave it.
- **Recommended: (a) for the watchdog and the replay.** Same change as item 15, so decide them together.
- **If nothing is decided.** They keep running whenever GitHub happens to fire them.

### [ ] 32. Public or private repository

- **Context.** On 7 Nov you said you want the repository private. Two things pull the other way. The council's loop runs
  on GitHub's free minutes, which are free only for a public repository; private, the loop would need paid minutes or a
  move to the website's host or your own server (that cut-over is prepared but has not happened). And the public copy on
  GitHub Pages would show nothing. On the other side: while it is public, anyone can read the code, the old scrambled
  passwords in its history (item 1) and the research.
  Since 11 Nov the website itself hands a visitor who is not signed in only the main system's trades and a few prices
  (`/cdata` cuts the guest files), but the `council-data` branch, with every book, name and note, stays readable on
  GitHub for as long as the repository is public: the site's own door is closed, that one is not.
- **Options.** (a) Stay public; do item 1 so the history holds nothing useful. (b) Go private after moving the loop to your
  always-on server or the website's host, and accept that GitHub Pages goes dark. (c) Go private and pay for minutes
  (against the "no paid services" rule).
- **Recommended: (a) now.** (b) is possible later; it is a project of its own.
- **If nothing is decided.** It stays public.

### [ ] 33. Mosha BO stays among the live paper systems?

- **Status, 11 Nov 2026 (evening): done in the code as part of item 37** (Mosha BO is a paper shadow from the first council
  round after the change is deployed). You did not answer this item by its number, so the box stays open: see item 40.
- **Context.** Rebuilt on earlier years with the corrected clock, Mosha BO makes -0.064R a trade over 157 trades with a
  46R worst drawdown (item 19). On 2006-17 it was "in substance a null result". It has placed no live paper trade since
  4 Nov. The five Mosha studies of 10 Nov tested other readings of the method and none passed.
- **Options.** (a) Move it to a shadow (recorded, never alerted, like Gold trend fast). (b) Keep it live on paper and let
  the decay monitor watch it. (c) Retire it.
- **Recommended: (a).** It costs nothing on paper either way, but the main systems' results should not carry a system
  with no evidence behind it. A live rule change, so it is yours to make.
- **If nothing is decided.** (b) is what happens.

### [ ] 34. Three study proposals nobody has answered

Each is from a finished study; nothing was changed. All paper only.

- [ ] **Book weights (`research/edge/portfolio-v2`, 7-8 Nov).** Equal risk per idea with the gold family capped at 40 %,
  instead of one unit per system. The comparison runs on paper on the Council research pane ("Paper comparison"). The study
  itself says it is **not an edge on untouched data**. **Recommended: leave the sizes as they are**; look at the paper
  comparison again after 20 trading days.
- [ ] **Near-stop market fills (`research/edge/shadow-audit`, 7 Nov).** The engine checks its minimum stop distance on the
  planned entry, not on the actual fill, so a market fill can land very close to the stop and one small move counts as a
  full loss. Proposal: check the distance on the fill and skip the trade when it is too small. **Recommended: yes** (it can
  only skip a trade, never loosen a stop). It mostly concerns the retired engine's shadow streams.
- [ ] **Gold daily engulf and the Sunday candle (`research/edge/gold-weekend`, 7 Nov).** The rule counts a short Sunday
  candle as a day. Counting proper trading days instead is "correct by construction and not worse" (+7.1R over 20 years,
  within noise). For Gold trend the same change is worse, so that stays. **Recommended: adopt it for the engulf only, or
  leave it; the evidence does not favour either strongly.**

### [ ] 35. Small display leftovers from the 11 Nov check of every page

- **Context.** The check found and fixed the larger problems. Left alone on purpose, as older design or your call: very
  small labels on the ICT desk; small toolbar buttons in ChronosTrade on phones (a stated choice); in the light theme, the
  main button of the shared dialog and some badges whose text sits at or just under the readable-contrast line; a corrected
  line of the Mosha book that keeps the desk's first wording in English in the French view; and Luxus's page still showing
  the fixed-rule studies' figures to the teacher.
- **What is ready.** Pull request #729 (open, not merged) covers most of these: ICT text at readable size, light-theme
  colours at the contrast standard, the teacher's page without the studies.
- **Options.** (a) Merge #729 after its checks pass. (b) Leave them.
- **Recommended: (a).** Display only; no rule or trade is involved.
- **If nothing is decided.** The site works; these stay slightly harder to read.

### [ ] 36. Academy: three small open points

- [ ] **A higher request limit for the Academy.** The site's firewall allows 30 requests a minute per person to the
  server functions; the Academy paces itself to 24 and waits when it must. Raising the limit for `/api/academy` only would
  make long training runs a little faster. **Recommended: leave it** unless the waits bother you.
- [ ] **Written second opinions from a paid model.** Built, switched off, never called; costs money and so breaks the
  "no paid services" rule. The free route (your own assistant answers queued questions) is in place. **Recommended: keep
  the paid route off.**
- [ ] **Your acceptance walk** (`docs/academy/ACCEPTANCE.md`): sign in, open `/academy`, go through the list once. The
  Academy's store is empty until you train on it; every number on the page will be from your own attempts.

## The edge review of 11 Nov 2026

From `research/proposals/2026-11-11-edge-review.md` (its evidence: `research/edge/honest-book`, `research/edge/trend-breadth`
and the studies it lists). You were shown its decisions on 11 Nov 2026 and answered: **"yes anything that is better for the
system and that applies it"**. That is taken as your approval of exactly the three recommended changes below (items 37 to
39) and nothing wider. Paper and demo only. No entry rule, filter, size, stop or exit of any system changed, no stop was
removed, loosened or moved, and nothing of the ICT desk was touched. Developer notes: `CLAUDE.md`, "Supported book,
financing in the costs, replica mirror gold only (11 Nov 2026)".

### [x] 37. The live paper book is Gold trend and Gold daily engulf only

- **Status (11 Nov 2026): approved.** Your words: "yes anything that is better for the system and that applies it". Done in
  the code (Trader user rule `supported-book`); it takes effect on the first council round after the change is deployed,
  and that round writes the dated line into the council's rule history.
- **What changed.** Gold trend (the 20-day breakout) and Gold daily engulf keep trading live on paper, exactly as before.
  Gold replica, Gold momentum pullback, the NQ New York open run, Gold H4 trendline and Mosha BO become **paper shadows**:
  the same rule finds the same trades with the same stops, every trade is recorded and managed by the same loop to its
  exit, but it is never alerted, gets no futures ticket and is not counted as "our system". Gold trend fast stays the
  shadow it has been since 7 Nov. (The momentum pullback was already recorded as a test shadow since 6 Nov; it is now
  listed as a shadow everywhere.)
- **Trades already open.** A trade that was open as a live trade keeps running as a live trade to its own exit, with its
  stop. On 11 Nov, 22:00 UTC, there was none of the five systems': the only main-system order on the book was one resting
  Gold daily engulf buy limit (3,971.36, stop 3,895.27), which stays live.
- **History.** Trades the five systems took live before the change stay in the main record as live trades; nothing is
  relabelled. The page says "paper shadow since 11 Nov" beside each of them.
- **Why.** No system has a t of 2 on data it was not built on. On untouched 2006-17, Gold trend (+0.49R a position, n 75,
  t 1.77) and the daily engulf (+0.19R, n 256, t 1.89) are the nearest; the other five are flat or negative there. The book
  of all of them made +4.3R a year with an 83R worst drawdown and lost at doubled costs. Not shown: the two-system book has
  not itself been run as a book. Expect about +6R a year after financing, give or take 15R, with a drawdown near 30R.
- **To undo.** Ask for a system back: a new owner rule removes its entry from the council's `ownerShadow` setting, and its
  next trade is live again.

### [x] 38. Overnight financing is counted in the paper costs

- **Status (11 Nov 2026): approved.** Your words: "yes anything that is better for the system and that applies it". Done in
  the code (`council/fills.mjs`, Trader user rule `count-financing`); in effect from the first council round after the
  change is deployed.
- **What changed.** A gold buy held overnight on the demo broker pays financing: 0.0148 % of the price for each rollover
  (Monday to Friday 22:00 UTC, three on Wednesday), about 5.3 % a year. It is the broker's own rate read on 11 Nov 2026 and
  the method of `research/edge/trend-breadth` Part A. It is now part of the cost of every paper trade, so of every "after
  costs" figure that is built from the trades: the council's cost summary, the week pane, the daily digest, the edge
  scoreboard, the decay monitor. "What to expect" was rebuilt with it: Gold trend +0.49R becomes +0.40R a position
  (t 1.77 becomes 1.49), the daily engulf +0.19R becomes +0.14R (t 1.46), the H4 trendline +0.05R becomes +0.01R (t 0.23),
  Gold trend fast +0.37R becomes +0.29R (t 1.53).
- **History is not rewritten.** The cost of a trade is recorded once, when it closes. Trades closed before the change keep
  the cost they were recorded with; every trade closed after it carries financing. A net figure that spans that day mixes
  the two, and the page says so.
- **Limits, said plainly.** Today's rate, not a history of it (the repository has none). Gold buys only: a gold sell is
  credited nothing (the broker would credit a little), and no other market's rate has been measured, so none is charged.
  Not in the figures of the replica, Mosha BO or the momentum pullback in "What to expect" (their study records do not
  carry what the sum needs). The 30-day replay of the retired engine's setups and the decay monitor's backtest baselines
  do not carry it either.
- **To change the rate.** One named constant, `FIN`, with its source and date.

### [x] 39. The demo mirror stops copying the replica's forex and crypto paper trades

- **Status (11 Nov 2026): approved.** Your words: "yes anything that is better for the system and that applies it". Done in
  the code (Trader user rule `replica-mirror-gold-only`, read by the mirror); in effect from the first council round after
  the change is deployed.
- **What changed.** The Replica demo account gets no NEW copy of the replica's paper trades on forex and crypto. Gold
  replica copies, and every other book and account, are unchanged. A position that was already copied is managed exactly
  as before: its stop stays, a moved stop is followed, and it is closed when its paper trade closes. Nothing is closed or
  left without a stop by this change.
- **Until when.** Until that stream is positive before costs over 200 trades: the forex and crypto replica paper trades
  closed since the rule started must number 200 or more and sum to more than zero before costs. The council counts it
  every round. It does **not** switch back by itself: when the condition is met, it is yours to decide.
- **Why.** Those paper trades made -0.08R a trade before costs over 568 trades (t -1.3), and the Replica demo account
  filled 0.08R worse than paper on every copy (n 121, t 3.9).
- **Off-switch.** A new owner rule that clears the council's `mirrorReplica` setting: every replica paper trade is copied
  again from the next round.

### [ ] 40. Mosha BO to a paper shadow (item 33): covered by item 37

- **Status (11 Nov 2026): open** as a question, done in the code. The review's decision 4 ("Mosha BO to shadow: recommended
  yes; it is part of decision 1") is carried out by item 37. You approved the review's recommendations as a whole and did
  not answer item 33 by its number.
- **What is asked.** Nothing more needs doing. If you agree, item 33 can be ticked with this one. If you want Mosha BO
  live on paper again, say so: it is one line (item 37, "To undo").
- **If nothing is decided.** It stays a paper shadow, recorded and judged on its forward record.

### [ ] 41. Who placed the 10-lot gold buy on the Replica demo account that closed 11 Nov 13:37 UTC for -$4,427? Reset the account before reading its record

- **Status (11 Nov 2026): open.** The owner has not answered.
- **Context.** On 11 Nov at 13:37 UTC a 10-lot gold buy on the Replica demo account closed with a loss of $4,427 (entry
  4,040.45, exit 4,036.12), which took the account from about $10,017 to $5,545. It is not in the mirror's records, and the
  mirror cannot send more than 5 lots: it was not a copied trade and looks placed by hand. Nothing real was lost (a demo
  account). The mirror's daily loss stop then refused every replica copy for the rest of that day, and the account's
  balance and results no longer measure the replica.
- **Options.** (a) It was you: reset the account (close everything by hand, set the balance back, and ask for the mirror's
  records of that account to be started afresh), then read its record from that day. (b) It was not you: change that
  account's password first, then (a).
- **Recommended.** Whichever applies, reset the account before its record is read.
- **If nothing is decided.** The Replica demo account keeps a balance that one hand-placed trade halved, and its record
  cannot be used to judge the replica.

## The book study of 11 Nov 2026

Three pre-registered studies on the book of item 37 (`research/proposals/2026-11-11-book-study.md`): the two-system book
run as a book (+5.2R a year on 2006-17 after all costs, 330 positions, t 1.86: positive, not proven; worst drawdown about
20R lasting almost four years), the trend leg's add on against off (no difference the data can see), and the Gold trend
rule on thirteen other markets with hourly candles (0 of 14 tests pass). One decision came out of them.

### [ ] 42. "What to expect": count financing on the trend legs' add unit as well

- **Status (11 Nov 2026): open.** Proposed by the book study; nothing was changed.
- **Context.** Since item 38 the "What to expect" figures charge overnight financing on a position's first unit only,
  because the study records then on file did not carry the add unit. The book study committed unit-level records
  (`research/edge/supported-book/legs.json`). With every unit charged, on untouched 2006-17: Gold trend +0.31R a position
  (n 74, t 1.20) instead of the +0.40R (t 1.49) shown today; Gold trend fast +0.21R (n 128, t 1.17) instead of +0.29R.
  The daily engulf has no add and does not change.
- **Options.** (a) Rebuild the two trend legs' expectations from the unit-level records. (b) Leave the first-unit figures
  and say so on the page.
- **Recommended.** (a). No trade, size or rule changes; the page's expectation for Gold trend becomes about a fifth lower
  and its time-to-judge longer, which is the honest state.
- **If nothing is decided.** The page keeps overstating the trend legs' expectancy by about 0.08R a position.
