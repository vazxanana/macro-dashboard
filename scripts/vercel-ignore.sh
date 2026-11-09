#!/bin/sh
# Vercel "Ignored Build Step" (vercel.json ignoreCommand). Exit 0 = skip this deployment, exit 1 = build it.
# 8 Nov 2026: 283 commits reached main in one day and each one ran a preview build and a production build (3,692 build
# CPU minutes, $12.92 of the day's $15.83 Vercel usage) although the build only copies files. Only main deploys, and only
# when something the site serves changed: the pages, the PWA files, assets, the API functions, the build itself or a
# published edge study. Council code, tests, workflows and research scripts change nothing on the site.
[ "$VERCEL_GIT_COMMIT_REF" = "main" ] || exit 0
if git diff --quiet HEAD^ HEAD -- market-structure.html gold-trading.html index.html edge-lab.html macro-desk.html backtest.html manifest.json app.webmanifest sw.js offline.html icons icon-192.png icon-512.png robots.txt assets api vercel.json scripts package.json package-lock.json research/edge research/macro-veteran 2>/dev/null; then
  exit 0   # nothing the site serves changed
fi
exit 1
