import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(webDir, '../..');
const distDir = path.join(webDir, 'dist');
const origin = 'https://www.funspot.co.ke';
const pages = ['about.html', 'how-it-works.html', 'contact.html', 'terms.html', 'privacy.html'];

await mkdir(distDir, { recursive: true });
await cp(path.join(webDir, 'public'), distDir, { recursive: true, force: true });

const email = process.env.FUNSPOT_CONTACT_EMAIL?.trim() ?? '';
if (!isValidContactEmail(email)) {
  throw new Error('[crawl-files] Set FUNSPOT_CONTACT_EMAIL to a valid contact email before building public pages.');
}
const contactPath = path.join(distDir, 'contact.html');
let contact = await readFile(contactPath, 'utf8');
if (!contact.includes('{{FUNSPOT_CONTACT_EMAIL}}')) {
  throw new Error('[crawl-files] Contact email template token is missing.');
}
contact = contact.replaceAll('{{FUNSPOT_CONTACT_EMAIL}}', email);
await writeFile(contactPath, contact, 'utf8');

const shell = await readFile(path.join(distDir, 'index.html'), 'utf8');
if (!shell.includes('<div id="root"></div>')) {
  throw new Error('[crawl-files] App shell is missing the React application root.');
}
if (shell.includes('public-home') || shell.includes('PublicHomeContent')) {
  throw new Error('[crawl-files] A separate public homepage must not be included in the app shell.');
}
if (!shell.includes('<link rel="canonical" href="' + origin + '/"') ||
    !shell.includes('<meta property="og:url" content="' + origin + '/"') ||
    !shell.includes('google-adsense-account')) {
  throw new Error('[crawl-files] Homepage canonical, Open Graph or AdSense verification metadata is missing.');
}
if (shell.includes('pagead/js/adsbygoogle.js')) {
  throw new Error('[crawl-files] AdSense must not load in the SPA shell.');
}

// Root visitors and crawlers receive the exact same SPA document. No alternate
// homepage content, crawler-only renderer, or user-agent-dependent response.
const functionDir = path.join(repoDir, 'netlify', 'functions');
await mkdir(functionDir, { recursive: true });
const functionSource = [
  'const template = ' + JSON.stringify(shell) + ';',
  '',
  'export default async function handler(request) {',
  '  const requestUrl = new URL(request.url);',
  '  const requestedPath = requestUrl.searchParams.get("path") || requestUrl.pathname;',
  '  const isHome = requestedPath === "/";',
  '  const isMessageRoute = requestedPath === "/messages" || requestedPath.startsWith("/messages/");',
  '  const commentPath = requestedPath.startsWith("/comments/") ? requestedPath.slice("/comments/".length) : "";',
  '  const isCommentRoute = commentPath.length > 0 && !commentPath.includes("/");',
  '  const isAppRoute = isMessageRoute || isCommentRoute || requestedPath === "/login";',
  '  if (!isHome && !isAppRoute) {',
  '    return new Response("Not Found", {',
  '      status: 404,',
  '      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },',
  '    });',
  '  }',
  '',
  '  return new Response(template, {',
  '    status: 200,',
  '    headers: {',
  '      "content-type": "text/html; charset=utf-8",',
  '      "cache-control": isHome',
  '        ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"',
  '        : "no-cache",',
  '      "x-content-type-options": "nosniff",',
  '      "x-funspot-render": "same-app-shell",',
  '    },',
  '  });',
  '}',
  '',
].join('\n');
await writeFile(path.join(functionDir, 'ssr.mjs'), functionSource, 'utf8');

for (const page of pages) {
  const html = await readFile(path.join(distDir, page), 'utf8');
  const canonical = origin + '/' + page;
  for (const [label, ok] of [
    ['h1', /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)],
    ['paragraph', /<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)],
    ['canonical', html.includes('<link rel="canonical" href="' + canonical + '"')],
    ['og:url', html.includes('<meta property="og:url" content="' + canonical + '"')],
    ['structured data', html.includes('"url":"' + canonical + '"')],
  ]) {
    if (!ok) throw new Error('[crawl-files] ' + page + ' missing ' + label + '.');
  }
}

const rules = [
  'User-agent: Mediapartners-Google', 'Allow: /', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: Google-Display-Ads-Bot', 'Allow: /', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: AdsBot-Google', 'Allow: /', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: *', 'Allow: /', 'Allow: /ads.txt', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'Sitemap: ' + origin + '/sitemap.xml', '',
].join('\n');
await writeFile(path.join(distDir, 'robots.txt'), rules, 'utf8');
const urls = ['/', ...pages.map((page) => '/' + page)]
  .map((route) => '  <url><loc>' + new URL(route, origin).href + '</loc></url>');
await writeFile(path.join(distDir, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls, '</urlset>', '',
].join('\n'), 'utf8');

console.info('[crawl-files] Verified one application shell, public pages, metadata, robots.txt and sitemap.');
