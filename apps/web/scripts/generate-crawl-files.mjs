import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(webDir, 'dist');
const origin = 'https://www.funspot.co.ke';
const pages = ['about.html', 'how-it-works.html', 'contact.html', 'terms.html', 'privacy.html'];
const homepageSource = await readFile(path.join(webDir, 'index.html'), 'utf8');
await mkdir(distDir, { recursive: true });
await cp(path.join(webDir, 'public'), distDir, { recursive: true, force: true });
await writeFile(path.join(distDir, 'index.html'), homepageSource, 'utf8');
const email = process.env.FUNSPOT_CONTACT_EMAIL?.trim() ?? '';
const validEmail = /^[A-Z0-9.!#$%&'*+/=?^`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
const emailDomain = email.split('@').at(-1)?.toLowerCase() ?? '';
const reservedDomain = /(?:^|\\.)(?:invalid|example|test|localhost)$/.test(emailDomain)
  || /^example\\.(?:com|org|net)$/.test(emailDomain);
const ciValidationAddress = process.env.CI === 'true' && email === 'build-validation@invalid.invalid';
if (!validEmail.test(email) || (reservedDomain && !ciValidationAddress)) {
  throw new Error('[crawl-files] Set FUNSPOT_CONTACT_EMAIL to a real, non-placeholder contact email before building public pages.');
}
const contactPath = path.join(distDir, 'contact.html');
let contact = await readFile(contactPath, 'utf8');
if (!contact.includes('{{FUNSPOT_CONTACT_EMAIL}}')) throw new Error('[crawl-files] Contact email template token is missing.');
contact = contact.replaceAll('{{FUNSPOT_CONTACT_EMAIL}}', email);
await writeFile(contactPath, contact, 'utf8');
const rules = [
'User-agent: Mediapartners-Google','Allow: /','Disallow: /app/','Disallow: /messages/','Disallow: /comments/','Disallow: /login','',
'User-agent: Google-Display-Ads-Bot','Allow: /','Disallow: /app/','Disallow: /messages/','Disallow: /comments/','Disallow: /login','',
'User-agent: AdsBot-Google','Allow: /','Disallow: /app/','Disallow: /messages/','Disallow: /comments/','Disallow: /login','',
'User-agent: *','Allow: /','Allow: /ads.txt','Disallow: /app/','Disallow: /messages/','Disallow: /comments/','Disallow: /login','',
`Sitemap: ${origin}/sitemap.xml`,''].join('\n');
const homepage = await readFile(path.join(distDir, 'index.html'), 'utf8');
if (!homepage.includes(`<link rel="canonical" href="${origin}/"`) || !homepage.includes(`<meta property="og:url" content="${origin}/"`)) throw new Error('[crawl-files] Homepage canonical metadata must use www.funspot.co.ke.');
if (/\/(?:app\/)?assets\/|<script[^>]+type="module"[^>]+src=/i.test(homepage)) throw new Error('[crawl-files] Homepage must be plain HTML without React/Vite bundle references.');
if (homepage.includes('pagead/js/adsbygoogle.js')) throw new Error('[crawl-files] AdSense must not load on the homepage.');
const app = await readFile(path.join(distDir, 'app/index.html'), 'utf8');
if (!app.includes('noindex,nofollow') || !app.includes('/manifest.webmanifest') || app.includes('pagead/js/adsbygoogle.js')) throw new Error('[crawl-files] /app/ must be noindex, use the manifest and omit AdSense.');
for (const page of pages) {
 const html = await readFile(path.join(distDir, page), 'utf8'), canonical = `${origin}/${page}`;
 for (const [label, ok] of [['h1',/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)],['paragraph',/<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)],['canonical',html.includes(`<link rel="canonical" href="${canonical}"`)],['og:url',html.includes(`<meta property="og:url" content="${canonical}"`)],['structured data',html.includes(`"url":"${canonical}"`)]]) if(!ok) throw new Error(`[crawl-files] ${page} missing ${label}.`);
}
await writeFile(path.join(distDir,'robots.txt'),rules,'utf8');
const urls=['/',...pages.map(p=>`/${p}`)].map(route=>`  <url><loc>${new URL(route,origin).href}</loc></url>`);
await writeFile(path.join(distDir,'sitemap.xml'),['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...urls,'</urlset>',''].join('\n'),'utf8');
console.info('[crawl-files] Static homepage, public pages, robots and sitemap verified.');
