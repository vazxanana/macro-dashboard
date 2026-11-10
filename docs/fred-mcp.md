# Working on the ICT desk from ChatGPT (or Claude / Cursor)

The ICT desk has its own connector. Through it you can read the rules and every trade, look at candles, backtest
the desk's own model on 2020-now data with your own settings, compare your idea against the live rule, keep your own
desk record for each signal, and propose a change. A proposal becomes a draft pull request. The owner reviews it and
decides. Nothing changes live until the owner merges it.

A second way to change the edge, **apply**, is switched on for Fred (owner, 10 Nov 2026: full control of the ICT edge).
With it a change to the ICT edge's own files takes effect without the owner's review once the automatic checks pass
(section 6). For a member it is not switched on for, the apply tools are not in the tool list, and proposing is the way.

## 1. Get your connector URL

Sign in on the desk, open **Profile**, find **ChatGPT connector**, type your desk password and copy the URL.
The URL contains your key, so don't share it. If it ever leaks, tell the owner and a new key will be made.

## 2. Add it

**ChatGPT (web).** Turn on Settings → Apps → Advanced settings → **Developer mode**. Then choose **Create app**
(older menus call it Settings → Connectors → Advanced → Create). Give it a name (for example "Meridian ICT"), paste
your URL as the MCP server URL, and set Authentication to **No authentication**. Tick the box to say you trust it,
then create it. In a chat, pick it from the **+** menu under Developer mode. On a Business or Enterprise workspace,
an admin has to allow developer mode first. Menus change: if yours look different, see OpenAI's help article
"Developer mode and MCP connectors in ChatGPT".

**Claude.** Go to Settings → Connectors → Add custom connector and paste the URL.

**Cursor.** Add this to `~/.cursor/mcp.json`: `{ "mcpServers": { "meridian-ict": { "url": "<your URL>" } } }`

ChatGPT asks you to confirm before any tool that writes (a note, a desk record, a proposal or a comment). That's expected.

## 3. The tools

| Tool | What it does |
|---|---|
| `ict_guide` | Explains the desk, the model, the rules and the workflow. Start here. |
| `ict_rules` | The rule book (`.claude/skills/ICT/SKILL.md`) by section, plus the live parameters |
| `ict_trades`, `ict_trade` | Live and replay signals with stats and filters (market, grade, side, dates, outcome); one trade with every feature |
| `ict_status` | The tracker now: prices, open paper trades, shadow variants, notes |
| `ctrader_results` | Demo account results by label (no account numbers) |
| `ict_bars` | Candles (OANDA) for a market, timeframe and window, up to 1500 |
| `ict_backtest` | Runs the desk's own iFVG engine on 2020-now H1 candles with your parameters and filters. Returns n, win rate, average R, net R, profit factor, max drawdown, t, results by year and by side, in sample (2020-2023) vs out of sample (2024-now), and sample trades. |
| `ict_compare` | The live rule vs your proposal on the same candles: both sets, the differences, year by year and market by market, and a verdict |
| `ict_file_list`, `ict_file_read` | The ICT source files you may change |
| `ict_propose_change` | Opens a draft PR. Send whole files, a test, what / why / evidence / risk. |
| `ict_my_proposals`, `ict_proposal_comment` | Your PRs with CI status and the owner's comments; replies on your own PRs |
| `ict_note` | Saves a note on a trade or for the owner |
| `ict_desk_update` | Your own desk record for a signal: taken / skipped / missed, your fill, your R, your grade, tags, a note. The desk page shows it. |
| `ict_apply_change`, `ict_revert_change` | **Off.** Available only after the owner switches apply on (section 6). |
| `search`, `fetch` | Search across trades, rules and the guide (ChatGPT deep research uses these) |

