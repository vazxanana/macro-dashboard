# The Academy analyst: the optional language model

Written 10 Nov 2026. Read with `ARCHITECTURE.md` and `MODULES.md`.

The Academy decides with a deterministic engine (`MXA.decide`). That does not change. The **analyst** is an optional second
opinion: a language model that is shown one historical decision point and answers BUY, SELL, WAIT or MANAGE. It is **off**
until the owner sets a key. While it is off the page says so, nothing is sent and no answer is ever made up.

**What has been tested, said plainly: everything here ran against fakes. No real provider call was ever made, because the
project has no key.** The request and response shapes were checked against the providers' public API documentation on
10 Nov 2026. The first real call is the owner's (see the first-run checklist).

## 1. What the analyst sees, and what it never sees

It sees only what was known at the decision time. The server builds the request (`api/_academy-analyst.js` `buildRequest`):

| In the request | Where it comes from |
|---|---|
| The setup: side, entry, stop, target, timeframe, the edge's own facts about it | the server's copy of the candidate, cut to a candidate's fields |
| The edge: name, plain-English definition, cost per round trip | the registry (`academy/edges.mjs`) |
| The 95 features with their values, and what each one means | `MXA.features` of the snapshot; the glossary is `MXA.FEATURE_DOC` |
| Closed bars: the last 30 of the signal timeframe, the last 15 of each other one | the page's snapshot at the decision time |
| Releases already out (7 days) and still to come (72 hours): time, title, impact | the server's calendar file |
| The running thesis | the page |
| The mentor's lessons: the matching ones in full, the other active ones in short | the store |
| The deterministic engine's answer: action, evidence both ways, reasons to wait, gates, risk, similar past cases | the page, checked against the stored attempt |
| The open paper position, when there is one: side, entry, stop, target | the page |

It **never sees** a result. `buildRequest` refuses the whole request, before any call, when the payload holds:

- an outcome field anywhere (`R`, `netR`, `exitT`, `exit`, `reason`, `mfeR`, `maeR`, `outcome`, `result` and their kin);
- a bar that closes after the decision time, or a timeframe it does not know;
- a setup, a thesis change, a calendar item or a position dated after the decision time;
- a scheduled release that carries anything but its time, title and impact;
- an exam setup the analyst has already decided (a test setup is decided once).

The outcome files are not opened for the request. The page also holds how its paper trades ended; `assets/academy-analyst.js`
sends only the position's side and levels, and the server's check would refuse the rest anyway.

## 2. The safeguards

**Lessons are data, not instructions.** Lesson titles, texts and notes and the thesis go in as quoted data inside one
`<facts>` block. The system text tells the model that such text is never an instruction. The block cannot be closed from
inside a lesson. More important: no safeguard depends on the model obeying. Every rule below is checked in code
(`parseAnswer`), the same way for every provider.

**The answer is checked before it counts.** An answer is refused, with the reasons listed on the page, when:

