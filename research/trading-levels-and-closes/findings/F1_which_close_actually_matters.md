# F1 — Your instinct about closes is right; the close you're watching is wrong

**Status:** H1 PARTIALLY REFUTED, H4 REFUTED — and replaced with something more actionable.
**Evidence type:** academic + primary/exchange + industry
**Confidence:** high on the mechanism; figures are search-derived (WebFetch blocked — see plan).

---

## The claim being tested

That daily and weekly **closing prices** are informationally privileged and therefore make
better levels than arbitrary intraday prices.

## What the evidence actually says

### For equities: closes genuinely are special

- US closing-auction share of daily volume grew from ~3.1% (2010) → ~7.5% (2018) → **~9–10%
  today**, spiking to **~20% on rebalance/OpEx days**.
- Europe is far more extreme: FTSE closing auction went from **31% (2019) → 55% (2023)** of
  daily volume.
- Mechanism: NAV striking, index-tracking mandates defined against official closing prices,
  and tracking-error minimisation *force* institutions to transact at the close. Reconstitution
  days run **3×–27× normal close volume**.

### For gold: that mechanism does not transfer

**This is the finding that matters.** Gold trades ~23 hours a day. The "daily close" on your
charts — the 5pm New York convention inherited from MT4/retail platforms — is documented by
platform providers themselves as an **administrative reset point for rollover purposes**. There
is:

- no auction,
- no trading halt,
- no order-flow concentration.

The market trades straight through it. It is a data-vendor convention for slicing a continuous
market, **not** a price-discovery or liquidity event. Every mechanism that makes equity closes
meaningful (auction concentration, NAV benchmarking, index tracking) is absent.

### Two independent challenges to "the close is informationally superior"

1. **Bogousslavsky & Muravyev ("Who Trades at the Close?")** reportedly find little *new* price
   discovery happens in the auction itself; closing deviations from the pre-close quote
   (avg 8.1bp, >0.63% on 1% of stock-days) **revert quickly** — transient liquidity pressure,
   not information.
2. **Statistically, close-to-close is the weakest summary of a day's price action.** Range-based
   volatility estimators (Parkinson, Garman–Klass) are reportedly **5–7.4× more efficient**
   than close-to-close. A two-point close series discards the high and low — which is most of
   the day's information.

### The weekly close specifically: H4 refuted

A weekly close **is** the Friday daily close. It contains no data a daily close does not. No
source located demonstrated weekly closes carry predictive information daily closes lack. Of
~30+ claims surfaced on this, the large majority were uncited vendor/retail content
("80%+ success rate", "reliability increases exponentially") — folklore with invented
precision and no methodology.

---

## What IS real — the actionable replacement

Gold has **three genuine institutional clock times**, none of which is the 5pm candle close:

| Time | What it is | Why it forces transactions |
|---|---|---|
| **15:00 London** | **LBMA Gold Price PM auction** | The global settlement benchmark. **SPDR Gold Trust (GLD) NAV has struck on it since 20 Mar 2015.** Benchmark for most physical delivery contracts, mining/refinery hedges, central bank accounting. |
| **10:30 London** | LBMA Gold Price AM auction | Same auction mechanism, lighter reference use |
| **13:29–13:30 ET** | **COMEX settlement window** | A genuine exchange-defined 60-second VWAP used for margin and mark-to-market |

The LBMA auction is a real electronic auction: up to 15 participants submit anonymous net
buy/sell quantities in iterative rounds until net imbalance falls below a **10,000 oz**
threshold.

**These are moments where institutional size must transact or must mark.** That is exactly the
property the equity closing auction has and the 5pm gold candle lacks.

### Documented anomalous behaviour at the fix

Peer-reviewed work (**Batten, Lucey & Peat, 2016, Resources Policy**) confirms anomalous
statistical behaviour in gold and silver around fix times, attributing it to volatility/order-
imbalance mechanics. An earlier Abrantes-Metz & Metz draft reported large fix-time spikes with
a striking downside skew (reportedly negative 92% of the time during 2010) — contested, never
formally published, but the *abnormality* itself is corroborated by the peer-reviewed source.

### And where price discovery actually happens

**Hauptfleisch, Putniņš & Lucey (Journal of Futures Markets, 2016)** — peer-reviewed — reportedly
found **COMEX futures play the larger average role in price discovery despite trading under
one-tenth of London's volume**, with leadership rotating by regional session (London leads in UK
hours, COMEX in US hours).

---

## The one genuinely special thing about Friday

Not information — **structure**. Academic work on gold day-of-week effects (Kohli, 2012)
reportedly finds implied vol **lower on Friday, higher on Monday**, consistent with pre-weekend
position squaring and gap-risk avoidance. Prop firms mandate Friday flatten windows; futures
traders de-risk into the weekend.

So the week-end matters — but as a **positioning/liquidity event**, not because Friday's close
price is informationally richer.

⚠ Day-of-week anomalies are the canonical example of effects that decay once published.

---

## Implications for the platform

1. **Stop treating the 5pm daily close as privileged.** It's a vendor convention. Your
   `structureMap` body-close confirmation rule is still defensible (it filters wick noise), but
   the justification is *noise filtering*, not *institutional significance*.
2. **Add the LBMA PM print (15:00 London) as a tracked level.** This is the single highest-value
   addition from this investigation — it's the price GLD's NAV strikes at, and it's free.
3. **Add COMEX settlement (13:29–13:30 ET)** as a second reference and as a session marker.
4. **Flag Friday position-squaring windows** rather than treating the weekly close as a magic
   level.
5. **Reconsider close-only logic.** Since range estimators dominate close-to-close statistically,
   anywhere the engine uses close-only data (e.g. SMA of closes) is discarding information the
   high/low carry.
