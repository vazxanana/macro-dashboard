# Shadow streams at realistic costs: which ones cost at most 0.10R and still make money out of sample (9 Nov 2026)

**Verdict: INCONCLUSIVE. No shadow stream passes as a whole. Seven streams fail on cost (the engine's scalp 0.35R, retrace scalp 0.40R, intraday 0.14R, retrace intraday 0.17R and M30→M1 0.16R a trade, LIT 0.25R, and the NQ trend-on run 0.14R by the letter, 0.04R since 2020). Eight streams are cheap enough (the five ICT shadows 0.015–0.056R, the engine's swing, retrace swing and position 0.03–0.05R), but the ICT shadows have no closed forward trade yet and the three engine ones have one or two, so none can be judged. Strictly by the owner's screen (cost ≤ 0.10R and net out-of-sample expectancy > 0) only the engine retrace swing survives, on two trades. With the per-trade cost gate of proposal 3, two rows pass the pre-registered bar: the NQ trend-on run (+0.17R a trade 2020→now, t 2.5, all of it from 2023 on, the window its rule was built on) and the engine scalp (+0.78R on 84 forward trades, t 2.8, in eight days of one market week). Both are leads to keep on paper, not live changes.**

Pre-registration: `preregistration.md` (written with `costmodel.mjs` before `run.mjs` computed any out-of-sample statistic; one commit,
as the owner asked, so the order is stated there rather than shown by git). Harness: `run.mjs` over council-data of 9 Nov 07:08 UTC
(commit 40d95376). Cost model: `costmodel.mjs`, tested in `tests/shadow-cost.test.mjs`. Paper research only: no live rule,
`config.json`, Trader, tracker, alert or mirror setting changed. The owner decides (`research/proposals/2026-11-09-council-edge.md`).

## How each trade was costed

Round trip in price = spread + commission + entry slippage (market entries) + exit slippage (every exit but a resting target), ÷ the
trade's initial risk. Forex and gold: the costs study's raw-account typical spreads with its New York-hour shape (`research/edge/costs`);
commission from the demo broker (`ctrader/symbols.json`: forex 22.5 USD a million a side, gold 12); crypto: the broker's own quoted
spread (BTC 0.024%, ETH 0.146%, SOL 0.243% of price; XRP is not offered, mean of the three); CME futures for the ICT desk and the NQ
run: one tick spread, $1.24 commission, one tick each way slippage (NQ 1.37 points a round trip); spot silver $0.025 (assumed).

**Demo mirror fills.** 8 same-time market fills (`lagSec` ≤ 300 s, median 65 s; crypto 3, forex 4, gold 1) slipped +0.041R on
average against the council's entry, half a spread included: forex fills came in better than the model (−4.4× its default slippage),
crypto at 0.9×, the one gold fill 6.6× worse. No group reached the 5 fills the plan needs to replace the default, so the defaults stand.
Of the other mirror fills, 30 are catch-up copies made hours or days after the signal (`lagSec` up to 6.5 days); their `slipR`
(−0.82 to +1.17R) is price drift, not execution, and was not used. 15 were limit fills (none filled worse than the council's entry; 13 of 15
within 0.07R of it, two better by 0.13R and 0.58R). The ICT account fills index CFDs against futures signals (no `slipR`).

## Results by stream

R a trade net of the realistic cost unless marked. IS / OOS as pre-registered: NQ and LIT have backtests from 2004 / 2008, so OOS =
2020-01-01 on + live paper; the ICT and engine backtests only cover the window those rules were designed or tuned on, so they are IS
and OOS is the live paper record (1–9 Nov for the engine, from 7–8 Nov for the others).

