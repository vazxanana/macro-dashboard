**Verdict: the shadow book's −300R week is 100% costs, not trading. On 515 closed shadow trades (2–8 Nov) the book made +92.6R gross and paid 380.5R of modelled costs; 82% of that cost is Kraken spot fees charged to 139 crypto scalps whose stops are a fraction of the 0.8% round trip (the same crypto trades at CFD cost: +18.2R). One bookkeeping artefact is proven and repaired: 29 gold M30→M1 trades were copies of a Scalp entry recorded before the 6 Nov dedupe and counted twice (26 closed this week, +15.8R net); they now carry status `duplicate`. The near-stop market fills are a sizing artefact for the owner to rule on (23 trades filled at under half their planned risk carry 86R of the cost). No shadow stream has robust research behind it. Retire the Retrace scalp everywhere and every engine setup on BTC/ETH/SOL/XRP; keep Intraday and Retrace intraday on gold/forex, M30→M1 on its own trades, Swing as a tag source, the owner's two system shadows and the ICT variants.**

Paper research only. No live rule, size, filter or mirror setting was changed. The one code change is a one-time data repair in
`council/repairs.mjs` (`voidM30Twins`, tested in `tests/repairs.test.mjs`), the same mechanism as the 4 Nov rounded-price repair.
Everything else here is a proposal for the owner.

Snapshot: council-data as cloned on 7 Nov 22:37 UTC (`config.btAt` 21:41). The week report quoted −306.66R over 499 trades from
another snapshot of the same files; the composition is the same (this copy: 515 trades, −287.94R; after the twin repair 489 trades,
−303.77R). Week = Monday 00:00 to Sunday 24:00 UTC, closed trades only, the page's `isClosed` and `merNet` (council/digest.mjs).

## 1. Where the loss comes from

The book, before and after the repair (R; cost = spread + Kraken fees on crypto + half a spread of slippage per market order, council/fills.mjs):

| book | n | win | gross | cost (fees / spread / slip) | net | net a trade | t |
|---|---|---|---|---|---|---|---|
| shadow, as recorded | 515 | 35% | +92.55 | −380.49 (300.3 / 50.7 / 29.1) | −287.94 | −0.56 | −4.5 |
| shadow, m30m1 copies removed | 489 | 35% | +73.74 | −377.51 (300.3 / 49.6 / 27.7) | −303.77 | −0.62 | −4.7 |
| Meridian live (same files) | 33 | 18% | −12.37 | −25.07 | −37.44 | −1.13 | |

By setup (shadow, as recorded):

| stream | n | win | gross | cost (fees / spread / slip) | net | net a trade | t |
|---|---|---|---|---|---|---|---|
| scalp (M15→M1) | 261 | 28% | +37.82 | −210.23 (163.1 / 30.0 / 17.2) | −172.41 | −0.66 | −3.2 |
| rscalp (retrace M15→M1) | 151 | 42% | +12.67 | −138.27 (113.3 / 16.3 / 8.7) | −125.60 | −0.83 | −4.1 |
| rintra (retrace H1→M5) | 26 | 50% | +12.55 | −15.47 (13.8 / 1.1 / 0.6) | −2.92 | −0.11 | −0.3 |
| intraday (H1→M5) | 44 | 39% | +12.18 | −12.28 (9.5 / 1.9 / 0.9) | −0.10 | 0.00 | 0.0 |
| position (D1→H1) | 2 | 0% | −2.00 | −0.25 | −2.25 | −1.13 | |
| swing (H4→H1) | 1 | 0% | −1.00 | −0.30 | −1.30 | −1.30 | |
| rswing (retrace H4→H1) | 2 | 100% | +0.52 | −0.24 | +0.28 | +0.14 | |
| m30m1 (gold M30→M1) | 28 | 32% | +19.81 | −3.45 | +16.36 | +0.58 | 0.9 |
| m30m1, its own trades only | 2 | 50% | +1.00 | −0.47 | +0.53 | +0.27 | |

