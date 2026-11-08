---
name: "lit"
description: "LIT (Liquidity Inducement Theory; Arctic / kev.futures): inducement, FBOS/RBOS, AMD, smart money traps, IDM POI, NQ/ES & XAU/XAG divergence, session timing. Use to teach/quiz LIT, analyse charts, plan entries, or code/backtest LIT rules."
---

# LIT: Liquidity Inducement Theory

## 1. What LIT is, sources, how to use this skill

**LIT** is a liquidity price-action method. Retail traders cluster entries and stops at obvious levels: highs/lows, equal highs/lows, trendlines, S/R and textbook SMC order blocks. Price works through four steps:
1. It builds that liquidity (**Accumulation**).
2. It sweeps one side with a fake break (**Manipulation**, an FBOS).
3. It proves the fake is over (**RBOS**).
4. It delivers to the opposite liquidity (**Distribution**).

You enter from the order block the manipulation itself created (**IDM POI**). The stop goes beyond the manipulation extreme; the target is the accumulation on the other side.

**Sources** (23 lecture videos, consolidated):
- **A = Arctic ("Davy D Arctic", Apostles Discord), 2026.** A11/A12 = Feb 2026 masterclass, newest and top priority. A04 duplicates A01. A09 = prop-scaling talk; only its legitimate risk rules are kept.
- **B = Arctic 2025 originals** of the same lessons (Apr–Oct 2025).
- **YT = kev.futures "LIT Education"**: a different teacher in the same framework (he credits "RE and Arctic"). kev speaks **NY** time; Arctic speaks **UK** time.
- **(kev pub)** = kev's 4 other public YouTube videos (HTF, rejection entries, PD arrays, a weekly recap). Same rank as YT, used only where they don't contradict Arctic. Third-party public LIT material ranks lowest, labelled when used.
- **Conflict priority:** 2026 > visually confirmed on chart > repeated > older/YT. Tags like (A12) name the video.
- Arctic trades **NQ/ES and EURUSD (with DXY)**. Nothing in the corpus tests gold, so every XAUUSD rule here is **UNTESTED INFERENCE**.
- **"(our default)"** marks a parameter we chose, not the teacher.

**Modes**
- **Teach/quiz:** explain from §3–5 in glossary terms; use §11 for what valid vs invalid setups look like on a chart and §11.11 for ready-made drills. Quiz with scenarios, e.g. "Asia accumulated; London swept the Asia high with vectors and broke the last low. Give bias, POI, SMT, DOL." Correct against the rule and flag single-source or conflicting rules.
- **Chart analysis / trade plan:** walk §1.1 and output §1.2. Size it with §6/§7.
- **Code/backtest:** use §8 and expose every (our default) as a parameter.

### 1.1 Checklist for a chart Sama sends
Walk it in order. Say "can't see X" rather than guess.
0. **Read the chart:** instrument, TF, timezone (convert to NY via §4.1; if unknown, ask or assume cTrader UTC and say so), date, prices.
1. **Weekly (M15 over Mon–Fri):**
   - Is one extreme set by a confirmed weekly IDM? Is the week OLHC (bull) or OHLC (bear)?
   - Is the 50% rebalance done? Is it Friday with the objectives complete?
2. **HTF context:** pd high/low, H1/H4 HTF SMTs, ATH proximity, daily-range breakout, nearest HTF draw.
3. **Asia** (18:00–01:00 NY): Protected or Judas?
4. **London** (02:00–05:00 NY): continuation, manipulation or accumulation?
5. **NY:** who crowned the day's IDM (Asia / London / none yet)? Is a counter AMD forming? Locate price vs 08:30, 09:30 and 10:00.
6. **Current cycle (M15 → M5):**
   - Accumulation box.
   - Valid manipulation end (FBOS of left/external structure or a valid left POI tap), with vectors and immediate rejection?
   - Premium for shorts / discount for longs?
   - RBOS: clean or ugly?
7. **Correlated asset:** ES for NQ, DXY for EU, XAG for XAU (kev only; Arctic names no gold confirmer and excludes DXY, B05 16:01). Divergence, confirmation or decorrelation?
8. **Zones:**
   - IDM POI (blue), refined M5 → M3 → M1.
   - SMTs (pink) between price and POI and between POI and target; apply Rules A/B.
   - Is the order-flow chain still alive?
9. **DOL:** the accumulation opposite the manipulation, then pd H/L, session extremes, equal H/L. Is target-first satisfied? Is price > 50% of the way to the DOL?
10. **Plan:** model, entry, stop (wick + spread), target, R:R (> 3 required), BE trigger, size.
11. **Hard no-trade scan (§5.6).** If anything hits → NO TRADE.

### 1.2 Output format
```
BIAS CARD   Weekly: <OLHC/OHLC/open; set extreme+day> | Daily: <bull/bear/none> | Asia: <Protected/Judas> | London: <Cont/Manip/Accum> | NY crown: <Asia/London/NYSE/pending> | Corr: <div/confirm/decorr/n.a.> | Confidence: <H/M/L>
NARRATIVE   2-4 lines: accumulation -> manipulation (what was swept/tapped, when) -> RBOS? -> where price is now -> DOL.
SETUP       Status: <Waiting manipulation | Manip done, waiting RBOS | RBOS done, waiting POI tap | Live | Invalidated>. IDM POI <range,TF>; SMTs <ranges>; DOL <level>.
ENTRY PLAN  Model | Entry | Stop | Target | R:R | BE trigger | Size (risk $ / lots) | Invalidation
   -- or --
NO TRADE    Reason(s), quoting the rule (e.g. "sweep was mid-range"; "RBOS reached by accumulation").
```
For gold, add the line "XAU mapping = untested inference; backtest before live."

---

## 2. Glossary

| Term | Meaning |
|---|---|
| Liquidity | Clustered entries + stops + closed positions at obvious retail levels. Entries fuel the move into a level; their stops fuel the reversal. |
| Accumulation (A) | Channels, ranges, wedges, triangles, trendlines, equal H/L, gradual trends. "Not balance, it is bait." Tells you **where** price goes. |
| Manipulation (M) | The AMD reversal leg. Ends only by an **FBOS of left/external structure** or a **tap of a valid left POI**. Tells you **when**. |
| Inducement (IDM) | (A11) any liquidity sweep, including in-trend ones. "The IDM" also names the day's/week's main manipulation. |
| HTF IDM level (kev pub) | The **last piece of unbalanced PA** (made off nothing, e.g. relative equal H/L mid-range) in a run of low-resistance liquidity. Price rebalances it before the real expansion. |
| Enticement (kev pub) | A false manipulation in the narrative direction (e.g. a push up on a bull day) before the real inducement the other way. |
| Distribution (D) | Expansion to the DOL. It becomes the next cycle's A ("D→A"). |
| FBOS | False/failed break of structure: a sweep of an obvious swing **against bias** that rejects. |
| IFBOS | **Internal FBOS**: a false break of an *internal* (minor) swing inside a range or re-accumulation, not of external/left structure. It is liquidity, not the manipulation end (A03 12:44 re-transcribed: "there's internal F-BOS... but then taps into a POI, a valid area for manipulation to end"). Arctic's Discord channel #structure-ifbos-fbos was never recorded; definition inferred from his spoken use. |
| IBOS | **Internal BOS**: a break of internal structure used as the confirmation in place of an RBOS (B02 20:12: "you either have RBOS or IBOS"; "no breaks of structure, relative or internal"). |
| RBOS | Real/relevant break of structure: the **last low before the high** (bearish) or last high before the low (bullish), wicked or closed through. It verifies the manipulation is over; it does not end it. |
| Protected H/L | The completed-manipulation extreme. Trade only away from it until a counter AMD. |
| OB | Last opposite-coloured candle before a large move away, wick included (Arctic). kev: any indecisive candle before displacement. |
| POI | An OB you trade **from**: in bias direction, at a structural extreme or in the order-flow chain (blue box). |
| IDM POI / extreme POI | The OB formed **at the manipulation extreme by the manipulation**. Top priority. |
| Order flow (OF) | Re-entry OBs chained off the IDM POI reaction. They die on a counter AMD. |
| SMT | **Smart money trap** = an opposing/fake OB (pink box). NOT ICT SMT divergence. |
| HTF SMT | An opposing OB on H1/H4. Gives a pullback, rarely a reversal. |
| AMD div / AMDD | Correlated-pair divergence in the M phase: one asset sweeps, the other holds. Trade the holder. |
| Counter AMD | An opposite AMD. Invalidates prior order flow, protection and targets. |
| Crown | The session whose manipulation is the day's real IDM. |
| Protected / Judas Asia | Asia with a full AMD / Asia that only accumulated (both sides are liquidity). |
| Fake Asia | Asia on the day after a weekly extreme: looks like accumulation, is distribution. |
| DOL | Draw on liquidity, opposite the manipulation: an accumulation, a structural point or trendline liquidity. |
| Vector candle | Body ≥ 1.5–2× recent bodies AND volume ≥ 1.2× (yellow either direction). The lookback is hard-coded in his private "Apostles" indicator: its Inputs tab (A11 37:10, checked frame by frame) shows only Base Body Size Multiplier 1.5, Base Volume Multiplier 1.2, opacity 80, session boxes hidden above 61 min and an "Arctic Frankfurt" 02:00–02:01 time line. There is no length input, so the course cannot reveal the lookback. |
| 5-3-1 | POI refinement M5 → M3 → M1. |
| Mitigation ("Retest of the Extreme") / RBOS model | Enter at the IDM POI with no RBOS (advanced) / limit at the OB after the RBOS (default). |
| Ping-pong | POI made and left unmitigated → the first SMT bounces price into the POI. |
| OLHC / OHLC | Bull week / bear week candle path (weekly PO3). |
| pd high/low | Previous-day high/low. |
| Template trader | Fades every sweep mechanically, including mid-range ones (the error). |

**Transcript mishearings:**
- RBOS = arbos, elbows, "our boss", Airbus, abos. FBOS = F-boss, F-post, Flosses. "fries entry"/"Fries POI" = chat label, probably FBOS/first entry (unconfirmed). "readers of the extreme" = **Retest of the Extreme**. "HLO" (A06) = "the low", not a term.
- POI = PY, POY, PIO, PMI. OB = "older/water block", Oobie. Order flow = "all the flow".
- DOL = DLL/DRO. But in A09, "DLL" = **daily loss limit**.
- NQ = MQ, Enke, "enqueue". ES = "yes". DXY = "X-ray"/XY. NY = "on yes".
- Manipulation = "many plated", "mini-pidation". AMD = EMD. IDM = EDM. IDM POI = IDMPI. AMD div = "AOD dev". Counter AMD = "account to AMD".
- M50 = M15. FEG/FPG = FVG. PR3 = PO3. "stokey shins" = NYSE. POC = an H1 OB (not volume POC).
- Arctic's "1:30" = 13:30 UK = 08:30 NY. His "2:30" = 09:30 NY.

