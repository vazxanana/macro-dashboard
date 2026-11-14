# Pre-registration: SMT at the sweep of ICT index A-setups, replicated on 2008-2019

Written on 14 Nov 2026, **before any signal of this window was computed**. What existed when this file was committed: the
H1 candle download (`run.mjs fetch`: OANDA mid NAS100, SPX500, US30, US2000, 1 Jun 2007 → 14 Jan 2020, cached outside git;
no price was read for any signal) and the detector `smt.mjs` copied from `ict-smt`. No `count` stage was run and no trade was
simulated. This file is committed and pushed ALONE, first; the runner follows in the next commit; then `count` and `full` run.
The sha256 of this file is written into `result.json` (`planSha256`).

Paper research. ICT is its own edge, run by Fred: this study proposes at most. No file under `ict/`, no rule of the tracker,
the replay, the desk or the rule book changes, whatever the result. Nothing of ICT is mixed into a council system. Every
simulated trade keeps the engine's own stop.

## 1. Why, and what is being replicated

`research/edge/ict-smt` (branch `ict-smt`, PR #1004) split the desk's index A-setups by SMT divergence at the sweep on OANDA H1
2020-26. Its pre-registered question (do SMT setups do better?) FAILED. Out of sample (2024-26) the SMT setups made −0.158R a
trade net (n 149, monthly t −1.91) and the others +0.211R (n 367, monthly t 2.14), difference −0.369R (Welch t −3.01). In sample
(2020-23) the gap was small (−0.049R, t −0.46). The reading "skip the SMT setups" was found **after the fact**; ict-smt says it
needs its own pre-registration on data that study never read. This is that test.

**Window: signal candle closes 2008-01-01 → 2019-12-31.** It does not overlap ict-smt's 2020-26 at all. Prior use of these
years, declared: `ict-oos-2008` ran the unfiltered A-rule on OANDA 5m 2008-17 (verdict FAILS on its pre-registered bar, in its
RESULT.md); `ict-universe` / `ict-smile` used 2018-26 HistData. **No study has computed the SMT split on any year before 2020.**
There is no in-sample / out-of-sample split inside this window: the whole window is the replication. The index A-rule was
fitted on 2023-26, so the unfiltered baseline here is out of its sample too, but only the split is judged.

**Dedupe**: `research/edge/` and every remote branch named like smt / ict-oos / replicate were read: only `ict-smt` computes
SMT for a signal; the untested-backlog proposal does not list it.

## 2. Definition (fixed; `smt.mjs`, unchanged)

`smt.mjs` is a byte-for-byte copy of `research/edge/ict-smt/smt.mjs` on branch `ict-smt` (commit f70c042ab), sha256
`a52082e777e89f84adfa27324f1269943d4180777b504ec4355774787e2dca1e` (the test checks it). It imports
`research/edge/ict-equal-lows/eq.mjs` (`sweptSwings`) unchanged. Same partners NQ → ES, ES → NQ, YM → ES, RTY → ES; same swing
(3 candles a side, last 96 H1 candles, confirmed before the sweep candle, untouched until it, the most recent one taken); same
partner reference (its extreme over the swing's 7-candle window, at least 5 candles present) and "held" rule (no partner candle
after that window, up to and including the sweep-time candle, trades beyond it). Not judged = no SMT. GC excluded, as ict-smt.

## 3. Engine, data, costs (fixed)

- **Engine**: as ict-smt: `api/_ictlab.js` `runMarket` with the desk's own `signals()`, `isASetup()`, `sizeOf()`, `P`
  (`ict/tracker.mjs`) and `simulate()` (`ict/replay.mjs`), imported, never edited. Live exit, live sizing. Three streams, each
  its own one-open stream per market: **unfiltered** (every A-setup), **SMT**, **no SMT** (the rest, not-judged included).
- **Markets**: NQ, ES, YM, RTY = OANDA mid NAS100, SPX500, US30, US2000 H1 through the keyless proxy `meridianx.dev/md/bars`
  (ict-oos-2008's source and path). **RTY is included**: the proxy now serves `us2000` (it did not when ict-oos-2008 ran) and
  the download returned US2000 H1 from 1 Jun 2007, so RTY keeps ES as its partner, as in ict-smt. Warm-up from 1 Jun 2007;
  candles to 14 Jan 2020 so the last trades can close.
- **Candle handling**: as ict-oos-2008 and the live futures feed: H1 candles in the 17:00 New York hour and in CME closures
  (`inHalt(t) || cmeShut(t)`, from the tracker) are dropped (ict-smt dropped only the 17:00 hour; stated as a difference);
  D1 = `dailyNY(H)`. OANDA's pre-2012 overnight quotes are thinner; no market-year is dropped for coverage.
- **Costs**: ict-oos-2008's model, one round trip = 0.0002 x price + one futures tick (NQ, ES 0.25; YM 1; RTY 0.1, added the
  same way). It scales with price, so it fits 2008 index levels better than the lab's fixed points (NQ 1.5, ES 0.5, YM 3, RTY
  0.4), which are reported beside it, not judged. Net R = size x (R − cost / risk). 2x costs = 2 x net − gross. **No
  financing**: trades are out within 36 H1 candles and the desk trades futures (as ict-smt and ict-oos-2008); stated.

## 4. Tests (two, no third), statistic and bar

| test | what | statistic |
|---|---|---|
| **H1 (primary)** | no-SMT A-setups net minus SMT A-setups net > 0, pooled index book, 2008-2019 | one-sided Welch on trades (normal approximation) |
| H2 | no-SMT A-setups alone, net > 0, 2008-2019 | one-sided t on calendar-month sums (all 144 months, a month without a trade = 0) |

Holm over the two p-values. **Placebo: 40 seeded random labels** (mulberry32, seeds 1000-1039): each A-setup signal is called
"SMT" with its market's observed SMT share over the window; the same streams and both statistics are recomputed per draw.

- **H1 passes** only if: SMT trades n ≥ 30; Welch t ≥ 2; Holm p < 0.05; at most 2 of the 40 placebo draws reach the observed
  difference; the difference is still > 0 at 2x costs.
- **H2 passes** only if: monthly t ≥ 2; Holm p < 0.05; no-SMT net R a trade still > 0 at 2x costs.
- **Verdict** (on H1, the replication): **PASS** if H1 passes; **FAIL** if the H1 difference is not positive; **INCONCLUSIVE**
  otherwise (positive but short of the bar), and when SMT trades are under 30. H2 is reported with its own pass / no-pass.

Reported, not judged: n, win rate, R a trade, total R, drawdown, trade and month t for every stream; gross, net, 2x and lab
costs; **by year and by half (2008-13, 2014-19)**, with the H1 difference per half; per market (not judged one by one); the
split inside the unfiltered stream's own trades; the tag reasons.

## 5. What follows

- A PASS becomes a short note in the report for Fred and the owner (a forward review tag first); never a live change made here.
  Fred decides on the ICT edge (owner, 10 Nov).
- Anything else: reported as it is, no proposal. Nothing is tuned after the run. A bug found after the run is fixed, stated,
  and everything is run again.