By market group, and the setup × group cells that matter:

| stream | n | gross | cost | net | net a trade | t |
|---|---|---|---|---|---|---|
| Crypto (BTC, ETH, SOL, XRP) | 139 | +47.87 | −313.43 (fees 300.3) | −265.56 | −1.91 | −5.4 |
| Forex (5 pairs) | 245 | +4.25 | −49.66 | −45.41 | −0.18 | −1.8 |
| Gold | 131 | +40.43 | −17.40 | +23.03 | +0.18 | 0.7 |
| scalp · crypto | 64 | +36.12 | −170.40 | −134.28 | −2.10 | −3.0 |
| rscalp · crypto | 48 | +8.14 | −118.09 | −109.95 | −2.29 | −5.7 |
| scalp · forex | 145 | +0.98 | −31.61 | −30.63 | −0.21 | −1.5 |
| rscalp · forex | 64 | −6.46 | −15.10 | −21.56 | −0.34 | −1.9 |
| rintra · crypto | 11 | +3.87 | −14.34 | −10.47 | −0.95 | −2.3 |
| intraday · crypto | 13 | +1.31 | −9.86 | −8.55 | −0.66 | −1.4 |
| scalp · gold | 52 | +0.72 | −8.22 | −7.50 | −0.14 | −0.4 |
| rscalp · gold | 39 | +10.99 | −5.08 | +5.91 | +0.15 | 0.4 |
| rintra · gold | 9 | +11.91 | −0.56 | +11.35 | +1.26 | 1.2 |
| intraday · forex | 28 | +13.87 | −2.33 | +11.54 | +0.41 | 1.2 |

By session: London carries the loss (138 trades, +41.2 gross, −129.8 net, 171R of cost, of which scalp·London −90.7 and rscalp·London −45.8),
then Asia (123, +8.0 / −62.6), New York (99, +9.0 / −49.5), the overlap (98, +14.8 / −39.6), late (57, +19.6 / −6.5). Every session is
positive gross and negative net: it is the cost, not the hour. The full setup × session table is in `result.json` (`book.byKSession`).

### Costing and sizing artefacts, checked one by one

