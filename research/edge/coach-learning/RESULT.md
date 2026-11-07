# Does the Coach's self-learning help or hurt?

Paper research only. No live rule, config or trader code was changed.

## Short answer

**The Coach's learning is mostly noise.** It neither finds better trades nor reliably avoids worse ones. What it reliably does is churn.

- **No selection edge.** On the 150-day engine replays the learned rules pick trades that are no better than randomly dropping the same number of trades. This holds for the Coach as coded and for every stricter or slower variant tested.
- **Total R improves only because it trades less.** Every setup it decides on loses about −0.19R a trade after spread. Any rule that stops trades looks good on total R, so total R is not the test here.
- **It flip-flops constantly.** Over 150 days the Coach as coded made **346 rule changes**, and **299 of them undid an earlier change, 216 of those within 3 days**. Live, 1–7 Nov, config history shows the same pattern: m30m1 D1 changed 5 times, rscalp Asia 4 times, scalp overlap 3 times, and the minimum stop went up 6 days in a row.
- **Part of the churn is a structural bug, not just small samples.** It is explained under "Why it flip-flops" below.
- **Stricter evidence plus a 14-day cool-down removes about 93% of the churn at no measurable cost.** The stricter evidence is n ≥ 30 on each side, clustered t ≥ 2 and both halves. Churn falls to 25 changes and 13 reversals, none within 3 days. However, this variant does **not** improve out-of-sample results: OOS −0.184 vs −0.176 R/trade on the primary stream, −0.204 vs −0.172 on the second.
- **Verdict: FAIL. No variant passes, so there is no `proposal.md`.** No variant has positive OOS expectancy, and only the Coach-with-pauses variant beats the coded Coach out of sample on both streams. That variant is the worst of all in-sample.

## Data and method

### Signal streams
The engine's own signals, from two council 150-day replays (`council/backtest.mjs`, 6 Jun – 3 Nov 2026, 10 markets):
- **Primary:** `research/backtest-150d-m30.json`, 12,493 filled trades of the setups the Coach rules on: scalp, rscalp, intraday, rintra, swing, position, rswing, m30m1.
- **Second:** `research/backtest-150d-clean.json`, with no m30m1.

Results are net of each trade's spread (`R − cost`), the same way the trader reads its backtest. Gross OOS for the coded Coach is −0.067 R/trade against −0.093 for take-everything.

### Walk-forward
- The simulation steps hour by hour.
- A trade is **taken** if the rule state at its open lets it through. Otherwise it is a **shadow** with `blockedBy` reasons, exactly as the trader records it.
- The Coach sees a trade only after it has closed.

The Coach logic is copied with its exact thresholds (`council/trader.mjs` of 7 Nov):

| Piece | Rule (as coded) | When |
|---|---|---|
| learnFilters D1/structure | sample ≥ 8; one side n ≥ 5 at < −0.2R and another n ≥ 3 at > +0.1R → only the good side. Or a side n ≥ 6 at ≤ −0.6R → narrow to with / main. Window: 30 days. | every 6 h |
| learnFilters session | session n ≥ 5 at < −0.2R, rest n ≥ 3 at > 0 → skip it | every 6 h |
| rule drop | blocked shadows n ≥ 5 at > +0.2R, or the rule is 21 days old (re-test) | daily |
| learnFromBacktest | conditions d1/cf/choch/m15c (n ≥ 30 per side, t ≥ 3, both halves); break-even (paired t ≥ 2, both halves); backtest pause; resume. Run on a rolling 30-day replay rebuilt from the same stream. | daily |
| learnPauses | n ≥ 6 at < −0.25R, or 4 losses in a row → 3-day pause; early and normal resumes | hourly |
| minRR | 14-day trades under 1.5R: n ≥ 6 at < 0 → minRR 1.5 (never lowered) | daily |

### Not simulated (the stream lacks the data)
- minRisk and buffer, which need stop width in ATR,
- the review lessons (hunt / noise / late / news),
- the dollar cap and exposure limits,
- market pauses,
- the second-target and market-entry steps.

### Split and benchmark
- **Evaluation window:** starts after a 30-day warm-up (6 Jul).
- **IS:** 6 Jul – 24 Sep. **OOS:** 24 Sep – 3 Nov.
- **Random-thinning benchmark:** 300 random subsets of the take-everything trades, each the same size as the variant's OOS trades. The column shows the share of those subsets the variant beats. 50% is no skill; above 95% would be skill.

