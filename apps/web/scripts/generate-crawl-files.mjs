import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');
const configuredOrigin = process.env.VITE_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : (process.env.CONTEXT === 'production' && process.env.URL ? process.env.URL : 'https://funspot.co.ke'));

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return '';
    return url.origin;
  } catch {
    return '';
  }
}

const origin = normalizeOrigin(configuredOrigin);
const crawlRules = [
  // Let Google's ad crawler inspect pages where AdSense units are shown.
  'User-agent: AdsBot-Google',
  'Allow: /',
  'Allow: /ads.txt',
  'Disallow: /login',
  'Disallow: /comments/',
  '',
  // Keep personal messaging and account/comment routes out of ordinary search.
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
  console.warn('[crawl-files] VITE_SITE_URL is not configured; robots.txt was generated without a sitemap URL. Set VITE_SITE_URL to override the canonical production origin.');
} else {
  const urls = ['/', '/privacy.html'];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((route) => `  <url><loc>${origin}${route}</loc></url>`).join('\n')
    + '\n</urlset>\n';
  await writeFile(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
  console.info(`[crawl-files] Generated sitemap.xml for ${origin}`);
}
