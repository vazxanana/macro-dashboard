# Position sizing for the live systems: fixed 1R stays

Paper research only. No live rule, size, config or tracker was changed.

**Question.** Every live system risks a fixed R per trade. Would one of three simple sizing overlays have given more return
per unit of drawdown, in **both halves** of the long out-of-sample histories? The systems are ICT A-setups, the NQ New York
open run, the Gold replica, Gold trend N20 and Gold daily engulf. All of them are regime-bound.

## Verdict: keep fixed 1R. No overlay passes the pre-registered bar.

| Rule | Portfolio ret/DD better by ≥10%, both halves (x1) | Same at x2 | Positive-year share not lower | ≥3 of 5 systems better, each half | Pass |
|---|---|---|---|---|---|
| Inverse volatility | no (H1 0.40 vs 0.22; **H2 7.65 vs 12.10**) | no | yes | no (H1 3, **H2 1**) | **no** |
| Drawdown throttle | no (H1 0.28 vs 0.22; **H2 12.36 vs 12.10, +2%**) | no (H1 −0.89 vs −0.89) | yes | no (**H1 0**, H2 3) | **no** |
| Decay-monitor throttle | no (H1 0.57 vs 0.22; **H2 3.62 vs 12.10**) | no | no | no (H1 1, H2 0) | **no** |

- **Inverse volatility** hurts in the second half. It shrinks the replica (mean size 0.62) because the replica only trades
  when gold is volatile, and it hurts ICT in both halves. It helps the NQ run in both halves, and Gold trend and Gold daily engulf in the first half only.
- **The drawdown throttle** improves the portfolio's full-history return/drawdown from 6.63 to 8.08, and its drawdown from
  83R to 48R. Almost all of that comes from **weighting, not timing**:
  - With X fixed from the build-period drawdowns, ICT spends 99% of its first half and 80% of its second half at half size.
    The NQ run spends 82-84%. For these two the throttle is close to a permanent half size.
  - Holding each system at a **constant** weight equal to the throttle's average size beats the throttle in both halves
    (post hoc: H1 0.63 vs 0.28, H2 13.77 vs 12.36).
  - System by system, the throttle's timing improves no system in the first half, and it lowers ICT in both halves.
  - The sensitivity runs (X at a quarter of and at the full build-period drawdown) do not change this.
- **The decay monitor as a throttle switches the systems off for good.** Run causally over the long records with today's
  baselines, it marks ICT as decaying for 89% of 2008-16 and 100% of 2017-26. It marks the NQ run as decaying for 82% of
  2004-14 and 100% of 2015-26, so it misses the run's whole 2023-26 good regime. Gold trend is decaying 91% of 2017-26.
  - A one-sided CUSUM that has built up over years of flat trading takes years of trades at the backtest edge to wind down.
  - Restarting the record at each half (post hoc) does not save it. Started in 2015, the NQ monitor goes "decaying" during
    the flat 2015-22 years and is still there in 2023-26: H2 ret/DD −0.22 against +1.32 at fixed size.
  - ICT's baseline (+0.20R a trade, from a 15-month replay) is above what the rule made even in its good 2018-26 era
    (+0.09R). On a long record the monitor reads ICT as decaying almost by construction.
  - **The monitor is useful as an alert. It should not drive size.**

**Recommendation to the owner.**
- Keep fixed R per trade on every system. No sizing overlay goes live, and none is proposed as a shadow variant.
- Do not wire the decay monitor's status into size. Keep it as status and alert only, as it is now.
- The only thing that improved return per drawdown in both halves was **how much risk each system gets**, not when.
  The long-history drawdowns come from ICT and the NQ run (ICT −83R and NQ −61R at 1R, against −5R for Gold trend and −15R
  for Gold daily engulf).
  - That is a post-hoc observation with hindsight weights. It is not a tested rule.
  - If the owner wants to act on it, the next step is a separate pre-registered test of a static risk budget. For example:
    ICT and the NQ run at half the R of the gold sleeves, with the weights fixed before the test.

## The portfolio (equal risk: 1R base per position in every system)

Net R, x1 costs. Halves are by entry year: H1 2004-14, H2 2015-26. "mean m" is the average size multiplier.

