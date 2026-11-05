import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');
const origin = 'https://www.funspot.co.ke';
const requiredPages = ['about.html', 'how-it-works.html', 'contact.html', 'terms.html', 'privacy.html'];
function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
const crawlRules = [
  'User-agent: Mediapartners-Google', 'Allow: /', 'Disallow: /app/', '',
  'User-agent: Google-Display-Ads-Bot', 'Allow: /', 'Disallow: /app/', '',
  'User-agent: AdsBot-Google', 'Allow: /', 'Disallow: /app/', '',
  'User-agent: *', 'Allow: /', 'Allow: /ads.txt', 'Disallow: /app/', '',
  `Sitemap: ${origin}/sitemap.xml`, '',
].join('\n');
await mkdir(distDir, { recursive: true });
const homepage = await readFile(path.join(distDir, 'index.html'), 'utf8');
if (!homepage.includes(`<link rel="canonical" href="${origin}/"`) ||
    !homepage.includes(`<meta property="og:url" content="${origin}/"`) ||
    !(homepage.includes(`"url": "${origin}/"`) || homepage.includes(`"url":"${origin}/"`))) {
  throw new Error('[crawl-files] Public homepage canonical, og:url and structured data must use the fixed www origin.');
}
if (homepage.includes('pagead/js/adsbygoogle.js')) throw new Error('[crawl-files] Do not load AdSense on the public homepage.');
const appEntry = await readFile(path.join(distDir, 'app', 'index.html'), 'utf8');
if (!appEntry.includes('noindex,nofollow') || !appEntry.includes('/manifest.webmanifest')) {
  throw new Error('[crawl-files] /app/ entry must be noindex and link the PWA manifest.');
}
if (appEntry.includes('pagead/js/adsbygoogle.js')) throw new Error('[crawl-files] AdSense loader must not be included in /app/.');
for (const page of requiredPages) {
  const html = await readFile(path.join(distDir, page), 'utf8');
  const canonical = `${origin}/${page}`;
  const checks = [
    ['h1', /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)],
    ['paragraph', /<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)],
    ['canonical', html.includes(`<link rel="canonical" href="${canonical}"`)],
    ['og:url', html.includes(`<meta property="og:url" content="${canonical}"`)],
    ['WebPage structured data', html.includes(`"url":"${canonical}"`)],
    ['public footer links', ['/about.html', '/how-it-works.html', '/contact.html', '/terms.html', '/privacy.html'].every((href) => html.includes(`href="${href}"`))],
    ['AdSense in head', /<head>[\s\S]*?pagead\/js\/adsbygoogle\.js[\s\S]*?<\/head>/i.test(html)],
  ];
  for (const [label, valid] of checks) if (!valid) throw new Error(`[crawl-files] ${page} is missing valid ${label}.`);
}
await writeFile(path.join(distDir, 'robots.txt'), crawlRules, 'utf8');
const routes = ['/', ...requiredPages.map((page) => `/${page}`)];
const urls = routes.map((route) => `  <url>\n    <loc>${escapeXml(new URL(route, `${origin}/`).href)}</loc>\n  </url>`);
const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n');
await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
console.info(`[crawl-files] Verified public homepage and ${requiredPages.length} standalone public pages; generated sitemap for ${origin}.`);
