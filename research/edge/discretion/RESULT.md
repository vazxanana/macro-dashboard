# Result: discretion, taken against skipped signals (20 Nov 2026)

**Verdict: TOO FEW TO JUDGE.** 0 human take / skip decisions recorded before the outcome exist on council-data (ICT: 0; council systems: 0); the bar needs 20 a side. The owner's view (the edges work when a person chooses) can be neither confirmed nor refuted today: nothing records the choosing.

Pre-registered in `PREREGISTRATION.md` (pushed alone before any figure here). council-data commit `bb4e7c3c188d385ce0fd82a31bcb4e461bf68d9c`. Paper research only; read-only; nothing live changed. Aggregates only: no trade, note or name of any person is in this folder. Not an edge, and not evidence against one: an absence of records.

## 1. What exists (the exact count)

| Source | On council-data | Records | Stamped before the outcome | Usable |
|---|---|---|---|---|
| `ict/desk.json` (Taken / Skipped / Missed, grade, score per ICT signal) | no (absent from the branch and its history) | 0 | 0 | 0 |
| `ict/mcp-notes.json` (connector notes) | no | 0 | n/a (free text, no take / skip) | 0 |
| `reviews/losses.json` (human loss reviews) | yes | 8 by 1 reviewer | 0 (after the close: 8) | 0: hindsight, and losing trades only (8 of 8 are losses, 7 on shadow trades), so no "taken vs skipped" can be read from them |
| `reviews/analyst.json` (post-mortems) | yes | 28 | n/a | 0: written by a program, not a person |
| `trades.json` (council systems) | yes | 1,260 | 0 carry a take / skip field | 0 |
| Mosha log (private store); Mosha lessons (private store); ChronosTrade sessions (browser); Academy store (private store); the old browser journal (removed 17 Nov 2026) | no | not readable here | not known | not counted, never guessed |

The ICT desk page keeps its Taken / Skipped marks in the browser (localStorage) and writes `ict/desk.json` only when a GitHub token is pasted in; the connector's `ict_desk_update` writes the same file. Neither has written it once. The Mosha desk's own record already says the same on its side (17 Nov 2026: 0 trades logged before entry).

## 2. ICT (a separate edge, its own section)

29 forward signals (27 closed) and 826 replay records. Reviews matched to an execution: 0 (Taken 0, Skipped 0, Missed 0); before the outcome 0, hindsight 0.

| Test | n taken / higher grade | n skipped / lower grade | difference | Welch t | verdict |
|---|---|---|---|---|---|
| D1 taken vs skipped, every decided signal (primary) | 0 | 0 | n/a | n/a | too few to judge |
| D1 on A-setups alone (reported) | 0 | 0 | n/a | n/a | too few to judge |
| D2 grade above the median vs at or below | 0 | 0 | n/a | n/a | too few to judge |

**How many decisions it would take.** Per-unit R of the 259 closed replay A-setups has a standard deviation of 1.6879R (mean +0.264R; every signal: sd 1.6002R, n 826). The forward desk recorded 12 A-setups in 11.6 days (31.1 a 30 days; every signal 63.4). Months assume EVERY A-setup gets a decision before its exit and half are taken:

| Taken beats skipped by | n a side for t = 2 (about a coin flip to show it) | n a side for 80 % power | months to t = 2 | months to 80 % |
|---|---|---|---|---|
| 0.10R | 2,280 | 4,473 | 146.7 | 287.9 |
| 0.20R | 570 | 1,119 | 36.7 | 72 |
| 0.30R | 254 | 497 | 16.3 | 32 |
| 0.50R | 92 | 179 | 5.9 | 11.5 |

On every signal instead of A-setups (rate 63.4 a 30 days):

| Taken beats skipped by | n a side for t = 2 (about a coin flip to show it) | n a side for 80 % power | months to t = 2 | months to 80 % |
|---|---|---|---|---|
| 0.10R | 2,049 | 4,020 | 64.6 | 126.7 |
| 0.20R | 513 | 1,005 | 16.2 | 31.7 |
| 0.30R | 228 | 447 | 7.2 | 14.1 |
| 0.50R | 82 | 161 | 2.6 | 5.1 |

Note: replay records carry no `Rraw`, so the pre-registered "Rraw, else R" reads their sized R; divided by `size` the A-setup sd is 1.6876R.

## 3. Council systems (own section, never pooled with ICT)

D3: no record exists. No council system has a place where a person says "take" or "skip" before the outcome (alerts go out; nothing comes back). For scale only: the 38 closed live-book records of `trades.json` (legacy engine setups included) have a per-trade sd of 0.9622R (mean −0.539R before costs), 139.6 a 30 days over 8.2 days:

| Taken beats skipped by | n a side for t = 2 (about a coin flip to show it) | n a side for 80 % power | months to t = 2 | months to 80 % |
|---|---|---|---|---|
| 0.10R | 741 | 1,454 | 10.6 | 20.8 |
| 0.20R | 186 | 364 | 2.7 | 5.2 |
| 0.30R | 83 | 162 | 1.2 | 2.3 |
| 0.50R | 30 | 59 | 0.4 | 0.8 |

Caveat: that rate is the pre-registered arithmetic on what is on file, and most of those records are the legacy engine setups of 1-4 Nov (retired). Today's live paper book is two gold systems that close a few positions a month, so on the book as it stands the months are many times longer; the shadow and research streams are where signals are frequent.

## 4. Reading

- **Count: 0.** The claim "discretion is the difference" is untested, not failed. Every past example of a person's good picks in this repository was chosen after the result (the Mosha examples, the loss reviews), which is what this count means.
- **The sample needed is large.** With R this noisy, a real advantage of 0.3R a trade (large) needs about 254 decided A-setups a side for an even chance of t = 2; 0.5R needs 92. A 20-a-side reading can only show an effect of about 1.1R a trade. So the capture has to start now and cover every signal, or it will never be judged.
- **Limits.** The desk file keeps one `at` per review (the last save), so a mark edited after the result would look late and one made early then left alone looks early: only a server stamp of the FIRST decision settles it. "Skipped" must be a recorded choice; an unmarked signal is not a skip. Taken-vs-skipped measures selection among the system's signals, not a person's own entries, exits or sizing.
- The owner's proposal is `research/proposals/2026-11-20-discretion.md`. Nothing is built by this study.

To repeat: export the files with `git show origin/council-data:<file>` into a folder (same paths), then `node research/edge/discretion/run.mjs <folder> <commit>`.