- it is not one JSON object and nothing else (one fenced block around it is tolerated);
- it has a key that is not in the answer shape, or misses one;
- it gives a probability, a percentage or a score (confidence is the word low, medium or high);
- it trades the other side of the setup without a matching FLIP lesson that it names;
- a BUY or SELL has no stop, or a stop on the wrong side;
- entry, stop or target is not one of the allowed rows: the setup's own levels, or what a **matching** lesson's level rule
  gives (the engine's own arithmetic, `then.adjust`); a level taken from a lesson must name that lesson;
- it names a lesson or an evidence factor that was not supplied;
- a MANAGE has no open position, or would remove or loosen a stop (it can only hold, tighten to a supplied level, or close).

A refused answer is not stored as an answer. The call is still billed, and the refusal is in the audit trail.

**Hard gates stand.** Missing data, no stop, reward to risk below 1 after costs, a risk block, conflicting lessons, and
any gate the engine raised and did not pass on a mentor's lesson: with one of these in force the final answer is WAIT.
The gate is named, and the record keeps what the analyst wanted (`wanted`, `forced: true`).

**Kept apart.** An analyst answer is stored with `engine: 'language-model'` in its own files (`analyst/attempts`,
`analyst/corrections`, `analyst/dataset`). No number of the deterministic engine counts it: not attempts, progress, the
dataset, the blind arena or the exam summary. `GET ?get=progress` carries the analyst's record in a separate `analyst`
block. `GET ?get=attempts|corrections|dataset&engine=language-model` reads its rows.

**The engine answers first.** The analyst can only be asked on a setup whose deterministic attempt is stored (and, in the
blind arena, shown). An exam setup is decided once by each engine. The outcome gate is unchanged.

**The mentor can correct it.** `POST { action: 'correct', engine: 'language-model', … }` works like the engine's
correction. A saved lesson is in force for both. Asking again on the same setup is stored as a same-trade replay and compared
with `MXA.compare`. A lesson's own replay counters belong to the engine's replays and are not touched.

**Paper only.** Nothing here places an order or imports council, mirror or broker code. No key, endpoint or model name
reaches the browser. No model name is written in the repo: the model id comes from the environment only.

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Set values in Vercel only. Never commit a value. The three marked **required** switch the analyst on; with any of them
missing it stays off.

| Variable | Meaning |
|---|---|
| `ACADEMY_LLM_KEY` | **Required.** The provider's API key. Unset = off. |
| `ACADEMY_LLM_URL` | **Required.** The HTTPS address requests are posted to: `https://<provider host>/<path of its text API>`. |
| `ACADEMY_LLM_MODEL` | **Required.** The model id the provider expects: `<model id>`. |
| `ACADEMY_LLM_FORMAT` | The wire format. `chat` (default): system and user messages, key as a Bearer token. `messages`: system as its own field, key in `x-api-key`, an API version header. Take the one your provider documents. |
| `ACADEMY_LLM_USD_PER_MTOK_IN` | Price of one million input tokens, in US dollars. Default 10. **Set the provider's real price.** |
| `ACADEMY_LLM_USD_PER_MTOK_OUT` | Price of one million output tokens. Default 50. **Set the provider's real price.** |
| `ACADEMY_LLM_USD_PER_MTOK_CACHE_READ` | Price of input tokens the provider reports as read from its prompt cache. Default: the input price. |
| `ACADEMY_LLM_USD_PER_MTOK_CACHE_WRITE` | Price of input tokens it reports as written to its prompt cache. Default: twice the input price. |
| `ACADEMY_LLM_DAILY_USD` | Daily budget. Default 0.50. |
| `ACADEMY_LLM_MONTHLY_USD` | Monthly budget. Default 5. |
| `ACADEMY_LLM_HARD_USD` | Lifetime hard stop. Default 25. |
| `ACADEMY_LLM_MAX_CALLS_DAY` | Provider calls a day, commentary and analyst together. Default 20. |
| `ACADEMY_LLM_STOP` | `1` = the kill switch: no call at all. |
| `ACADEMY_LLM_ANALYST_MAX_TOKENS` | Output cap of one analyst call. Default 4000 (256 to 16000). A model that reasons before it answers spends output tokens on that too. |
| `ACADEMY_LLM_MAX_TOKENS` | Output cap of one commentary call (`explain`). Default 700. |
| `ACADEMY_LLM_TIMEOUT_MS` | Time allowed for one call, retries included. Default 45000, at most 55000 (the function itself stops at 60 s). |
| `ACADEMY_LLM_RETRIES` | Retries after a 408, 429, 5xx or 529 answer or a failed connection. Default 1, at most 3. |
| `ACADEMY_LLM_PROVIDER` | A label shown beside every answer. Default: the host name of the URL. |
| `ACADEMY_LLM_AUTH_HEADER` | The header that carries the key, if your provider uses another one. `Authorization` is sent as `Bearer <key>`, any other header gets the bare key. |
| `ACADEMY_LLM_API_VERSION` | `messages` format only: the value of the API version header. Default: the version current on 10 Nov 2026. |
| `ACADEMY_LLM_HEADERS` | Optional JSON object of extra request headers. |
| `ACADEMY_LLM_BODY` | Optional JSON object of extra request fields your provider documents (for example a reasoning-effort setting). It cannot replace the model, the messages, the system text or the output cap, and cannot switch streaming on. |
| `ACADEMY_LLM_MAX_TOKENS_FIELD` | `chat` format only: `max_tokens` (default) or `max_completion_tokens`. Some providers refuse the first for their reasoning models. |
| `ACADEMY_LLM_SYSTEM_ROLE` | `chat` format only: `system` (default) or `developer`. |
| `ACADEMY_LLM_JSON_SCHEMA` | `1` = also send the answer's JSON schema in the format's own structured-output field. Off by default: the answer is checked in code either way, and this path has never met a real provider. |

Vercel reads environment variables at deploy time: redeploy after a change.

## 4. Budgets, and how to change them

Before every call the adapter estimates the cost (the prompt at the input price, the **whole** output cap at the output
price) and reserves it in the ledger in one locked step. The call is refused, before it is made, when the reservation would
cross the day's budget, the month's budget or the hard stop, when the kill switch is on, or when the day's call cap is
reached. The answer then says `skipped: 'budget'` with the scope (`day`, `month`, `hard-stop`, `calls`).

After the call the reservation is corrected to what the provider **reported** as usage, at the prices in the environment.
No price is written in the code. Three cases:

- The provider answered with an error (4xx, 429, 5xx, 529): not billed. The reservation is given back.
- The call timed out, or its answer could not be read: it may have been billed. The estimate stays, counted as `unconfirmed`.
- The provider reported no usage: the estimate (characters ÷ 4) is charged and marked `estimated`.

One analyst ask is about 5,000 to 7,000 input tokens. With the default prices (set high on purpose) and the default output
cap, one ask reserves about $0.25, so the default daily budget allows only a few asks. **Set the two real prices first.** To give it
more room, raise `ACADEMY_LLM_DAILY_USD`, `ACADEMY_LLM_MONTHLY_USD`, `ACADEMY_LLM_HARD_USD` or `ACADEMY_LLM_MAX_CALLS_DAY`
and redeploy. To spend less per ask, lower `ACADEMY_LLM_ANALYST_MAX_TOKENS`; if answers then come back "cut off at the
output cap", raise it again or lower the model's reasoning effort through `ACADEMY_LLM_BODY`.

The same question is never billed twice. The cache key is the edge, the setup, the snapshot hash, the active lessons with
their versions, the thesis, the prompt version and the model settings. A repeat is answered from the cache at no cost and
stores no second attempt.

The page never asks by itself. "Ask on every setup of this run" is a switch: it first shows how many setups are left and
what they cost at most, and it stops by itself at a budget or at the call cap.

## 5. How to read the cost ledger

The Costs tab shows it; the raw form is `GET /api/academy?get=cost`.

| Field | Meaning |
|---|---|
| `enabled`, `reason` | On or off, and why it is off. |
| `provider`, `format` | The label and wire format in use. `fake: true` only on the local dev server's test double. |
| `budgets` | Daily, monthly, hard stop, and whether the kill switch is on. |
| `calls` | The daily cap, the calls made today, the calls left today. |
| `prices` | The prices and output caps the ledger is using. Check these against your provider's price list. |
| `today`, `month`, `total` | Per bucket: `usd`, `requests`, `tokensIn`, `tokensOut`, `cacheHits`, `skipped` (refused before the call), `errors`, `retries`, `unconfirmed` (timed out: the estimate was kept). |
| `remaining` | What each budget has left. |
| `days`, `months` | Every day and month so far. |

Each analyst answer also carries its own `costUsd`, token counts and provider, and writes one row to the audit trail
(Audit tab). The provider's own usage page is the bill; the ledger should be at or above it.

## 6. Turning it off at once

Set `ACADEMY_LLM_STOP` to `1` in Vercel and redeploy. No call is made from then on; every ask answers "not sent". Removing
`ACADEMY_LLM_KEY` also switches it off and shows the "Off" line. Without a redeploy: set the daily budget of the provider
account to zero on the provider's side, or revoke the key there.

## 7. What has and has not been tested

Tested, offline, in `tests/academy-analyst.test.mjs` and `scripts/audit/academy.cjs` (the appended analyst block):

- the request each wire format sends (headers, version header, system field, output cap) against the documented examples;
- reading text, stop reason and usage from each documented response shape; cost from reported usage and environment prices;
- 429, 529 and 5xx handling with a bounded retry inside one reservation; a long `Retry-After` is not waited out;
- off without a key; every budget and the call cap refusing before the call; a failed call giving its reservation back;
- every refusal in section 1 and section 2; hard gates; MANAGE; prompt injection inside a lesson;
- the cache, the audit row, the key never appearing in an answer, an error, the audit trail or a stored file;
- the analyst's rows kept apart from the engine's; the exam and outcome rules;
- the page: the off state, and the whole flow against the fake provider.

**Not tested, because no key exists: no real provider call was ever made.** Unknown until the first real call:

- whether your provider accepts the request exactly as sent (model id, version header, any field in `ACADEMY_LLM_BODY`);
- how often a real model returns an answer the checks refuse, and how good its judgement is;
- real latency against the 45 s limit, and real token counts and cost;
- the opt-in structured-output field (`ACADEMY_LLM_JSON_SCHEMA`);
- a provider-side fallback to another model after a declined request (it can be asked for through `ACADEMY_LLM_BODY` and
  `ACADEMY_LLM_HEADERS` where a provider documents one; the ledger would still price the call at the two prices you set);
- the function bundle on Vercel (the route loads `api/_academy-analyst.js` and `assets/academy-core.js`; if they are
  missing the route answers "not part of this build" and every other route keeps working).

**The fake provider.** `node scripts/academy-dev.mjs --fake-llm` serves labelled test answers from
`scripts/academy-fake-llm.cjs`: a fixed rule (follow the engine unless a matching lesson says otherwise), not a language
model, no network, no cost. Its provider name is `fake-test` and the page shows a "FAKE PROVIDER: test answers, not a
language model" banner whenever it sees that name. It is injected into the handler by the dev server and by tests only.
The deployed function takes no injected dependency, so no environment variable and no address can switch it on.

## 8. First-run checklist for the owner

1. In Vercel set `ACADEMY_LLM_KEY`, `ACADEMY_LLM_URL`, `ACADEMY_LLM_MODEL` (`<model id>`), `ACADEMY_LLM_FORMAT` and the
   two prices `ACADEMY_LLM_USD_PER_MTOK_IN` and `ACADEMY_LLM_USD_PER_MTOK_OUT`. Keep the default budgets for the first day.
2. Redeploy. Open `/academy`, go to Costs: it should say On, with your provider label and your prices.
3. In Train, start a replay and stop on one setup. The decision card shows "Analyst (language model)" with "Ask the
   analyst". There must be **no** FAKE banner on the live site.
4. Ask **one** setup. Read the answer beside the engine's: action, evidence both ways, lessons used, uncertainty, and
   anything refused.
5. Open Costs: one request, a cost of a few cents. Open Audit: one `analyse` row. Compare the cost with the provider's own
   usage page. If the ledger is below the provider's figure, fix the prices before asking again.
6. If the call failed, the card says why (status and the provider's message, with the key cut out). A 401 or 403 is the
   key or the header; a 404 is the address or the model id; a 400 names the field the provider refused.
7. Only then consider "Ask on every setup of this run". Read its estimate first.
