import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(webDir, '../..');
const distDir = path.join(webDir, 'dist');
const ssrEntry = path.join(webDir, 'dist-ssr', 'entry-server.js');
const origin = 'https://www.funspot.co.ke';
const pages = ['/about.html', '/how-it-works.html', '/contact.html', '/terms.html', '/privacy.html'];

await mkdir(distDir, { recursive: true });
await cp(path.join(webDir, 'public'), distDir, { recursive: true, force: true });

const email = process.env.FUNSPOT_CONTACT_EMAIL?.trim() ?? '';
if (!isValidContactEmail(email)) {
  throw new Error('[crawl-files] Set FUNSPOT_CONTACT_EMAIL to a valid contact email before building public pages.');
}

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

const adsScript = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4829747375056254" crossorigin="anonymous"></script>';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function withRoot(mode, content = '', attributes = '') {
  const marker = '<div id="root"></div>';
  if (!shell.includes(marker)) throw new Error('[crawl-files] HTML template is missing #root.');
  return shell.replace(marker, '<div id="root" data-render-mode="' + mode + '"' + attributes + '>' + content + '</div>');
}

function withMetadata(html, metadata) {
  const jsonLd = '<script type="application/ld+json">' + JSON.stringify(metadata.structuredData) + '</script>';
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(metadata.title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="' + escapeHtml(metadata.description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/i, '<link rel="canonical" href="' + escapeHtml(metadata.canonical) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/i, '<meta property="og:url" content="' + escapeHtml(metadata.canonical) + '">')
    .replace(/<meta property="og:title" content="[^"]*">/i, '<meta property="og:title" content="' + escapeHtml(metadata.title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/i, '<meta property="og:description" content="' + escapeHtml(metadata.description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, jsonLd)
    .replace('</head>', adsScript + '</head>');
}

const ssrBundle = await readFile(ssrEntry, 'utf8');
if (!ssrBundle.trim() || !ssrBundle.includes('renderApp') || !ssrBundle.includes('renderNotFound') ||
    !ssrBundle.includes('renderPublicDocument') || !ssrBundle.includes('getPublicDocumentMetadata')) {
  throw new Error('[crawl-files] The production React SSR bundle is missing a required render entry point.');
}

const ssrRenderer = await import(pathToFileURL(ssrEntry).href);
const renderedHome = ssrRenderer.renderApp('/');
const renderedNotFound = ssrRenderer.renderNotFound();
if (!renderedHome.includes('home-screen') || !renderedHome.includes('home-columns') || renderedHome.includes('Football is better together') || renderedHome.includes('<div id="root"></div>')) {
  throw new Error('[crawl-files] React SSR did not render the real Funspot application workspace.');
}
if (!renderedNotFound.includes("This page isn't here.") && !renderedNotFound.includes("This page isn&#x27;t here.")) {
  throw new Error('[crawl-files] React SSR did not produce the custom 404 content.');
}

const notFoundMarker = '<div id="root"></div>';
if (!shell.includes(notFoundMarker)) {
  throw new Error('[crawl-files] Cannot generate the static 404 page without the React root marker.');
}
let staticNotFound = shell.replace(
  notFoundMarker,
  '<div id="root" data-render-mode="not-found">' + renderedNotFound + '</div>',
);
staticNotFound = staticNotFound
  .replace(/<title>[\s\S]*?<\/title>/i, '<title>Page not found | Funspot</title>')
  .replace(/<link rel="canonical" href="[^"]*">/i, '')
  .replace(/<meta name="robots" content="[^"]*">/i, '<meta name="robots" content="noindex,follow">');
if (!/<meta name="robots"/i.test(staticNotFound)) {
  staticNotFound = staticNotFound.replace('</head>', '<meta name="robots" content="noindex,follow"></head>');
}
await writeFile(path.join(distDir, '404.html'), staticNotFound, 'utf8');
for (const page of pages) {
  const meta = ssrRenderer.getPublicDocumentMetadata(page);
  const markup = ssrRenderer.renderPublicDocument(page, email);
  if (!meta || !markup.includes('<h1') || !markup.includes(meta.title.split('|')[0].trim())) {
    throw new Error('[crawl-files] React SSR did not render public document ' + page + '.');
  }
  if (page === '/contact.html' && !markup.includes(email)) {
    throw new Error('[crawl-files] Contact page did not render the configured contact email.');
  }
  const attributes = ' data-page-path="' + escapeHtml(page) + '" data-contact-email="' + escapeHtml(email) + '"';
  const documentHtml = withMetadata(withRoot('public-document', markup, attributes), meta);
  if (!documentHtml.includes('<link rel="canonical" href="' + meta.canonical + '">')) {
    throw new Error('[crawl-files] Canonical metadata is missing from public document ' + page + '.');
  }
  await writeFile(path.join(distDir, page.slice(1)), documentHtml, 'utf8');
}

const functionDir = path.join(repoDir, 'netlify', 'functions');
await mkdir(functionDir, { recursive: true });
const functionSource = String.raw`import { renderApp, renderNotFound, renderPublicDocument, getPublicDocumentMetadata } from "../../apps/web/dist-ssr/entry-server.js";
const template = __SHELL__;
const contactEmail = __CONTACT_EMAIL__;
const adsScript = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4829747375056254" crossorigin="anonymous"></script>';

function withRoot(mode, content = "", attributes = "") {
  const marker = '<div id="root"></div>';
  if (!template.includes(marker)) throw new Error("SSR HTML template is missing #root");
  return template.replace(marker, '<div id="root" data-render-mode="' + mode + '"' + attributes + '>' + content + '</div>');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function withMetadata(html, metadata) {
  const jsonLd = '<script type="application/ld+json">' + JSON.stringify(metadata.structuredData) + '</script>';
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(metadata.title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="' + escapeHtml(metadata.description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/i, '<link rel="canonical" href="' + escapeHtml(metadata.canonical) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/i, '<meta property="og:url" content="' + escapeHtml(metadata.canonical) + '">')
    .replace(/<meta property="og:title" content="[^"]*">/i, '<meta property="og:title" content="' + escapeHtml(metadata.title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/i, '<meta property="og:description" content="' + escapeHtml(metadata.description) + '">')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, jsonLd)
    .replace('</head>', adsScript + '</head>');
}

export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const requestedPath = requestUrl.searchParams.get("path") || requestUrl.pathname;

  if (requestedPath === "/app" || requestedPath === "/app/") {
    return new Response(null, { status: 301, headers: { location: "/" } });
  }
  if (requestedPath.startsWith("/app/")) {
    const destination = requestedPath.slice("/app".length) || "/";
    return new Response(null, { status: 301, headers: { location: destination + requestUrl.search } });
  }

  const publicMetadata = getPublicDocumentMetadata(requestedPath);
  if (publicMetadata) {
    const pageMarkup = renderPublicDocument(requestedPath, contactEmail);
    const attributes = ' data-page-path="' + escapeHtml(requestedPath) + '" data-contact-email="' + escapeHtml(contactEmail) + '"';
    const html = withMetadata(withRoot("public-document", pageMarkup, attributes), publicMetadata);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
        "x-content-type-options": "nosniff",
        "x-funspot-render": "react-ssr",
      },
    });
  }

  const normalizedPath = requestedPath.length > 1 ? requestedPath.replace(/\/+$/, "") : "/";
  const isAppRoute = normalizedPath === "/" || normalizedPath === "/login"
    || /^\/messages(?:\/[^/]+)?$/.test(normalizedPath)
    || /^\/comments\/[^/]+$/.test(normalizedPath);
  if (isAppRoute) {
    return new Response(withRoot("app", renderApp(normalizedPath)), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "x-funspot-render": "react-ssr",
      },
    });
  }

  const notFoundHtml = withRoot("not-found", renderNotFound())
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>Page not found | Funspot</title>')
    .replace(/<meta name="robots" content="[^"]*">/i, '<meta name="robots" content="noindex,follow">')
    .replace(/<link rel="canonical" href="[^"]*">/i, '');
  return new Response(notFoundHtml, {
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
`.replace('__SHELL__', () => JSON.stringify(shell)).replace('__CONTACT_EMAIL__', () => JSON.stringify(email));
await writeFile(path.join(functionDir, 'ssr.mjs'), functionSource, 'utf8');

const rules = [
  'User-agent: Mediapartners-Google', 'Allow: /', 'Disallow: /app/', 'Disallow: /messages', 'Disallow: /comments', 'Disallow: /login', '',
  'User-agent: Google-Display-Ads-Bot', 'Allow: /', 'Disallow: /app/', 'Disallow: /messages', 'Disallow: /comments', 'Disallow: /login', '',
  'User-agent: AdsBot-Google', 'Allow: /', 'Disallow: /app/', 'Disallow: /messages', 'Disallow: /comments', 'Disallow: /login', '',
  'User-agent: *', 'Allow: /', 'Allow: /ads.txt', 'Disallow: /app/', 'Disallow: /messages', 'Disallow: /comments', 'Disallow: /login', '',
  'Sitemap: ' + origin + '/sitemap.xml', '',
].join('\n');
await writeFile(path.join(distDir, 'robots.txt'), rules, 'utf8');
const urls = ['/', ...pages]
  .map((route) => '  <url><loc>' + new URL(route, origin).href + '</loc></url>');
await writeFile(path.join(distDir, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls, '</urlset>', '',
].join('\n'), 'utf8');

console.info('[crawl-files] Verified React SSR for the real Funspot application, public documents and 404; generated robots.txt and sitemap.');
