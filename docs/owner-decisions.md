# Open owner decisions (9 Nov 2026; items 19 to 26 added 10 Nov)

One checklist of what waits on the owner's yes or no. Each item: what it is, why it matters, the options, and the recommended
one. Nothing below has been changed in the code; each item names where the change would go. Tick an item when it is decided and
note the answer next to it (or in the PR that carries it out).

Grouped: **Security** (1-8 and 26, of which 7-8 and 26 are Fred's connector), **Trading on paper and demo** (9-14), **Reliability
and data** (15-16), **Council proposals the study already answered** (17-18), **The research candle clock, 10 Nov 2026** (19-25).

---

## Security

### [ ] 1. Change every password, including the owner's

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

- **Context.** Passwords are stored as plain SHA-256 with no salt (`api/_accounts.js` `sha`, `api/users.js`), and the Users page
  accepts passwords of 4 characters. The 9 Nov fix keeps hashes off the page, but a leaked user list (Blob, repo history) is easy
  to crack.
- **Options.** (a) Switch to `scrypt` from Node's built-in `crypto` (free, no new package) with a per-user salt; re-hash each
  account the next time it signs in, keep SHA-256 only for accounts not yet upgraded. (b) Only raise the minimum length.
  (c) Leave as is.
- **Recommended: (a) plus a 10-character minimum.** One change in `api/_accounts.js` / `api/users.js` / `api/_session.js` with
  tests in `tests/auth.test.mjs`; nobody has to do anything except sign in once.

### [ ] 3. Per-permission gating of `/cdata`

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

- **Context.** "Link my cTrader account" (`api/ctrader-link.js`) sends the browser to cTrader without a `state` value. The return
  is already tied to a 15-minute HttpOnly link cookie for the signed-in member, which blocks most abuse, but `state` is the
  standard guard against a forged return carrying someone else's grant code.
- **Options.** (a) Put a random value in the link cookie, send it as `state`, refuse a return whose `state` differs.
  (b) Leave as is.
- **Recommended: (a).** Small and standard; check once that cTrader passes `state` back on the redirect.

### [ ] 5. Vercel firewall rule for `/api/login`

- **Context.** Password guessing is limited to 10 failures per 10 minutes per IP by `api/_guard.js`, but that table lives in
  memory per server instance, so several instances each allow 10. The firewall's general `/api` limit is 30 a minute per IP.
- **Options.** (a) Add a firewall rate-limit rule just for `POST /api/login` (and `/api/ctrader-link`, `/api/mcp` key requests),
  for example 10 a minute per IP, deny. (b) Leave it to the in-memory guard.
- **Recommended: (a).** Set in Vercel → Firewall; no code change, no extra cost on the current plan. Keep it a rate limit, not a
  timed block (a shared mobile IP must never lose the site for an hour).

### [ ] 6. Who may see `/api/status`

- **Context.** `/api/status` is public and edge-cached. Since 9 Nov it no longer carries error stacks, but it still tells anyone
  how old each bot's last round is, the run mode, and the last run's error line, step and commit.
- **Options.** (a) Public answer reduced to "ok / behind"; the details only with a signed-in session. (b) Session only.
  (c) Keep as is.
- **Recommended: (a).** The page shows "Council bot behind" to signed-in users only, so nothing visible changes.

### [ ] 7. Fred's connector: GitHub token scopes

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

- **Context.** `ict_backtest` / `ict_compare` need `OANDA_TOKEN` on the server (the same token `/md/bars` uses; `OANDA_ENV`
  unset = practice account). Without it NQ / ES / YM fall back to research candles from 2023 only. The lab's round-trip costs
  (`api/_ictlab.js` `COST`: NQ 1.5, ES 0.5, YM 3, RTY 0.4 points, gold 0.5, silver 0.03) differ from the CME micro round trip the
  digest and the portfolio study use (`ICT_COST_PTS`: NQ 1.37, ES 1.0, YM 5.5, RTY 0.55, gold 0.42), so a lab result looks
  better on ES, YM and RTY than the desk's own reports.
- **Options.** (a) Keep `OANDA_TOKEN` a practice-account token and set the lab's costs to `ICT_COST_PTS` (silver stays 0.03).
  (b) Keep the lab's numbers and say so in the guide. (c) Use the higher of the two per market.
- **Recommended: (a).** One cost table for every ICT number Fred and the owner compare. Update `docs/fred-mcp.md` with it.

### [x] 26. Fred may apply ICT changes without review: ON (your decision, 10 Nov 2026)

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

- **Context.** The mirror treats ICT signals that are not A-setups as shadows (`council/ctrader-mirror.mjs` `ictCandidates`),
  and the code comment says they are "never sent". But shadows are mirrored by default (config `mirrorShadow` is not `false`), and
  every ICT trade is routed to the ICT book, so the non-A signals are copied to the ICT demo account next to the A-setups.
- **Options.** (a) Do not copy non-A ICT signals at all (one line in `ictCandidates`). (b) Copy them to a separate account.
  (c) Keep copying them; read the ICT account knowing it mixes both. (d) `mirrorShadow: false` (stops every shadow copy, the
  council shadows too).
- **Recommended: (a).** The ICT demo account should show the A-rule the desk actually follows; non-A results are already tracked
  on paper.

### [ ] 10. Late-copy check for ICT trades

- **Context.** A council trade copied late is skipped when the price is already past its stop or target or has run more than 1R
  from the entry (`LIMITS.maxDriftR`). ICT trades skip that check (their levels are futures prices, the demo trades the cash CFD),
  so an ICT trade copied hours late (closed market, capacity wait) goes in at the price then, with the original distances.
- **Options.** (a) Apply the same check on the futures side: compare the ICT desk's latest futures price (`ict/snapshot.json`)
  with the trade's futures entry, stop and target, and skip when past the stop / target or more than 1R in. (b) A time limit
  instead (for example, no copy more than 30 minutes after the signal). (c) Leave as is.
- **Recommended: (a).** Same rule as the council trades, and it cannot loosen a stop.

### [ ] 11. Shadow streams after the cost study (proposals 3a-3e)

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

- **Context.** The LIT study was inconclusive (27 gold fills in 19 years; what can be measured is negative), and LIT costs about
  0.25R a trade, well over the owner's 0.10R limit; no LIT trade in 19 years was cheaper than 0.10R. On 8 Nov the owner chose to keep
  it as a paper shadow, and it also has a demo account and a "study" replay with loosened rules.
- **Options.** (a) Keep it on paper as decided, knowing it fails the cost limit. (b) Retire the stream and its demo copies; keep
  the study and the replay page for learning.
- **Recommended: (b).** By the owner's own 0.10R rule it cannot become a system; the replay keeps it available for study.

### [ ] 13. Proposal 4: damp the Coach's session flips on paper engine setups

- **Context.** 37 Coach changes on 17 rules in one week, 4 rules flipped back and forth 3+ times; a fair session rule tested on
  2020-26 found almost nothing to switch off, and the Coach's choices did no better than random (`research/edge/coach-learning`).
- **Proposal.** A session is switched only after at least 15 trades and a clearly losing record (t ≤ −1) over a fixed window.
- **Recommended: yes.** Main systems and owner rules are already outside the Coach's reach; this only slows the shadow-book churn.

### [ ] 14. Proposal 5: size the replica for its real drawdown

- **Context.** 2020-26: worst drawdown −45R at normal costs, −62R at doubled costs, two losing years in a row (2022-23); the rule
  also failed before 2023 (`research/edge/replica-oos`).
- **Options.** (a) Cut the replica's risk so a −60R run stays inside the drawdown the owner accepts. (b) Keep the size.
- **Recommended: (a).** A sizing decision only, no rule change.

---

## Reliability and data

### [ ] 15. Trigger the watchdog from a Vercel cron

- **Context.** `watchdog.yml` runs on a GitHub cron at :11 / :41 (GitHub fires this repo's crons only a few times a day) and after
  every completed council run. If the loop hangs inside a run, nothing completes, and the "council stopped" alert can be hours late.
  The old `api/kick.js` that dispatched workflows from Vercel is gone.
- **Options.** (a) A Vercel cron every 15-30 minutes that dispatches `watchdog.yml` (a small function or a new `api/run.js` job;
  needs a token with Actions write, never committed). (b) Keep GitHub's cron.
- **Recommended: (a).** Costs nothing extra on the current plan and makes the watchdog independent of GitHub's scheduler.

### [ ] 16. Dead FRED series `BSCICP03DEM665S` (German business confidence)

- **Context.** This OECD series stopped at 2024-01-01. The Macro strategist already drops it as "no data" (`council/macro.mjs`
  `MAX_AGE`), so its "Eurozone growth pulse" driver is empty; but the gold terminal (`gold-trading.html` `refreshFundamentalsX`)
  still fetches it and shows its 2024 value as today's Eurozone growth pulse.
- **Options.** (a) Retire the driver on both pages until a live, free replacement is found (the ECB data API already used for the
  euro 2-year yield is the first place to look). (b) Replace it now with another free series. (c) Leave it.
- **Recommended: (a).** A 2024 reading shown as current is worse than no reading.

---

## Council research proposals already answered by the study (for the record)

### [ ] 17. Proposal 1: keep the time exit at the candle's close

No difference (−0.001R a position over 719 positions). **Recommended: yes, close the question.** Nothing changes in the code.

### [ ] 18. Proposal 2: no cost gate on the gold systems

The trades a 0.10R cost gate would skip made +0.42R each. **Recommended: yes.** Nothing changes in the code.

---

## The research candle clock (10 Nov 2026)

The HistData research candles were being read on the wrong clock. A pre-registered audit settled the rule and every study
loader now uses one converter (`council/histdata.mjs`); the audit and the before → after table of every study are in
`research/edge/histdata-clock/RESULT.md`, the Academy's part in `docs/academy/DATA-CLOCK.md`. No trading rule, live member
or config was changed. The items below are what that work leaves for the owner.

### [ ] 19. Monitoring baselines rebuilt on the corrected clock (already committed: confirm or revert)

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

- **Context.** `research/edge/ict-variants` was pre-registered and failed on 9 Nov. On the corrected clock its script gives
  PASS for one of nine verdicts: V3 htffvg, index book: in-sample n 80, +0.273R, t 1.44; out-of-sample n 84, +0.355R, t 1.92;
  2024 lost (21 trades, −0.5R); not "strong". The plan itself warns that with nine tries one pass by luck is plausible. The
  ict-filters study, on the same corrected clock, no longer picks this filter in-sample. The desk already records the
  feature on every signal (`feat.htfFvg`, skill §29), so a forward record is building.
- **Options.** (a) Do nothing new: keep forward-testing the recorded feature. (b) Add a paper shadow variant for it
  (never alerted, as the other shadows). (c) Change the live A-rule.
- **Recommended: (a).** One pass of nine with t under 2 in both halves is a hypothesis. Never (c) on this evidence.

### [ ] 21. `ict/replay.mjs` still reads HistData files with the old clock (live code, not changed)

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

- **Context.** Their loaders are fixed, but these were not re-run (each RESULT.md says so in a line under its title):
  the long engine replays `scalp-filters`, `scalp-exits`, `timing`, `regime`, `setups-promote`, `confluence`, `costs`
  (hours of machine time between them; every one is a FAIL on the Scalp or on a setup that is not live), `ict-smile`
  (needs FRED), `ict-sessions` (inputs cannot be reproduced; its verdict fields do not move with the clock).
- **Options.** (a) Re-run them on a free runner when convenient (the commands are in each RESULT.md). (b) Leave them.
- **Recommended: (a), low priority.** None of them carries a live rule. Until then, read their numbers as old-clock numbers.

### [ ] 24. The dollar-index file of 2018 is not a usable series

- **Context.** The clock audit could not check `UDXUSD` 2018: its hourly returns do not follow EUR/USD at any offset
  (correlation near zero in 50 weeks) and its weekly reopen matches in 3 of 52 weekends. From 2019 the file is fine.
  The veteran's event playbook (`council/event-base.json`) uses it for the dollar's first read on the eight 2018 CPI rows.
- **Options.** (a) Drop the 2018 rows from the event base (a change to the event-reaction study's pre-registered data
  window: needs an amendment). (b) Keep them, labelled. (c) Find another 2018 dollar-index series.
- **Recommended: (a) with a dated amendment.** Eight of 86 CPI rows; the playbook's figures are descriptive only.

### [ ] 25. COT release lag in the Macro strategist (found by the unmerged `wip/data-clock-fixes` branch; not changed here)

- **Where.** `council/macro.mjs` line 59 (`COT_LAG = 4`) and line 245 (`r.t <= D - COT_LAG * DAY`).
- **Effect.** A CFTC report dated Tuesday is taken as public four days later. In a holiday week the CFTC publishes on the
  following Monday, so the strategist's COT driver can read a report up to two days before it was public. The same lines
  compute the "3-year" percentile over the last 60 rows of a pull that mixes two contracts. `council/cot.mjs` already has
  the right release clock (`usableAt`, `RELEASE_LAG`).
- **Proposed fix.** Use `cot.mjs` `usableAt` for the cut and its 156-week percentile, as the wip branch drafted
  (unverified; it also changed `council/veteran.mjs` staleness and added tests). This is not the HistData clock and it
  changes what a live member computes, so it was left for the owner.
- **Recommended: yes, as its own reviewed change with tests.** Paper only either way.
