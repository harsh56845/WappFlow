# Deploy WappFlow on GitHub Pages

GitHub Pages hosts **static files only** (HTML, CSS, JS). The UI runs in the browser; **campaigns and customers stay in `sessionStorage`** on each device.

## What works on Pages

- Import CSV/XLSX, templates, campaigns (in-browser memory)
- UI, reports export, suppression list (browser-only)

## What does **not** run on Pages alone

- **WhatsApp QR / pairing / auto-send** need the **Node.js server** (`server.js` + Baileys). GitHub Pages cannot run that code.

### Option A — Easiest (recommended): one URL, no paste

1. Deploy the **full app** with [Render](https://render.com) using `render.yaml` in this repo (or run `npm start` locally).
2. Open that URL in the browser — QR and pairing work automatically (UI and engine share the same origin).

### Option B — GitHub Pages UI + hosted engine (no manual paste in the app)

1. Deploy the engine (Render / VPS) and note the **https://** URL (required — Pages is https, so `http://192.168.x.x` is blocked by the browser).
2. In GitHub: **Settings → Secrets and variables → Actions → Variables** → add `WAPPFLOW_WA_ENGINE_URL` = `https://your-wappflow.onrender.com`
3. Redeploy Pages. The build injects that URL into the site; QR/pairing call your server with no settings field.

### Option C — Home Wi‑Fi only

Run `npm start` and open **`http://<your-lan-ip>:3000`** on the same network — not the `github.io` link. QR works with no extra configuration.

## One-time GitHub setup

1. Push this repo to GitHub.
2. **Enable Pages (required)** — if the workflow fails with `Failed to create deployment (status: 404)` or *Ensure GitHub Pages has been enabled*, Pages is still off:
   - Open [WappFlow → Settings → Pages](https://github.com/harsh56845/WappFlow/settings/pages) (repo **Admin** only).
   - Under **Build and deployment → Source**, choose **GitHub Actions** (not “Deploy from a branch”).
   - Save. You do not need to pick a branch when using Actions.
3. Push to `main` or re-run **Actions → Deploy GitHub Pages → Re-run all jobs**.
4. Open: `https://harsh56845.github.io/WappFlow/`

If **Source** has no “GitHub Actions” option, confirm the repo is public (or you have GitHub Pro for private Pages) and you are logged in as the owner (`harsh56845`), not a read-only collaborator.

## Local full stack (WhatsApp + UI)

```bash
npm start
# http://localhost:3000
```

## Workflow file

`.github/workflows/deploy-github-pages.yml` copies `public/` and sets the correct **base path** for project Pages (`/<repo-name>/`).
