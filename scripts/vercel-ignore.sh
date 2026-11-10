#!/bin/sh
# Vercel "Ignored Build Step" (vercel.json ignoreCommand). Exit 0 = skip this deployment, exit 1 = build it.
# 8 Nov 2026: 283 commits reached main in one day and each one ran a preview build and a production build (3,692 build
# CPU minutes, $12.92 of the day's $15.83 Vercel usage) although the build only copies files. Only main deploys, and only
# when something the site serves changed: the pages, the PWA files, assets, the API functions, the build itself or a
# published edge study. Council code, tests, workflows and research scripts change nothing on the site.
# 10 Nov 2026: ict/ counts too. Two functions bundle ict/*.mjs (api/mcp.js, the ICT backtest lab; api/run.js, the backup
# runner), so a merged ICT change must redeploy them or they keep running the old rule.
# 10 Nov 2026: one branch may also get a PREVIEW build, and only when the owner opts in by setting the project variable
# MX_PREVIEW_BRANCH (Preview environment) to that branch's exact name. Unset (the default) nothing but main builds, as before.
# A preview is never production: Vercel serves it on its own protected URL and the Academy keeps its files in academy-preview/.
if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then
  [ -n "$MX_PREVIEW_BRANCH" ] && [ "$VERCEL_GIT_COMMIT_REF" = "$MX_PREVIEW_BRANCH" ] && [ "$VERCEL_ENV" != "production" ] || exit 0
fi
if git diff --quiet HEAD^ HEAD -- market-structure.html gold-trading.html index.html edge-lab.html macro-desk.html backtest.html manifest.json app.webmanifest sw.js offline.html icons icon-192.png icon-512.png robots.txt assets api ict academy academy.html ml/models/index.json vercel.json scripts package.json package-lock.json research/edge research/macro-veteran 2>/dev/null; then
  exit 0   # nothing the site serves changed
fi
exit 1
