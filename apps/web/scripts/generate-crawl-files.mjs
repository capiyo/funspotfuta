import { mkdir, readdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');
// Keep production URLs canonical; never publish preview-host URLs in the sitemap.
const configuredOrigin = process.env.VITE_SITE_URL || 'https://funspot.co.ke';

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && url.hostname !== 'localhost') || url.username || url.password) return '';
    return url.origin;
  } catch {
    return '';
  }
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const origin = normalizeOrigin(configuredOrigin);
const crawlRules = [
  // Google's AdSense content crawler and ad review crawlers need public-page access.
  'User-agent: Mediapartners-Google',
  'Allow: /',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  'User-agent: Google-Display-Ads-Bot',
  'Allow: /',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  'User-agent: AdsBot-Google',
  'Allow: /',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  // Do not invite search engines to crawl private messaging or login-only routes.
  'User-agent: *',
  'Allow: /',
  'Allow: /ads.txt',
  'Disallow: /messages/',
  'Disallow: /login',
  'Disallow: /comments/',
  ...(origin ? ['', `Sitemap: ${origin}/sitemap.xml`] : []),
  '',
].join('\n');

await mkdir(distDir, { recursive: true });
await writeFile(path.join(distDir, 'robots.txt'), crawlRules, 'utf8');

if (!origin) {
  await rm(path.join(distDir, 'sitemap.xml'), { force: true });
  console.warn('[crawl-files] Invalid VITE_SITE_URL; generated robots.txt without a sitemap declaration and removed stale sitemap.xml.');
  process.exitCode = 1;
} else {
  // Include the SPA homepage and real, standalone HTML documents emitted to dist.
  // Do not invent URLs for React views that are not independent public pages.
  const entries = await readdir(distDir, { withFileTypes: true });
  const staticPages = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .map((entry) => entry.name)
    .filter((name) => !['index.html', '404.html'].includes(name.toLowerCase()))
    .filter((name) => !name.startsWith('.'))
    .sort((a, b) => a.localeCompare(b));

  const routes = ['/', ...staticPages.map((name) => `/${name.split('/').map(encodeURIComponent).join('/')}`)];
  const uniqueRoutes = [...new Set(routes)];
  const urls = uniqueRoutes.map((route) => {
    const loc = escapeXml(new URL(route, `${origin}/`).href);
    return `  <url>\n    <loc>${loc}</loc>\n  </url>`;
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  // Fail the build if a protected route accidentally enters the public sitemap.
  const forbiddenRoute = /\/(?:login|messages|comments)(?:\/|$)/i;
  if (uniqueRoutes.some((route) => forbiddenRoute.test(route))) {
    throw new Error('[crawl-files] Protected route detected in sitemap.');
  }

  await writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.info(`[crawl-files] Generated sitemap.xml for ${origin} with ${uniqueRoutes.length} public URL(s): ${uniqueRoutes.join(', ')}`);
}