---

## 3. Core model

### 3.1 Liquidity & structure
- **Only liquidity at range extremes moves price.** Mid-range mini-sweeps are noise. A low sitting inside an FVG holds no meaningful liquidity.
- **Trendlines are "paths of slaughter":** entries at every touch, stops just beyond, then sliced.
  - Stacked SMC OBs (tap → internal BOS → new OB → repeat) get run all at once.
- **Liquidity left beyond a level = not protected** ("house with an open back").
  - Wait for the candle that sweeps all of it.
  - With a cluster of highs, expect the extreme one to be taken.
- **There is no retail "BOS".**
  - A break **against** bias = FBOS (liquidity).
  - A break **with** bias after the manipulation = RBOS.
  - ChoCH = MSS = the same thing.
- **FBOS validity:**
  - Needs an obvious retail swing: equal H/L, a trendline origin, pd/session/Asia extremes, or the previous-week H/L.
  - Typical look: a slow, grinding, trendline-supported push that just exceeds the swing, then a quick return.
  - **Not an FBOS:** a break in the bias direction, or an impulsive break that is then accepted.
  - An internal (minor-swing) FBOS (**IFBOS**) is weaker and does **not** end the manipulation by itself. In a re-accumulation, the IFBOS is bait; the real end is the following tap of a valid POI, then entry from the new POI with the stop at the extreme (A03 12:32–12:58).
- **Weekly lock:** once the weekly low (high) is set, any later break below (above) it that week is an FBOS, not a BOS.
- **External vs internal:**
  - External = the extreme swing of the current range/leg; everything inside it is internal.
  - **Manipulation must take structure "to the left" that matters:** session/pd/previous-week extremes, the start of the accumulation, structure outside Asia.
  - A plain Asia low "means nothing" once bias is set.
  - Internal swings after a vector move are "just liquidity for the trend".
- **Location:** manipulations must sit in the weekly-range **premium for shorts** and **discount for longs**. A mid-week-range sweep isn't manipulation. (A07)

### 3.2 The AMD cycle
**Accumulation → Manipulation (FBOS or POI tap, with vectors) → [SMT pullback] → protected extreme + IDM POI → RBOS → Distribution / order flow → DOL.**
- The cycle is fractal: it runs on H1, M15, M5, M3, M1 and on any market.
- Candle anatomy: bearish = O→H→L→C; bullish = O→L→H→C. "Before being bullish we have to make the low."
- **The manipulation "cannot end until liquidity is induced or a POI is tapped".** There are exactly two end types:
  - (a) an FBOS of a left high/low;
  - (b) a tap inside a valid left OB/POI.
  - A03's extra two (AMD-div, DXY) are correlated-asset versions of these.
- **Validity tests:**
  - **Vectors are required.** "It cannot be inducement without vector candles." A wick one way and a push the other way is not a manipulation.
  - **Immediate rejection.** If price takes the high and keeps pushing, the high won't hold (A11 14:47: took the highs, pushed on, then dropped → won't hold).
  - **Chop or an M5 FVG fill right after the sweep** = it wasn't the manipulation; it's still accumulation. Expect a re-sweep / micro AMD.
  - **Price inside an unfilled FVG → no manipulation:** a sweep/AMD made while price is still trading inside an FVG is accumulation, not M ("manipulation cannot enter a fair value gap", A11 04:39). FVG TF unstated; default = the M5/M15 FVG of the prior displacement (our default; test both).
  - **Fake manipulation:** a sweep in the **same direction as the draw** (e.g. a sweep down on a bearish day) is bait for counter-trend traders. Never fade it.
  - **Enticement cycle (kev pub):** on a bull narrative, a push up out of accumulation that then drops is enticement; the drop is the real inducement and must FBOS the **nearest prominent structural low** to the left before the reversal ("the correct FBOS is the nearest point of prominent structure"). Don't buy the first OB reaction before that low is taken.
  - **A POI tap counts only if no opposite AMD has formed yet.**
- **Reverse or continue at external structure?** No AMD yet today → the sweep IS the manipulation → reversal. AMD already formed → continuation. (A11)
- **Target-first:** no reversal trade until the current AMD's target is taken (on either correlated index) **and not before 09:30 NY**. (A06, 6 Mar 2026: ES's target completed 14:45–14:50 UK; only then were longs permitted.)
- **Bigger or longer accumulation → bigger expansion.**
- **Distribution quality:**
  - Displacement with vectors = good.
  - **Accumulating away** = not enough liquidity was taken → expect a re-sweep of the extreme; stay out or go to BE.
  - Steady build-up in the expansion direction → expect a final push that takes a structural level and reverses. Take profit there.
- **Counter AMD** invalidates all prior order flow and old targets. "An AMD stays in power until a new manipulation in the other direction takes it out."
- **Several nested cycles per day.** **AMD > time:** a valid AMD outside the windows still counts; time only adds confidence.

### 3.3 Vector candles
- Arctic's indicator inputs (A11 37:15, on screen): **Base Body Size Multiplier 1.5, Base Volume Multiplier 1.2** (taught student default: 2× body + volume); both directions yellow. Relative to the preceding candles: a big candle after big candles is not a vector. Lookback/average type not shown.
- Vectors confirm the manipulation, a good RBOS and distribution.
- Arctic's FBOS approaches are often slow grinds. The grind is accumulation; the **sweep or reversal candle** must show vectors or a clear rejection.

### 3.4 Inducement vs manipulation
- YT treats them as the same. **A11 (newer) splits them:**
  - **Inducement** = any sweep, e.g. a trend inducing highs while still making higher lows.
  - **Manipulation** = the AMD M-leg.
- Treating every inducement as a reversal is "why most LIT traders are unprofitable". **Use A11.**

### 3.5 Protected highs/lows
- **What is protected:** the extreme of a completed manipulation (POI tap or FBOS, then a reaction). Not the OBs inside the move.
- **Only "at that stage":** a later counter AMD can take it. Inside an HTF SMT, price may re-induce the clearest structure first.
- **Not protected if:**
  - liquidity remains beyond it;
  - it was formed by an SMT tap rather than a valid POI/FBOS;
  - it pushed off nothing (no PD array);
  - no AMD occurred (a pure channel, or equal lows engineered inside an FVG).
- **Confirmation:**
  - kev: a candle **closes** clearly away after the tap.
  - Arctic: an RBOS, or displacement with vectors.
  - A fat-wick, small-body rejection at the IDM also counts.
- **Then:** trade only away from it; any continuation pullback is valid. A news-made high can be protected.

### 3.6 RBOS
- **Definition (2026, visual):** the last opposite swing before the manipulation extreme, broken by **wick or close**.
- **An RBOS alone is not a setup.** "Many times price gives you an RBOS and it takes you out." It needs a valid manipulation end first.
- Students must wait for the RBOS; experienced traders may enter without it.
- **An RBOS formed in Asia is valid structure** (A11 09:16). Only the Asia H/L as an *inducement* is fake (§4.5).
- **Ugly/fake RBOS → skip:**
  - (a) price **accumulates into** the RBOS (slow grind, no displacement);
  - (b) an RBOS candle that immediately flips back ("the candle just flipped itself", A11 17:15) → treat it as an FBOS; same if no real manipulation preceded it ("distribution to distribution");
  - (c) an RBOS taken from **previous** structure instead of current structure;
  - (d) a choppy, overlapping, wedge-like reclaim.
- **Good RBOS** = a displacement candle closing through the swing.
- **Div variant ("RBOS 2"):** with NQ/ES div, the protected index may use the nearer internal swing formed while the other index made its extreme. Very high confidence. (A11)

### 3.7 OBs, POIs, order flow, refinement
- **OB:**
  - The last opposite-coloured candle before a large move away (usually one), **box including the wick**.
  - If none exists, use kev's indecisive candle, checked on M1.
