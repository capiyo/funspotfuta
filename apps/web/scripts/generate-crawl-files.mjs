import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(webDir, 'dist');
const origin = 'https://www.funspot.co.ke';
const pages = ['about.html', 'how-it-works.html', 'contact.html', 'terms.html', 'privacy.html'];
await mkdir(distDir, { recursive: true });
await cp(path.join(webDir, 'public'), distDir, { recursive: true, force: true });
const email = process.env.FUNSPOT_CONTACT_EMAIL?.trim() ?? '';
if (!isValidContactEmail(email)) throw new Error('[crawl-files] Set FUNSPOT_CONTACT_EMAIL to a valid, non-placeholder contact email before building public pages.');
const contactPath = path.join(distDir, 'contact.html');
let contact = await readFile(contactPath, 'utf8');
if (!contact.includes('{{FUNSPOT_CONTACT_EMAIL}}')) throw new Error('[crawl-files] Contact email template token is missing.');
contact = contact.replaceAll('{{FUNSPOT_CONTACT_EMAIL}}', email);
await writeFile(contactPath, contact, 'utf8');
const homepage = await readFile(path.join(distDir, 'index.html'), 'utf8');
const rootStart = homepage.indexOf('<div id="root">');
const rootEnd = homepage.lastIndexOf('</div>');
if (rootStart < 0 || rootEnd <= rootStart) throw new Error('[crawl-files] Built app shell must contain #root.');
const rootHtml = homepage.slice(rootStart + '<div id="root">'.length, rootEnd);
const staticText = rootHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<!--([\s\S]*?)-->/g, ' ').replace(/<[^>]+>/g, ' ');
const wordCount = staticText.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
if (wordCount < 250) throw new Error(`[crawl-files] #root needs at least 250 static words; found ${wordCount}.`);
if (/\b(?:TODO|TBD|placeholder|lorem ipsum|TYPE\s+REAL)\b/i.test(rootHtml)) throw new Error('[crawl-files] #root contains TODO or placeholder text.');
if (!homepage.includes(`<link rel="canonical" href="${origin}/"`) || !homepage.includes(`<meta property="og:url" content="${origin}/"`)) throw new Error('[crawl-files] Homepage canonical metadata must use www.funspot.co.ke.');
if (!homepage.includes('google-adsense-account')) throw new Error('[crawl-files] Homepage AdSense verification meta tag is missing.');
if (!homepage.includes('/manifest.webmanifest')) throw new Error('[crawl-files] App shell must link the PWA manifest.');
if (homepage.includes('pagead/js/adsbygoogle.js')) throw new Error('[crawl-files] AdSense must not load in the app shell.');
for (const page of pages) {
  const html = await readFile(path.join(distDir, page), 'utf8');
  const canonical = `${origin}/${page}`;
  for (const [label, ok] of [
    ['h1', /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)],
    ['paragraph', /<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)],
    ['canonical', html.includes(`<link rel="canonical" href="${canonical}"`)],
    ['og:url', html.includes(`<meta property="og:url" content="${canonical}"`)],
    ['structured data', html.includes(`"url":"${canonical}"`)],
  ]) if (!ok) throw new Error(`[crawl-files] ${page} missing ${label}.`);
}
const rules = [
  'User-agent: Mediapartners-Google', 'Allow: /', 'Disallow: /messages/', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: Google-Display-Ads-Bot', 'Allow: /', 'Disallow: /messages/', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: AdsBot-Google', 'Allow: /', 'Disallow: /messages/', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: *', 'Allow: /', 'Allow: /ads.txt', 'Disallow: /messages/', 'Disallow: /login', 'Disallow: /comments/', '',
  `Sitemap: ${origin}/sitemap.xml`, '',
].join('\n');
await writeFile(path.join(distDir, 'robots.txt'), rules, 'utf8');
const urls = ['/', ...pages.map((page) => `/${page}`)].map((route) => `  <url><loc>${new URL(route, origin).href}</loc></url>`);
await writeFile(path.join(distDir, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls, '</urlset>', '',
].join('\n'), 'utf8');
console.info(`[crawl-files] Root app shell has ${wordCount} static words; public pages, robots and sitemap verified.`);