## Live rule history (council-data `config.json`, 1,158 commits, 1–7 Nov)

`history.mjs` reads every version of `config.json` and diffs the rules field by field. Full list: `out/history.json`.

| Rule | Changes | Reversals | Timeline (UTC) |
|---|---|---|---|
| global.minRisk | 6 | 0 | 0.6 → 0.7 → 0.8 → 0.9 → 1.0 → 1.1, one step each midnight on 3–7 Nov |
| m30m1.d1 | 5 | 3 | 3 Nov → against; 6 Nov 00:06 off; 6 Nov 07:01 → with; 7 Nov 00:05 off; 7 Nov 06:02 → with |
| rscalp.session:asia | 4 | 3 | 2 Nov skip; 4 Nov 00:04 on; 4 Nov 06:02 skip; 6 Nov on |
| scalp.session:overlap | 3 | 2 | 6 Nov 12:01 skip; 7 Nov 00:05 on; 7 Nov 06:02 skip |
| global.be | 3 | 1 | on 2 Nov 06:05, off 11:53 (backtest) |
| rscalp.d1, rintra.d1, rscalp.session:overlap | 2 each | 1 each | |

In total there were 41 field-level rule changes in 6 days.

## Why it flip-flops: two samples, opposite verdicts

`learnFilters` builds its sample without the shadows that the d1/struct/session rules blocked. The drop test uses exactly those blocked shadows.

So once a rule is dropped, the add test at the next 6-hour slot sees only the trades taken **before** the rule existed. That is a stale sample, and it re-adds the rule.

The live log shows this directly:
- "m30m1: only with D1, against: −0.62R over 8 trades" was written twice, on 6 Nov 07:00 and 7 Nov 06:00, with the identical sample.
- In between, it was dropped on 6 Nov 00:04 and again on 7 Nov 00:03, because the trades the rule had blocked made +0.45R over 9 and then +1.36R over 19.

In the simulation of the coded Coach (primary stream), this loop caused:
- **90 re-adds within 24 h of a shadow-evidence drop**,
- **20 re-adds within 24 h of a 21-day re-test drop**,
- **100 rules switched off again within 3 days of being switched on**.

Judging on every closed signal (variant C6) cuts the shadow-drop re-adds from 90 to 19 and total changes from 346 to 191. P&L does not change measurably.

## Results

### Primary stream (backtest-150d-m30), R per trade net of spread

| Variant | IS n | IS R/t | OOS n | OOS R/t | OOS R | OOS maxDD | OOS t | beats random thinning (OOS) | rule changes (150 d) | reversals (<3 d) |
|---|---|---|---|---|---|---|---|---|---|---|
| F0 frozen: no learned rules | 6196 | −0.184 | 3285 | −0.196 | −643.7 | −643.7 | −3.85 | 53% | 0 | 0 (0) |
| F1 frozen: IS-chosen strict set (picked none) | 6196 | −0.184 | 3285 | −0.196 | −643.7 | −643.7 | −3.85 | 53% | 0 | 0 (0) |
| C0 Coach as coded, with pauses | 722 | −0.262 | 219 | −0.121 | −26.4 | −31.7 | −0.84 | 70% | 346 (+254 pauses) | 299 (216) |
| **C1 Coach as coded, noPause (live today) = baseline** | 4735 | −0.193 | 2772 | −0.176 | −486.9 | −487.2 | −3.13 | 68% | 346 | 299 (216) |
| C2 backtest learner only | 6196 | −0.181 | 3227 | −0.188 | −607.1 | −618.6 | −3.63 | 58% | 11 | 4 (3) |
| C3 coded + 14-day cool-down | 4508 | −0.180 | 2953 | −0.181 | −534.9 | −550.2 | −3.28 | 63% | 106 | 65 (0) |
| C4 coded, 60-day window | 3258 | −0.172 | 2237 | −0.165 | −369.9 | −369.9 | −2.80 | 74% | 378 | 335 (239) |
| C5 coded, no 21-day re-test | 890 | −0.251 | 181 | −0.275 | −49.8 | −54.1 | −1.91 | 27% | 261 | 214 (182) |
| C6 coded, full sample (bug fix) | 4594 | −0.162 | 2971 | −0.186 | −551.3 | −565.6 | −3.39 | 60% | 191 | 146 (63) |
| C7 C6 + 14-day cool-down | 4798 | −0.174 | 2986 | −0.185 | −551.7 | −570.0 | −3.37 | 60% | 105 | 61 (0) |
| S1 strict (n ≥ 30, t ≥ 2, both halves) | 3778 | −0.148 | 2988 | −0.184 | −550.8 | −570.1 | −3.36 | 60% | 45 | 30 (7) |
| S2 strict + 14-day cool-down | 5296 | −0.170 | 2988 | −0.184 | −550.8 | −570.1 | −3.36 | 60% | 25 | 13 (0) |
| S3 strict + cool-down + 60 d, no re-test | 2435 | −0.180 | 1269 | −0.038 | −48.5 | −153.1 | −0.51 | 100% | 13 | 2 (0) |
| S4 strict + cool-down + 60 d + re-test 21 | 4944 | −0.165 | 3084 | −0.187 | −575.6 | −583.3 | −3.46 | 59% | 26 | 15 (0) |
| S5 strict + cool-down + full sample | 5258 | −0.177 | 3011 | −0.191 | −574.1 | −592.4 | −3.52 | 53% | 29 | 15 (0) |
| S6 S5 + 60 d, no re-test | 1872 | −0.186 | 1029 | −0.126 | −129.8 | −175.2 | −1.66 | 87% | 14 | 2 (0) |

