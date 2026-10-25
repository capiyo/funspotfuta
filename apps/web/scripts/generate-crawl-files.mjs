import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');

// This is intentionally fixed: build environment variables must not be able to
// publish a non-canonical production origin into canonical tags or the sitemap.
const origin = 'https://www.funspot.co.ke';
const requiredPages = [
  'about.html',
  'how-it-works.html',
  'contact.html',
  'terms.html',
  'privacy.html',
];

function escapeXml(value) {
  return value.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const crawlRules = [
  'User-agent: Mediapartners-Google',
  'Allow: /',
  'Disallow: /messages/',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  'User-agent: Google-Display-Ads-Bot',
  'Allow: /',
  'Disallow: /messages/',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  'User-agent: AdsBot-Google',
  'Allow: /',
  'Disallow: /messages/',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  'User-agent: *',
  'Allow: /',
  'Allow: /ads.txt',
  'Disallow: /messages/',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  `Sitemap: ${origin}/sitemap.xml`,
  '',
].join('\n');

await mkdir(distDir, { recursive: true });
const homepagePath = path.join(distDir, 'index.html');
const homepage = await readFile(homepagePath, 'utf8');
if (!/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(homepage) || !/<p\b[^>]*>[\s\S]*?<\/p>/i.test(homepage)) {
  throw new Error('[crawl-files] Homepage must include a real HTML h1 and descriptive paragraph.');
}
if (!homepage.includes(`<link rel="canonical" href="${origin}/"`) ||
    !homepage.includes(`<meta property="og:url" content="${origin}/"`) ||
    !/"url"\s*:\s*"${origin.replaceAll('.', '\\.')}\/"?/.test(homepage)) {
  throw new Error('[crawl-files] Homepage canonical, og:url and structured data must use the fixed www origin.');
}
// The SPA shell can render private screens and user-generated content, so do
// not load AdSense from index.html or the SPA entry module.
if (homepage.includes('pagead/js/adsbygoogle.js')) {
  throw new Error('[crawl-files] AdSense must not load from the SPA shell.');
}

for (const page of requiredPages) {
  const filePath = path.join(distDir, page);
  let html;
  try {
    html = await readFile(filePath, 'utf8');
  } catch {
    throw new Error(`[crawl-files] Required standalone public page missing from dist: ${page}`);
  }
  const canonical = `${origin}/${page}`;
  for (const [label, valid] of [
    ['h1', /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)],
    ['paragraph', /<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)],
    ['canonical', html.includes(`<link rel="canonical" href="${canonical}"`)],
    ['og:url', html.includes(`<meta property="og:url" content="${canonical}"`)],
    ['WebPage structured data', html.includes(`"url":"${canonical}"`)],
    ['public footer links', ['/about.html', '/how-it-works.html', '/contact.html', '/terms.html', '/privacy.html'].every((href) => html.includes(`href="${href}"`))],
    ['AdSense in head', /<head>[\s\S]*?pagead\/js\/adsbygoogle\.js[\s\S]*?<\/head>/i.test(html)],
  ]) {
    if (!valid) throw new Error(`[crawl-files] ${page} is missing valid ${label}.`);
  }
}
const contactPage = await readFile(path.join(distDir, 'contact.html'), 'utf8');
if (!contactPage.includes('TODO') || !contactPage.includes('real contact method')) {
  throw new Error('[crawl-files] Contact page must keep the clearly marked unprovided-contact TODO.');
}

await writeFile(path.join(distDir, 'robots.txt'), crawlRules, 'utf8');
const sitemapRoutes = ['/', ...requiredPages.map((page) => `/${page}`)];
const urls = sitemapRoutes.map((route) => {
  const loc = escapeXml(new URL(route, `${origin}/`).href);
  return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
});
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls,
  '</urlset>',
  '',
].join('\n');
await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
console.info(`[crawl-files] Verified homepage and ${requiredPages.length} standalone public pages; generated sitemap for ${origin}.`);
