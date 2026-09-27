#!/usr/bin/env node
/**
 * Injects GitHub Pages base path + optional WhatsApp engine URL into static site.
 * Usage: node scripts/prepare-github-pages.js <siteDir> [basePath]
 * Env: WAPPFLOW_WA_ENGINE_URL — https origin where npm start / Render runs (no trailing slash)
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.resolve(process.argv[2] || '_site');
let basePath = process.argv[3] || process.env.GITHUB_PAGES_BASE || '/';
const waEngine = (process.env.WAPPFLOW_WA_ENGINE_URL || '').trim().replace(/\/$/, '');

if (!basePath.startsWith('/')) basePath = '/' + basePath;
if (!basePath.endsWith('/')) basePath += '/';
if (basePath === '//') basePath = '/';

const indexPath = path.join(siteDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('index.html not found in', siteDir);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

function upsertMeta(name, content) {
  const metaTag = `<meta name="${name}" content="${content}">`;
  const re = new RegExp(`<meta name="${name}" content="[^"]*">`);
  if (re.test(html)) html = html.replace(re, metaTag);
  else html = html.replace('<head>', `<head>\n  ${metaTag}`);
}

upsertMeta('wappflow-base', basePath);
upsertMeta('wappflow-wa-engine', waEngine);

fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');
console.log('GitHub Pages prepared:', siteDir, 'base:', basePath, waEngine ? `wa-engine: ${waEngine}` : 'wa-engine: (not set)');
