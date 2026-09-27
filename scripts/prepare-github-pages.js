#!/usr/bin/env node
/**
 * Injects GitHub Pages base path into static site (meta tag + .nojekyll).
 * Usage: node scripts/prepare-github-pages.js <siteDir> [basePath]
 * Example: node scripts/prepare-github-pages.js _site /bulk_whatsappmsgtool/
 */
const fs = require('fs');
const path = require('path');

const siteDir = path.resolve(process.argv[2] || '_site');
let basePath = process.argv[3] || process.env.GITHUB_PAGES_BASE || '/';

if (!basePath.startsWith('/')) basePath = '/' + basePath;
if (!basePath.endsWith('/')) basePath += '/';
if (basePath === '//') basePath = '/';

const indexPath = path.join(siteDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('index.html not found in', siteDir);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');
const metaTag = `<meta name="wappflow-base" content="${basePath}">`;

if (html.includes('name="wappflow-base"')) {
  html = html.replace(/<meta name="wappflow-base" content="[^"]*">/, metaTag);
} else {
  html = html.replace('<head>', `<head>\n  ${metaTag}`);
}

fs.writeFileSync(indexPath, html);
fs.writeFileSync(path.join(siteDir, '.nojekyll'), '');
console.log('GitHub Pages prepared:', siteDir, 'base:', basePath);
