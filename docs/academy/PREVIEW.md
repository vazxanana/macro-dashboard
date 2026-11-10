# A safe preview of the Academy

Status on 10 Nov 2026: **no preview exists yet.** The assistant's Vercel connection could see the team but not the project
(zero projects, zero deployments listed), so it could not read the project's settings or start a deployment. Nothing was
bypassed. What follows is ready on the branch and needs one owner action.

## What a preview is here

A preview is a separate deployment of one branch on its own Vercel URL. It is not production: `meridianx.dev` keeps serving
`main`, the crons in `vercel.json` only run on production, and previews are behind Vercel's own sign-in (the project's
"previews only" protection).

## What is already in place on the branch

- **Opt-in build.** `scripts/vercel-ignore.sh` still skips every branch except `main`. It builds a preview for exactly one
  branch, and only when the project variable `MX_PREVIEW_BRANCH` holds that branch's name. Unset, nothing changes. A branch
  can never be built as production through this switch (test: `tests/academy-preview.test.mjs`).
- **Separate storage.** The Academy keeps its files under `academy/` on production and under `academy-preview/` on any
  preview or development deployment (`api/_academy-store.js` `rootFor`, decided from `VERCEL_ENV`, never from a request).
  The two folders share the project's private Blob store and cannot read or overwrite each other (same test file).
- **No orders, no bot writes.** The Academy has no broker or council code. The council's cron runner is not triggered on a
  preview.

## The owner action (about two minutes)

1. Vercel → project `macro-dashboard` → Settings → Environment Variables → add
   `MX_PREVIEW_BRANCH` = `claude/website-display-xoyadz`, environment **Preview** only.
2. Check that the Preview environment has the variables the site needs to sign in and store: the session key
   (`SESSION_SECRET`, or `CTRADER_LINK_KEY` / `CRON_SECRET` which it falls back to), `BLOB_READ_WRITE_TOKEN`, and
   `OANDA_TOKEN` for candles. If they are set for "All Environments" already, nothing to do. Without the Blob token the
   Academy answers "storage not set up" instead of working badly.
3. Push any commit to the branch (or use Deployments → Redeploy on the branch's latest commit). The build copies files and
   takes under a minute.
4. Open the preview URL Vercel shows on the pull request, sign in to Vercel when asked, sign in to the desk as the owner,
   then open `/academy`.

To stop previews again: delete `MX_PREVIEW_BRANCH`.

## Cost

A preview build uses the existing plan's build minutes; this build only copies files. On 8 Nov the project paid about
$12.92 for 566 builds in a day (roughly two cents a build), which is why branch builds were switched off. With the opt-in,
one branch builds once a push. Leave the variable unset while the branch is being pushed to many times a day.

## Limits to know

- Use the preview for `/academy`. The other pages on a preview read the same council data and the same user list as
  production (that is how every preview of this project has always worked); changing users, profile photos or
  notifications there changes the real ones.
- The language-model analyst stays off on the preview unless its key is also set for the Preview environment
  (`docs/academy/LLM.md`).
- The firewall's rate limits are project-wide and apply to the preview too; the page paces itself to stay inside them.

## Without a preview

`sh scripts/build.sh && node scripts/academy-dev.mjs` serves the built site with the real Academy API on a local file
store at `http://127.0.0.1:8770/academy` (recorded candles; add `--live` and run node with `--use-env-proxy` for live
candles).
