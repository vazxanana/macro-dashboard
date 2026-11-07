# Meridian + ICT desk as one book: portfolio and sizing (research, paper only)

**Verdict: give the ICT desk almost all of the risk, keep its own `sizeOf`, and run Meridian at a tenth of an ICT R.**
None of the five schemes tested beats the ICT size field by more than noise once Meridian is cut back. Two choices do matter:
- **Cutting Meridian back.** Meridian trades about 8 times a day, its 30-day replay is net negative, and at equal R it drives over 90% of the book's daily variance.
- **The mirror's fixed 0.01 lot.** On the $1,000 demo it puts about 4% of the balance on every ICT gold trade.

Nothing live changed. `council/ctrader-mirror.mjs` LIMITS and every trading rule are as they were. The budget at the end is a recommendation for the owner.

## Data

All R are per 1 unit of risk and net of costs.

| stream | source | window | trades | net R | R a trade |
|---|---|---|---|---|---|
| ICT A-setups (what the mirror sends) | council-data `ict/replay.json`, `aset: true`, R per unit (`Rraw`) minus the CME-micro round trip (research/edge/costs) | 4 Aug 2025 – 5 Nov 2026 | 253 | +78.5 | +0.31 |
| ICT, every signal (correlation only) | same file, all closed | same | 826 | +115.1 | +0.14 |
| Meridian sleeve | council-data `backtest.json`, Scalp against D1 outside Asia (the engine rule the owner put live on 7 Nov), gold + 5 FX (the mirror's markets), `R_none − cost`, twins dropped | 8 Oct – 6 Nov 2026 | 241 | −8.1 | −0.03 |
| Meridian sleeve incl. crypto (not mirrored) | same, all markets | same | 378 | −288.2 | −0.76 |
| Meridian live paper | council-data `trades.json`, non-shadow, closed | 1 – 7 Nov 2026 | 36 | −15.4 | −0.43 |

By market, in R a trade:
- **ICT:** ES +0.40, NQ +0.37, RTY +0.62, YM +0.16, GC +0.19.
- **ICT by tier:** index A+ +0.44 (n 150), index A +0.04 (n 43), gold +0.19 (n 60).
- **Meridian sleeve:**
  - positive: USD/CHF +0.76, GBP/USD +0.21, gold +0.13
  - negative: AUD/USD −0.30, USD/CAD −0.27, EUR/USD −0.81

**The combined book** is ICT A-setups plus the Meridian sleeve. Meridian is present only in its 30 days.

`backtest.json` has no close times. A Meridian close is estimated as the fill plus 1.25 h, the median Scalp hold in `trades.json`. That estimate is used only for overlap counts and for which day a trade's P&L is booked.

## 1. Combined daily equity curve

The full daily curve is in `portfolio.json` (`curve`). Below it is by month at fixed 1R = 0.5% for both systems.

| month | book % | ICT R | Meridian R |
|---|---|---|---|
| 2025-08 | +1.23 | +2.5 | |
| 2025-09 | −1.66 | −3.3 | |
| 2025-10 | +2.91 | +6.1 | |
| 2025-11 | +6.49 | +12.7 | |
| 2025-12 | +1.28 | +2.6 | |
| 2026-01 | +2.87 | +5.7 | |
| 2026-02 | +1.88 | +3.8 | |
| 2026-03 | −2.57 | −5.1 | |
| 2026-04 | −2.63 | −5.3 | |
| 2026-05 | −0.76 | −1.5 | |
| 2026-06 | +9.94 | +19.4 | |
| 2026-07 | +0.83 | +1.8 | |
| 2026-08 | +10.28 | +19.9 | |
| 2026-09 | +2.58 | +5.3 | |
| 2026-10 | −5.58 | −6.7 | −1.8 |
| 2026-11 (to 6th) | +7.01 | +20.6 | −6.3 |

The book ends at +38.1%, with a maximum drawdown of 19.4%.

## 2. Correlation

### Between systems

These are daily R correlations, 8 Oct – 6 Nov 2026.

| pair | correlation |
|---|---|
| ICT A-setups vs Meridian sleeve | **+0.03** |
| ICT, every signal, vs Meridian sleeve | −0.13 |
| ICT A-setups vs Meridian live paper (6 days only, meaningless) | +0.55 |

The systems are uncorrelated. A Meridian sleeve with a real edge would be a good diversifier; this one has none.

### Between markets

The markets themselves move together: daily closes over 119 days, `ict/bars.json`.

| | ES | NQ | YM | RTY | GC |
|---|---|---|---|---|---|
| ES | 1 | 0.92 | 0.81 | 0.81 | 0.35 |
| NQ | | 1 | 0.59 | 0.77 | 0.30 |
| YM | | | 1 | 0.73 | 0.38 |
| RTY | | | | 1 | 0.27 |

The ICT trades are much less correlated, because they are sparse and fire on different days:
- Across all days, the average pairwise daily-R correlation of the index trades is 0.09.
- On days both markets closed a trade, it is 0.03 to 0.38. NQ–ES is 0.38 over 82 days.

**When two index trades are open at once in the same direction, they are close to one trade:**

| | overlapping pairs | correlation of R | P(second loses \| first loses) | base loss rate | opened within 1 h of each other |
|---|---|---|---|---|---|
| A-setups | 60 | **0.76** | **0.92** | 0.62 | 33 |
| every signal | 403 | 0.41 | 0.86 | 0.65 | 153 |

Inside Meridian, the daily correlation averages 0.07. The one pair that moves together is the dollar pair AUD/USD–GBP/USD at 0.59.

## 3. Concurrent exposure

Time with N ICT A-setups open:

| open | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| share of time | 56% | 33% | 9% | 2% | 1% | 0.1% |

- **Peak:** 5 ICT A-setups open at once.
- **ICT never met the mirror's maxOpen of 5** on arrival.

There are 7 clusters with 3 or more same-direction index positions open at once. Each one won or lost together:

| date | side | trades | R |
|---|---|---|---|
| 22 Jun 2026 | sell | 4 | +5.8 |
| 2 Jul 2026 | sell | 3 | −1.7 (3 losers) |
| 5 Aug 2026 | sell | 4 | +6.2 |
| 17 Aug 2026 | sell | 3 | +11.1 |
| 25 Aug 2026 | sell | 3 | −2.5 (3 losers) |
| 3 Nov 2026 | buy | 3 | −0.5 |
| 4 Nov 2026 | buy | 3 | +11.4 |

Together the clusters made +29.8R. They are concentrated bets, but on this replay they paid.

**With Meridian**, over its 30 days:
- 8 positions peaked open at once, and 4+ were open 6.8% of the time.
- 27 arrivals found 5 already open. The mirror would have skipped them. They made +1.6R in total, so the maxOpen limit costs nothing.

**ICT gold against Meridian gold:** 7 overlaps, all on the opposite side, so they hedged each other.

## 4. Worst drawdowns: combined fixed 1R book, 0.5% a trade

| peak → trough | depth | trades | R | cause |
|---|---|---|---|---|
| 18 Oct → 28 Oct 2026 (not recovered by 6 Nov) | **19.4%** | 93 (73 losers) | −42.4 | **Meridian FX scalps**: EUR/USD −16.0, GBP/USD −9.0, AUD/USD −11.6, USD/CAD −8.2. ICT was −0.6 net. |
| 2 Mar → 4 Jun 2026 (recovered 17 Jun) | 8.6% | 44 | −14.9 | ICT NQ −8.1 and ES −5.3. A slow index bleed, half same-direction. |
| 13 Sep → 7 Oct 2026 (recovered 16 Oct) | 7.4% | 27 | −15.2 | ICT RTY −5.6, GC −3.8, YM −3.2; 72% of the index trades in the same direction. |
| 9 Sep → 10 Oct 2025 | 4.8% | 17 | −9.8 | ICT ES −7.5, NQ −2.0; every index trade in the same direction. |
| 22 Jul → 29 Jul 2026 | 3.1% | 14 | −3.2 | ICT GC −3.0. |

The deepest drawdown is a 10-day Meridian FX losing streak (−42R). The ICT drawdowns are index clusters losing together, and slow bleeds.

## 5. Sizing schemes

Base risk is 0.5% of equity per 1R, and equity compounds daily.

The Monte Carlo runs 10,000 one-year paths of 5-day blocks of real days. Each system is drawn from its own window, independently: their measured correlation is about 0. The Meridian part is therefore its 30 days repeated, mean included. The last two columns rescale each scheme until P(10% drawdown within a year) is 5%, which compares schemes at equal tail risk.

### A. Both systems at the same R

| scheme | trades | avg risk ICT / Mer % | return % | max DD % | ret/DD | worst month % | MC 1y return p50 % | MC DD p95 % | **P(DD ≥ 10%)** | at P = 5%: ICT / Mer % per R | at P = 5%: 1y return % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fixed 1R | 494 | 0.50 / 0.50 | +38.1 | 19.4 | 1.96 | −5.6 | −28.8 | 77.4 | **1.00** | 0.04 / 0.04 | −1.4 |
| ICT size field (`sizeOf`) | 494 | 0.42 / 0.50 | +32.9 | 17.8 | 1.85 | −3.0 | −31.1 | 77.7 | 1.00 | 0.03 / 0.04 | −1.7 |
| ICT grade: A+ 1R, A 0.5R | 494 | 0.40 / 0.50 | +34.2 | 18.8 | 1.82 | −4.8 | −30.8 | 77.8 | 1.00 | 0.03 / 0.04 | −1.6 |
| Index cap 1 (same direction) | 448 | 0.41 / 0.50 | +19.7 | 19.9 | 0.99 | −4.7 | −36.7 | 79.1 | 1.00 | 0.03 / 0.04 | −2.2 |
| Index cap 2 (same direction) | 485 | 0.48 / 0.50 | +30.5 | 19.4 | 1.57 | −5.6 | −32.1 | 78.1 | 1.00 | 0.04 / 0.04 | −1.7 |
| Vol target 0.5% a day per system | 494 | 0.24 / 0.15 | +18.9 | 6.7 | 2.81 | −2.5 | −2.4 | 36.9 | 0.96 | 0.06 / 0.04 | −0.3 |
| Quarter Kelly, cap 0.5% | 384 | 0.45 / 0.24 | +30.1 | 13.9 | 2.17 | −6.7 | −21.8 | 58.3 | 1.00 | 0.06 / 0.03 | −2.6 |
| *ICT only, fixed 1R (reference)* | 253 | 0.50 / 0 | +45.8 | 8.6 | 5.34 | −3.4 | +34.0 | 13.6 | 0.20 | 0.36 / 0 | **+23.6** |
| *Mirror as coded: 0.01 lot on $1,000* | 494 | 1.08 / 0.27 | +70.2 | **31.4** | 2.23 | **−10.6** | (+570)* | 33.7 | **1.00** | 0.29 / 0.07 | (+73)* |

\* This Monte Carlo compounds a lucky Meridian gold month 12 times over. Treat the numbers as an artefact.

At equal R, no sizing scheme rescues the book:
- Meridian's daily R swing is 6.1 against ICT's 1.6, and its mean is negative.
- Every scheme hits a 10% drawdown in more than 95% of years.
- The rescaled schemes cannot earn anything.

### B. Meridian at 0.1× ICT's R (the budget split)

| scheme | trades | avg risk ICT / Mer % | return % | max DD % | ret/DD | worst month % | MC 1y return p50 % | MC DD p95 % | **P(DD ≥ 10%)** | at P = 5%: ICT / Mer % per R | at P = 5%: 1y return % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Fixed 1R | 494 | 0.50 / 0.05 | +45.2 | 8.6 | 5.27 | −3.5 | +27.7 | 17.5 | 0.43 | 0.28 / 0.03 | +14.9 |
| **ICT size field (`sizeOf`)** | 494 | 0.42 / 0.05 | +39.6 | **6.4** | **6.20** | **−2.0** | +24.0 | 15.2 | **0.30** | 0.28 / 0.03 | **+15.3** |
| ICT grade: A+ 1R, A 0.5R | 494 | 0.40 / 0.05 | +41.0 | 7.5 | 5.46 | −2.9 | +24.5 | 15.8 | 0.34 | 0.24 / 0.03 | +14.7 |
| Index cap 1 (same direction) | 448 | 0.41 / 0.05 | +25.8 | 6.7 | 3.82 | −2.6 | +14.4 | 16.3 | 0.35 | 0.25 / 0.03 | +8.7 |
| Index cap 2 (same direction) | 485 | 0.48 / 0.05 | +37.2 | 8.6 | 4.33 | −3.5 | +22.3 | 17.7 | 0.44 | 0.27 / 0.03 | +12.0 |
| Vol target 0.5% a day per system | 494 | 0.24 / 0.015 | +20.6 | 5.3 | 3.92 | −1.7 | +13.7 | 8.7 | 0.02 | 0.28 / 0.02 | +16.3 |
| Quarter Kelly, cap 0.5% | 384 | 0.45 / 0.02 | +35.2 | 8.6 | 4.11 | −3.7 | +20.8 | 15.9 | 0.33 | 0.27 / 0.02 | +12.5 |

Two extra variants are in `portfolio.json`: an index "split" (the k-th same-direction position takes 1/k of its risk) and grade + split. Both are worse than the size field, at +11.7% and +10.8% at P = 5%.

### What each scheme does

- **Fixed 1R:** the baseline.
- **ICT size field** (`sizeOf`: 1.5× with 2R+ of room to the draw on liquidity, 0.5× otherwise, halved for tight stops):
  - It has the best return/DD and the best worst month on both books.
  - At equal tail risk it is +0.4 points over fixed, which is a tie.
  - Keep it. It is already the live rule.
- **Grade A+ / A:** A+ index trades earn +0.44R against +0.04R for A. Yet halving the A trades scores below `sizeOf` at equal tail risk (+14.7 vs +15.3).
- **Correlation cap:** **fails.**
  - Same-direction index trades are strongly correlated (0.76).
  - But the clusters were profitable (+29.8R), so blocking them removes more return than risk. Cap 1 costs 40% of the return at equal tail risk.
  - Count the clusters as one bet in the budget instead of blocking them. The split version also loses.
- **Volatility targeting:**
  - It is the best at equal tail risk (+16.3% vs +15.3%), but the margin is within noise.
  - It needs a running estimate of each system's daily volatility, which no live code has.
  - **Inconclusive.** A paper-track candidate, not a rule.
- **Quarter Kelly, capped at 0.5%:**
  - For ICT the cap always binds: quarter Kelly is 2–3% per R.
  - The rolling per-market estimate switches markets off after bad stretches, dropping 110 trades, and it costs at equal tail risk.
  - What it does well is the obvious part: it sets Meridian FX near 0.
- **ICT alone beats every combined book** at equal tail risk: +23.6% against +15.3%. On this replay, Meridian costs return and adds no diversification benefit, because it has no edge to diversify with.

## 6. Recommendation for the owner: risk budget for the cTrader DEMO mirror

This is a recommendation only. LIMITS (0.01 lot, maxLots 0.1, maxOpen 5, dayStop 2%) and every live rule are unchanged.

| item | budget |
|---|---|
| ICT A-setups | **0.20% of balance per 1R × the size field**: 0.10% (tight stop, little room) to 0.30% (2R+ room) |
| Meridian (every live sleeve, gold and FX) | **0.02% per 1R**, a tenth of an ICT R, while its replay stays net ≤ 0. Today: −0.03R a trade over 241 gold/FX trades, and −0.43R over 36 live paper trades. |
| Crypto | 0. It is not mirrored, and the sleeve nets −0.76R a trade after Kraken fees. |
| Open risk | about **1% of balance** at most. This was the peak in the replay at this budget; maxOpen 5 already bounds it. |
| Same-direction index positions | **no cap** (it fails above), but treat 3+ open together as one bet. They win or lose together. |
| Day stop | keep **2%**: about 10 ICT R. The worst replay day at this budget is −0.73%, so it would never have fired. |
| maxOpen | keep **5**. ICT alone never needed more. With Meridian, the 27 skipped arrivals were worth +1.6R. |

### What the budget should deliver

These are Monte Carlo figures for one year.

| case | median year | p95 DD | **P(10% DD)** | P(losing year) |
|---|---|---|---|---|
| as replayed (ICT +0.31R a trade) | +9.3% | 6.3% | **0.2%** | 7% |
| ICT expectancy cut by 0.2R, to about the 2018–26 long-history +0.11R (research/edge/portfolio) | +2.1% | 10.1% | **5.3%** | 37% |

The 0.20% base is the largest size that keeps P(10% DD) at about 5% in the conservative case. If the replay's expectancy holds, the same 5% line sits at 0.325%. Raise toward it only after the demo confirms the edge.

### What the mirror actually risks today

The mirror sends **0.01 lot on a balance of about $1,000**. Using the median stops:

| market | stop p10 / p50 / p90 | risk per trade at 0.01 lot | vs the budget |
|---|---|---|---|
| ICT gold (GC → XAUUSD, 1 oz) | $25.8 / $35.5 / $64.1 | **2.6% / 3.6% / 6.4%** (avg 4.3%) | 13–32× too big |
| Meridian gold | $1.9 / $6.5 / $14.3 | 0.19% / 0.65% / 1.4% | 10–70× |
| Meridian FX | 4–29 pips | 0.03–0.27% | 1.5–13× |
| ICT indices, assuming 1 lot = $1 per point (check the broker's lotSize) | NQ 166 pts, YM 221, ES 28, RTY 16 (p50) | 0.02–0.30% | 0.1–1.5× |

The as-coded mirror is mostly an ICT gold book:
- ICT gold makes about 70% of its replay P&L.
- On replay: +70%, but a **31% max drawdown**, a −10.6% worst month and a −9% worst day.
- 28 days lose 2% or more. The day stop only blocks new orders, so a single gold loss goes through it.
- P(10% DD in a year) is about 100%.

**Options for the owner (no change made):**
1. **Judge the demo in R, not in dollars, as an execution test.** This is the cheapest option and matches the mirror's stated purpose.
2. **Size by risk:** lots = budget $ / (stop × $ per point per lot). With 0.01-lot steps this needs a demo balance of about **$25–50k** for the gold stops. At 0.20%, a $35 gold stop is 0.014–0.03 lot.
   - Under maxLots 0.1, Meridian FX scalps with tight stops, and index CFDs if they are $1 per point, would then hit the cap and be refused.
   - So the lot rule and maxLots would have to be decided together.
3. **If neither:** know that each ICT gold loss is about 3.6% of the demo, and the day stop fires after the first one.

## Caveats

- **Meridian evidence is short.** It is 30 days of replay, plus 6 days of live paper under changing rules. The Meridian systems live today (gold replica, gold trend and the other gold paper legs) have no trade-level replay. The 0.1× budget applies to them until they do.
- **The ICT replay is 15 months**, and its +0.31R a trade is 2–3× the long-history figure. The conservative row covers this.
- **The Monte Carlo draws the two systems independently.** Their measured correlation is 0.03, over 30 days.
- **Meridian costs are the engine's one-spread charge.** On a spread-only account the costs research puts them at 2×, which would make the sleeve worse.
- **No out-of-sample split for the sizing schemes.** The differences between `sizeOf`, fixed, grade and vol target (14.7–16.3% at equal tail risk) are within noise. The large effects are the Meridian weight and the fixed lot.
- **Variants run:** 20 scheme × book runs, plus 2 budget cases. Settings were fixed before the runs (base 0.5%, quarter Kelly, 20-day vol window). Two were not: the 0.1× Meridian weight was chosen after the equal-R run, from Meridian's share of the daily variance, and the 0.20% base is solved from the conservative Monte Carlo.
- **Earlier work.** research/edge/portfolio (2018–26 HistData ICT, 150-day council) reached the same picture: caps on the council sleeve hold up, ICT `sizeOf` was best, and the combined p95 DD is about 23–28 ICT R.

## Files

- `research/portfolio.mjs`: the study. Its loaders, sizing schemes, drawdown, correlation, exposure and Monte Carlo functions are exported for reuse.
- `research/portfolio.json`: every number above, plus the daily curve.
- `tests/portfolio.test.mjs`: synthetic-trade tests.

To reproduce:

```
mkdir -p cd/ict
git show origin/council-data:ict/replay.json > cd/ict/replay.json
git show origin/council-data:ict/bars.json > cd/ict/bars.json
git show origin/council-data:backtest.json > cd/backtest.json
git show origin/council-data:trades.json > cd/trades.json
node research/portfolio.mjs cd            # writes research/portfolio.json (10,000 paths; PATHS=... to change)
```
