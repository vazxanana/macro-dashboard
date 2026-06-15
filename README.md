# Institutional Trading Dashboard - Netlify Deployment

## Files Included

- `index.html` - Complete dashboard (all-in-one file with HTML, CSS, and JavaScript)
- `netlify.toml` - Netlify configuration
- `_redirects` - URL routing configuration

## How to Deploy to Netlify

### Option 1: Drag & Drop (Easiest)

1. Go to https://app.netlify.com
2. Sign in (or create free account)
3. Drag this entire folder onto the Netlify dashboard
4. **Done!** Your site is live in seconds

### Option 2: Netlify CLI

```bash
# Install Netlify CLI (if not already installed)
npm install -g netlify-cli

# Navigate to this folder
cd netlify-deploy

# Log in
netlify login

# Deploy to production
netlify deploy --prod
```

### Option 3: Git Push (GitHub/GitLab)

1. Create a new GitHub repo
2. Push this folder to GitHub
3. Connect repo to Netlify in dashboard
4. Netlify auto-deploys on each push

## Dashboard Features

✅ Soft purple institutional design (#9B7BA8)
✅ Real-time market signals (10 major indicators)
✅ Economic calendar with multi-timeframe impact (1m, 3m, 5m, 10m)
✅ Trade Setups tab with macro-based trading ideas
✅ Weekly Report tab with comprehensive analysis
✅ Professional Bloomberg-style typography
✅ Glassmorphism UI design
✅ Dark terminal aesthetic
✅ Full responsive design
✅ Real-time data refresh
✅ News detail modal
✅ Risk appetite calculation

## All-in-One File

`index.html` contains everything needed - no external dependencies, no build process required.

## Support

For issues or updates, regenerate the dashboard HTML file and replace `index.html`.
