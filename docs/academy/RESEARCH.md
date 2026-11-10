# Academy research engine

Read with `ARCHITECTURE.md` (the contract), `MODULES.md` (what was built) and `TRAINING.md` (the dataset and the policy
check). This file covers the research engine: `academy/gen/research.mjs`, its output `academy/data/research.json` and its
tests `tests/academy-research.test.mjs`. Paper research only. Nothing here places an order or changes a rule.

```sh
node academy/gen/research.mjs      # a second or two; writes academy/data/research.json
node --test tests/academy-research.test.mjs
```

The run is deterministic. The same committed data and the same code give the same bytes. `generated` is the date in
`academy/data/meta.json`, not the clock.

## 1. What it does

It reads three committed files and nothing else: the feature matrix `ml/data/matrix.json.gz`, the policy check
`academy/data/eval.json` and `academy/data/meta.json`. No candles, no network, no paid service.

It writes five kinds of study. Each study is one notebook entry in the shape the API's `notebook.add` takes, so the page
can show a generated study beside the owner's own notes.

| Kind | Entries | What it says |
|---|---|---|
| `baseline` | 8 | Each edge, and the book of seven, with every setup taken: n, win rate, net R a trade, total, t, profit factor, worst drawdown, by year, first 70 % of the period against the last 30 %. Checked against `eval.json`. |
| `condition` | 130 tested + 7 untested lists | One pre-registered feature bucket of one edge: does net R a trade differ inside the bucket? Tested on a discovery part and a confirmation part. |
| `regime` | 7 | Each edge by regime and by volatility band, with n and t. Under 20 trades in a regime it says "unfamiliar". |
| `book` | 1 | How often the edges trade on the same days, the correlation of their daily net R, and the drawdown of the book. |
| `policy` | 1 | `eval.json` joined: the decision policy against taking every setup, and the wait reasons. |

A trade here is: train pool, not flagged (`rule.clockShift`, `rule.pre2020`), filled. An order that never filled is not a
trade. Net R is after costs.

## 2. Pre-registration

The families, the buckets, the split, the minimum sample, the correction and the pass rule are constants at the top of
`academy/gen/research.mjs`, above the line `END OF PRE-REGISTRATION`. They were written before any condition result was
computed. The only numbers known beforehand were the published baselines of `eval.json` and the counts of feature values
(no outcomes). Nothing was tuned after a run. A later change to a constant must be listed in `AMENDMENTS`, which is empty.

**Families and keys** (22 keys, 60 buckets an edge, 420 conditions for the seven edges):

| Family | Keys and buckets |
|---|---|
| Market regime | `regime` (trending, ranging, breakout, reversal, high-vol, low-vol), `regimeHtf` (the same six), `effRatio` (low, high) |
| Bias and structure agreement | `biasAlign` (with, against, neutral), `ltfAlign` (with, against, neutral), `htfLtfConflict` (true) |
| Session and day | `session` (asia, london, overlap, newyork, late), `dow` (mon to fri) |
| Volatility | `atrPctile` (low, high), `volAbnormal` (true) |
| Stop, reward to risk, side | `stopAtr` (low, high), `rr` (low, high), `entryOffset` (low, high), `side` (buy) |
| Scheduled releases | `eventNear` (true) |
| Location and resting levels | `locFor` (good, poor, mid), `distSR` (low, high), `oppLiq` (1 or more) |
| Trigger quality | `confirm` (strong, weak, against), `sweepFor`, `dispFor` (with, against, none), `momFor` (with, against, flat) |

- One bucket is one condition and one test. A yes / no key gives one bucket, since the other side is the same test.
- A numeric key gives two buckets: the lowest third and the highest third. The two cut values come from the discovery
  part only, and each is a value that occurred there.
- Rows where the key is unknown are left out of that study. `eventNear` is unknown before 2022, where the calendar begins.
- A bucket is a list of lesson conditions. Membership is decided by `MXA.lessons.matches`, the function the decision
  engine uses. So a draft lesson fires on exactly the trades its study counted.

**Split.** Each edge's trades are put in signal-time order. Discovery is the first 70 % by count. Confirmation is the
rest. The baselines use the other split, the one `eval.json` uses: the point 70 % of the way through the period by time.

**Minimum sample.** The bucket and the rest each need 20 trades in the discovery part and 20 in the confirmation part.
Otherwise the condition is "inconclusive: too few trades". It is not tested and not counted as a test.

**Measure.** Net R a trade inside the bucket minus outside it, with a two-sided Welch t, in each part.

**Correction.** Benjamini-Hochberg at 10 % across every discovery test of the run.

**Pass rule.**

| Label | Meaning |
|---|---|
| `inconclusive` | Too few trades, or the discovery part shows no difference (\|t\| under 2). |
| `rejected` | Discovery passed, but the difference has the opposite sign in confirmation. |
| `in-sample` | Discovery passed and the sign holds, but the confirmation \|t\| is under 2. |
| `out-of-sample` | Discovery passed, the sign holds and the confirmation \|t\| is at least 2. |
| `validated` | Out-of-sample, and the discovery p-value survived the correction. |

