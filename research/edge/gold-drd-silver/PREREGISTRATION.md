# Pre-registration: the playbook's weekly-bull daily rejection long, and its two Daily-regime cuts, on silver (12 Nov 2026)

Written and pushed before any silver number is computed.

## Why
`gold-drd-long` (FAIL) found the gold playbook's weekly-bull daily rejection long profitable out of its own sample but not
measurably better than buying every bullish-week day. `gold-drd-er` (FAIL) found that skipping choppy Dailies (20-day efficiency
ratio under 0.2) halved the drawdown but did not pick measurably better trades. Two cuts looked better on gold and were named as
chosen after the fact: ER20 >= 0.3, and the signed version (ER20 >= 0.2 with the close above its value 20 days earlier). Their own
test has to be on data they were not chosen on. Silver (XAG/USD) is the nearest market the rule was never looked at on.

## Rule (gold-drd-long's, unchanged except for the two price-scaled numbers)
17:00 New York days; weekly structure from 2-bar fractal weekly swings, bullish after a weekly close above the last swing high
(the last COMPLETED week is used). Signal day: closes above the previous day's low and in the top 30% of its range. Buy the next
day's first H1 open; stop under the signal day's low by a buffer; target 3R; out at the close of the 10th day; stop first when one
candle holds both. Each signal is its own trade. On gold the buffer is $0.30 and the cost $0.35 a round trip; on silver both are
scaled to price as one hundredth of gold's typical ratio: **buffer $0.004, cost $0.03 a round trip** (the cost the ICT lab already
uses for silver). ER20 as in gold-drd-er (17:00 New York daily closes up to and including the signal day).

## Tests (three, Holm over the three)
On OANDA mid H1 XAG_USD, March 2006 (or the feed's first candle) to now, net of costs:
- **T1** the rule, every signal; **T2** the rule with ER20 >= 0.3; **T3** the rule with ER20 >= 0.2 and close above the close 20 days
  earlier.
- A test PASSES only if: mean net R a trade > 0 with t >= 2 after Holm (p from the normal approximation, one-sided), AND PF > 1
  in 2006-2019 AND in 2020-now.
- Verdict: PASS if T2 or T3 passes (the cuts are what this study is for); T1 is reported with the same bar.

## Reported, not tested
Each stream's worst drawdown, year by year, the baseline (every bullish-week day) and lift t as in gold-drd-long, ER20 >= 0.2.
Caveat carried over: overlapping trades are treated as independent, which if anything flatters t.

## Data
OANDA mid H1 XAG_USD through the site's candle proxy, cached outside git. Nothing live changes whatever the result; a PASS is a
proposal to the owner.