| stream | cost a trade, mean (median) | IS n | IS net (t) | OOS n | OOS cost | OOS gross | OOS net (t) | OOS x2 | OOS halves | OOS max DD | verdict | survives the 0.10R screen |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NQ open run, trend-on (`nq-trend`) | 0.139 (0.127) | 1,024 | −0.01 (−0.1) | 514 | 0.039 | +0.21 | **+0.18 (2.6)** | +0.14 | +0.02 / +0.33 | −22.7 | **FAIL** (cost, by the letter) | no |
| LIT, gold (`lit`) | 0.253 (0.234) | 9 | +0.65 (0.5) | 18 | 0.222 | +0.06 | −0.16 (−0.3) | −0.38 | +0.27 / −0.59 | −8.6 | **FAIL** (cost) | no |
| ICT no Friday (`ict-nofri`) | 0.020 (0.013) | 220 | +0.31 (2.8) | 0 | – | – | – | – | – | – | **INCONCLUSIVE** (no forward trade) | no |
| ICT H1 opposite (`ict-h1opp`) | 0.022 (0.013) | 176 | +0.29 (2.3) | 0 | – | – | – | – | – | – | **INCONCLUSIVE** | no |
| ICT structure trail (`ict-strail`) | 0.020 (0.013) | 256 | +0.26 (2.5) | 0 | – | – | – | – | – | – | **INCONCLUSIVE** | no |
| ICT spot silver (`ict-silver`) | 0.056 (0.040) | 82 | +0.42 (2.1) | 0 | – | – | – | – | – | – | **INCONCLUSIVE** | no |
| ICT NQ/ES dip-buy (`ict-dip`) | 0.015 (0.012) | 68 | +0.45 (2.0) | 0 | – | – | – | – | – | – | **INCONCLUSIVE** | no |
| *Reference: ICT A-setups, live desk rule* | *0.020 (0.013)* | *254* | *+0.24 (2.5)* | | | | | | | | *not judged* | |
| Engine scalp (`eng-scalp`) | 0.350 (0.180) | 4,150 | −0.40 (−12.7) | 280 | 0.258 | +0.16 | −0.10 (−0.7) | −0.36 | −0.23 / +0.03 | −69.7 | **FAIL** (cost) | no |
| Engine retrace scalp (`eng-rscalp`) | 0.402 (0.193) | 2,168 | −0.40 (−10.2) | 163 | 0.292 | +0.07 | −0.22 (−1.5) | −0.51 | −0.04 / −0.41 | −55.0 | **FAIL** (cost) | no |
| Engine intraday (`eng-intraday`) | 0.141 (0.083) | 992 | −0.29 (−5.5) | 52 | 0.150 | +0.26 | +0.11 (0.5) | −0.04 | +0.08 / +0.15 | −13.2 | **FAIL** (cost) | no |
| Engine retrace intraday (`eng-rintra`) | 0.165 (0.082) | 499 | −0.10 (−1.3) | 29 | 0.200 | +0.38 | +0.18 (0.4) | −0.02 | −0.18 / +0.52 | −6.6 | **FAIL** (cost) | no |
| Engine swing (`eng-swing`) | 0.041 (0.030) | 105 | −0.22 (−1.7) | 1 | 0.016 | −1.00 | −1.02 | −1.03 | – | −1.0 | **INCONCLUSIVE** (1 trade) | no |
| Engine retrace swing (`eng-rswing`) | 0.054 (0.027) | 55 | −0.20 (−2.1) | 2 | 0.009 | +0.26 | +0.25 | +0.24 | +0.42 / +0.08 | 0.0 | **INCONCLUSIVE** (2 trades) | yes, on 2 trades |
| Engine position (`eng-position`) | 0.033 (0.021) | 74 | −0.70 (−6.0) | 2 | 0.013 | −1.00 | −1.01 | −1.03 | −1.01 / −1.01 | −2.0 | **INCONCLUSIVE** (2 trades) | no |
| Engine M30→M1 (`eng-m30m1`) | 0.164 (0.164) | – | – | 2 | 0.164 | +0.50 | +0.34 | +0.17 | +1.99 / −1.31 | −1.3 | **FAIL** (cost) | no |

