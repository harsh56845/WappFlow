# Deploy WappFlow on GitHub Pages

GitHub Pages hosts **static files only** (HTML, CSS, JS). The UI runs in the browser; **campaigns and customers stay in `sessionStorage`** on each device.

## What works on Pages

- Import CSV/XLSX, templates, campaigns (in-browser memory)
- UI, reports export, suppression list (browser-only)

## What does **not** run on Pages

- **WhatsApp QR / pairing / auto-send** need the **Node.js server** (`server.js` + Baileys) on a machine you control (Mac, VPS, Railway, etc.).

On GitHub Pages, set **Settings → WhatsApp link → Self-hosted WhatsApp engine URL** to your server, for example:

`http://192.168.1.5:3000` (home Wi‑Fi) or `https://your-vps.example.com`

The server must be reachable from the browser and already allows CORS (WappFlow’s server sets `Access-Control-Allow-Origin: *`).

## One-time GitHub setup

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions**
3. Push to `main` (or run workflow **Deploy GitHub Pages** manually).
4. Open: `https://<username>.github.io/<repo-name>/`

## Local full stack (WhatsApp + UI)

```bash
npm start
# http://localhost:3000
```

## Workflow file

`.github/workflows/deploy-github-pages.yml` copies `public/` and sets the correct **base path** for project Pages (`/<repo-name>/`).
