# Measuring discretion: record the choice before the result (20 Nov 2026)

**A proposal for the owner. Nothing is built, nothing live changes, no rule, size, stop or filter is touched.** It follows the
owner's remark of 20 Nov 2026 ("the difference is discretion on all edges, because they work") and the study
`research/edge/discretion` (pre-registered; verdict "too few to judge").

## In plain words

1. **Your view cannot be checked today, either way.** The desk has tested about 150 fixed rules. It has never measured a
   person's choosing, because the choosing is not written down anywhere the desk can read. On council-data there are
   **0 take / skip decisions recorded before the outcome**: the ICT desk's review file was never written (the marks stay in
   each browser), the 8 loss reviews were written after the loss, and no council system has a place to say "take" or "skip".
2. **Picked examples do not count.** The five Mosha trades, the screenshots, a loss review: each was chosen after its result
   was known. They show the pattern, not how often choosing wins. Only a choice stamped before the result is evidence.
3. **It takes many decisions.** One trade's result swings by about 1.7R on the ICT A-setups. For "the ones I take beat the
   ones I skip by 0.3R a trade" (a large advantage) to show at t = 2 with an even chance, it takes about 254 taken and 254
   skipped signals; for 0.5R about 92 a side. At today's pace of A-setups that is roughly 6 to 16 months, and only if every
   signal gets a decision. Twenty a side can only show an advantage of about 1.1R a trade.
4. **So the one thing worth doing is to start recording now**, on every edge, cheaply, in a way that cannot be changed
   afterwards. Then your claim becomes a number with n and t beside each system's own record.

## What to capture (the smallest thing that can be measured)

For each LIVE or paper signal of each system, one record, made by a signed-in person:

| Field | Values | Why |
|---|---|---|
| decision | **Take** or **Skip** (a signal nobody marked is "no decision", never a skip) | the comparison needs both sides |
| one reason tag | a short fixed list per desk (for example: with the higher timeframe, at my level, news ahead, late, too wide a stop, poor structure, other) | later: which reasons carry the difference |
| confidence | low / medium / high | later: does higher confidence do better |
| who | the account (shown to the owner only; reports pool everyone) | by person in aggregate |
| **server time of the FIRST decision** | stamped by the server, never sent by the page | the whole point: before the outcome, and not editable |
| the signal's state at that time | pending / open, and the price then | to tell "before entry" from "before exit" |

Rules that make it honest:

- **The first decision stands.** A change of mind is a new line; the first one is what is scored. Nothing is deleted.
- **Only a decision stamped before the signal's exit counts**; the stricter record "before entry" is shown beside it. A mark
  made after the result is kept apart and labelled hindsight.
- **A decision is not an order.** It never places, sizes, blocks, alerts or copies anything, and no system reads it
  (absolute rules 1-3). The systems keep taking every signal on paper exactly as now; that is the comparison.
- **ICT stays separate** (absolute rule 4): its decisions, its record, its own card on Fred's desk; never pooled with a
  council system. Each council system and the Mosha desk likewise get their own.
- **Privacy**: individual decisions live in the private store behind the sign-in, not on the public council-data branch;
  only pooled counts and figures are published.

## What you would see

Two records side by side on each system's card, same trades, same costs:

- **All signals** (the record as it is today), and
- **Taken by a person** (the same signals a person marked Take before the outcome), with **Skipped** beside it,

each with n, R a trade after costs and t; the difference taken minus skipped with its t; and, until both sides reach 20,
the words "too few to judge" with the count so far and how many are still needed. Never the word "edge". The bar is already
fixed in `research/edge/discretion/PREREGISTRATION.md` (20 a side, t at least 2, Holm over the tests judged), so a later
reading cannot pick its own.

## What it would take to build (for a later decision; not done here)

- One small signed-in endpoint that appends a decision with the server's clock and refuses a second "first" decision.
- Take / Skip buttons where signals already appear: the ICT desk's signal card (it has Taken / Skipped / Missed today, but
  keeps them in the browser), the Council's active and pending trades, the phone alert's link.
- One read-only report (the study's `run.mjs` already computes it from a file of decisions).
- No trading code, no stop, no mirror, no workflow changes.

## The decision

- **(a) Build the capture as described** (recommended if you believe discretion is the difference: it is the only way to
  find out, and every week without it is a week of signals that can never be scored).
- **(b) ICT desk only first**: make its existing Taken / Skipped marks save to the server with a server stamp. Smallest
  step; it has the most signals a month. Fred's desk, so with Fred.
- **(c) Leave it.** Then the claim stays a belief; the mechanical records stay the only evidence.

Honest expectations: even with every signal decided, a real advantage of 0.3R a trade needs about a year or more of ICT
A-setups to show; a smaller one, several years. Skipping a signal is also only one kind of discretion: a person's own
entries, exits and size are measured by their own logged trades (the Mosha desk's pre-entry record), not by this.