| Rule | Half | Total R | Max DD | Ret/DD | Worst year | Years + | Mean m |
|---|---|---|---|---|---|---|---|
| Fixed 1R | H1 | +17.9 | 82.8 | 0.22 | −33.7 | 5/12 | 1 |
| | H2 | +531.1 | 43.9 | **12.10** | −3.4 | 10/12 | 1 |
| | all | +549.1 | 82.8 | 6.63 | −33.7 | 15/23 | 1 |
| Inverse vol | H1 | +32.4 | 80.2 | 0.40 | −48.1 | 5/12 | 1.11 |
| | H2 | +473.3 | 61.9 | 7.65 | −14.0 | 10/12 | 1.00 |
| | all | +505.8 | 80.2 | 6.31 | −48.1 | 15/23 | 1.04 |
| Drawdown throttle | H1 | +13.7 | 48.4 | 0.28 | −20.9 | 5/12 | 0.56 |
| | H2 | +377.2 | 30.5 | 12.36 | −2.6 | 10/12 | 0.63 |
| | all | +390.9 | 48.4 | 8.08 | −20.9 | 15/23 | 0.60 |
| Decay throttle | H1 | +18.0 | 31.6 | 0.57 | −22.1 | 6/12 | 0.20 |
| | H2 | +78.2 | 21.6 | 3.62 | −12.1 | 7/12 | 0.09 |
| | all | +96.2 | 31.6 | 3.04 | −22.1 | 13/23 | 0.14 |

**x2 costs, ret/DD (H1 / H2 / all):**

| Rule | H1 | H2 | All |
|---|---|---|---|
| Fixed | −0.89 | 2.91 | 0.33 |
| Inverse vol | −0.85 | 1.65 | 0.00 |
| Drawdown throttle | −0.89 | 4.03 | 0.73 |
| Decay throttle | −0.46 | 2.65 | 0.75 |