Backtest settings (`params`): `piv` (swing candles, 3), `look` (96), `vmax` (candles from sweep to inversion, 6),
`maxAtr` (8), `holdH` (time exit in H1 candles, 36), `be` (break-even R, 1.5; 0 turns it off), `trail_from` /
`trail_dist` (2 / 1.5; trail_from 0 turns the trail off), `mark` (2).
Filters (`filters`): `min_grade`, `sides`, `sessions`, `atr_min` / `atr_max` (stop vs the daily ATR), `bias`, `zone`,
`min_body`, `max_speed`, `htf_fvg`, `skip_friday`, `min_room_r`.
`rule: "all"` tests every signal instead of the A-setups, and `sizing: "flat"` sizes every trade at 1 unit.

## 4. Example prompts

- "Call ict_guide, then summarise the A-setup rule in five lines."
- "Show the A-setup losses on NQ since 1 October and what they have in common."
- "Backtest NQ, ES and YM from 2020 with the live rule. Then compare it with skipping Fridays. Is the difference out of sample real?"
- "Compare the live rule with `vmax: 4` and `filters: { atr_max: 0.6 }` on all five markets. Show it year by year."
- "Read ict/tracker.mjs, change the A-setup to exclude the NY PM session, write a test for it, and propose the change with evidence_run."
- "What did the owner say on my proposals? Is CI green?"
- "Mark nq-b-1793926800 as taken, fill 25010.25, result 2.5R, grade A, tags sweep and fvg, note: clean sweep of the previous day's low."

### Worked example: your desk record

You took a signal and want it on the desk. Ask: "Mark signal `nq-b-1793926800` as taken at 25010.25, +2.5R, grade A,
with the note 'clean sweep of PDL, entered on the M5 inversion'." ChatGPT calls:

```json
{ "name": "ict_desk_update",
  "arguments": { "id": "nq-b-1793926800", "action": "taken", "fill": 25010.25, "r": 2.5,
                 "grade": "A", "tags": ["sweep", "fvg"], "note": "clean sweep of PDL, entered on the M5 inversion" } }
```

The record is saved to the council data (`ict/desk.json`) in the same shape the desk page writes, with your name and
the time, and shows on the page on its next load. What you leave out keeps its value, so a later
`{ "id": "nq-b-1793926800", "r": 3.1 }` only changes the result. `action` is `taken`, `skipped`, `missed` or `none`.
`grade` is one of the page's letters (A+, A, B, C, F); you can send `score` 1-10 instead (10 = A+, 8-9 = A, 5-7 = B,
3-4 = C, 1-2 = F). There is one record per signal: a record another member wrote is never replaced.

## 5. The review rules

- **Paper only.** Nothing here places an order.
- **Every trade has a stop.** No change may remove a stop, move it away from the sweep, or loosen a trailed stop.
- **An edge must pass out of sample on 2020-now data.** That means at least 30 trades out of sample, positive
  average R both in sample and out of sample, and most out-of-sample years positive, all net of costs. A t of 2 or
  more is strong. Report every variant you tried, not only the best one.
- **The owner approves every rule change.** `ict_propose_change` is the only way a change reaches the desk while apply
  is off. The server checks a proposal before it opens the PR:
  - only ICT files can change;
  - a code or rule change needs a test at `tests/ict-<topic>.test.mjs`;
  - every file must pass a syntax check;
  - no new network, environment or process access.

  CI runs the tests, and the owner decides.
- **ICT stays separate** from the council systems.

## 6. Apply: on for Fred

The owner decided on 10 Nov 2026 that Fred has full control of the ICT edge: his changes to the ICT edge's own files take
effect without a manual merge. `ict_apply_change` and `ict_revert_change` are in Fred's tool list. For any other member
they are not listed and answer like a tool that does not exist. The owner can switch it off at any time: unticking "ICT:
may apply changes to the ICT edge without my review" on the Users page stops the next call, and removing the name from
`council/ict-apply.json` is the hard off-switch.

What does not change: every ICT trade keeps its stop (a guard test outside your reach checks it on every change), ICT is
paper and demo only, and only the ICT edge's own files can be changed.

This is how the two paths differ:

