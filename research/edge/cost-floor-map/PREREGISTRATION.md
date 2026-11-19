# Cost floor map: which pre-cost effects of the 13-14 Nov studies are blocked only by cost (pre-registration)

Committed and pushed alone, before `collect.mjs`, `run.mjs`, `collected.json` or `result.json` exist. Written 14 Nov 2026.

**What this is.** A synthesis of results already committed on the study branches of the 13-14 Nov 2026 research days
(pull requests #815 to #943). It is accounting, not a test: no market data is fetched, no rule is run, no study's own file is
edited, and no row of it may be called an edge. Nothing live changes. Three things are left to other work on purpose and are
not redone here: the recount of every test for multiple testing (branch `multiple-testing-update`), the measured Sunday-reopen
spread (branch `weekend-reopen-cost`) and the bond month-end futures re-cost (branch `bond-month-end-futures`, read only as a
committed source where it already gives a figure).

## 1. Which studies are read

- Every branch of `origin` that holds `research/edge/<topic>/result.json`, listed with `git ls-tree` and read with
  `git show`. The **scope** is the studies of pull requests #815 to #943 (the 13-14 Nov research days, as listed by the
  branch-to-pull-request map of the GitHub API). Older studies on `main` are outside the scope.
- Not studies, left out by name: cost-accounting files (`gotobi-cost`, `index-futures-cost`, `bond-month-end-futures`: they
  are SOURCES for the futures column, section 4), the multiple-testing recount, builds without a rule.
- A study's **decisive tests** are the tests its pre-registration judged on, in its decisive window (out of sample /
  confirmation / "decisive" / "B" / 2016 → now, whatever the study named decisive). For #815-#899 they are exactly the tests
  `research/edge/multiple-testing-1314nov/build-inputs.mjs` lists (its paths are reused); for #900-#943 they are written down
  in `collect.mjs` by the same reading of each study's own `verdict` and RESULT.md, one entry per pre-registered test.
  Replication studies of a frozen rule (gotobi-replicate, gotobi-feed, rsi2-replicate, ...) are read like any study.

## 2. What is extracted, per decisive test

From the object in result.json that holds the test's decisive figures (the "stream"):

| field | meaning | rule |
|---|---|---|
| `n` | trades (or positions, events, years where the study counts those) | as stored |
| `gross` | mean result a trade BEFORE every cost, in the study's unit (R unless the study works in % of price, then %) | a field the study names gross (`grossAvg`, `avgGross`, `meanGross`, `grossR`, `gross`, ...); a stored total is never used as a mean |
| `net` | mean result a trade after every cost the study charged | the study's own net mean |
| `cost` | cost charged a trade = `gross - net` | spread, commission, slippage and financing together, as the study charged them; components are copied where stored |
| `tNet` | the study's decisive t of the net result | as stored (month-sum t where the study judged on months, trade t otherwise) |
| `tGross` | t of the gross result, the same kind as `tNet` | as stored; if not stored, derived as in section 3 |
| stop size | median stop as % of price (or pips on forex) | only where stored; needed for the demo comparison |

A study whose decisive object has no gross figure, or no net, or no t (bootstrap-only or Sharpe-difference tests), is listed
as **"cannot be read"** with the reason, never estimated. A test whose decisive gross is zero or negative is listed as **"no
gross effect"** and kept out of the ranked table.

## 3. The two cost floors (fixed before any number is computed)

Assumption, stated once and applied everywhere: the cost is a **constant a trade**, so changing it moves every trade's result
by the same amount, leaves the spread of results unchanged, and moves the t in proportion to the mean.

- Scale `s` (R of mean per unit of t): `s = (gross - net) / (tGross - tNet)` when both t's are stored and
  `tGross - tNet >= 0.1`; else `s = net / tNet` when `|tNet| >= 0.2`; else `s = gross / tGross` when tGross is stored; else
  the t-2 cost is "cannot be read".
- **Break-even cost** = the cost a trade at which decisive net R = 0 = `gross`.
- **t-2 cost** = the cost a trade at which decisive net t = 2 = `gross - 2 s`. A negative value is reported as "t 2 is not
  reached even at zero cost".
- Headroom = break-even cost minus the cost the study charged (negative = the charged cost is above break-even).
- Caveats said in the report: on a month-sum t the proportional rule is an approximation (months hold different numbers of
  trades); a cost in R depends on each trade's stop, so a per-trade constant in R is itself a simplification.

## 4. Comparison targets

**(a) The demo broker, measured.** council-data `ctrader/symbols.json` (read with
`git show origin/council-data:ctrader/symbols.json`, the copy of the day is stored in `collected.json` with its `at` time):
round trip as a fraction of price = `spreadTypical.median / bid + commissionRT`. No slippage is added (none is measured) and no
financing (the study's own financing figure is added back where the study stores it apart, since the demo charges a swap too).
Converted to R with the study's stored median stop as % of price: `demoR = demoPct / stopPct` (+ the study's financing in R).
Only for instruments the demo account quotes (XAU, EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF, NAS100, US500, US30, US2000,
BTC, ETH, SOL) and only where the study stores a stop size as % of price or in pips. Everything else: "unknown", with the
reason (no symbol on the demo; no stop size stored). The median stop understates the mean cost in R (cost / stop is convex):
said in the report.

"Fits on the demo at measured cost?" = **yes** when `gross - demoR > 0`, **no** when it is not, **unknown** when demoR is
unknown. The t at the demo cost is reported beside it (`(gross - demoR) / s`).

**(b) A futures route.** Only figures from committed cost studies of these days, each cited with its branch and its own dated
sources: `index-futures-cost` (#900, CME micro index futures for index-overnight, index-ibs, turn-of-month),
`bond-month-end-futures` (#943, Treasury futures for bond-month-end), `gotobi-cost` (#893, yen: published broker spreads, no
futures). Anything else about a futures contract is written "from memory, not opened" and carries no number.

"Would need futures?" = **yes** when the gross is positive, the net at the study's cost is not, and the demo comparison is
"no" or "unknown"; **no** when the demo fits at measured cost; **n/a** without a gross effect.

## 5. The report

`result.json` (from `run.mjs`, offline, reading only `collected.json`) and `RESULT.md`: one ranked table of the tests with a
positive decisive gross, ranked by tGross (strongest pre-cost effect first): study, test, instrument, n, gross, cost charged,
break-even cost, t-2 cost, measured demo cost, fits on the demo, would need futures. Then, in plain words: the effects blocked
only by cost (gross t >= 2 and break-even above zero), the ones with no gross effect, and the ones unproven at any cost (gross
t under 2: a smaller cost cannot make them proven). The verdict line is "ACCOUNTING (no rule tested)".

Test: `tests/cost-floor-map.test.mjs`, offline, against the committed `collected.json` (the formulas on hand-made inputs; the
report against result.json); it never needs another branch.