At doubled costs the 2004-14 portfolio loses money under every rule (fixed: −222R). The ICT and NQ cost sensitivity in the
early years (#511, #526) dominates it.

## Per system: return / drawdown, x1 (fixed / inverse vol / DD throttle / decay)

| System (split) | First half | Second half |
|---|---|---|
| ICT A-setups (2008-16 / 2017-26; X 5.6R) | −0.32 / −0.53 / −0.41 / −0.81 | **5.21** / 3.22 / 3.98 / – (never on) |
| NQ open run (2004-14 / 2015-26; X 10R) | 0.00 / 0.18 / −0.11 / −0.08 | 1.32 / 1.52 / **2.31** / – (never on) |
| Gold replica (2017-21 / 2022-26; X 20.1R) | 0.43 / −0.08 / 0.43 / 0.44 | 4.28 / 3.19 / **4.95** / 0.92 |
| Gold trend N20 (2006-16 / 2017-26; X 1.85R) | 6.25 / **6.90** / 4.94 / 1.63 | **21.49** / 20.51 / 18.09 / 3.74 |
| Gold daily engulf (2006-16 / 2017-26; X 7.4R) | 3.25 / **3.69** / 2.26 / 3.01 | 3.83 / 3.41 / **4.11** / 3.56 |

Totals and drawdowns per system, rule and half are in `result.json` (`systems.<id>.x1|x2.<rule>.h1|h2|all`, with `byYear`).

- No rule wins in both halves for more than one system. Inverse vol does it for the NQ run; the other two rules do it for
  none.
- The drawdown throttle wins in H2 for three systems: the NQ run, the replica and Gold daily engulf. It wins in H1 for none.
- Inverse vol wins in H1 for three systems and in H2 only for the NQ run.

**Share of positions the decay monitor sized at 0x (decaying):**

| System | H1 | H2 |
|---|---|---|
| ICT | 89% | 100% |
| NQ | 82% | 100% |
| Replica | 0% | 63% |
| Gold trend | 50% | 91% |
| Gold daily engulf | 9% | 7% |

**Share of positions the drawdown throttle sized at 0.5x:**

| System | H1 | H2 |
|---|---|---|
| ICT | 99% | 80% |
| NQ | 84% | 82% |
| Replica | 0% | 29% |
| Gold trend | 41% | 30% |
| Gold daily engulf | 42% | 16% |

## Post-hoc diagnostics (added after the results; they cannot change the verdict)

**Timing vs weighting.** Each system is held at a constant weight equal to the overlay's average multiplier over its whole
history. These are hindsight weights. Portfolio ret/DD, x1:

| Weights | H1 | H2 | All |
|---|---|---|---|
| Fixed | 0.22 | 12.10 | 6.63 |
| Constant at the drawdown throttle's averages (ICT 0.55, NQ 0.59, replica 0.88, trend 0.82, engulf 0.85) | **0.63** | **13.77** | 8.62 |
| The drawdown throttle itself | 0.28 | 12.36 | 8.08 |
| Constant at the decay throttle's averages (ICT 0.05, NQ 0.07, replica 0.44, trend 0.26, engulf 0.88) | 3.12 | 10.66 | 13.42 |

The static down-weighting of ICT and the NQ run does the work. Switching size in and out does not.

**Decay monitor restarted at each half** (record from the half's first trade, as the live monitor starts from a recent
replay). Ret/DD, fixed → decay throttle:

| System | H1 | H2 |
|---|---|---|
| ICT | −0.32 → −0.81 | 5.21 → 0.44 |
| NQ | 0.00 → −0.08 | 1.32 → −0.22 |
| Replica | 0.43 → 0.44 | 4.28 → 2.19 |
| Gold trend | 6.25 → 1.63 | 21.49 → 8.65 |
| Gold daily engulf | 3.25 → 3.01 | 3.83 → 3.56 |

It is worse or level everywhere.

## Method (as pre-registered, `preregistration.md`, commit a5c7dfa4)

- **Records.** These are the earlier studies' per-position net R, sized as live and unchanged:
  - ICT: `ict-oos-2008`, 4,021 A-setups, 2008-26.
  - NQ: `nq-open-oos`, 1,869 trades, 2004-26.
  - Replica: `replica-oos`, 341 positions, 2018-26. There were no 2017 trades.
  - Gold trend N20 and Gold daily engulf: `gold-systems-oos`, 134 and 451 positions, 2006-26.
  - The records are copied, with close times and the inverse-vol inputs, into `inputs.json`.
- **Costs.** x1 and x2 are each study's own: ICT costR, NQ 1 / 2 points, gold $0.30 / $0.60 a unit.
- **Inverse vol.**
  - Size is clamp(median of the trailing 756-day 20-day vol ÷ the 20-day vol, 0.5, 2).
  - The vol is measured on OANDA daily closes through the site proxy, with weekend stubs dropped. It uses completed
    candles before the entry only.
  - During warm-up the size is 1: 10 gold positions in 2006.
- **Drawdown throttle.**
  - Size is 0.5 while the system's own 1R record, counting positions closed before the entry, is more than X below its peak.
    It goes back to 1 at a new peak.
  - X = 0.5 × the build-period worst drawdown in `council/decay-base.json`.
- **Decay throttle.**
  - `assess()` from `council/decay.mjs`, imported unchanged, runs before every entry on the 1R record closed by then, with
    the live baselines.
  - Status maps to size: healthy 1x, watch 0.5x, decaying 0x.
- **Portfolio.** The sum of the five systems' sized net R, ordered by close time. Drawdown is measured on closed positions.
  Years are counted by close date, and halves by entry year.
- **Caveats.**
  - The second halves contain the periods the rules were built on, so they flatter every rule alike.
  - Ret/DD comes from a single path, so differences of a few percent are noise. The bar asked for 10% in both halves.
  - NQ close times are taken as 11:00 ET, an upper bound. They are used only to order positions.

## Files

- `preregistration.md`: the rules and the decision bar, committed before the run.
- `run.mjs`:
  - `fetch` gets the daily candles into a scratch cache.
  - `build` writes `inputs.json` from the earlier studies' records.
  - The default run writes `result.json` and prints the tables.
- `inputs.json`: the five per-position records with the inverse-vol inputs, so the run needs no candle cache.
- `result.json`: every table above, by rule, half and year, at x1 and x2, plus the sensitivity runs, the post-hoc
  diagnostics and the decision.

Re-run:

```
node research/edge/sizing/run.mjs fetch <cache>
node research/edge/sizing/run.mjs build <cache> <ict-oos-2008 trades.json> <replica-oos trades.json>
node research/edge/sizing/run.mjs
```