The engine streams' OOS is the live paper record (the "live" column of `result.json` equals OOS there); the NQ, LIT and ICT streams
have no closed live trade yet (the NQ trend shadow started 8 Nov and no trend-on New York open has fired since; LIT has no filled
order yet; the ICT shadows' first trades are still open).

Where the cost goes (mean R a trade over all trades, spread / commission / slippage): engine scalp 0.23 / 0.03 / 0.09; retrace scalp
0.28 / 0.03 / 0.09; LIT 0.14 / 0.04 / 0.07; ICT A-rule 0.004 / 0.007 / 0.009; NQ trend 0.025 / 0.063 / 0.051. The council's own
stamped `costR` (`council/fills.mjs`) under-states the engine's realistic cost: scalp 0.21 vs 0.35, intraday 0.09 vs 0.14, retrace
intraday 0.08 vs 0.17. The difference is mainly crypto (the broker quotes ETH and SOL at 6–12× the model's 0.02% spread) and the
session shape (Asia and the 17:00 New York rollover).

**Crypto is not the whole story.** On the live engine trades, forex scalps cost 0.15R and gold scalps 0.13R a trade; forex retrace
scalps 0.18R. They fail the 0.10R screen without any crypto trade.

## Proposal 3 as written: keep only the trades whose own cost is ≤ 0.10R (secondary, same bar)

| stream | trades kept | IS n | IS net (t) | OOS n | OOS net (t) | OOS x2 | OOS halves | OOS max DD | verdict |
|---|---|---|---|---|---|---|---|---|---|
| NQ trend-on | 43% (513 of 514 OOS) | 147 | +0.14 (1.2) | 513 | **+0.17 (2.5)** | +0.13 | +0.00 / +0.33 | −22.7 | **PASS** |
| Engine scalp | 28% | 1,137 | +0.17 (3.2) | 84 | **+0.78 (2.8)** | +0.72 | +0.51 / +1.06 | −8.3 | **PASS** |
| Engine retrace scalp | 29% | 622 | +0.07 (1.4) | 55 | +0.23 (0.9) | +0.17 | +0.17 / +0.28 | −11.2 | INCONCLUSIVE |
| Engine intraday | 57% | 563 | −0.08 (−1.2) | 34 | +0.08 (0.3) | +0.03 | −0.11 / +0.27 | −13.1 | INCONCLUSIVE |
| Engine retrace intraday | 54% | 272 | +0.11 (1.6) | 13 | +0.87 (1.1) | +0.84 | −0.25 / +1.82 | −1.9 | INCONCLUSIVE |
| LIT | 0% | – | – | – | – | – | – | – | INCONCLUSIVE (no trade is that cheap) |
| ICT shadows, engine swing / rswing / position | 83–100% | as above | as above | 0–2 | – | – | – | – | INCONCLUSIVE |

Both formal passes need reading before anyone acts on them:

- **NQ trend-on run.** Since 2020 the trend-on open run made +0.18R a trade after realistic costs (514 trades, 90.6R, worst drawdown
  −22.7R), and costs are only 0.04R a trade now that NQ stops are 30–50 points. But by year: 2020 −0.03, 2021 −0.05, 2022 +0.14,
  2023 +0.34, 2024 +0.30, 2025 +0.24, 2026 +0.39R a trade. The run's rule was built on 2023–26 (`research/edge/nq-open-oos`
  `periods.built`); on 2020–22 alone the trend-on run is +0.02R (n 246, t 0.2), flat (post-hoc split). The trend gate keeps 514 of the
  593 open-run trades since 2020, so it is nearly the live stream. The stream-level FAIL is the plan's letter: the mean cost over
  2004–26 is 0.139R because a fixed 1.4-point round trip was a large share of the 4–10-point stops of 2004–13; it is not a cost problem
  today.
- **Engine scalp, cheap trades only.** The trades whose realistic cost is ≤ 0.10R (wide stops for their market) made +0.17R a trade in
  the engine's 150-day replay (crypto +0.54R, forex +0.16R, gold −0.06R) and +0.78R in the forward week (forex +0.71R on 47, gold
  +0.83R on 28, crypto +1.04R on 9). The forward sample is 84 trades in eight days of one market week, and the costs study's 8.8 years
  of forex and gold history (`research/edge/costs`) found no stop size that made the scalp positive out of sample. This is the
  forward diagnostic council-edge already saw (+0.33R at the council's cost), now at realistic cost; it supports proposal 3 as a paper
  column, not a live scalp.

## Limitations

- Out-of-sample evidence is thin where it matters: the live paper record is 8 days for the engine and zero closed trades for the
  ICT, NQ trend and LIT shadows. Their verdicts can only change with forward trades.
- Spreads for forex and gold are published typical figures (no bid/ask history in the repo); the crypto spread is one broker quote
  (9 Nov 07:03 UTC); silver's is an assumption. x2 costs are reported for every stream.
- The engine replay's risk is recovered from its stored cost column (exact), its entry price for commission from the broker's current
  quote (commission is 0.003–0.03R, so this hardly matters). The NQ risk is recovered from the regime study's net and net-at-2-points
  columns (matches the NQ study's yearly median stops: 4.5 / 31.2 / 47.6 points in 2005 / 2020 / 2025 vs 4.5 / 30.6 / 47.2).
- ICT backtests (Aug 2025–Nov 2026) overlap the desk's design window, so their positive IS figures are not out-of-sample evidence.
- Mirror slippage: 8 usable fills, below the plan's 5-per-group threshold everywhere; the defaults were used.

## Reproduce

```
git fetch origin council-data && git worktree add /tmp/cdata origin/council-data   # or any checkout of council-data
node research/edge/shadow-cost/run.mjs /tmp/cdata                                   # writes result.json, prints one line per stream
node --test tests/shadow-cost.test.mjs
```