### Second stream (backtest-150d-clean, no m30m1)

| Variant | IS n | IS R/t | OOS n | OOS R/t | OOS R | beats random (OOS) | rule changes | reversals (<3 d) |
|---|---|---|---|---|---|---|---|---|
| F0 frozen: no learned rules | 3844 | −0.180 | 1944 | −0.206 | −400.3 | 49% | 0 | 0 (0) |
| C0 coded, with pauses | 512 | −0.243 | 88 | −0.163 | −14.3 | 59% | 216 (+189 pauses) | 173 (108) |
| **C1 coded, noPause = baseline** | 2576 | −0.157 | 1476 | −0.172 | −254.0 | 73% | 216 | 173 (108) |
| C2 backtest only | 3844 | −0.180 | 1927 | −0.198 | −382.1 | 58% | 12 | 3 (3) |
| C3 coded + cool-down | 3020 | −0.181 | 1705 | −0.202 | −344.3 | 51% | 87 | 54 (0) |
| C4 coded, 60 d | 2105 | −0.123 | 1555 | −0.173 | −268.3 | 74% | 193 | 158 (90) |
| C5 coded, no re-test | 363 | −0.149 | 164 | −0.104 | −17.0 | 76% | 156 | 117 (97) |
| C6 full sample (fix) | 2783 | −0.183 | 1640 | −0.182 | −298.9 | 68% | 158 | 120 (52) |
| S1 strict | 3098 | −0.196 | 1757 | −0.193 | −338.9 | 62% | 28 | 12 (3) |
| S2 strict + cool-down | 3222 | −0.185 | 1749 | −0.204 | −356.2 | 52% | 19 | 8 (0) |
| S3 strict + cool-down + 60 d, no re-test | 2195 | −0.220 | 1005 | −0.185 | −185.5 | 60% | 11 | 0 (0) |
| S6 S5 + 60 d, no re-test | 2255 | −0.222 | 1133 | −0.237 | −268.1 | 26% | 10 | 0 (0) |

### By month (primary stream, R per trade)

The stream is 150 days long, so months stand in for years.

| | Jul | Aug | Sep | Oct | Nov (3 d) |
|---|---|---|---|---|---|
| F0 frozen | −0.237 | −0.152 | −0.214 | −0.136 | −0.784 |
| C1 coded | −0.248 | −0.182 | −0.214 | −0.111 | −0.775 |
| S2 strict + cool-down | −0.228 | −0.145 | −0.207 | −0.122 | −0.732 |

## Reading the results

1. **The learning does not separate good trades from bad.**
   - **Selection skill.** No variant beats random thinning at the 95% level on either stream. The coded Coach beats 68–73% of random subsets OOS and 37–73% IS.
   - **Per-trade expectancy.** It is within ±0.03R of take-everything in almost every row, and the sign of the difference changes between IS and OOS and between streams.
