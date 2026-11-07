# Portfolio v2: every council stream with a long history, weighted walk-forward (paper only, proposal)

**Verdict.**

**Passes the letter of the pre-registered bars, but is not an edge on untouched data:** in the clean 2009-17 half no book
has t above 1.2 and 6 of 8 lose at double costs; what survives is long-gold beta. Proposal only, no live change.

- **On the letter of the pre-registered bars, the combined book passes.** All 8 walk-forward books (4 schemes × 2 universes)
  have a monthly t of 3.0 to 4.5 over 2009-26, both halves positive, and a positive x2-cost total (Q2). None is "mostly beta"
  (Q3). Inverse volatility (IV) and minimum correlation (MC) beat equal risk (EQ) in both halves on the All universe (Q1).
- **But the pass comes from 2018-26, the years most stream rules were built on.** In the clean half, **2009-17**, no
  book has a t above 1.2. Each book makes +9 to +36R in nine years. At x2 costs, 6 of the 8 books **lose** money there.
  In that half the alpha t is 0.8 to 1.5, while the gold beta t is 3 to 6.7. On untouched data, the book is a small
  long-gold position plus noise.
- **Diversification does work on the noise.** The streams are close to uncorrelated: the average pairwise correlation is
  0.11 across the 8 distinct streams, and gold and Nasdaq correlate at only 0.06. The effective number of bets is 3 to 4.
  But a book cannot have an edge its parts do not have. In 2009-17 the four gold systems made **all** of the book's profit
  (EQ-All: gold +12.3R, everything else −3.3R). The gold trend N20 alone had a better return/drawdown in that half (4.8)
  than any book (0.4 to 2.1).
- **The weighting scheme matters less than counting each idea once.** IV and MC beat EQ on All mainly because they
  automatically down-weight the five near-copies of the ICT desk, which correlate 0.74 to 0.93 with each other. Plain equal
  risk on the 8 distinct streams (EQ-Distinct) does as well: return/DD 12.9 against IV-All's 8.9, and Sharpe 1.00 against
  1.01. On the Distinct universe, no scheme beats EQ in both halves.
- **Top-k by trailing t (performance chasing) is the worst scheme overall.** It has the lowest Sharpe and the worst 2018-26.
  It looks best in 2009-17 only because, in those years, it happened to hold the gold trend legs.

**Proposal (owner decides, nothing changed).** If the council ever gets a book-level risk budget:

- Weight equal risk per **distinct idea**. Count the ICT desk once, not five times.
- Treat the four gold systems as one long-gold exposure with one cap.
- Size the whole book on the 2009-17 numbers (Sharpe about 0.3), not on the 2018-26 ones (Sharpe about 1.5).

No live rule, size, filter or mirror setting was changed.

## Data: 12 streams, monthly net R

