import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(webDir, '../..');
const distDir = path.join(webDir, 'dist');
const ssrEntry = path.join(webDir, 'dist-ssr', 'entry-server.js');
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
if (!shell.includes('<link rel="canonical" href="' + origin + '/"') ||
    !shell.includes('<meta property="og:url" content="' + origin + '/"') ||
    !shell.includes('google-adsense-account')) {
  throw new Error('[crawl-files] Homepage canonical, Open Graph or AdSense verification metadata is missing.');
}
if (shell.includes('pagead/js/adsbygoogle.js')) {
  throw new Error('[crawl-files] AdSense must not load in the homepage or app shell.');
}

const ssrBundle = await readFile(ssrEntry, 'utf8');
if (!ssrBundle.trim() || !ssrBundle.includes('renderHome') || !ssrBundle.includes('renderNotFound')) {
  throw new Error('[crawl-files] The production React SSR bundle is missing its render entry points.');
}

const ssrRenderer = await import(pathToFileURL(ssrEntry).href);
const renderedHome = ssrRenderer.renderHome();
const renderedNotFound = ssrRenderer.renderNotFound();
if (!renderedHome.includes('<h1') || !renderedHome.includes('Football is better') || renderedHome.includes('<div id="root"></div>')) {
  throw new Error('[crawl-files] React SSR did not produce meaningful homepage HTML.');
}
if (!renderedNotFound.includes('This page isn\'t here.')) {
  throw new Error('[crawl-files] React SSR did not produce the custom 404 content.');
}

const functionDir = path.join(repoDir, 'netlify', 'functions');
await mkdir(functionDir, { recursive: true });
const functionSource = String.raw`import { renderHome, renderNotFound } from "../../apps/web/dist-ssr/entry-server.js";
const template = __SHELL__;
function withRoot(mode, content = "") {
  const marker = '<div id="root"></div>';
  if (!template.includes(marker)) throw new Error("SSR HTML template is missing #root");
  return template.replace(marker, '<div id="root" data-render-mode="' + mode + '">' + content + '</div>');
}
const appHtml = withRoot("app");

export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const requestedPath = requestUrl.searchParams.get("path") || requestUrl.pathname;

  if (requestedPath === "/") {
    return new Response(withRoot("public", renderHome()), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
        "x-content-type-options": "nosniff",
        "x-funspot-render": "react-ssr",
      },
    });
  }

  if (requestedPath === "/app") {
    return new Response(null, { status: 301, headers: { location: "/app/" } });
  }

  if (requestedPath === "/app" || requestedPath.startsWith("/app/")) {
    const appPath = requestedPath.slice("/app".length) || "/";
    const normalizedAppPath = appPath.length > 1 ? appPath.replace(/\/+$/, "") : "/";
    const validAppRoute = normalizedAppPath === "/" || normalizedAppPath === "/login"
      || /^\/messages(?:\/[^/]+)?$/.test(normalizedAppPath)
      || /^\/comments\/[^/]+$/.test(normalizedAppPath);

    if (validAppRoute) {
      return new Response(appHtml, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-cache",
          "x-robots-tag": "noindex, nofollow",
          "x-content-type-options": "nosniff",
          "x-funspot-render": "react-client-app",
        },
      });
    }
  }

  return new Response(withRoot("not-found", renderNotFound()), {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, follow",
      "x-content-type-options": "nosniff",
      "x-funspot-render": "react-ssr-404",
    },
  });
}
`.replace('__SHELL__', JSON.stringify(shell));
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
  'User-agent: Mediapartners-Google', 'Allow: /', 'Disallow: /app/', '',
  'User-agent: Google-Display-Ads-Bot', 'Allow: /', 'Disallow: /app/', '',
  'User-agent: AdsBot-Google', 'Allow: /', 'Disallow: /app/', '',
  'User-agent: *', 'Allow: /', 'Allow: /ads.txt', 'Disallow: /app/', '',
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

console.info('[crawl-files] Verified the production React SSR entry, public pages, metadata, robots.txt and sitemap.');