| | Propose (`ict_propose_change`) | Apply (`ict_apply_change`) |
|---|---|---|
| Use it for | Anything you want the owner to look at first. The only way for a change that needs something outside the ICT files, or new network / environment / process access. | A change to the ICT edge's own files: `ict/*.mjs`, the rule book, `tests/ict-*.test.mjs`, the ICT fixtures and research. |
| What it opens | A draft pull request | A normal pull request on a branch `mcp/<you>/apply-…` |
| Who merges | The owner | The apply workflow, when every check passes. If one fails, the pull request stays open with a comment saying why, and nothing changes. |
| Server checks | Allowed paths, sizes, syntax, no new network / environment / process access, a test for a rule change, risk and evidence | The same |
| Extra checks | CI | Main's own copy of the verifier (the same rules again, on the pull request itself), the whole test suite, the built site unchanged, and a stop guard you cannot edit: every signal and every simulated trade keeps a stop on the right side of its entry, and ICT imports nothing from the council, the API or the mirror |
| Live on the desk | After the owner merges | The tracker runs the new code from its next round (about 12 minutes); the replay is rerun; the backtest tools use it after the next site deploy |

Out of reach on both paths: the council's systems, the page, the API, workflows, scripts, users, tokens and cTrader
orders. ICT is paper and demo only. Every trade has a stop.

### Worked example: apply a change

"Read `ict/tracker.mjs`. Change the A-setup so the New York afternoon is excluded, write a test, and apply it with an
evidence run on NQ, ES, YM and RTY." ChatGPT reads the file, writes the whole new file and a test, and calls:

```json
{ "name": "ict_apply_change",
  "arguments": {
    "title": "A-setup: skip NY PM",
    "what": "aIndex() returns false when feat.session is NY PM.",
    "why": "NY PM A-setups lose out of sample; the sweep is usually the day's last liquidity run.",
    "risk": "About a fifth fewer trades. Not tested on gold (the gold rule is unchanged).",
    "evidence_run": { "markets": ["nq", "es", "ym", "rty"], "filters": { "sessions": ["Asia", "London", "NY AM", "Close"] } },
    "files": [ { "path": "ict/tracker.mjs", "content": "…the whole new file…" },
               { "path": "tests/ict-nypm.test.mjs", "content": "…a node:test file that fails without the change…" } ] } }
```

The answer gives the pull request number and `applied: "pending"`. Then ask "Did my applied change merge?":
`ict_my_proposals` shows it with `apply.checks` (running / passed / failed) and `apply.result` (`merged`, waiting, or
`refused` with the reason). At most 6 proposals and applied changes an hour together, and 10 applied changes a day.

### Worked example: undo an applied change

"Revert my applied change 412, it added losers in the London session."

```json
{ "name": "ict_revert_change", "arguments": { "number": 412, "why": "more London losers than the backtest showed" } }
```

Every file that change touched goes back to its content before the merge (a file it added is deleted), as a new
applied change through the same checks. It only works on your own merged applied changes. If one of the files changed
again since, it refuses and names the file: read the file and apply the content you want instead.

## 7. Limits and caveats

- **Rate limits per key:** 90 calls a minute, 12 backtests or comparisons per 10 minutes, 40 candle requests per
  10 minutes, and 20 writes an hour (6 of them can be proposals; applied changes and reverts count as proposals, with
  at most 10 applied changes a day).
- **Backtest windows:** 1 to 5 markets, from 2020-01-01. Long answers are cut at 150,000 characters.
- **Backtests run on OANDA cash CFDs** (NQ → NAS100, ES → SPX500, YM → US30, RTY → US2000, GC → spot gold), while
  the live desk trades futures. Prices differ, but the structure is the same. If OANDA is unavailable, NQ, ES and YM
  use the research candles from 2023 on, and the answer says so.
- **Costs:** results are net of a round-trip cost per trade (NQ 1.5 points, ES 0.5, YM 3, RTY 0.4, gold 0.5, silver 0.03;
  `cost: false` gives gross). The desk's own reports use the CME micro round trip, which is higher on ES, YM and RTY; the owner
  is deciding whether the connector should use the same numbers.