| check | finding | artefact? |
|---|---|---|
| Kraken fees on tight stops | 139 crypto trades: median cost 1.30R a trade on a median 0.56% stop (BTC median 1.75R; worst 39.7R on a 0.021% stop). Fees are 300R of the 380R cost. The model is the one the costs study chose on purpose (Kraken Pro spot taker 0.40% a side; `research/edge/costs`: the spread alone was 1/40 of the real cost). At a CFD venue (0.04% round trip) the same 139 trades are +18.2R net, −2.9R for rscalp. | **A venue assumption that decides the verdict, not an error.** A scalp whose round trip costs 1–2× its risk is unjudgeable on that venue; on a CFD venue the gross edge (+0.34R a trade, t 0.65) is still noise. |
| Near-zero stops (sizing) | The engine's stop floor (`minRisk` × ATR, never inside 5 spreads) is checked on the planned entry. A market fill lands between the planned entry and the stop, so the fill's risk can be a fraction of the planned risk, and R and costR are both per unit of that smaller risk. 172 of 515 shadow trades filled at market; 23 filled at under half the planned risk (gross +11.9, net −74.1, cost 85.9R), 4 at under a quarter (cost 63.0R: one BTC scalp 39.7R, one XRP scalp +17.7R gross on a 0.047% stop). 73 trades had a stop under 5 spreads (gross −0.1, net −92.0). The live book had none under half the planned risk this week. | **Sizing artefact, owner's call.** Honouring the floor at the fill (skip, as the Trader already skips a fill past the stop) or measuring R on the planned risk (the costs study's convention) are both rule changes. Proposed below; the stale-signal guard already counts these fills (`snapshot.staleGuard.better`). |
| The same trade recorded twice | m30m1 fires on the Scalp's M1 entry. The Trader drops the copy since 6 Nov 18:03 UTC (#259), but 29 copies recorded 4–6 Nov stayed: 26 closed this week (+18.8R gross, +15.8R net), so the m30m1 "stream" was the Scalp counted twice, and the Coach's m30m1 D1 rule (flipped 4 times in 2 days) was learning on Scalp trades. After the dedupe, 0 copies; m30m1 has 3 trades of its own. Also 2 scalp/intraday pairs with the same stop and target (the live book blocks the second as `duplicate`; the shadow book records both): +1.5R. | **Proven and repaired**: `voidM30Twins` marks the 29 copies `status: 'duplicate'` (kept for the record with `dupOf`, `void`, R unchanged); no tally counts that status. Test: `tests/repairs.test.mjs`, incl. the pinned council-data copy (6 Nov 13:16 copy voided, 20:00 own trade kept). The scalp/intraday pairs are left as a proposal (marking shadows `duplicate` changes the Coach's sample). |
| Adds counted twice | 0 shadow trades with `addOf`; no `size` / `rawR` on any engine trade (scale 1). Crypto trend and gold trend fast have no closed shadow trade yet. | none |
| Costs double-counted | `Rnet = R − costR` on all 515 (0 mismatches); every cost is the default model (`costSrc` default; no broker spread or mirror fills yet). Market entry + stop exit pays 2 spreads + fees; limit entry + target exit pays 1 spread. The costs study puts the real forex round trip at ~1.4 pips against this 2: slightly high, not double. | none |
| Gap stops / R below −1 | 0 trades below −1R; 7 trades with `r0` differing from the stop on record (break-even / trail moves, correct). | none |

## 2. Research support, stream by stream

Robustness verdicts from `research/robustness.json` (bar: n ≥ 30, OOS t ≥ 2, CI > 0, positive at 2× costs, Bonferroni; `research/robustness.md`).

| stream | studies | robustness | supported? |
|---|---|---|---|
| scalp | scalp-filters FAIL (−0.20R IS / −0.20R OOS after spread, all 9 years negative; gross −0.07/−0.06); scalp-exits FAIL; timing FAIL; regime: loses in every regime; costs: no edge before costs on 8.8 years; setups-promote FAIL | scalp-30d, scalp-30d-fx, scalp-150d, scalp-histdata: all *not proven* | **no** |
| rscalp | setups-promote FAIL (−0.225 IS / −0.198 OOS, 0/3 OOS years); costs: "vanishes" under every cost model; the owner's rr ≥ 3 rule is worse in both periods | not audited | **no** |
| intraday | setups-promote FAIL (−0.075 / −0.016, 1/3 years); regime: break-even everywhere, gross OOS +0.053 | not audited | no, but the one setup research puts at ~0 |
| rintra | setups-promote FAIL (−0.082 / −0.079); gold only +0.041 IS / +0.119 OOS (regime); costs: +0.186 engine net on 113 in the 30-day replay | not audited | no; gold leg near zero |
| swing | meridian-swing FAIL (−0.095R, t −3.0, n 2,076, every year negative; owner rule −0.111, t −2.2); regime: one weak ADX lead, "track on paper, not adopt" | swing-adx fragile, swing-adx-fwd not proven | **no** (ADX tag lives on these records) |
| rswing | setups-promote FAIL (−0.116 / +0.021 n 74) | not audited | **no** |
| position | setups-promote FAIL (−0.156 / −0.185, 0/3); owner research-150d: off since 2 Nov | not audited | **no** |
| m30m1 | setups-promote PASS, weak: gold, London only +0.032 IS / +0.222 OOS (n 128, 2/3 years); 5,925 of 8,016 replay signals duplicate a Scalp | not audited | weak, London only, own trades only |
| crypto trend (shadow 7 Nov) | crypto-trend-decay (#508): decayed, Jun 2025–Oct 2026 −0.13R over 20 positions (t −0.56) | trend fragile, trend-2018 robust | decayed |
| gold trend fast (shadow 7 Nov) | gold-systems-oos (#530): regime-bound, 2006–17 +0.37R a position (n 129, t 1.92) | gtrend5 fragile, gtrend5-2018 fragile | regime-bound |
| ICT nofri | ict-filters PASS, weak (no Friday A-setups holds 2018–26) | fragile | weak |
| ICT h1opp | no session / structure filter passes (ict-sessions, ict-filters) | fragile | no |
| ICT strail | ict-exits FAIL (no exit beat the live one IS); skill §33 paper variant | not audited | no |
| ICT silver | ict-markets: passes the gate (n 82, +0.41R, t 2.02, both halves positive; 16 cells tested; 2018–23 −79.5R) | not audited | weak |
| ICT dip-buy | ict-index-longonly: adds little beyond being long equities | fragile | no |

Streams that are only bleeding paper with nothing behind them: **scalp, rscalp, swing, rswing, position** (every study FAIL), plus every
engine setup on crypto, where the cost model makes the paper unjudgeable whatever the entry does.

## 3. Trades each shadow still needs before the council can judge it

Bar: |t| ≥ 2 at the stream's current expectancy, n = (2·sd / |exp|)²; time at the stream's own rate, capped at 2 years. Forward rates
are extrapolated from 6 days of the shadow book (all 10 markets, every session), so the fast streams are shown in weeks.

| stream | current record | needed | verdict |
|---|---|---|---|
| scalp | forward 261, −0.66R, sd 3.4, t −3.2 | 104 at that expectancy: **already judged (losing)**; at the 150-day replay's −0.154R: 602 trades ≈ 3 weeks | judged |
| rscalp | forward 154, −0.88R, sd 2.6, t −4.3 | 34: **already judged (losing)**; at the replay's −0.115R: 630 ≈ 6 weeks | judged |
| intraday | forward 44, −0.002R, sd 1.75 | expectancy ~0: no number reaches |t| 2; at the replay's −0.223R: 194 ≈ 4 weeks | unjudgeable at its forward expectancy; the replay says losing |
| rintra | forward 27, −0.12R, sd 2.3 | 1,456 ≈ 45 weeks at the forward rate; at the replay's −0.011R: 60,000 (never) | not within 2 years unless it moves away from zero |
| swing | forward 1 | at the replay's −0.188R (sd 1.4): 210 trades ≈ 9 months at 1–2 a week (replay rate 268/yr across 10 markets) | within 2 years; meridian-swing already answered it on 2,076 |
| rswing | forward 2 | at the replay's −0.201R: 51 ≈ 4–5 months | within 2 years; FAIL on 2018–26 already |
| position | forward 2, replay −0.747R over 66 | 6 more trades | already judged by the replay |
| m30m1 (own trades, London) | 3 own trades (+0.53R net), 1 London | at setups-promote's +0.222R OOS, sd ~1.8: **263 London trades ≈ 5.8 years** at 45 a year | not judgeable within 2 years |
| crypto trend (shadow) | 0 closed | at −0.13R (sd 1.0, 14 positions a year): 256 positions ≈ 18 years; at the baseline sd 8.5: never | not judgeable within 2 years (the decay monitor says the same) |
| gold trend fast (shadow) | 0 closed | at +0.37R (sd 2.2, 8.7 a year): 140 positions ≈ 16 years | not judgeable within 2 years |
| ICT nofri | 0 forward (since 7 Nov); replay +0.273R, sd 1.6, 162/yr | 145 trades ≈ 11 months | within 2 years |
| ICT h1opp | replay +0.295R, sd 1.7, 129/yr | 129 ≈ 12 months | within 2 years |
| ICT strail | replay +0.221R, sd 1.65, 188/yr | 223 ≈ 14 months | within 2 years |
| ICT silver | replay +0.52R, sd 1.85, 63/yr | 51 ≈ 10 months | within 2 years |
| ICT dip-buy | replay +0.59R, sd 1.85, 52/yr | 39 ≈ 9 months | within 2 years |

## 4. Proposed lists (the owner decides)

**Retire**

| stream | why |
|---|---|
| rscalp, all markets | −0.88R a trade net over 154 forward (t −4.3); 150-day replay −0.115 over 2,181; setups-promote FAIL in both halves; costs: vanishes under every cost model. Already judged. |
| scalp, rscalp, rintra, intraday on BTC / ETH / SOL / XRP | 139 trades: +47.9R gross, −265.6R at Kraken fees (median 1.3R cost on a 0.56% stop), +18.2R at CFD cost. Unjudgeable on the venue the model assumes, noise on the other; the owner already moved crypto trend to shadow. |
| position | off since the 2 Nov research-150d rule; replay −0.747R over 66; setups-promote FAIL. 1–2 shadow trades a week teach nothing. |
| rswing | setups-promote FAIL; replay −0.201R over 55; 2 forward trades a week. |
| scalp on gold + forex (owner's call) | no study supports it anywhere; every one of 9 years negative after spread. Forward this week: gold −7.5R over 52, forex −30.6R over 145. It is the Coach's filter-trial sample: keep it only if the owner wants the Coach to keep learning on it. |

**Keep**

| stream | why |
|---|---|
| intraday on gold + forex | the one engine setup research puts near zero rather than below it (regime gross OOS +0.053; forward −0.002R over 44; forex +0.41R over 28 this week). Crypto leg out. |
| rintra on gold | gold-only +0.119R OOS (regime, not proven); forward gold +11.4R over 9. Forex (−3.8R over 6) and crypto legs out. |
| m30m1 on gold, its own trades, judged on London | the only formal PASS among the engine setups (weak). After the repair it has 3 trades of its own; it needs ~263 London trades before |t| 2. Its D1 rule should be re-learned on its own trades, not the Scalp copies. |
| swing (tag source, 1–2 a week) | FAIL as an edge, but the D1 ADX band tag (swing-adx, claim swing-adx-fwd) is read off these records; the owner moved it to shadow on 7 Nov. |
| crypto trend shadow, gold trend fast shadow | the owner's 7 Nov decisions. Neither can be judged within 2 years at its rate (14 and 8.7 positions a year); owner-watch streams, not council verdicts. |
| ICT nofri, h1opp, strail, silver, dip | one open paper position each, futures costs 0.02–0.03R a trade (no costing issue). Replay t 2.1–2.5 but in-sample for the variant choice (robustness: fragile); an independent forward record takes 9–14 months each. |

**Proposals (rule changes, not made here)**

1. Honour the engine's stop floor at the fill: a market fill whose risk is under `max(minRisk × ATR, 5 spreads)` is skipped (the Trader
   already skips a fill past the stop). Or measure R on the planned risk, as the costs study does. Either removes the 0.02–0.1% stops
   that carry 7–40R of cost each.
2. Mark a shadow whose stop and target match an open shadow of another setup as `duplicate` too (the live book does this already), so
   the shadow book counts an idea once.
3. State the crypto venue: keep Kraken spot fees (then retire the crypto scalps as unjudgeable) or cost them as a CFD (0.04%) and judge
   them on the gross edge, which is noise so far.

## Files

- `run.mjs <council-data dir> [week Monday] [out]`: builds every table above from trades.json, ict/replay.json, ict/shadow.json,
  research/shadow-replay.json, research/robustness.json and council/decay-base.json; applies the twin repair on a copy for the
  "after" book. `result.json`: its output on the 7 Nov snapshot.
- `council/repairs.mjs` `voidM30Twins`, run once by the Trader after trades.json is read; `tests/repairs.test.mjs`.
