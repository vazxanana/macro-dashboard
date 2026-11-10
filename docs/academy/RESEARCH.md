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
| `condition` | 121 tested + 7 untested lists | One pre-registered feature bucket of one edge: does net R a trade differ inside the bucket? Tested on a discovery part and a confirmation part. |
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

## 3. The run of 10 Nov 2026

Data: matrix `9035174e215f`, eval `6c59608207b3`, candles `histdata@60cea4527cb1`. 1,421 train trades.

- **121 of 420 conditions had enough trades to test** (replica 32, gtl 9, gmp 47, nq-open 33). The other 299 are
  inconclusive for lack of trades. mosha-bo (29 trades), gtrend (19) and geg (84) are too small for any test: their
  confirmation part holds fewer than 40 trades.
- **7 of the 121 tests passed discovery. Chance alone gives about 5.8.** So the discovery passes are what noise looks
  like.
- **Nothing is validated.** No discovery p-value survived the correction. The smallest adjusted p is 0.39.
- 1 out-of-sample, 4 in-sample only, 2 rejected, 114 tested and inconclusive.
- With no real effect anywhere, about 0.15 conditions would pass discovery and then confirm. One did.

The one out-of-sample condition:

| Edge | Bucket | Discovery: in, out, t | Confirmation: in, out, t | Adjusted p |
|---|---|---|---|---|
| gtl | lower-timeframe structure is neutral (`ltfAlign` = neutral) | n 84 at +0.281 R, n 31 at -0.220 R, t 2.10 | n 26 at +0.788 R, n 24 at +0.043 R, t 2.10 | 0.79 |

It is one result out of 121 tests, it sits at the edge of the t line in both parts, and it did not survive the
correction. It is a hypothesis for the mentor, not an edge.

The two rejected conditions are a warning in themselves. On replica, momentum with the trade looked much worse in
discovery (t -2.69) and momentum flat much better (t 2.64). Both flipped sign in confirmation.

**Draft lessons.** One, inactive: "gtl: TAKE when the lower-timeframe structure is neutral", with its evidence and the
study id. Research proposes. The mentor decides. A draft should be tested on the exam pool before it is switched on.

**Baselines.** They equal `eval.json` exactly. Worst drawdowns in net R: replica 32.1, nq-open 20.4, gmp 16.1, gtl 12.6,
geg 8.4, gtrend 6.3, mosha-bo 5.2. The book of seven: 1,421 trades, +0.249 R a trade, t 4.57, profit factor 1.46, every
year from 2020 positive.

**Book.** More than one edge had a trade active on 48.7 % of the active days. Only 6 of the 21 pairs share 20 days on
which both closed a trade, and none of those correlations is far from zero (the largest is +0.25 on 23 days, t 1.19).
The book's worst drawdown is 36.0 R against 101.1 R for the seven edges' own worst drawdowns added together.

**Policy.** The policy took 486 trades at +0.342 R and waited on 935 at +0.201 R (t 1.17: no measurable difference). The
waits skipped +187.95 R in total, most of it on replica. No wait reason marks a group of trades that lost money.

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
  "certified", and 2023 is weak. Clock-shifted weeks are left out.
- **Holes in time.** The train pool misses each edge's exam months (about 30 %), and each edge misses different months.
  The book study is therefore not the live book, and its drawdown is understated.
- **No exam data.** Nothing here has been tested on the exam pool. That is by design: the exam pool is for the mentor.
- **The policy reasons are a proxy.** `eval.json` stores how often each wait reason fired, not what those trades made.
  The reason table shows every train trade that carries the feature behind the reason, waited on or not.
- **Descriptive unless validated.** In-sample and out-of-sample labels are reports, not edges. Nothing in this run is
  validated.