Baseline, regime, book and policy studies describe the train pool. They carry `in-sample` and are never called an edge.

## 3. The run of 10 Nov 2026 (corrected research clock)

Data: matrix `70e66e9073af`, eval `986a22fc937c`, candles `histdata@85ef4b8ceaac`. 1,476 train trades.
This run is on the corrected candle clock (`docs/academy/DATA-CLOCK.md`). The pre-registration did not change. The run
on the old clock (1,421 trades, 121 tests) is kept in `academy/archive/pre-clock/data/research.json`.

- **130 of 420 conditions had enough trades to test** (replica 35, gtl 13, gmp 45, nq-open 37). The other 290 are
  inconclusive for lack of trades. mosha-bo (28 trades), gtrend (18) and geg (82) are too small for any test: their
  confirmation part holds fewer than 40 trades.
- **5 of the 130 tests passed discovery. Chance alone gives about 6.2.** So the discovery passes are what noise looks
  like.
- **Nothing is validated.** No discovery p-value survived the correction. The smallest adjusted p is 0.47.
- 0 out-of-sample, 2 in-sample only, 3 rejected, 125 tested and inconclusive.
- With no real effect anywhere, about 0.16 conditions would pass discovery and then confirm. None did.

**The one out-of-sample condition of the old-clock run did not repeat.** On the old clock, "gtl: lower-timeframe
structure is neutral" passed discovery and confirmation at t 2.10 each (adjusted p 0.79). On the corrected clock it does
not pass discovery. It was one result out of 121 tests at the edge of the t line, and it is gone. That is what a chance
result looks like.

The two in-sample conditions are both on nq-open: the higher-timeframe regime is ranging (discovery t 2.70,
confirmation t 1.17) and a high entry offset (discovery t 2.13, confirmation t 0.28). Neither confirms.

The three rejected conditions are a warning in themselves. On replica, momentum with the trade looked much worse in
discovery (t -2.58) and momentum flat much better (t 2.62). Both flipped sign in confirmation. On gmp, the New York
session looked worse in discovery (t -2.20) and flipped too.

**Draft lessons.** None. No condition reached out-of-sample or validated, so research proposes nothing. (The old-clock
run offered one inactive draft, the gtl condition above.)

**Baselines.** They equal `eval.json` exactly. Worst drawdowns in net R: replica 26.6, nq-open 16.3, gmp 16.1, gtl 13.5,
geg 7.3, gtrend 5.3, mosha-bo 4.6. The book of seven: 1,476 trades, +0.252 R a trade, t 4.74, profit factor 1.46, every
year from 2020 positive.

**Book.** More than one edge had a trade active on 49.6 % of the active days. Only 6 of the 21 pairs share 20 days on
which both closed a trade, and none of those correlations is far from zero (the largest is +0.30 on 23 days, t 1.41).
The book's worst drawdown is 31.9 R against 89.6 R for the seven edges' own worst drawdowns added together.

**Policy.** The policy took 522 trades at +0.312 R and waited on 954 at +0.219 R (t 0.82: no measurable difference). The
waits skipped +208.59 R in total, most of it on replica. No wait reason marks a group of trades that lost money.

## 4. How to read a study

Every entry has the same fields:

| Field | What it holds |
|---|---|
| `id`, `kind`, `edge` | `cond:<edge>:<key>:<bucket>`, `base:<edge>`, `regime:<edge>`, `book:seven`, `policy:eval`. `edge` is null for the book and the policy. |
| `title`, `hypothesis` | The claim being tested, in one sentence. |
| `dataset`, `sampleSize` | Which trades, how many, and where the split falls. |
| `method` | The measure and the pre-registered rule. |
| `results` | One or two plain sentences, always with n and t. |
| `table` | The numbers. For a condition: `when` (the lesson conditions), `discovery` and `confirmation` (each `nIn`, `nOut`, `rIn`, `rOut`, `diff`, `t`, `df`, `p`), `q` (the adjusted p), `fdrPass`. |
| `limitations` | What the study cannot show. |
| `validation` | One of the six notebook values. See the pass rule. |
| `reproducibility` | The command, the data versions and the code hash. |
| `tags` | `research`, the kind, the family and the key. |

Reading order for a condition: first `validation`, then the confirmation line, then `q`. A large discovery t with a
weak confirmation is the usual shape of noise. `rIn` and `rOut` are net R a trade; `diff` is their difference.

The conditions that could not be tested are listed in one entry an edge (`cond:<edge>:untested`), with the trade counts
of each bucket and no averages. An average over a handful of trades would only invite a wrong reading.