2. **Pauses (C0) look good OOS and bad IS.**
   - **The swing.** They are −0.262 vs −0.184 IS and −0.121 vs −0.196 OOS, on only 219 and 88 OOS trades. This is a swing inside a very wide random band (5–95%: −0.43 to +0.05).
   - **Why it is not skill.** Pausing a losing setup after 6 losing trades is mostly sitting out, and sitting out is the only thing that "works" in a stream that loses everywhere.
3. **The 21-day blind re-test does double duty.** It causes churn: 51 of 346 changes, often re-added within a day from the same 30-day evidence. But removing it (C5) locks in early noise rules, and C5 is the worst OOS on the primary stream (−0.275). The re-test is the only thing that rescues bad rules, which shows the rules being added are noise in the first place.
4. **The minRR raise and the minimum-stop raise are one-way ratchets on weak triggers.**
   - **minRR.** In simulation it goes 1.2 → 1.5 on day 9 and never comes back.
   - **minRisk.** Its trigger is "win rate < 35% over 10+ trades". The engine's normal win rate is 23–26% at reward:risk ≈ 2–3, so this fires by construction every day. That is why live minRisk climbed 0.6 → 1.1 in five days. Its P&L effect could not be simulated, because the stream has no stop width in ATR.
5. **Stricter evidence plus a cool-down is the clean way to stop churn, but it buys no performance.**
   - **S2:** 25 changes instead of 346 and 0 reversals within 3 days. OOS is the same as the frozen book (−0.184 vs −0.196) and within noise of the coded Coach (−0.176).
   - **S3:** −0.038 OOS on the primary stream, but it was not the IS pick. On the second stream it is −0.185 (60%), so it is a lucky draw rather than a rule. It is one of 16 variants and was not selected in-sample.

## Verdict

**FAIL.** Every variant has negative OOS expectancy. No variant improves on the coded Coach OOS on both streams with consistent in-sample support.

The Coach's coach-stats learning is noise-chasing:
- It does not hurt per-trade results measurably.
- It does not help them either.
- It produces most of the rule changes in `config.json`.

No `proposal.md` is written because no candidate passes.

**For the owner, not a proposal: if less churn is wanted for its own sake (readable rules, stable live behaviour), these changes are cost-free on this evidence.**
- **(a)** Have `learnFilters` judge on every closed signal of the setup, including shadows its own rules blocked. This fixes the add/drop disagreement behind the m30m1, rscalp-Asia and scalp-overlap flips.
- **(b)** Require n ≥ 30 on each side, clustered t ≥ 2 and both halves before adding or dropping a coach-stats rule.
- **(c)** Do not change the same rule again within 14 days.
- **(d)** Stop the one-way minRisk ratchet: a sub-35% win rate is normal for this engine.

Together (a)–(c) cut rule changes by about 90% with OOS expectancy unchanged within noise. None of them makes the book profitable, because the underlying setups lose about 0.19R a trade on these replays.

## Variants tried

16 policies × 2 streams = 32 runs, plus one smoke test. Every result is reported above. None was used to pick a live rule.

## Files

- `history.mjs`: rebuilds the live rule timeline from council-data `config.json` git history. Output: `out/history.json` and `out/config-commits.txt`.
- `sim.mjs`: the walk-forward Coach simulator, with the policy variants listed at the bottom of the file.
- `report.mjs`: builds `result.json` from `out/sim-m30.json` and `out/sim-clean.json`.

### Re-run

```
git fetch origin council-data --shallow-since=2026-10-25
git log --reverse --format='%H %cI' origin/council-data -- config.json > research/edge/coach-learning/out/config-commits.txt
node research/edge/coach-learning/history.mjs research/edge/coach-learning/out/config-commits.txt research/edge/coach-learning/out/history.json
git show origin/council-data:research/backtest-150d-m30.json > /tmp/m30.json      # and backtest-150d-clean.json
cd research/edge/coach-learning && node sim.mjs /tmp/m30.json out/sim-m30.json && node sim.mjs /tmp/clean.json out/sim-clean.json && node report.mjs
```

The simulator takes about 2 minutes per stream.
