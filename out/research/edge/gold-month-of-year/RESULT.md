# Result: gold's month of the year, as the gold terminal encodes it (14 Nov 2026)

**Verdict: FAIL**, 0 of 3 tests pass: the page's seasonal months are not reliably different from the rest of the year.
On the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed) the page's strong months (November, December, January, February) did better than the rest and its weak months (March, June) did
worse in both windows, but no test comes near significance after Holm (each adjusted p 0.2685) and no placebo share is under
5 % (T1 7.5 %, T2 9.6 %, T3 16.3 %): about one random set of four months in ten does at least as well as the page's.

Data: council-data `research/daily/xau.json` (OANDA mid gold, daily UTC candles, weekends folded into Monday with
`fills.mjs` `foldWeekend`), 20 Mar 2006 to 6 Nov 2026; complete months only. Decisive window January 2016 to October 2026
(130 months); replication April 2006 to December 2015 (117 months; T1 from May 2006, 116 positions). T1 costs: $0.30 a round
trip and overnight financing on the long (`fills.mjs` `nights` x `FIN.xau.long`, imported).

## The three tests

| Test | Window | In-set n | Out n | In-set mean | Out mean | Difference | Welch t | one-sided p |
|---|---|---|---|---|---|---|---|---|
| T1 long in Nov-Feb vs other months, net R a position | 2016 - Oct 2026 | 42 | 88 | +0.327R | +0.047R | +0.280R | 1.35 | 0.0895 |
| T1 | 2006 - 2015 | 38 | 78 | +0.066R | +0.003R | +0.063R | 0.31 | 0.3776 |
| T2 Nov-Feb mean daily return vs the rest (bp a day, months) | 2016 - Oct 2026 | 42 | 88 | +8.04 | +2.99 | +5.05 | 1.28 | 0.1019 |
| T2 | 2006 - 2015 | 38 | 79 | +6.59 | +0.54 | +6.05 | 1.17 | 0.124 |
| T3 rest minus Mar / Jun (short claim, bp a day) | 2016 - Oct 2026 | 22 | 108 | +0.57 (Mar/Jun) | +5.45 | +4.87 | 0.79 | 0.2178 |
| T3 | 2006 - 2015 | 19 | 98 | -6.92 (Mar/Jun) | +4.33 | +11.25 | 2.18 | 0.0183 |

| Bar | T1 | T2 | T3 |
|---|---|---|---|
| Claimed sign in both windows | met | met | met |
| Decisive Holm-adjusted p < 0.05 | 0.2685, not met | 0.2685, not met | 0.2685, not met |
| Placebo share < 5 % (1,000 random month sets, decisive) | 7.5 %, not met | 9.6 %, not met | 16.3 %, not met |
| 2x cost (decisive) | met (+0.268R, strong book +0.215R) | | |

## T1 as books (net of $0.30 and financing; stop 3 x ATR(20))

| Book | Window | n | Gross R a position | Net R a position | t | Total | Worst drawdown | Stopped |
|---|---|---|---|---|---|---|---|---|
| Strong months only (Nov-Feb) | 2016 - Oct 2026 | 42 | +0.439 | +0.327 | 1.95 | +13.7R | -3.3R | 9 |
| Every month | 2016 - Oct 2026 | 130 | +0.241 | +0.137 | 1.39 | +17.8R | -10.3R | 34 |
| The other eight months | 2016 - Oct 2026 | 88 | +0.147 | +0.047 | 0.38 | +4.1R | -11.1R | 25 |
| Strong months only | 2006 - 2015 | 38 | +0.142 | +0.066 | 0.40 | +2.5R | -5.4R | 12 |
| Every month | 2006 - 2015 | 116 | +0.108 | +0.023 | 0.25 | +2.7R | -13.1R | 36 |
| The other eight months | 2006 - 2015 | 78 | +0.091 | +0.003 | 0.02 | +0.2R | -10.2R | 24 |

At 2x cost the strong book is +0.215R a position in 2016-26 and -0.010R in 2006-15.

## What it says
- **The direction is the page's, the size is not distinguishable from chance.** In 2016-26 gold rose in every calendar group, and
  Nov-Feb rose a little faster; in 2006-15 the strong months' lead over the rest was about a fifth of its 2016-26 size on T1.
- **The strong set is carried by January.** In 2016-26 January alone made +0.898R a position (n 11, t 2.63) and +16.2 bp a day;
  November, inside the page's set, made -0.162R and -1.9 bp a day; December +0.274R, February +0.249R. In 2006-15 December was
  negative (-0.332R). January is picked after the fact here: it is not a finding.
- **The weak-month claim held in 2006-15 only.** March (-0.528R, t -2.93, -8.0 bp a day) and June were weak then; in 2016-26
  March was positive (+5.1 bp a day) and only June slightly negative (-4.0 bp a day).
- **The outside claim (Jan, Aug, Sep strong), reported only**: 2016-26 T1 +0.120R ahead (t 0.47, placebo 24.7 %), T2 +2.29 bp
  (t 0.52, placebo 30.1 %); September was among the weakest months of 2016-26 (-5.2 bp a day).

Per calendar month, mean daily return in bp (book net R a position):

| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2016 - Oct 2026 | +16.2 (+0.90) | +6.3 (+0.25) | +5.1 (+0.21) | +8.8 (+0.06) | +0.1 (-0.11) | -4.0 (+0.03) | +8.1 (+0.16) | +7.9 (+0.01) | -5.2 (-0.23) | +3.0 (+0.24) | -1.9 (-0.16) | +10.9 (+0.27) |
| 2006 - 2015 | +15.0 (+0.22) | +7.0 (+0.22) | -8.0 (-0.53) | +6.5 (+0.17) | -2.7 (-0.30) | -5.9 (-0.20) | +3.8 (+0.09) | +9.1 (+0.57) | +0.5 (+0.08) | +0.1 (+0.11) | +9.1 (+0.19) | -3.9 (-0.33) |

## What this is not
Gold only, and **not a gate on the live gold book**: by the owner's rule (docs/owner-decisions.md item 44) no gate, exit, entry
or size is tested on that book's 2006-17 window, and nothing here is proposed for Gold trend, Gold daily engulf or any council
system. The study measures the gold terminal's seasonal score (`seasS`); a pass would only have changed the page's wording, by
the owner's decision. With a FAIL, the tile's "not tested here" can truthfully become "tested here, failed" (14 Nov 2026,
`research/edge/gold-month-of-year`): that wording change is the owner's call and was not made. Nothing live changed;
`gold-trading.html` is untouched.

To repeat: `node research/edge/gold-month-of-year/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/gold-month-of-year/run.mjs full <dir>`. Input sha256 in result.json. Test: `tests/gold-month-of-year.test.mjs`.