| id | stream | status | first month | positions | 2009-17 R (t) | 2018-26 R (t) | max DD (full) | full x2 R | corr gold | corr NQ | gold β t | alpha t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `ict_a` | ICT A-setups (GC NQ ES YM) | live | 2007-07 | 4,106 | −9.8 (−0.14) | +166.2 (2.45) | 79.9 | −80.5 | 0.16 | −0.04 | 2.5 | 1.1 |
| `ict_dip` | ICT shadow dip | shadow | 2007-07 | 888 | +23.0 (0.70) | +103.2 (2.90) | 49.1 | +82.3 | 0.05 | **0.36** | 0.5 | 0.9 |
| `ict_nofri` | ICT shadow nofri | shadow | 2007-07 | 3,545 | −42.3 (−0.69) | +175.8 (2.80) | 80.4 | −64.6 | 0.13 | −0.02 | 2.0 | 1.1 |
| `ict_h1opp` | ICT shadow h1opp | shadow | 2007-07 | 2,697 | −64.8 (−1.09) | +116.9 (2.00) | 95.0 | −109.5 | 0.09 | 0.01 | 1.3 | 0.2 |
| `ict_strail` | ICT shadow strail | shadow | 2007-07 | 4,116 | +32.1 (0.41) | +126.9 (1.82) | 64.9 | −69.9 | 0.14 | −0.07 | 2.2 | 1.3 |
| `nq_open` | NQ NY open run | live | 2004-01 | 1,869 | −23.7 (−0.67) | +95.1 (2.46) | 55.4 | −120.6 | 0.03 | −0.07 | 0.5 | 1.3 |
| `replica` | Gold replica | live | 2017-01 | 341 | 0 (no trades 2017) | +124.9 (1.46) | 35.1 | +106.5 | 0.07 | 0.05 | 0.7 | 1.1 |
| `gtrend` | Gold trend N20 | live | 2006-07 | 134 | +25.6 (1.34) | +83.2 (2.62) | 5.4 | +113.6 | 0.24 | 0.09 | **3.7** | 2.2 |
| `gtrend5` | Gold trend fast N5 | shadow | 2006-07 | 228 | +33.1 (1.44) | +104.0 (2.85) | 10.7 | +143.0 | 0.29 | 0.06 | **4.5** | 2.4 |
| `gtl` | Gold H4 trendline | live | 2006-07 | 720 | +3.8 (0.19) | +55.7 (2.28) | 25.9 | +58.1 | **0.44** | 0.06 | **7.4** | 0.7 |
| `geg` | Gold daily engulf | live | 2006-07 | 451 | +43.3 (1.78) | +54.0 (2.20) | 14.1 | +85.9 | 0.30 | 0.02 | **4.7** | 1.9 |
| `crypto` | Crypto trend v3 | shadow | 2017-09 | 125 | +4.3 (Sep-Dec 2017) | +347.0 (2.22) | 9.5 | +343.1 | 0.15 | −0.06 | 1.6 | 2.0 |

How the table was built:

- **R:** net R per position at the stream's live sizing, booked in the month it closed. t is the t of monthly R.
- **Correlations and betas:** taken over the stream's whole coverage, against OANDA XAU_USD and NAS100_USD month-end
  % changes. The OLS uses both gold and NQ.
- **Sources:**
  - ICT: `ict-streams.mjs` (this folder). It drives the desk's own code over the #526 OANDA 5m cache. Its ICT A 2018-26
    figure (1,787 trades, +0.093R a trade) matches #526 (1,786, +0.093).
  - NQ open: #511 `trades`.
  - Replica: #512 `positions.json`, booked on the entry month.
  - Gold systems: #530 `positions`.
  - Crypto: #508 `trades`.
- **Not included:** silver (no long history), Mosha BO and gold momentum pullback (2018-26 only), and the retired scalp
  sleeve.

