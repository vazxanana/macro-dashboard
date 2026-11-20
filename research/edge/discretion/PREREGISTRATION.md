# Pre-registration: does a person's choice of signals beat taking every signal? (discretion, 20 Nov 2026)

Committed and pushed alone, before any result (any R figure by decision, any standard deviation, any power figure) was computed.

## Why this study, and not another rule

Owner, 20 Nov 2026: "think outside the box, because the difference is discretion on all edges, because they work." The owner's
view is that the edges work when a person chooses which signals to take, and that the mechanical tests fail because they take
every signal. About 150 pre-registered studies in `research/edge/` test rules; none measures the choosing. This study measures
the choosing itself, with what the repository already records, and says what is missing where it cannot.

Nearest work: `research/proposals/2026-11-14-luxus-record-power.md` (how many pre-entry trades one trader's own record needs),
the Mosha desk's `pre` / `setAt` rule (a trade counts only when written down before its outcome), `mosha-select` (four simple
conditions did not hold the owner's selection), `research/proposals/2026-11-17-mosha-misses.md`. None compares TAKEN against
SKIPPED signals of one stream.

Paper research only. Read-only on council-data. No rule, size, filter, stop, config, page, `api/`, `council/` or `ict/` file
changes. ICT is a separate edge (absolute rule 4): it has its own section and is never pooled with a council system. Owner
item 44 is untouched (no gate, exit, entry or size of the gold book is tested). Aggregate figures only: no individual's trade,
note or name is written to the repository; "by person" is reported only as counts of distinct reviewers and pooled statistics.

## What was looked at before this file (said plainly)

Only an inventory, as the brief asked ("count what exists first"), on council-data commit `bb4e7c3c188d385ce0fd82a31bcb4e461bf68d9c`:
which files exist, how many records they hold, and whether each human review's time stamp is before or after its trade's
close. No R figure was split by any decision, no mean, standard deviation or t was computed. What the inventory showed:
`ict/desk.json` and `ict/mcp-notes.json` are absent from the branch and from its whole history; `reviews/losses.json` holds 8
human reviews, all stamped after the close; `reviews/analyst.json` holds 28 records written by a program. So the expected
outcome of the tests below is "too few to judge"; the bar is fixed here anyway so that a later re-run on a fuller record
cannot choose its own.

## Sources of a recorded human decision (the inventory, to be counted exactly by run.mjs)

| Source | What it would hold | Counts as a decision? |
|---|---|---|
| council-data `ict/desk.json` | per ICT signal: act (Taken / Skipped / Missed), grade, score, tags, by, at | yes, when `at` is before the execution's exit |
| council-data `ict/mcp-notes.json` | notes through the connector | no (free text, no take / skip field); counted only |
| council-data `reviews/losses.json` | the loss review: tags, a note, by, at, on LOSING trades | no: losses only, written after the close (hindsight class) |
| council-data `reviews/analyst.json` | post-mortems by the Analyst program | no: not a person; counted only |
| Mosha log, Mosha lessons, ChronosTrade, Academy, the browser journal | private store or the browser | not on council-data: not readable here; said so, never guessed |

## Definitions

- **Execution**: one closed record (status win / loss / be) of `ict/trades.json` (live) or `ict/replay.json` (replay; top-level
  records, never the paper variants). **Per-unit R** = `Rraw`, else `R` (the desk's one-booked-outcome rule).
- **Decision**: a review record keyed by an execution's exact id with `act` Taken or Skipped (case-insensitive). `Missed` is
  not a choice to skip and is counted apart. Times are read as unix seconds, milliseconds or ISO text.
- **Before the outcome** (class B): the review's `at` is strictly before the execution's `closed` time. Sub-class B0: `at` at
  or before the execution's `opened` time. **Hindsight** (class H): `at` at or after `closed`, or no readable `at`.
  A replay execution is back-filled history; its review is class B only under the same test (`at` < `closed`).
  Only class B enters a test. Class H is counted and shown apart, labelled hindsight, and never judged.
- A record edited later keeps only its last `at` in this file format; that limit is stated in the result (a server stamp of
  the first decision is part of the proposal).

## Tests (ICT section; fixed now)

- **D1, taken vs skipped**: class-B decisions on ICT executions. Mean per-unit R of Taken minus Skipped, Welch t. Reported
  for every decided execution and for A-setups (`aset`) alone; the primary is every decided execution.
- **D2, grade**: class-B reviews carrying a numeric `score` (1-10), else a letter `grade` mapped A+ 6, A 5, B 4, C 3, D 2, F 1.
  Above the median against at or below it, mean per-unit R, Welch t.
- **Council systems (own section)**: D3 = the same comparison for any council stream with a take / skip record. The inventory
  found no such record; if run.mjs finds none, D3 is "no record exists", not a result.
- **Bar**: a test is JUDGED only with n >= 20 on each side; otherwise the verdict for it is "too few to judge" and no t is
  quoted as evidence. Judged: PASS needs the difference > 0 and Welch t >= 2, Holm-adjusted p < 0.05 over the judged tests;
  otherwise FAIL. A PASS would be a first small sample in favour of discretion on that stream, never an edge.
- **Overall verdict**: PASS if D1 passes; FAIL if D1 is judged and does not; "TOO FEW TO JUDGE" if D1 is not judged.

## Power arithmetic (fixed now, computed after)

For "taken beats skipped by d R a trade" with equal sides and a per-trade standard deviation s:
- n a side for an expected Welch t of 2 (about a 50 % chance to show it): `ceil(2 * (2 s / d)^2)`;
- n a side for 80 % power at two-sided 5 %: `ceil(2 * ((1.96 + 0.8416) s / d)^2)`.
- d in {0.10, 0.20, 0.30, 0.50} R. s = the sample standard deviation of per-unit R of the stream's closed executions:
  **ICT**: `ict/replay.json` top-level A-setups (and every signal, shown beside); **council live book** (own section): closed,
  non-shadow, non-void, non-duplicate records of `trades.json`, raw `R`.
- Months needed = 2 x n a side / (decided signals a month), with the signal rate = the stream's FORWARD records
  (`ict/trades.json` A-setups; `trades.json` live) per 30 days over their own span, assuming every signal gets a decision and
  half are taken. Stated as arithmetic, not evidence.

## Outputs

`run.mjs <council-data dir>` (files exported with `git show`, no network), `RESULT.md`, `result.json` (counts, classes, tests
or "too few", power tables; aggregates only), `tests/discretion.test.mjs` (the pure pieces on made-up data; the report against
result.json; no name or trade id in the committed files), and the owner's proposal
`research/proposals/2026-11-20-discretion.md` (how to capture a decision before the outcome on every live signal so this can
be measured: a proposal only, nothing built).