`counts` at the top of the file gives the number of tests, the labels by count and what chance alone would give.
`proposedLessons` holds the drafts. Each passes `MXA.lessons.validate` and the API's `lesson.save`, is `active: false`,
and has `source.kind: 'research'` with the study id. `source` is an object, not a word, because `lesson.save` takes an
object there.

## 5. No exam data, no look-ahead

- The exam pool is the mentor's test set. The loader looks at an exam row's edge and pool tag, counts it and moves on.
  The test replaces every outcome and every feature of every exam row with wild values and gets the same bytes back.
- The generator opens the matrix, `eval.json`, `meta.json` and its own source (for the code hash). It opens no
  candidate or outcome file.
- A condition is built only from feature keys, all known at the signal time. Outcome columns are averaged, never used to
  choose a row. A raw price level is never a condition.

## 6. Limits

- **One sample per edge.** Each edge has one history. A split into two parts is one cut in time, not a walk-forward.
- **Small n.** Three edges cannot be tested at all. gtl has 50 confirmation trades, so only 9 of its 60 buckets clear
  the minimum. A t of 2 on 24 trades is weak.
- **Many overlapping tests.** Buckets share trades (a regime, its volatility, its session). The correction assumes the
  tests are not negatively related. The "expected by chance" figures are rough for the same reason.
- **Trades overlap the cut.** A discovery trade can still be open when the first confirmation trade begins.
- **HistData candles.** The candidates and outcomes come from the research candles. Coverage is "usable", not
  "certified", and 2023 is weak. Weeks whose clock could not be verified against a second feed are left out (`docs/academy/DATA-CLOCK.md`).
- **Holes in time.** The train pool misses each edge's exam months (about 30 %), and each edge misses different months.
  The book study is therefore not the live book, and its drawdown is understated.
- **No exam data.** Nothing here has been tested on the exam pool. That is by design: the exam pool is for the mentor.
- **The policy reasons are a proxy.** `eval.json` stores how often each wait reason fired, not what those trades made.
  The reason table shows every train trade that carries the feature behind the reason, waited on or not.
- **Descriptive unless validated.** In-sample and out-of-sample labels are reports, not edges. Nothing in this run is
  validated.

## 7. Policy investigation, 10 Nov 2026

A separate, pre-registered study of the decision policy itself: `research/edge/academy-policy/` (`PREREGISTRATION.md`
written and committed first, then `walk.mjs`, `lib.mjs`, `run.mjs`; report `RESULT.md`, numbers `result.json`, tests
`tests/academy-policy.test.mjs`). The question: why does `policy-1.0` not beat taking every setup, worst on replica and
gmp, and does any principled change generalise?

- **Three sets, kept apart.** Discovery = the earliest 60 % of each edge's usable train setups, validation = the
  latest 40 % (cut times fixed from the candidate files before any outcome was opened), and the exam pool as the
  untouched final test. `academy/data/exam-ledger.json` logs every exam read made to judge a policy: one at most per
  frozen candidate version, only after it passes validation, written before the read. **It holds zero reads.**
- **Diagnosis.** The evidence margin does not rank trades: its rank correlation with net R is about zero on replica
  (−0.07, −0.10) and gmp (−0.06, −0.02) in both parts. The replica gap is a discovery result (−0.73 R, t −1.43) that
  is gone on validation (−0.07 R, t −0.19): the support votes that looked wrong-signed in discovery (momentum t −2.84,
  lower-timeframe structure t −4.57) flipped sign. The gmp gap has one sign in both parts and is significant in
  neither (t −0.43, t −1.47). Of 55 votes that could be tabled in both parts, 33 kept their sign. Two votes are
  constants: every candidate but gtrend's carries the 10R cap as its target, so "reward to risk at least 2" always
  supports and "a resting level in the way" almost always contradicts.
- **Candidates** (five, fixed in advance; the null is "take every setup"): C1 defer to the edge, C2 gates only, C3 an
  a-priori edge-logic table for replica and gmp, C4 drop the votes that are wrong-signed in discovery, C5 take only at
  medium or high confidence. Acceptance needed a validation take-minus-wait t of 2 after a Holm correction, a take-set
  above the baseline and a drawdown not worse. **0 of 16 tests accepted; the largest validation t is 1.00.** C2 and C3
  are rejected, C1 (identical to the baseline: no hard gate ever fires), C4 and C5 are inconclusive.
- **Power.** The smallest difference that reaches t = 2 on validation is 0.35 R (gmp) to 1.28 R (replica), several
  times each edge's average trade. A modest real improvement cannot be shown on this data.
- **Nothing shipped changed.** `policy-1.0` is still the policy; no `policy-1.1` exists. `eval.json` gained `drawdown`
  and `eval-trades.json` was added (`TRAINING.md`, section 3).

`node research/edge/academy-policy/run.mjs` is offline and reproduces `result.json` byte for byte from the committed
files; `walk.mjs` (which needs the research candles) writes the outcome-free decision records it reads.