**Every stream is positive in 2018-26, and all but the replica (t 1.46) have t ≥ 1.8.** In 2009-17, only the four gold
systems, `dip`, `strail` (and crypto's four months of 2017) are positive, and none has t ≥ 2. That is the regime-bound pattern already found stream by stream
(#508, #511, #512, #526, #530).

## Walk-forward books, 2009-01 to 2026-10

The weights for each year come from the 36 months before it. Each book is a 1R budget split across its streams. The ratios
(return/DD, Sharpe, t) do not depend on that scale.

| book | R | t | Sharpe | max DD | **R/DD** | worst month | + years | 2009-17 R (t) | 09-17 Sharpe | 09-17 R/DD | 2018-26 R (t) | 18-26 Sharpe | 18-26 R/DD | x2 R (t) | x2 2009-17 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EQ-All | 136.7 | 3.39 | 0.80 | 20.9 | 6.56 | −7.5 | 15/18 | +9.0 (0.33) | 0.11 | 0.43 | +127.7 (4.42) | 1.49 | 13.2 | +50.1 (1.21) | **−45.9** |
| IV-All | 124.2 | 4.27 | 1.01 | 13.9 | 8.94 | −5.3 | 16/18 | +11.9 (0.69) | 0.23 | 0.86 | +112.3 (5.00) | 1.68 | 15.0 | +72.3 (2.47) | **−20.1** |
| MC-All | 124.7 | 4.41 | 1.05 | 12.4 | **10.05** | −5.0 | 15/18 | +12.0 (0.76) | 0.25 | 0.97 | +112.7 (5.03) | 1.69 | 16.4 | +76.9 (2.71) | **−17.4** |
| TK-All | 122.4 | 3.06 | 0.72 | 16.8 | 7.28 | −11.2 | 15/18 | +35.5 (1.12) | 0.37 | 2.11 | +86.9 (3.59) | 1.21 | 7.5 | +101.9 (3.14) | +29.4 |
| EQ-Distinct | 142.8 | 4.21 | 1.00 | 11.1 | **12.91** | −3.7 | 15/18 | +16.4 (0.92) | 0.31 | 1.48 | +126.5 (4.53) | 1.52 | **26.0** | +85.5 (2.49) | **−21.3** |
| IV-Distinct | 122.7 | 4.49 | **1.06** | **8.9** | **13.71** | −3.6 | 14/18 | +16.9 (1.18) | 0.39 | 1.89 | +105.8 (4.71) | 1.58 | 22.4 | +88.9 (3.25) | **−4.5** |
| MC-Distinct | 124.4 | 4.43 | 1.05 | 10.0 | 12.44 | −3.8 | 14/18 | +15.7 (1.08) | 0.36 | 1.57 | +108.7 (4.67) | 1.57 | 21.5 | +87.0 (3.09) | **−8.4** |
| TK-Distinct | 107.7 | 2.99 | 0.71 | 13.5 | 7.98 | −3.5 | 12/18 | +21.6 (0.97) | 0.32 | 1.74 | +86.1 (3.07) | 1.03 | 12.5 | +83.7 (2.75) | +15.8 |
| *ICT A alone (1R)* | 156.5 | 1.61 | 0.38 | 59.3 | 2.64 | −15.3 | 13/18 | −9.8 (−0.14) | −0.05 | −0.16 | +166.2 (2.45) | 0.83 | 6.4 | −49.6 | −134.1 |
| *NQ open alone* | 71.4 | 1.35 | 0.32 | 52.6 | 1.36 | −7.8 | 9/18 | −23.7 (−0.67) | −0.22 | −0.47 | +95.1 (2.46) | 0.83 | 2.4 | −47.3 | −116.3 |
| *Gold trend N20 alone* | 108.8 | 2.92 | 0.69 | **5.4** | **20.2** | −2.2 | 15/18 | +25.6 (1.34) | **0.45** | **4.76** | +83.2 (2.62) | 0.88 | 21.8 | +107.4 | +24.8 |

**Scheme abbreviations:** EQ = equal risk, IV = inverse volatility, MC = minimum correlation, TK = the top 3 by trailing
24-month t.

**Sensitivity (top-k):**

| book | R | Sharpe | R/DD | 2009-17 R | 2018-26 R |
|---|---|---|---|---|---|
| TK2-All | 112.5 | 0.63 | 6.4 | +30.6 | +81.9 |
| TK5-All | 113.9 | 0.68 | 5.7 | +10.0 | +103.9 |
| TK2-Distinct | 79.9 | 0.58 | 5.4 | +14.2 | +65.7 |
| TK5-Distinct | 139.9 | 0.80 | 7.5 | +1.6 | +138.2 |

No choice of k changes the picture.

### Yearly R

| year | EQ-All | IV-All | MC-All | TK-All | EQ-Dist | IV-Dist | MC-Dist | TK-Dist | ICT A alone | Gold trend N20 alone |
|---|---|---|---|---|---|---|---|---|---|---|
| 2009 | 1.9 | 2.4 | 2.2 | 3.5 | 1.9 | 2.4 | 2.2 | 3.5 | −24.1 | 2.9 |
| 2010 | 2.3 | 3.2 | 3.6 | 10.2 | 6.1 | 5.5 | 6.0 | 10.2 | 7.8 | 2.9 |
| 2011 | 8.4 | 8.1 | 7.6 | 12.1 | 10.1 | 10.1 | 9.6 | 12.1 | 18.4 | 13.9 |
| 2012 | −4.9 | −3.5 | −3.3 | 5.6 | −1.3 | −0.2 | −0.9 | 5.6 | −17.4 | 6.4 |
| 2013 | **−15.2** | −8.8 | −7.1 | −4.5 | −7.5 | −4.5 | −4.4 | −4.5 | −41.7 | −1.9 |
| 2014 | 6.4 | 2.2 | 0.9 | −2.9 | 1.6 | −0.8 | −1.0 | −2.9 | 24.6 | 1.5 |
| 2015 | 4.0 | 0.0 | −0.8 | −0.4 | −1.9 | −3.3 | −3.8 | −4.9 | 14.4 | −1.7 |
| 2016 | 9.4 | 8.2 | 8.5 | 11.3 | 6.6 | 6.4 | 6.8 | 3.8 | 11.5 | 2.8 |
| 2017 | −3.3 | 0.0 | 0.4 | 0.5 | 0.8 | 1.4 | 1.1 | −1.4 | −3.1 | −1.3 |
| 2018 | 3.5 | 2.3 | 2.2 | 4.2 | 3.9 | 1.6 | 1.6 | −1.9 | 12.3 | 3.1 |
| 2019 | 2.8 | 6.2 | 6.1 | 4.0 | 3.5 | 7.0 | 6.4 | 6.7 | −4.4 | 14.2 |
| 2020 | 15.3 | 13.4 | 12.6 | 10.4 | 11.7 | 11.6 | 11.3 | 11.6 | 33.4 | 13.7 |
| 2021 | 23.6 | 16.8 | 18.2 | 6.2 | 28.1 | 17.1 | 19.2 | 4.9 | 5.9 | 0.9 |
| 2022 | 6.3 | 3.2 | 1.9 | 6.4 | 2.4 | 1.3 | 1.3 | −1.2 | 34.2 | 0.6 |
| 2023 | 6.3 | 8.6 | 8.7 | 3.9 | 7.1 | 8.7 | 8.9 | 6.6 | 12.5 | 4.2 |
| 2024 | 22.4 | 18.6 | 19.7 | 17.0 | 24.9 | 19.4 | 20.3 | 17.0 | 13.7 | 8.9 |
| 2025 | 30.4 | 28.3 | 28.4 | 16.9 | 31.7 | 28.8 | 29.1 | 18.9 | 36.9 | 30.4 |
| 2026 (to Oct) | 17.1 | 15.0 | 14.8 | 17.9 | 13.2 | 10.3 | 10.7 | 23.5 | 21.8 | 7.3 |

- **2018-26 is 9 positive years out of 9 for every non-TK book.**
- **2009-17 has 2-4 losing years per book** (5-7 positive of 9). 2013, the year gold crashed, is the worst year for every
  book except TK-Distinct.

### Average weights (2009-26)

| book | ICT A | dip | nofri | h1opp | strail | NQ open | replica | gtrend | gtrend5 | gtl | geg | crypto | **4 gold systems** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EQ-All | .09 | .09 | .09 | .09 | .09 | .10 | .04 | .10 | .10 | .10 | .10 | .03 | **.40** |
| IV-All | .04 | .09 | .05 | .05 | .04 | .09 | .04 | .17 | .14 | .15 | .13 | .01 | **.59** |
| MC-All | .03 | .09 | .04 | .04 | .03 | .10 | .05 | .17 | .13 | .16 | .14 | .01 | **.60** |
| EQ-Distinct | .14 | | | | | .15 | .06 | .15 | .15 | .15 | .15 | .05 | **.60** |
| IV-Distinct | .06 | | | | | .11 | .05 | .22 | .18 | .20 | .17 | .02 | **.77** |

Each year's weights, and TK's picks, are in `result.json` (`portfolios.*.weights`).

- **Risk parity is mostly a gold book.** The gold systems have the lowest monthly volatility (SD about 2.1-2.8R, against
  3.4-15R for the ICT streams, NQ open, the replica and crypto).
- **TK picked the gold trend legs in 2009-13,** then rotated through ICT dip, NQ open and geg.

## Correlation of monthly R (overlapping months, whole coverage)

|  | ict_a | dip | nofri | h1opp | strail | nq_open | replica | gtrend | gtrend5 | gtl | geg | crypto |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ict_a | 1 | .24 | **.93** | **.82** | **.93** | .11 | .10 | .09 | .10 | .18 | .04 | −.06 |
| ict_dip | | 1 | .20 | .24 | .23 | .04 | −.02 | .04 | .03 | .06 | .09 | .10 |
| ict_nofri | | | 1 | **.74** | **.86** | .14 | .18 | .10 | .08 | .17 | .02 | −.04 |
| ict_h1opp | | | | 1 | **.76** | .05 | .09 | .01 | .00 | .14 | −.01 | −.03 |
| ict_strail | | | | | 1 | .08 | .07 | .04 | .05 | .18 | .04 | −.01 |
| nq_open | | | | | | 1 | .02 | .01 | .06 | .04 | .06 | .00 |
| replica | | | | | | | 1 | .11 | .05 | .11 | .00 | −.02 |
| gtrend | | | | | | | | 1 | **.95** | .15 | .13 | .06 |
| gtrend5 | | | | | | | | | 1 | .15 | .19 | .08 |
| gtl | | | | | | | | | | 1 | .23 | .04 |
| geg | | | | | | | | | | | 1 | .15 |

| | average pairwise correlation | after removing gold and NQ beta |
|---|---|---|
| All 12 | 0.16 | 0.14 |
| Distinct 8 | 0.11 | 0.08 |
| gold vs NQ monthly returns | 0.06 | |

**Near-duplicates:**

- The four ICT shadows that filter or re-exit the A-setups are near-copies of it (0.74-0.93).
- `ict_dip` is a different stream (0.24): it is long-only Nasdaq after a 20-day fall.
- Gold trend N20 and N5 are one stream (**0.95**). They hold the same breakouts on two lookbacks.

Apart from these, every pair is at or below 0.24. The residual matrix is in `result.json` (`corrResid`).

## Gold and Nasdaq beta: how much the diversification is worth

- **Stream by stream, the beta is modest.**
  - The gold systems correlate 0.24-0.44 with the gold month, and their gold β is significant (t 3.7-7.4).
  - `ict_dip` correlates 0.36 with Nasdaq.
  - Everything else correlates below 0.2 with both. No stream has R² above 0.20.
- **In a book, the betas add up and the idiosyncratic parts cancel.** Over 2009-26:

| book | corr gold | corr NQ | R² | alpha (R/month) t | **2009-17 R²** | 2009-17 gold β t | 2009-17 NQ β t | **2009-17 alpha t** |
|---|---|---|---|---|---|---|---|---|
| EQ-All | 0.34 | −0.06 | 0.12 | 2.96 | 0.12 | 3.2 | −2.2 | **0.79** |
| IV-All | 0.42 | 0.05 | 0.18 | 3.30 | 0.20 | 4.9 | −1.7 | **0.86** |
| MC-All | 0.42 | 0.07 | 0.18 | 3.36 | 0.22 | 5.3 | −1.6 | **0.87** |
| TK-All | 0.32 | −0.01 | 0.10 | 2.43 | 0.13 | 3.7 | −1.5 | **1.29** |
| EQ-Distinct | 0.40 | −0.06 | 0.17 | 3.77 | 0.25 | 5.3 | −2.8 | **1.47** |
| IV-Distinct | 0.45 | 0.04 | 0.20 | 3.55 | **0.31** | 6.7 | −2.1 | **1.44** |
| MC-Distinct | 0.44 | 0.04 | 0.20 | 3.50 | **0.31** | 6.6 | −2.1 | **1.35** |
| TK-Distinct | 0.37 | −0.05 | 0.15 | 2.47 | 0.18 | 4.7 | −1.2 | **0.98** |

- **Over the whole window,** every book keeps an alpha t ≥ 2.4 after removing gold and NQ beta. So Q3 says "not mostly
  beta". That alpha is the 2018-26 alpha.
- **In the clean half,** the gold beta is the only significant term (t 3-6.7). The alpha t is 0.8-1.5.
- **The Nasdaq beta is negative in 2009-17.** The ICT index streams and the NQ open run lost in the up-months of the bull
  market (#526 found the index sells lost money).
- **The diversification ratio is 1.3-2.1,** which is about 2-4 effective bets out of 8-12 streams:

  | book | DR |
  |---|---|
  | MC-All | 2.07 |
  | MC-Distinct | 2.00 |
  | IV-All | 1.96 |
  | EQ-Distinct | 1.84 |
  | EQ-All | 1.67 |
  | TK-All | 1.40 |

- **Where the R came from:**

  | book | 4 gold systems, 2009-17 | rest, 2009-17 | 4 gold systems, 2018-26 | rest, 2018-26 |
  |---|---|---|---|---|
  | EQ-All | +12.3 | **−3.3** | +25.1 | +102.6 |
  | IV-All | +15.4 | **−3.5** | +40.0 | +72.3 |
  | EQ-Distinct | +18.2 | **−1.8** | +37.8 | +88.7 |

**So diversification helps in the way it always does.** It cuts the drawdown of a single stream: from 59R (ICT A) or 53R
(NQ open) to 9-21R for the books. Over the full window it raises the Sharpe from 0.15-0.75 per stream to 0.71-1.06.

**It does not create an edge.** On data the rules never saw, there was nothing left after the cancelling except the gold
legs, and they are largely long gold:

- #530's random-entry control already showed that random long gold entries make +0.28R a position.
- With costs doubled, the books lose in 2009-17.
- The best clean-half "portfolio" was one gold trend leg on its own.

## Pre-registered questions

| | bar | result |
|---|---|---|
| **Q1** a scheme beats EQ (R/DD and Sharpe higher, overall and in both halves) | | **IV-All and MC-All beat EQ-All**: 8.9 / 10.1 against 6.6 R/DD, and better in both halves. **TK-All does not**: it is worse overall and in 2018-26. **On Distinct, no scheme beats EQ**: IV and MC lose to EQ-Distinct in 2018-26, and TK is worse overall. |
| **Q2** the book is an edge (t ≥ 2 over 2009-26, both halves > 0, x2 total > 0) | all 3 | **All 8 books pass.** t 2.99-4.49, 2009-17 +9.0 to +35.5R, x2 +50 to +102R. |
| **Q3** mostly beta (alpha t < 2 while the book's t ≥ 2) / beta-heavy (R² ≥ 0.25) | | **No and no** over 2009-26 (alpha t 2.4-3.8, R² 0.10-0.20). |
| **Q4** diversification (reported) | | DR 1.3-2.1. The EQ, IV and MC books' 2009-26 Sharpe (0.80-1.06) is above every single stream's (0.15-0.75; average 0.50). The TK books (0.71-0.72) are below the best two streams. In 2009-17 it is below the best single streams: geg 0.59, gtrend5 0.48, gtrend 0.45. |

**Honest reading of the pass.** The Q2 bar only asked for each half to be positive. The 2009-17 half clears it by +9 to
+36R over nine years (t 0.3-1.2), and at x2 costs it does not clear it for 6 of 8 books. The overall t ≥ 2 is carried by
2018-26: those are the years the ICT, gold, replica and NQ rules were designed on, and where every stream looks good at
once. This is the same regime-bound result as each stream's own study, now at the book level. **The book is not a
demonstrated edge on untouched data.** It is a diversified, small long-gold position, with good in-sample years on top.

## What changed since the older portfolio study (#492, `research/portfolio.*`)

| | #492 (7 Nov) | v2 (this study) |
|---|---|---|
| Streams | ICT A-setups and the Meridian scalp sleeve (gold and FX scalps) | 12: ICT A and its 4 shadows, NQ open run, replica, gold trend N20/N5, gtl, geg, crypto trend. The scalp sleeve is not among the systems the decay monitor (#531) tracks as live. |
| History | 15 months of desk replay for ICT, 30 days for Meridian; daily R | 2004/2006/2007 to 2026-10; monthly R |
| Question | sizing *inside* a stream (fixed, `sizeOf`, grade, caps, vol target, Kelly) plus a demo-mirror risk budget | weights *across* streams, set walk-forward |
| Out-of-sample | none (stated in its caveats) | weights from prior data only; 2009-17 is untouched by every stream's design |
| ICT A | +0.31R a trade (15-month replay). "Give the ICT desk almost all the risk." | ICT A is one of the weakest long-history streams: −9.8R in 2009-17, −80R at x2 over 2007-26, 60-80R drawdowns. Risk parity gives it about 4%. |
| Beta | not measured | gold beta is the only significant term in the clean half |

**What still holds from #492:**

- Same-direction ICT positions cluster.
- Systems with no edge cost return without diversifying anything. In #492 that was Meridian FX; here it is the zero-edge
  streams in 2009-17.
- Do not size ICT up on its replay.

**What is reversed:**

- #492's budget put almost all the risk on ICT.
- Over 20 years, ICT's long-history record does not support that. The streams that held up on unseen data are the gold
  trend legs and geg.
- Those are mostly long gold. So #492's recommended 0.20% per ICT R is, if anything, generous, not conservative.

The other earlier study, `research/edge/portfolio` (2018-26 ICT plus a 150-day council), also never left the 2018+ regime.

## Proposal (not applied; the owner decides)

1. **Count ideas, not streams.** Any combined budget, including the cTrader mirror's, should count the ICT desk once. Its
   shadows are near-copies (0.74-0.93). Gold trend N20 and N5 are one bet (0.95).
2. **Equal risk per distinct idea is enough.** EQ-Distinct matched or beat every fancier scheme over the full window
   (R/DD 12.9). IV-Distinct was marginally better overall but lost in 2018-26, so there is no case for the extra machinery.
   Top-k performance chasing should not be used.
3. **One cap for the gold family.** gtrend, gtrend5, gtl and geg all carry significant gold-month beta (the replica trades
   the same market, though its monthly correlation is only 0.07). Treat them as one long-gold allocation, at most about 40% of the book's risk. In risk parity they drift to 60-77%.
4. **Expect the clean-half numbers.** Sharpe about 0.3 a year, and drawdowns of 9-21R on a 1R book budget. 2009-17 had
   2-4 losing years per book. The 2018-26 Sharpe of about 1.5 is in-sample for most streams.
5. **No live change from this study.** It does not support adding risk anywhere. The decay monitor (#531) remains the
   forward check on each stream.

## Caveats

- **Stream histories come from different harnesses.**
  - The OANDA mid data covers ICT, NQ open and the replica's 2017-22 part; the gold systems use OANDA spot; crypto uses
    Binance daily.
  - RTY is missing from the ICT streams.
  - The replica books on its entry month.
  - Month-boundary effects are small but nonzero.
- **Shadow streams are rebuilt with the live tracker's code on cash/spot candles, not futures.** No contract roll; the
  #526 costs apply.
- **Short histories.**
  - The replica (2017+) and crypto (2017-09+) are eligible only from 2019 and 2020.
  - Crypto's large R (+347R, SD 15R a month) gets a small weight in IV and MC, but 5% in EQ-Distinct. In EQ-Distinct it
    contributes +38.6R in 2018-26.
- **One fixed set of parameters**, not tuned: a 36-month window, 24-month eligibility, k = 3, an SD floor of 0.25R, and
  12-month overlap for correlations.
- **Multiple testing.** 8 primary books plus 4 TK sensitivities and x2 runs. The single-stream results were public before
  this pre-registration (pushed as 2a6d24a6 before any result; 318482c8 after the rebase onto main). The books were not.

## Files

- `preregistration.md`: the design and the bars, committed and pushed before any portfolio number (2a6d24a6; 318482c8 after the rebase).
- `ict-streams.mjs`: the ICT A-setup and shadow streams on OANDA 5m 2007-26, using the desk's code unchanged.
- `run.mjs`: monthly series, the walk-forward books, correlations, betas, attribution and verdicts. It writes `result.json`.
- `result.json`:
  - every table above;
  - per-year weights;
  - per-stream yearly R;
  - the raw and residual correlation matrices;
  - the monthly series of every stream and book, with the gold and NQ returns.

Re-run (the OANDA 5m cache from `research/edge/ict-oos-2008/fetch.mjs`, not in git):

```
node research/edge/ict-oos-2008/fetch.mjs <cache>
node research/edge/portfolio-v2/ict-streams.mjs <cache> <cache>/ict-streams.json     # about 1 minute
node research/edge/portfolio-v2/run.mjs <cache>/ict-streams.json <cache>             # writes result.json
```