- **Same box: POI or SMT, depending on bias.** "If you want it to hold it's your POI, if not it's your SMT." The reaction tells you which.
- **IDM POI first.** "I only take POIs that have induced structure beforehand." An OB not made by an inducement is just a normal POI.
- **Which POI after the RBOS:**
  - Three candidates: the **extreme** (manipulation OB), the **first OB after the RBOS**, or the **latest re-accumulation / re-AMD OB**.
  - **Take the most recent one formed** (B06 15:38: he drops "closest" for "most recent"; it must be a clean AMD with an RBOS). If price builds a re-AMD and leaves without revisiting the extreme, use the re-AMD OB.
  - Preferred fill = an **extreme mitigation** (deep into the IDM POI's extreme candle). A shallow "overall" near-edge tap can still deliver (A07, 16 Jul 2026 NQ): lower-quality fill, not an invalidation.
- **Valid location:** structure extremes (premium/discount, range top/bottom) or the OF chain only. "Mid-range is noise." Daily/HTF OBs count.
- **Invalid:**
  - mitigated OBs (use the newest);
  - OBs formed out of consolidation ("usually never work");
  - all-mitigated HTF zones;
  - a big "general area" box built from the current day's PA. Refine it to the first 2–3 OBs or an M3 OB. Big zones are only for HTF structure to the left, and still need an RBOS or OF.
- **FVGs:** Arctic says "we don't use FVGs"; kev uses them. Use OBs for Arctic-model entries. kev (pub) takes an FVG reaction only after price first **ran through an OB in front of it**, with a rejection; FVGs are "never permanently protected" (valid targets once the cycle completes). kev-variant only (§9).
- **Order flow:**
  - OBs created by price reacting off the IDM POI, each linking back in a chain. "Can't take one in the middle made out of nothing."
  - The chain must produce breaks in its direction: the next OF OB is taken only after price takes the previous low/high in the trade direction (A02 15:41).
  - It ends when a link isn't re-tapped or there is no OB on M1.
  - Usually 1–2 OF entries come before expansion.
  - **Valid only while its AMD "remains king".**
  - If price leaves without tapping your next OB and starts a new chain → **you're out; don't enter the new chain** (exception: an FBOS entry). Keep resting limits only on the next OB of the current chain (A11 18:17).
- **5-3-1 refinement:**
  - Mark on M15/M5, refine M5 → M3 → M1, and pick the TF by stop size (NQ: M5 OB ≈ 40 pts, M3 ≈ 33).
  - **Refine for size, not for mitigation.** A normal-sized OB that was only wicked into stays whole ("just mark the whole zone", A06 06:45). Only a **massive** OB (stop too big) is refined to the LTF OB "that makes the difference". Never refine into a sub-zone that made no OB.
  - An M5 POI inside a range → go higher TF.
  - A re-accumulation forming before your POI → that becomes the new entry.

### 3.8 Smart money traps (SMT = opposing OB)
- **Definition:** a fake OB around the FBOS that traps retail. It forms fast, looks perfect and fails once retail piles in: the last liquidity before delivery. kev: every OB opposite the eventual expansion is an SMT.
- **Side (visually resolved):** the OB at the **origin of the FBOS leg, on the other side of the swept level**. It points in the FBOS direction, against bias.
  - FBOS below a low → SMT = the bearish OB above (traps shorts).
  - FBOS above a high → SMT = the bullish OBs below (traps longs).
- **Law of dual traps:** the FBOS deceives one side, the SMT the other.
- **Once the bias/extreme is set, every opposing OB to the left is an SMT.** Mark them all first. A zone's label follows the day's extreme, not the order it formed in (A08, 22 Jul 2026: a chat "POI" became an SMT once the LOD printed).
- **Types (A11):**
  - **Type 1, manipulation-phase SMT:** "mostly non-tradable, designed only to deliver price into the true POI" (A02 post). **Never trade it** (a student lost a $100k account on these).
  - **Type 2, FBOS SMT** (made by an FBOS in accumulation): "can be tradable, often guiding price into the next structural POI before being invalidated".
  - **Type 3, SMT-first:** the manipulation taps the SMT, then goes to the POI.
  - An opposite mini-AMD inside distribution can act as an SMT.
- **Rule A:** SMT **not tapped** before the POI → it gets run through. kev (pub): an SMT gives a false reaction, then is blown through, usually within ~30 min (HTF SMT: up to a day).
- **Rule B:** SMT **tapped** before the POI → it pushes price into the POI, then gets taken out (A02 post). Creed: "The SMT deceives, the herd obeys, order flow delivers the truth."
- **Ping-pong:** POI left unmitigated → the first SMT gives a counter-move into the POI. Arctic himself refrains from trading these.
- **Speed bumps:** after the POI is mitigated, SMTs between price and the target slow price, then get run. When none remain → expect expansion.
- **Tradability:**
  - **Never use an SMT as a reversal POI against bias.**
  - A counter-scalp is allowed only under Rule B / ping-pong toward an unmitigated POI (low priority).
  - Preferred: enter **with** bias after price rejects from an SMT.
- **HTF SMT (H1/H4; refine to the M15 OB inside):**
  - Gives a **pullback, not a reversal**; size scales with TF. "SMT creates the trap, IDM crowns the reversal." **Not every HTF SMT gives a pullback**; some get run through (A10 03:00).
  - Week's extreme already set (e.g. Monday low) → expect at most one clean no-inducement continuation through HTF SMTs per week; at a later tap, trade the pullback only after an inducement (London sweep) + RBOS (A10 08:43, single example).
  - Range expansion off it only if the narrative has no reason for the opposite move.
  - Inside it, price must induce the clearest structure first.
  - Trade only **clean, unmitigated** ones (first wick in; daily-open confluence a plus).
  - Inside it, wait for the LTF AMD (sweep → displacement RBOS) → IDM POI → target the closest valid structure. An ugly RBOS here = low confidence.
  - Near ATH, an HTF SMT → expect a push lower hunting HTF structure.

---

## 4. Bias & time

### 4.1 Clocks
- Arctic's charts and spoken times are **UK local** (label "UTC" in winter, "UTC+1" in summer). kev speaks **NY**.
- **NY = UK − 5 h.** In the **DST-gap weeks** (2nd Sun Mar → last Sun Mar; last Sun Oct → 1st Sun Nov), NY = UK − 4 h.
- cTrader defaults to UTC: pin one timezone and convert.
- Arctic gives windows in UK time; in gap weeks the anchor is untaught. We anchor to NY (our default).

| Event | NY | UK | UK gap weeks |
|---|---|---|---|
| CME reopen / Asia start | 18:00 | 23:00 | 22:00 |
| "Tokyo" | 20:00 | 01:00 | 00:00 |
| Midnight open | 00:00 | 05:00 | 04:00 |
| Frankfurt / London open | 02:00 / 03:00 | 07:00 / 08:00 | 06:00 / 07:00 |
| Arctic London window | 02:00–04:00 | 07:00–09:00 | 06:00–08:00 |
| COMEX gold open (inference) | 08:20 | 13:20 | 12:20 |
| US data candle | 08:30 | 13:30 | 12:30 |
| Arctic NY window (FX) | 08:00–10:00 | 13:00–15:00 | 12:00–14:00 |
| Arctic NY window (indices/NQ) | 08:00–13:00 | 13:00–18:00 | 12:00–17:00 |
| NYSE open "crown" | 09:30 | 14:30 | 13:30 |
| Order release + H4 open | 10:00 | 15:00 | 14:00 |
| London close | 11:00–13:00 | 16:00–18:00 | 15:00–17:00 |
| "Seal" / FOMC | 14:00 | 19:00 | 18:00 |

### 4.2 Timeframes & workflow
- **M15** = bias, narrative, manipulation, weekly view.
- **M5/M3** = execution.
- **M1** = refinement, for experienced traders only (mostly after 09:30).
- HTF SMTs on H1/H4. DOL search order: M15 → H1 → Daily.
- Use M15 to decide whether an M5/M1 move is accumulation or distribution.
- **Order of work:** weekly → daily → Asia → London → NY → correlated check → execute.

### 4.3 Weekly profile & weekly-inducement process (A05, B08)
- **The weekly candle is an AMD:**
  - Bull week = **OLHC**, bear week = **OHLC**. "A weekly candle can't open, go lower, go higher, go lower again."
  - Template: Mon accumulates, Tue and Thu print the extremes, Wed expands, Fri closes. **Weak prior:** in 8 replayed weeks Monday made an extreme 5 times.
  - A late (Thursday) extreme is more likely the other side of the week.
1. **No extreme confirmed yet →** trade intraday AMDs in both directions.
2. **Weekly IDM =** a manipulation beyond the weekly open or external structure (previous-week H/L, external swing, daily inducement, HTF SMT).
   - Ideal timing (A05 Discord, B08 01:40): **07–09, 13–15, 16–18 UK = 02–04, 08–10, 11–13 NY**; NQ 13–18 UK (08–13 NY). A weekly H/L printed inside these windows is "often the true crown of the week". Example: EURUSD Tue 11 Mar 2025 weekly high at 18:00 UK, IDM-POI retap Wed 16:15 UK (B08; chart TZ ±1 h). Convert via §4.1, minding DST-gap weeks.
   - Ideally into an HTF POI, ideally with a correlated div.
3. **Confirm it** (our synthesis; A05 only says "time, practice, loads of markups"):
   - (a) a fat vector expansion away, leaving the "OB of the low/high of week";
   - (b) distance from the weekly open in the trend direction (EU ≈ 40 pips);
   - (c) **the next day is strongly directional** ("the hack");
   - (d) divergence.
   - Re-accumulation right after the sweep = won't hold → expect a deeper sweep.
4. **Bias locks:**
   - Mark every opposing OB to the left as an SMT.
   - Take **only AMDs in the weekly direction**.
   - Breaks against the extreme = FBOS.
   - A 15-min AMD aimed back at the extreme is a trap.
   - Weekly-direction POI = the OB of the weekly extreme, refined with the daily open.
5. **Fake Asia** the next day. A plain Asia sweep with no POI tap and no structure taken outside Asia is not a manipulation.
6. **Premium/discount-of-week filter** (shorts in premium, longs in discount).
7. **The other side** = an AMD into a valid opposing OB built by a chain of mitigations, with div (often Thursday). Bias then flips.
8. **After both extremes:** the week rebalances to the **50% of the weekly range** (Gann box 0.5) and tends to close around it. Target the liquidity in the 50% area ("not blindly"); price can react at 0.5 or go deeper (A05).
9. **Week done** (low, high and 50% complete) → it accumulates (usually Friday); news won't move it; **no trade**.
10. **Trade only days aligned with the weekly candle.** 2–3 of 5 days with no entry is normal; aim for 1–2 POI days per week.
- **(kev pub) weekly notes:** decide OLHC/OHLC from the unprotected HTF highs/lows (draws). The weekly manipulation is usually an intraday distribution leg taking HTF draws to the left. Once the LOW of week prints, **sells hold only to accumulation lows; buys hold to the draws** (mirror for HOW). A failed Friday expansion → that low is re-induced next week.

### 4.4 Daily
- **The M15 AMD sets intraday bias.** "The main POI of the day is crowned inside this cycle." It stands until a counter AMD.
- **No trade:**
  - inside a range with neither extreme protected (wait for the breakout);
  - an inside day;
  - Asia, London and NY all doing nothing.
- **HTF overlays:**
  - A daily-range breakout → expect a rebalance back into the range.
  - Near ATH, inducement lows get taken and price returns to ATH.
  - "An HTF manipulation never comes from a mitigation; it needs inducement." Near ATH, build-up lows get swept before each ATH leg; a bare POI tap there is not an HTF manipulation (B02, Oct 2025 NQ).
- **kev:** if the prior PM took the HTF draws but chopped, Asia makes the expansion and the HOD/LOD.

### 4.5 Sessions
- **Asia (18:00–01:00 NY; box edges ±1 h):** either accumulation (a springboard, ~80% per kev) or an AMD.
  - **Protected Asia** = a complete AMD inside Asia (POI tap or FBOS of a left H/L, then a push away), checked on M5. Its extreme holds: "even though you sweep the Asia high you keep longing". A correlated div also protects it.
  - **Judas Asia** = accumulation only (channels, engineered equal H/L, swings inside FVGs). Both sides are liquidity → a swing day (one side taken, then the other).
  - **Never fade a plain Asia high/low sweep.** Count only structure taken outside Asia.
  - Asia "manipulations" inside an HTF build-up are just liquidity; 09:30 is often the real one.
  - Arctic doesn't trade Asia and says students aren't ready for it.
  - (kev pub) Asia defaults to chop: an Asia **reversal needs an M3/M5 RBOS + a retrace into the IDM POI**; no M1-only Asia reversals (M1 continuations are fine once direction is confirmed). Asia H/L aren't protected unless Asia made the HOD/LOD. Prior PM induced + failed to expand + HTF draws met → Asia makes the LOD/HOD expansion.
- **London (02:00–04:00 NY, the "engine")** has 3 outcomes:
  1. **Continue** Asia's IDM.
  2. **Manipulate** the Asia/Frankfurt accumulation ("London sets the AMD"; its extreme is then protected).
  3. **Keep accumulating** → NY decides.
  - Frankfurt (02:00 NY) is a frequent EU trigger. 05:00 NY still counts as London.
  - London only **mitigated** (no inducement) → treat it like Asia: NY may reverse if there is an HTF draw.
  - London took **both** Asia extremes → expect a reversal around 09:30 toward the opposite London extreme (kev).
- **NY crown model (NQ):**

| Day's IDM before 09:30 made by | Expect |
|---|---|
| Asia | London/pre-NY continue; NYSE expands from Asia's crown. **NY may reverse only via a counter AMD that taps a valid HTF POI or sweeps significant liquidity** (Asia IDM = over-extended → pullback; A12 56:55 + Discord). |
| London | NYSE usually continues London's direction, into the next DOL. |
| Nobody | **NYSE crowns its own IDM:** a sharp sweep of the next valid structure (start of the accumulation, pre-NY wedge/channel extreme), then decisive delivery (B02 Discord: "if we haven't induced structure prior to NYSE"). |

- "9:30 crowns, 10:00 commits, 14:00 seals." It assumes no counter AMD: "don't template, be reactive".
- A manipulation within ~10 min before 09:30 (on a day with no inducement yet) is unconfirmed: wait for 09:30, the first 30 min of the hourly candle. It confirms (distributes away) or re-manipulates, and the re-manipulation is the real one (A08 02:40). But a clean 08:55 ES sweep (NQ did nothing) + ES RBOS still made the LOD (A08).
- **Don't trade the 09:30 candle.** Trade the M1 AMD/expansion after it.
- No setup (or no ES confirmation) in the first NY hour (08:30–09:30) → wait for the 09:30 crown, then trade the vectors (A06 22:02).
- (kev pub) 09:30 two cases: inducement before 09:30 with only a rejection → 09:30 expands straight; inducement **and** expansion already done → 09:30 retraces into the IDM POI first. Pre-09:30, mark unmitigated M5/M15 OBs above and below: "no mitigation = no inducement trade".
- An **untapped POI** overrides an early 09:30 move (SMT → POI first).
- **10:00** = order release + new H4; post-CPI chop often resolves here.
- **10:00–14:00** = "true delivery". **14:00** = seal.
- London close (11:00–13:00 NY) = possible unwind, now mostly on EURGBP.
- **kev's key times (NY)** — confluence only:
  - 18:00, 20:00, 00:00, 01:00, 02:00–03:00, 03:30 ±10 min, 05:30, 09:30.
  - Only inducements **at** a key time count. Don't look for reversals before the time.
  - A HOD/LOD made at a key time is likely protected.
- **Daily cap:** max **1 London + 1 NY trade**, 1% each; a London win = done for the day; after a London loss NY is allowed at 1%, no doubling (A12 notes). See §6.

### 4.6 Forex checklist (top-right of every Arctic chart)
1. Is the Asia session Judas or Protected?
2. What did London do: Continuation or Reversal?
3. Is the weekly candle on your side?
4. (our default) Did the correlated asset confirm?

### 4.7 News
News seeks liquidity via the weekly IDM and the HTF DOL ("structure amplified by volume"). Arctic's rule (B12 04:07, 09:27): **"News will either print in the direction of the weekly or be the catalyst for the close."** Extreme still missing → weekly direction; both extremes in → catalyst for the close. Before the release, ask where the weekly candle is:

| Weekly state | Expect |
|---|---|
| Low of week set, high missing, IDM POI just tapped, external highs above | News expands the week up; it can't be bearish (mirror for a set high). |
| Mid-week, after an extreme | News prints in the weekly-IDM direction. |
| Late week (NFP Fri), second extreme missing | Prints in the weekly direction to make it; may first dip into an internal OB (B12 case 1). |
| Both extremes in, Thursday made the high | Friday closes the week the other way (one example: EU NFP 4 Apr 2025). |
| Low, high and 50% all done | News does nothing → stand aside. |
| Candidate extreme reacted off nothing | Not the weekly extreme; news goes the other way. |

- **The news candle can be the manipulation** (it sweeps a H/L or taps a POI, then pushes away). The news H/L is then protected: trade away from it; don't fade it with the first counter-MSS (B03, Sep 2025). A news reversal needs an inducement taken.
- **CPI (A07, one example):** when the weekly candle has **no confirmed extreme** yet, trade the CPI move as its own AMD (sweep of the London low with NQ/ES div → vector → RBOS → entry). After the first move expect chop until ~10:00 NY, then a fresh sweep + div to re-enter. kev (pub): CPI/FOMC often becomes the weekly manipulation when low-resistance liquidity has built into it.
- The news-candle H/L becomes the target for an opposite AMD.
- Two releases can form one AMD (08:30 induces, 09:45/10:00 delivers).
- Never "full-port" news.

### 4.8 Correlated divergence
**NQ/ES AMD div:** in the M phase one index FBOSes a high/low and the other protects it. "The one that swept = liquidity; the one that held = the trade." Either index can lead. It is NOT ICT SMT divergence.

| Context | Rule |
|---|---|
| Pre-09:30 | Level must **stand out** as an obvious swing in that block of PA on M15; enter by market on the sweep (stop at the div) or at the refined OB (A06 27:33). |
| Post-09:30 | Any H/L, **if an accumulation precedes it**. |
| Main LOD/HOD | **Both** must manipulate *something* (internal on one + external on the other is fine, A08 18:28). A single-index div is not valid here; an internal div only around 09:30. A pool already swept the prior day = invalid. Single-index divs are fine for 2nd/3rd AMDs. |
| NQ reversal | Example only (B06 28:15, garbled): a reversal against an HTF-SMT context with a messy one-sided sweep was rejected for continuation. Not a general rule; the Main LOD/HOD row governs. |
| Both sweep the same level | Weaker; the div is the upgrade. |
| Strong decorrelation | No trade / lower confidence. |

- **Entry:**
  - Aggressive = market on the protected index as the other sweeps.
  - **Default** = a confirming close, then the next-candle pullback, or RBOS 2 → OB (A06 34:26: "that would have been confirmation"). Div trades are discretionary: "don't spam it everywhere".
- **Stop** beyond the protected level "to the left". **Add** at the refined OB. **Target** = the AMD target or the news-candle H/L.
- "M1 AMD div + RBOS + POI = textbook." Pick the cleaner index each day.
- **kev's split:**
  - **Manipulation div:** at prominent left structure during M; strong in Asia.
  - **Distribution div:** at build-up extremes during D. After 09:30 it brings quick reversals; otherwise the laggard usually takes the level too.
  - On bearish-draw days a bullish div gets run; trade its pullback back down.

**EURUSD/DXY:**
- "DXY speaks first, EU obeys." An EU sweep DXY doesn't match = fake (still accumulation), even with an RBOS.
- **Entry:** at the **minute DXY taps its POI** (or its M1 OF OB), enter EU the opposite way, ideally with an EU OB at the same price, with a **3-pip stop** (stop size, not offset). DXY POI large/messy → refine it to an LTF POI and wait for that tap; the stop stays 3 pips (B05 16:19). The claimed ~80% hit rate is anecdotal; A03's example times are unverified.
- EU direction only after DXY leaves its SMT.
- Exit EU when DXY reaches its target/POI first, or if DXY taps its POI and EU doesn't react (B05 15:20).

**Gold:** "**Gold does not listen to DXY.** DXY mostly strong on EU. Everything else you leave." (B05) Never port the DXY timing entry to XAU. See §7.

---

## 5. Execution
**Prerequisites for every model:** a valid accumulation, a valid manipulation end (FBOS of left/external structure or a POI tap) with vectors and rejection, and all bias filters passed (weekly side, premium/discount, session narrative, correlated check).

### 5.1 Entry models
1. **Mitigation model / "Retest of the Extreme" (advanced, not for students; B02 20:25).** "When manipulation has clearly ended. No RBOS needed. Enter at the extreme POI born from inducement."
   - Needs high confidence that the manipulation has ended; no BOS of any kind (RBOS/IBOS). Enter on the rejection candle at the retest of the manipulation extreme (often a second tap of the extreme zone).
   - Enter as price displaces off the OB: that candle or the next.
   - Best R:R, most stop-outs.
   - kev's NY-AM primary is the same idea: inducement into an M5/M15 OB → confirmed rejection → enter.
   - A blind limit with no rejection "gets run through".
2. **RBOS model (default):**
   - Wait for the last H-before-L (or L-before-H) to be wicked or closed (A12 01:13 + Discord: a wick suffices).
   - **Limit at the OB that caused the RBOS** (IDM POI / first opposite candle of the displacement; "OB open or wick high": both offered, no default, wick included "in case price digs deep", A02 08:30).
   - **Stop at the manipulation H/L.**
   - If the extreme isn't re-tapped, use the most recent re-accumulation/OF OB.
   - kev: NQ often doesn't return in NY; the model works best in Asia NQ and on EU.
3. **Next-candle 50% body (kev's default):**
   - (i) Price taps an M5/M15 OB at the end of a vector inducement.
   - (ii) Wait for the **confirmation candle**: the first candle that **closes** decisively away. A wicky first rejection doesn't count; if the next candle closes strongly back, keep waiting.
   - (iii) On the **next** candle, limit at **50% of the confirmation candle's BODY**. A later retrace to that level is still valid.
   - Stop beyond the rejection extreme. Don't enter on the close itself.
   - Fails when price respects the OB repeatedly before leaving.
   - **(kev pub) execution:** the M1 wick forms in the first ~15 s, ~30 s is the test (resume or flip), the last ~15 s pulls back. kev **market-orders as the entry candle pulls off its wick** (first 5–15 s) instead of resting a 50% limit. Rejection entries **almost only in NY AM** (IDM-POI retraces in Asia/London); never against a ~100-pt opposite candle.
4. **Divergence entry** (§4.8).
5. **FBOS entry** (on the sweep itself): exists, "really for forex". Arctic rarely uses it.

- **Second touch:** if the first touch of a level is itself the inducement, take the second touch.
- **Classic invalid entries:** before the OB existed; no RBOS; inside a range; no break.

### 5.2 Stops
- Place beyond the **manipulation extreme / protected H/L / OB wick**, plus spread.
  - Div trades: beyond the protected level.
  - OF entries: the OF POI's H/L.
  - Variant: below the pd low under the manipulation wick.
- **Never shrink or skip a stop.** If it's too big, wait for an OF re-entry, refine 5-3-1, or cut size.
- **Caps:**
  - NQ OB entry: **SL ≤ 20 pts** (A12 14:16). Larger → wait for an OF OB; if a fat OB is still taken, size down (micros / 1 mini, A12 02:56). kev 15–20 normal, declines 50–100 (pub). His shown NQ stops often run 25–42 pts: a guideline.
  - EU 3 pips off a DXY tap.
  - His stops are **0.014–0.14% of price, typically 0.03–0.10%**.

### 5.3 Targets (DOL)
1. **Default:** the far extreme of the accumulation that preceded the manipulation.
2. Then: Asia H/L, **pd H/L**, London H/L, equal H/L, swing-low clusters, the news-candle H/L.
3. HTF-SMT pullback trades: the closest valid structure; the **daily open** when the HTF SMT caps price.
4. Weekly: the opposite external structure / previous-week H/L, then the liquidity near the weekly 50%.
5. Ping-pong: the POI.

- Don't expect the full DOL against a bigger draw. A new AMD cycle cancels old targets.
- **Partials:** no % rule. "Two DOLs: partial at the first, full at the second." Exit when the final push of a build-up induces.
- **R:R ≤ 3 = skip.** He refused a 3.6R trade, calling it "1 to 3… not worth it"; the smallest planned trades he took were ~4.6–5.3R. Treat > 3 as the hard floor, ~4R+ as his practice. Shown trades run 2.3R (closed early) to 143R, median ~10. kev: "a consistent 6R" beats chasing 20R.
- Prop phase: fixed TPs (§6).

### 5.4 Break-even
- **Default (A11):** move the SL to BE after price **breaks structure twice away from entry on the entry TF**, counting only swings formed after entry.
- Also BE or exit if price grinds away instead of displacing.
- An early BE at the first reaction is only a discretionary "unsure" exception.
- A BE is information ("price wasn't ready") → look for the re-entry.

### 5.5 Adding & re-entries
- **Pyramid (kev):**
  - #1 the rejection entry;
  - #2 the IDM POI on the retrace (stop at the protected extreme);
  - #3–4 order-flow OBs (stop at the OF POI).
  - Arctic: POI, then refinement/OF, then NY re-entry. Div trades: market, then add at the OB.
- **After missing the first AMD:**
  - (a) a re-accumulation + micro AMD into an IDM POI;
  - (b) a "random" swing placed, pushed away from, re-induced and reclaimed;
  - (c) a late entry from the next OF POI once the side is protected.
- **Filters:**
  - **No re-entry once price is > 50% of the way to the DOL.**
  - Never on plain chop: you need an inducement or micro AMD.
  - On a re-sweep, wait for the OB tap + RBOS. A post-09:30 re-entry off an M3 OB without an RBOS is invalid; the same zone is acceptable only as a div entry (A08, 22 Jul 2026, 09:48 NY).

### 5.6 Hard no-trade list
- **No valid manipulation:**
  - only accumulation;
  - no left/external structure taken;
  - a sweep inside FVGs or mid-range;
  - a template sweep of a plain Asia H/L;
  - no vectors;
  - no immediate rejection, or chop after the sweep;
  - a fake manipulation in the draw direction.
- **Against the bigger narrative:**
  - a counter-weekly AMD, or one aimed at a set weekly extreme;
  - Friday after the weekly objectives are done;
  - an inside day or dead sessions;
  - inside a range with nothing protected.
- **Bad RBOS:**
  - an RBOS without a valid manipulation end;
  - an RBOS reached by accumulation;
  - an ugly or overlapping RBOS.
- **Bad zone:**
  - an SMT used as a reversal POI;
  - any manipulation-phase SMT;
  - mitigated OBs, OBs out of consolidation, OBs not linked to the IDM;
  - no M1 OB to continue the chain.
- **Stale or late:**
  - old order flow after a counter AMD;
  - a missed new chain;
  - a re-entry > 50% to the DOL.
- **Numbers:** R:R ≤ 3; a stop over the cap with no OF alternative.
- **Timing:**
  - a reversal before the target is taken or before 09:30 (NQ);
  - the 09:30 candle itself;
  - after CPI's first move until a fresh sweep (~10:00).
- **Correlation:**
  - decorrelated pair;
  - a one-sided main-LOD/HOD div away from the open, or a div on an already-swept pool;
  - EU without DXY confirmation;
  - gold traded off DXY timing.
- **Caps:** after a London win; DLL hit.
- **Students:** no M1, no Asia, no mitigation model.

---

## 6. Risk & prop-firm rules (legitimate only)
- **Fixed cash risk, identical on every trade.** CFD plan (A12): **1% per trade**, still 1% in drawdown. "You'd have to lose exactly 10 in a row" to blow a 10% account; after 10 straight losses, stop and re-evaluate.
- **Stop too big → cut size, never the stop.**
- **Daily loss limit:**
  - A09: hard **1.5R DLL** on the platform → one full loss = done (whiteboard: 1R = $500, DLL 1.5R = $750; "TP 1.5" at 29:08 is a misspeak).
  - A12 (on-screen notes): 1% in London, 1% in NY; London win → leave; London loss → NY at 1%, no doubling. His frame: 200k CFD, 10% max DD, 5% daily. Use Sama's actual FundingPips limits instead.
  - Resolution: allow a second trade only if the DLL ≥ 2R. **A win always ends the day.**
- **Fixed TP while building a prop buffer (A09 whiteboard):** **3R** in payout cycle 1, **2R** in cycles 2–4, fixed SL, "no partial" ("just take it 3R, don't get greedy"). With win-ends-day this also caps the day. A smaller TP raises the win rate. **Never lower standards to hit it.**
- **Prop TP regime:**
  - Challenge / new funded: **fixed TP** (A09: 3R then 2R; A12 NQ futures: 2 minis × 50 pts, or 1 mini × 75 pts when the OB/stop is too big for 2 minis at $300–400 risk; points, not liquidity). Gold: keep the R-based fixed TP.
  - Variable/DOL targets only after "a couple of max payouts" (A12 01:47).
- **Payout cycle / buffer:** the structure transfers, the numbers are firm-specific. e.g. N profitable days → payout; leave a buffer. Buffer ÷ R = stop-outs you can absorb.
- **Selectivity:**
  - 1–2 POI days per week is normal; "trade less, win rate goes up".
  - Journal one slide per day: screenshot, checklist, P/L %, emotions. Add monthly stats.
- **Copier / linked accounts (our default):** one stop hits every account, so count the DLL and losses portfolio-wide.
- **Always verify the firm's current rules:** daily/max DD basis, news restrictions, minimum days, consistency.

---

## 7. Gold (XAUUSD): UNTESTED INFERENCE
**What the sources say about gold:**
- Arctic: "Gold does not listen to DXY." DXY is for EU only.
- kev: **gold vs silver** is an AMD-div pair. This is the only positive gold statement. Arctic names no gold confirmer (B05 16:01); kev's 4 public videos and the public web have no gold content.
- "Works on any pair" (cocoa, crude, EU, NQ). The Asia logic "applies to every pair".
- Some behaviour is NQ-specific: wedge two-sided traps and no-retest vector delivery "doesn't really happen on other pairs".

**Ports (structure-only, unvalidated):**
- M15 AMD bias; manipulation end; protected extreme; RBOS and its ugly variants; IDM POI and the most-recent POI.
- SMT rules A/B, speed bumps, OF validity.
- Protected/Judas Asia; London's 3 outcomes; the weekly process and news table.
- Filters (mid-range, FVG, chop, > 50% to DOL); two-BOS BE; R:R > 3; the risk rules.

**Doesn't port:**
- the DXY minute entry and DXY fake-move veto;
- the 3-pip stop and NQ point caps;
- the 09:30 single-candle crown as a given;
- the futures prop plans.
- DXY may at most be tested as a context veto (skip a gold reversal into a strong opposite DXY expansion). Drop it if expectancy doesn't improve.

**XAU/XAG divergence (proposal):**
- Sync both symbols' TFs and clocks.
- **XAG sweeps a distinguishable level and XAU holds → trade XAU** from the protected side. Stop beyond XAU's protected level; add at XAU's refined OB.
- XAU sweeps and XAG holds → XAU is the liquidity side: skip, or wait for an XAU RBOS + POI.
- Port the NQ/ES validity table (§4.8), using the gold open in place of 09:30.

**Gold "crown" candidates** (test which acts like NQ's 09:30): **08:20 COMEX, 08:30 data, 09:30 equities, 10:00 NY**. London 02:00–04:00 NY; Asia 18:00–01:00 NY.

**Stops:**
- His stops run 0.03–0.10% of price (0.14% wide); "≤ 20 NQ pts" ≈ 0.08%.
- At $4,000 gold: 0.03% ≈ $1.2, 0.07% ≈ $2.8, 0.10% ≈ $4.0, 0.14% ≈ $5.6. **A usable gold stop is roughly $2–6** beyond the wick, plus spread and buffer. Rescale to the live price.
- Calibrate from history: entry-to-wick distance + MAE on valid setups.
  - Cap ≈ the 75th percentile (our default). Above the cap → skip, or wait for an OF re-entry.
  - Add a buffer for 08:30 and rollover spread spikes.
  - Keep R:R > 3 after costs.

**Vectors on cTrader CFDs** use **tick volume**; validate the 1.5×/1.2× thresholds on gold.

**FundingPips sizing (our default; verify firm rules):**
- Risk **1%** per trade (e.g. $100 on $10k).
- Lots = risk$ ÷ (stop$ × oz per lot). E.g. $100 ÷ ($3 × 100 oz) = 0.33 lots. Check the symbol's contract size.
- Personal **DLL 1.5R** as a hard equity guard.
- Max 1 London + 1 NY trade; any win or a full loss ends the day.
- **Fixed TP 2–3R** on challenge / new funded accounts. DOL targets once a payout buffer exists.
- Two-BOS BE.
- Check the firm's news rules before CPI/NFP (08:30 NY) and FOMC (14:00 NY).

**Prior evidence:** Sama's earlier backtests found no edge in generic OB/zone XAU entries (H4 S/D + M15 BOS) or in a 09:30/10:00-candle model on gold. LIT is not identical, but this is a strong reason to **backtest before live risk**.
- Data: M5, multi-year, split by session and direction.
- Start with the cleanest subset: M15 manipulation of a session/pd extreme → M5 RBOS → limit at the IDM POI → accumulation target.
- Run it with and without the XAG-div filter.

---

## 8. Mechanical spec (coding/backtesting)
The teacher is discretionary. Every (our default) is a tunable parameter. Bars are OHLCV; volume = tick volume on CFDs. Convert all times to America/New_York. **Avoid look-ahead:** pivots confirm only after their right-side bars close.

- **Sessions (NY):**
  - ASIA [18:00, 01:00); LONDON [02:00, 05:00); NY_AM [08:00, 12:00); NY_PM [12:00, 16:00).
  - Arctic windows 02–04, 08–10, 11–13. Key times {18:00, 20:00, 00:00, 01:00, 02:00, 03:00, 03:30, 08:20 gold, 08:30, 09:30, 10:00, 14:00}, ±10 min (kev gives ±10 only for 03:30; applying it to all is our default).
  - Trading day starts 18:00 NY; week = Sun 18:00 → Fri 17:00. pd H/L on that boundary (our default).
- **Swings (our default):**
  - Fractal pivot `L=R=2` on the analysis TF (M15 narrative; M5/M3 execution).
  - External = the extreme of the current leg/range, or a session/pd/previous-week extreme. Internal = the other pivots.
- **Vector:**
  - `body ≥ 1.5 × mean(body, N)` AND `vol ≥ 1.2 × mean(vol, N)`, over the preceding N bars. N = 10 (our default; the course never reveals N because it is not an input in his indicator). Calibrate N ∈ {5, 10, 20} by matching the yellow candles on his charts (e.g. NQ M5 Tue 24 Feb 2026, where the 09:30 drop and the rally legs are yellow). On gold, use tick volume.
  - Direction = sign(C − O).
- **Accumulation (our default):**
  - ≥ 8 M15 bars (≥ 12 M5) with range ≤ 3 × ATR(14), or a regression channel with R² ≥ 0.6 and ≥ 2 touches per side.
  - Store acc_high and acc_low.
- **FBOS (bearish; mirror for bullish):**
  1. L = an obvious external level: a session high, pd high, previous-week high, acc_high, or equal highs (within 0.1 × ATR, our default).
  2. High > L by ≥ 1 tick.
  3. A close back below L within 3 bars (our default; "immediate rejection").
  4. ≥ 1 vector in [sweep − 2, rejection + 2] (our default).
  5. No 2 consecutive closes above L.
  6. The sweep is in the premium half of the weekly range (the daily range if the week isn't formed yet; our default).
  7. Price is not trading inside an unfilled FVG at the sweep (A11 04:39; FVG TF = M5 or M15 of the prior displacement, test both; our default).
  - **MX** = the max high from sweep to rejection.
- **POI-tap end:** price enters a valid left POI, then a vector rejection closes outside it within 3 bars. Valid only if no opposite AMD has formed since the POI was created.
- **RBOS (bearish):**
  - Level = the low of the last confirmed swing low before MX, on the execution TF.
  - Trigger: `rbos_trigger ∈ {wick: low ≤ level (teacher rule, A12 01:13), close: close < level (conservative)}`; backtest both.
  - Quality (our default): the break bar is a vector OR the MX→break move takes ≤ 6 bars.
  - Reject it if > 50% of the bars from MX to the break overlap the previous bar's range by > 70% (proxy for "accumulated into the RBOS").
  - Also reject (treat as FBOS) if the bar after the break closes back beyond the level ("the candle just flipped itself", A11 17:15) or if no valid manipulation end preceded it.
  - Optional div RBOS 2: the nearer internal swing.
- **OB (bearish):**
  - The last bullish candle before the displacement that produced the RBOS, searched back from the first vector down-bar to MX.
  - Zone = its full range including wicks.
  - Fallback (kev): the smallest-body bar within 3 bars before the displacement.
  - Entry options:
    - **OB open** (near edge, highest fill rate): our default.
    - 50% of the OB ("50% tool").
    - OB high (wick; best R).
- **POI validity:**
  - Unmitigated since creation.
  - Its leg swept liquidity first (IDM flag; otherwise lower weight).
  - Not born from consolidation: the 5 prior bars are not all inside a ≤ 1 × ATR range (our default).
  - In the top/bottom 25% of the day/week range for shorts/longs, or part of an OF chain (our default).
  - Dies on a counter AMD (opposite FBOS + RBOS) or a break of MX.
  - After the RBOS, prefer the most recent valid POI.
- **Order flow:** after the IDM POI tap, each opposite OB (M1/M3) formed on the reaction leg and later tapped is the next link. The chain stops when a link isn't tapped before a new extreme, or on a counter AMD. Max 2 OF entries (our default; YT "usually 1–2").
- **SMTs:**
  - After a bearish MX: the bullish OBs (last bearish candle before an up-leg) below price and above the DOL, plus the FBOS-leg-origin OB.
  - `smt_tapped_before_poi`: true → Rule B (bounce into the POI); false → Rule A (run-through).
  - No counter-bias trades unless `pingpong=True` (default False).
- **Protected extreme:** MX after a valid end + RBOS. Void if untaken equal highs within tolerance remain above it, or on a counter AMD.
- **Divergence (asset A traded, asset B partner; e.g. XAU/XAG):**
  - Comparable levels: the same session extreme / time-aligned swing.
  - Div = B trades beyond its level while A doesn't, within ±3 bars (our default).
  - Pre-open: the level must be an M15 pivot with L=R=4 (our "distinguishable" proxy).
  - Post-open: the level must follow an accumulation.
  - Main HOD/LOD: both assets must sweep some pool.
  - Veto: 20-bar return correlation < 0.3, or opposite session returns (our default).
- **Entry/exit:**
  - Models: `RBOS_LIMIT`, `MITIGATION`, `NEXT50`, `DIV_MARKET`.
    - `RBOS_LIMIT`: expires on a break of MX, on reaching the DOL, or after 24 M5 bars (our default).
    - `MITIGATION`: market order on the first vector close away from the IDM POI.
    - `NEXT50`: confirmation = the first close beyond the OB's far edge after the tap (our proxy; kev gives no numeric test); limit at 50% of its body on the next bar.
  - **Stop** = MX + spread + buffer. Gold buffer = max(0.1 × ATR(M5), $0.30) (our default). Skip if the stop exceeds the cap (start ~0.08% of price, then calibrate).
  - **Target** = acc_low (alternatives: pd low, session low, equal lows). Skip if R:R ≤ 3.
  - **BE** after 2 post-entry swing breaks on the entry TF (fractal 2/2).
- **Filters:**
  - weekly side once confirmed;
  - premium/discount;
  - target-first;
  - re-entry blocked if > 50% of the way to the DOL;
  - ≤ 1 London + 1 NY trade; stop after a win or at −1.5R;
  - optional: Friday-complete skip, news blackout.
- **Weekly IDM proxy (our default):** a sweep of the previous-week H/L or an external swing, then a vector displacement ≥ 0.3 × ADR(14) within 4 h, and the next day closes in the same direction.
- **Hygiene:**
  - Real spread/commission. Limit fills need a 1-tick trade-through.
  - Report by session, weekday, direction and model, and with/without each filter.
  - Metrics: win rate, avg R, expectancy, max DD (R), longest losing streak.
  - Compare against a random-entry baseline with the same stops/targets. Use a walk-forward split.

---

## 9. Conflicts & open ambiguities (→ chosen resolution)
1. **Inducement vs manipulation:** YT = same thing, A11 = different → **A11**.
2. **RBOS:** last swing before the extreme (Arctic) vs a break past the vector series (kev) → **swing**; vectors as a check. Wick or close → **a wick suffices** (A12 01:13 + Discord); backtest both.
3. **SMT side:** Discord text vs diagrams → **diagrams** (FBOS-leg origin, opposite the swept level).
4. **SMT tradability:** "never" vs counter-scalps → never as a reversal against bias; ping-pong optional.
5. **Manipulation end types:** 2 vs 4 → **2** (div/DXY are correlated variants).
6. **POI after the RBOS:** "most recent" vs "closest" → **most recently formed** (B06 15:38: he corrects himself).
7. **Missed OF tap:** "you're out" (A11) vs "eat the order flow" (A12) → only the next OB in the **same AMD chain**; never the new chain (A11 18:17).
8. **M1:** forbidden for students vs "best R" → **M5/M3 default**; M1 for the experienced.
9. **Div entry:** immediate vs confirmation → **confirmation default**.
10. **Both indices sweeping:** "weaker" (B07) vs "both must manipulate" (A08) → each must sweep *some* pool for the main LOD/HOD; at the key level one breaks and one holds. B06's "both take a minimum" is one example, not a rule (kev pub also accepts one-sided holds).
11. **Asia IDM → NY:** continue vs may reverse → **continue**; reverse only on a counter AMD at an HTF POI or a big sweep (A12 56:55 + Discord).
12. **BE:** two-BOS vs early → **two-BOS**.
13. **DLL:** one loss = done (A09) vs NY allowed after a London loss (A12) → second trade only if DLL ≥ 2R.
14. **Targets:** DOL vs fixed → **fixed in the prop/buffer phase**, DOL after.
15. **FVGs:** kev uses them (pub: FVG only after an OB in front was run through; "first presented FVG" continuation entries), Arctic dismisses them → **OBs only** for the Arctic model; kev FVG rules = optional variant tests.
16. **Day template:** Tue/Thu extremes (Arctic) vs Monday extremes common vs Tue/Wed HOW/LOW (kev pub) → **weak prior**.
17. **Asia sweep:** kev's default "London/NY takes the Asia high → target the Asia low" vs Arctic "never fade a plain Asia sweep" → **Arctic**; fade only when the sweep also takes structure outside Asia or taps a valid POI.
18. **Partly tapped OB:** Arctic keeps the whole zone for re-entry (A06 06:45) vs kev pub "an already-tapped OB is used up" → **Arctic** (whole zone, lower-quality fill).
19. **Rejection-entry execution:** 50% body limit (kev YT) vs market-on-wick (kev pub) → **50% limit** as the backtest default, market-on-wick as a variant.
20. **Asia start:** 18:00 (Arctic/kev) vs 17:00 (original LIT timing script, third-party) → **18:00**; 17:00 only as a test variant.
21. **IDM meaning:** "Implied Displacement Model" (A11 agenda) vs inducement (all spoken use, kev pub) → **inducement**.
- **Open:**
  - the vector lookback (hard-coded in his private indicator, not an input; calibrate N, see §8);
  - the FVG timeframe for the inside-an-FVG rule;
  - IFBOS = internal FBOS (inferred from spoken use; the #structure-ifbos-fbos channel was never recorded);
  - partial % (A09: "no partial" in the prop phase; B03's "20%" is unexplained, not a rule);
  - whether 07–09 UK is a NQ window ("apart from 7 to 9", A06 24:00; treated as allowed);
  - B08 chart timezone (±1 h);
  - lesson A04 "Entries + EUR x DXY" and B-folder lessons 9 and 11 are missing from the source (not in Drive or Telegram);
  - anything about gold.

---

## 10. Worked examples
| # | Date / instrument | Chain | Stop | R |
|---|---|---|---|---|
| 1 | Thu 26 Feb 2026, ES M5 (+NQ) | Pre-market ascending channel → 08:35 NY wick above the prior high just after the data → bearish vectors break the last low (RBOS ~08:40) → limit short at the teal OB ~6,965–69 → 09:30 vectors ~25 handles into the accumulation. (Same day, NQ: separate ~09:15 NY pre-open div short, 17 pts, 4.6R, A06) | at high | RBOS model |
| 2 | Wed 7 Jan 2026, NQ M5 | Bull bias; overnight falling channel → London ~05:00 NY FBOS of swing ~25,712, ES held (div) → pink bearish SMT above traps shorts → long → ~25,800+ | 9 pts | 21.6 |
| 3 | Thu 19 Feb 2026, NQ M1 | **Mitigation**: ~03:24 NY rally into an HTF POI ~25,055 → short as price pushes off the OB, no RBOS | 7.25 pts | 6.1 |
| 4 | Tue 24 Feb 2026, NQ M5 | AMDD line from Mon NY low to Tue 09:30 wick; NQ's Tue low held above Mon's → long at 09:30, stop under the pd low → ~250 pts through two SMTs to the pd high | 32.75 pts | 13.3 |
| 5 | Fri 6 Mar 2026, MNQ M1 | 08:30 news high; target-first (Thu low hit on ES) → ES sweeps lows 09:38–09:55, NQ holds → M1 OB + RBOS long ~10:00 → news-candle high | 33 pts | 7.0 |
| 6 | Fri 26 Sep 2025, NQ M1 | Pre-NY dump; 09:30 dips into the pink SMT ~24,620 (Rule B) → rally to the untapped POI 24,725–745 by ~09:45 → real dump | — | illustration |
| 7 | Mon 20 Jul 2026, NQ M5 | No IDM pre-NY → 09:30 sweeps the start-of-accumulation high (NYSE crowns) → RBOS. M1 entry #1 → BE; re-entry after an overarching break + OB tap → Asia low ~28,710 | 32.25 pts | 10.6 |
| 8 | Thu 30 Apr 2026, NQ M5 | Re-entry: low placed ~02:20 NY, pushed away; ~10:00 NY ran ~30 pts under it and reclaimed → long | 38.25 pts | 10.9 |
| 9 | Mon 22 Sep 2025, EURUSD M5 | DXY swept the pd high in Asia + AMD; NY: EU into the blue POI 1.1765–70 at the minute DXY tapped its POI ~97.55 → long to the London high | 3.0 pips | 9.6 |
| 10 | Week 2–6 Mar 2026, MNQ M15 | OLHC: Tue low of week (NQ sweep, ES div, vectors) → Wed Asia sweep into that OB → Thu high of week (ES div into an OB chain) → Fri NFP + 50% rebalance → stand aside | — | weekly |
| ✗ | Tue 21 Jul 2026, NQ | M5 RBOS long **refused**: 42-pt stop for 3.6R ("not worth it"). Also a student short (Feb 2026): entered before the OB existed, no RBOS, inside a range → stopped | — | no trade |

---

## 11. Visual recognition: valid vs invalid (from the chart study)
What setups look like on Arctic's charts. Times are NY (his axis is UK: 14:30 chart = 09:30 NY). Pink box = SMT, blue/cyan = POI, yellow candles = vectors. Sharpens §3–§5; changes nothing.

### 11.1 Manipulation / FBOS
**Looks valid:**
- A slow rising (or falling) build-up under a flat, obvious left high, then one poke just past it and an **instant** dump that breaks the last low under the poke. The return is much faster than the approach (NQ M5, Fri 20 Feb 2026, London).
- Price spikes through a line of equal highs at the open after a triangle, leaves a cyan box at the very top, then breaks the low with vectors (NQ M1, 5 Feb 2026).
- One 09:30 wick onto a rising Monday-to-Tuesday low line, then yellow vectors rip through every pink box overhead (NQ M5, 24 Feb 2026).
- The strongest version takes a left extreme **and** runs into a blue POI on the same move. Both end types are visible at once (NQ M5, Tue 16 Sep 2025: Asia high taken into the POI).

**Looks invalid / trap:**
- A poke under a low **against** a set bias, no yellow candles, price just drifts back (NQ M5, 16 Sep 2025).
- Small Asia/London lows taken **mid-range**, inside gaps, with pink SMTs unfilled above: "literally nothing".
- An Asia box that is a clean rising channel and never touches the left swing low. No sweep and no tap means no manipulation, and the trendline is the target.
- A neat poke just above the Asia range high, then a drop. That is the textbook ICT Judas, and it is fake unless something outside Asia was taken.

**Common mistake:**
- Buying the first swept low because it "looks like a turtle soup", before the external level has been hit.
- Holding the first sweep through a staircase chop away. It re-sweeps.

### 11.2 RBOS
**Looks valid:**
- The break line sits **just under the sweep high**: the small last low that built the high, not a distant session low or the channel trendline (ES M5, 26 Feb 2026: wick 08:35, break within a few candles).
- On a textbook uptrend sketch (L, H, HL, HH, HL), the RBOS is the break of the **last HL**, the one that made the swept HH.
- Breaking candles are tall, close through the line and don't overlap prior bars; sweep to break takes a handful of bars.
- Under NQ/ES div, the protected index may break the nearer internal low formed while the other index printed its extreme ("RBOS 2"). That gives a tighter stop.

**Looks invalid / trap:**
- One or two big M1 candles punch through a falling micro trendline, and the **next** candles hand the whole move back. "That's just not real" (NQ M1, 17 Feb 2026).
- The reclaim is an overlapping, wedge-shaped climb that crosses the line with no single displacement candle and is already rolling over (NQ M5, 18–19 May 2026, under an H1 SMT).
- A slow wavy staircase from the sweep to the break. It was reached by accumulation, not displacement.

**Common mistake:**
- Waiting for a deep break of the session low. That is late and needs a huge stop. The RBOS is the nearest relevant swing.
- Buying the pink zone above a swept high after the RBOS. It is resistance now.

### 11.3 POI / OB
**Looks valid:**
- The OB sits **at the bottom of the wick that dipped under the flat lows** (or the top of the spike over the highs). Price leaves it fast and re-taps it once (NQ M3, 22 Jan 2026: re-tap long, stop under the sweep wick, ~8.8R to the SMT above).
- When the top OB has already been touched, the entry is the unmitigated OB of the RBOS leg just below it (NQ M5, 3 Feb 2026).
- Of extreme, first-after-RBOS and later re-accumulation boxes, price leaves from the **last** one and never revisits the extreme (EURUSD M5, 21 Oct 2025).
- A wide M5 box with a tighter M3 candle inside it that is itself a clear opposite-coloured OB. Enter at the M3 OB.

**Looks invalid / trap:**
- A clean-looking bullish OB in the **middle** of a rally with no sweep behind it. Price slices straight through on the return (NQ M15, 30 Jan–3 Feb 2026).
- An OB born inside sideways chop at the lows. Even if price then flies ~200 pts, Arctic "would never take" it. One win does not make a setup.
- An OB that price has already traded back into. Move to the newest OB, wick included.

**Common mistake:**
- Boxing every OB as a POI. Only the sweep's box and its order-flow chain count.
- Refining to an M1 sliver that never formed a real OB, or never refining and taking a double-cap stop.

### 11.4 SMTs
**Looks valid (to mark and respect, not to fade):**
- Dual trap: an uptrend breaks one higher low (FBOS); the pink box is the bearish OB where that leg began. Price returns, prints a lower high, then breaks through to new highs.
- Rule B in real time: the 09:30 candle dips into the pink box below while the blue POI above is **untapped**. Price rallies back into the blue POI within ~20 minutes, then the real dump starts (NQ M1, 26 Sep 2025).
- Ping-pong: price drops away from a fresh blue POI without touching it, one sharp push returns it into the POI, and that is the short (EURUSD M5, 1 May 2025: 6.7-pip stop).
- Speed bumps: once the POI is tapped and no fresh pink boxes remain toward the target, price expands without pause (NQ, Wed 9 Apr 2025).

**Looks invalid / trap:**
- The blue POI is re-tapped first and the pink boxes below were never touched. Price drops through them with no wick reaction (Rule A).
- A pink box at the base of an overnight rising channel (manipulation-phase SMT). Once the POI is tapped, price runs straight through it.
- A pink zone at a swept low after the high is taken (FBOS SMT). It gives one bounce to the next structure and is taken later the same day. It is not a reversal.

**Common mistake:**
- Buying the "perfect" pink demand OB, or shorting the 09:30 dump straight into a pink box while a POI above is still untapped.

### 11.5 HTF SMT & order flow
**Looks valid:**
- A pink H1/H4 box against the trend, touched for the first time. Inside it, a small M5 AMD forms: a sweep of an obvious prior low, a close back above, then a break up (NQ M5, 8–10 Apr 2026: SMT tap Thu, Wed low ~24,926 swept in Fri Asia, RBOS, long).
- An order-flow chain is a staircase of cyan OBs, each formed by tapping the previous one and then breaking the next high.
- Re-entry template B: a low is placed, price pushes away, later dips just under it and reclaims, and an earlier high breaks before the vertical leg (NQ M5, 1 May 2026, dip ~11:40, high taken 13:00).

**Looks invalid / trap:**
- Old H1 boxes price already traded back through: skip.
- HTF SMT at ATH: the first bounce after the drop looks like a bottom but traps longs (NQ, 21–22 Oct 2025).
- A chain where price pushes **above** the highs and reverses (F). Every earlier link is dead, and the new base OB is an SMT for the old trend.

**Common mistake:**
- Holding an HTF-SMT trade for a full reversal instead of the closest structure.
- Entering plain chop with no side swept and calling it a re-entry.

### 11.6 Entries & management
**Looks valid:**
- RBOS model: a rising channel, a spike above its high, an opposite candle at the top, then a break down. The limit goes at the teal OB with the stop above the spike (NQ M3, 26 Feb 2026, ~08:40).
- Mitigation model (experienced only): price sweeps over the top of a marked M15 POI and the short goes in **as** it pushes off, no RBOS (NQ M1, 19 Feb 2026, ~6R in 20 min).
- Next-candle 50%: the first rejection candle is wicky and is skipped. The first candle that **closes** decisively away is the confirmation, and the limit sits at 50% of its **body** on the next candle.

**Looks invalid / trap:**
- A short placed into the top of a rally inside a range, before any OB exists or any low has broken. One wick runs the stop (student, Feb 2026).
- After entry, price staircases away instead of displacing: expect a re-sweep, go to BE.
- A tidy RBOS long with a 42-pt stop for ~3.6R. Refused, though it hit target.

**Common mistake:**
- Entering on the confirmation close itself, at 50% of the full range, or moving to BE at the first wiggle using swings from before entry.
- Treating a BE as failure. In the 20 Jul 2026 trade the first M1 short scratched, and the same-narrative re-entry from the OB paid 10.6R.

### 11.7 Asia / London
**Looks valid:**
- Protected Asia low: the Asia box drifts sideways, dips once into the prior day's blue POI, then pushes away. London later takes the Asia high and keeps going. Keep buying (EURUSD M5, 16 Sep 2025, dip ~21:30).
- Protected Asia high: Asia takes the left range high and drops at once; London makes a lower high (EURUSD, 17 Sep 2025).
- London sets the AMD: Asia is a small rising channel, and around 02:55 London dips under the Asia low **into a small blue POI** and pushes off. That low holds all day (EURUSD M5, 10 Sep 2025).
- AMD + div protection in Asia: one index wicks under the evening low while the other prints only a relatively equal low (ES vs NQ, 25 Feb 2026, ~21:55). Gold vs silver here is untested inference.
- Fake Asia the day after the low of week: Asia grinds down into equal lows, takes them once into the weekly-low OB, then rallies (MNQ M3, 4 Mar 2026).

**Looks invalid / trap:**
- Judas Asia: a falling wedge, nothing swept or tapped; London breaks the low, then price rips through the high, then sells (EURUSD, 18 Sep 2025).
- An Asia rising channel whose swings sit inside an FVG. The low is not protected, and NY dumps through it.
- An early-London sweep of the prior-day low against a set bias that taps nothing (NQ, 17 Sep 2025, ~01:00). The real manipulation follows: London takes the Asia high into the POI.
- London only mitigates an old box (no inducement): NY can still reverse off an HTF zone (EURUSD, 22 Oct 2025).

**Common mistake:**
- Shorting London's Asia-high sweep on a Protected-low day, or calling a day bearish just because a plain Asia low broke.

### 11.8 NY 09:30 crown
**Looks valid:**
- Crown picture: Asia FBOSes its range high into a blue POI, London makes a lower high under it, pre-NY is flat, NYSE expands away.
- Nobody crowned: Asia and London build a flat-top triangle, 09:30 spikes just over the flat top, then dumps in straight vectors with no retest (NQ M15, Tue 7 Jan 2025).
- Nobody crowned, first move fake: 09:30 dips under the pre-NY channel, rips to the HOD by ~10:05, then falls ~100 pts (NQ M1, 29 Sep 2025).
- London crowned: 09:30 pushes **against** London into an OB (or dips into a blue zone), then continues London's way (NQ, 3 Oct 2025 bearish; 22 Aug 2025 bullish, +421 pts; 1 Oct 2025 bullish).

**Looks invalid / trap:**
- The big red 09:30 candle itself. Selling it often sells the low (NQ M5, 30 Sep 2025).
- A 09:30 drop into a pink SMT while the POI above is untapped. Price squeezes to the POI first.
- Pre-open longs in a pink demand zone while an older low below still holds liquidity. After 09:30 price takes that low, then goes up (NQ M5, 9 Sep 2025).

**Common mistake:**
- Reading a 09:30 counter-move as a reversal of London's crown, or buying a 09:30 triangle breakout.

### 11.9 Weekly & news
**Looks valid:**
- On M15 the week reads as one candle: one early sweep of a left line followed by a fat vector leg away. That is one extreme, and later dips (or pops) are higher lows (or lower highs) to join (MNQ, Tue 3 Mar 2026 low → Thu 5 Mar high).
- Bear week: Tuesday takes left structure and leaves a blue IDM POI under the high; Wednesday's retest drops, pink boxes below bounce once then go, Thursday sweeps Monday's low (EURUSD M15, 11–14 Mar 2025).
- Two releases, one AMD: with the weekly high missing, the 08:30 release drops into the lows (inducement) and the 09:45 PMI rallies to make the high of week (MNQ, Fri 20 Feb 2026).
- Late-week NFP with one side missing makes that side (MES, 6 Mar 2026).

**Looks invalid / trap:**
- A 15-minute AMD that would print high → low → **higher** high after the weekly high is set. A weekly candle cannot take that shape.
- A Friday sweep-and-pop after Monday made the high and Wednesday the low. It looks textbook, but the week is finished (NQ, 10 Jul 2026).
- Friday PPI with all objectives done: a small dip, then a triangle (MNQ, 27 Feb 2026).

**Common mistake:**
- Shorting a midweek "manipulation up" in a running bull week, or buying the first pink OB under a weekly high.

### 11.10 Divergence
**Looks valid:**
- Pre-09:30: the compared level is a prior high you can see on M15. NQ stalls just under it from an M3 OB (MNQ, 26 Feb 2026, ~09:15, 17-pt stop, 4.6R).
- Post-09:30: ES prints lower lows 09:38–09:55 while NQ's lows step **up**; OB + RBOS at the higher low (MNQ M1, 6 Mar 2026).
- NQ sweeps its Asia low, ES's Asia low stays intact with a higher low, and the trade is long ES with the stop just under its held low (23 Oct 2025, ~08:20, 3.5-pt stop, ~12R).
- EU long in its blue POI **at the same minute** DXY taps its own POI and turns (22 Sep 2025, ~10:25).

**Looks invalid / trap:**
- A main-LOD "div" on an already-swept pool, ES only at relative equal lows, far from 09:30 (22 Jul 2026).
- An EU bounce off equal lows while DXY is still pressed under its pink SMT. Wait for DXY to sweep above it (23 Oct 2025: the valid EU long came about an hour after DXY swept).
- Gold read off DXY. Gold's partner is silver, and that is **untested**.

**Common mistake:**
- Trading the index that swept, with the stop over its wick, instead of the protected one.

### 11.11 Drill questions
1. NQ M5, bias already bearish. Early London pokes under Tuesday's low with no vectors and drifts back up. Later London takes the Asia high straight into a blue POI and rejects at once. Which is the manipulation, and which way do you trade? → The high + POI tap. Short. The low poke went against the set bias and means nothing.
2. Asia is a rising channel with a trendline under the lows. It never takes the left swing low and taps no POI. Is the Asia low protected? → No. It is accumulation, and the trendline is liquidity for NY to run.
3. ES M5: wick above the prior high at 08:35, then the next few candles drop straight through the small low just under that high. Clean or ugly, and where is the entry? → Clean RBOS. Sell limit at the OB of the last up-candles at the high, stop above the wick.
4. NQ M1: two big candles break up through a falling micro trendline after a low, and the next candles give it all back. Buy the OB under them? → No. An M1 RBOS that flips straight back is not real.
5. After the RBOS you have three boxes: the extreme OB, the first OB after the break, and a later sideways re-accumulation that price just left. Which do you use? → The re-accumulation, the most recently formed POI.
6. A bullish OB formed mid-rally with no sweep behind it, and price is returning to it as the bias shifts. Buy it? → No. Mid-range, no inducement. Expect it to be run.
7. The blue POI at the swept high was just re-tapped, and the two pink boxes below were never touched. Long from the top pink box? → No. Rule A: they get run through.
8. 09:30 NY: a bearish candle drops into a pink box while the blue POI above is untapped. Short the drop? → No. Rule B: expect a rally into the POI first, then short from the POI.
9. You missed a long. Price is now well past halfway from the entry zone to the target box. Re-enter on the next OB? → No. Re-entries are blocked beyond 50% to the DOL.
10. Asia and London built a flat-top triangle with no IDM. 09:30 spikes just above the flat top. Buy the breakout? → No. Nobody crowned, so the spike is NYSE's manipulation. Look for the short after the RBOS.
11. Weekly: Monday made the high, Wednesday the low, and 50% is done. Friday sweeps a low and pops cleanly. Trade it? → No. The week is finished, so it is a no-trade rebalance day.
12. NQ takes the day's low, ES makes only relative equal lows, it is before 09:30, and that pool was already swept earlier in the session. Valid div long? → No. A main-LOD div needs both indices to manipulate a fresh pool, and internal divs count only around 09:30.

---

## 12. Changelog (v2)
- §4.7: late-week NFP with an extreme missing prints **in the weekly direction**; CPI is traded as its own AMD when the week has **no** confirmed extreme.
- §5.1: mitigation model named **"Retest of the Extreme"**. RBOS: a wick suffices; a break candle that flips back = FBOS.
- RBOS formed in Asia is valid; only a plain Asia H/L inducement is fake. kev pub: Asia reversals need an M3/M5 RBOS + IDM-POI retrace.
- Weekly-IDM windows confirmed (07–09/13–15/16–18 UK; NQ 13–18 UK); removed from §9 Open.
- §6: A09 3R/2R is a **fixed TP per payout cycle**, not a daily R cap; DLL 1.5R. A12: 1% per trade, London loss → NY at 1%. NQ OB stop ≤ 20 pts.
- §4.8: NQ "both take a minimum" is an example, not a rule. NY crown: an Asia-IDM reversal needs a counter AMD.
- Refine for size, not mitigation; SMT types quoted from the A02 post; not every HTF SMT pulls back.
- (kev pub) added: HTF IDM level, enticement, M1 rejection timing, FVG-after-OB, 09:30 cases; §9 #18–21.
- IFBOS = internal FBOS and IBOS = internal BOS added (A03, B02 re-transcribed). Vector lookback: his indicator has no length input (checked frame by frame), so N stays a calibrated default.
- Gold is still UNTESTED INFERENCE: no source tests it.