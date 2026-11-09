import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTACT_EMAIL } from '../src/config/contact-email.mjs';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(webDir, '../..');
const distDir = path.join(webDir, 'dist');
const ssrEntry = path.join(webDir, 'dist-ssr', 'entry-server.js');
const origin = 'https://www.funspot.co.ke';
const requiredFooterPaths = ['/about', '/contact', '/privacy', '/terms', '/ads-disclosure', '/insights'];
const forbidden = [
  'guest_john',
  'mary_ochieng',
  'Injuries could really hurt them here',
  'That midfield battle decides it',
  'This is going to be a banger',
  'Not confident about this one honestly',
];

await mkdir(distDir, { recursive: true });
await cp(path.join(webDir, 'public'), distDir, { recursive: true, force: true });

if (!CONTACT_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(CONTACT_EMAIL)) {
  throw new Error('[crawl-files] CONTACT_EMAIL in src/config/contact-email.mjs is invalid.');
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
  throw new Error('[crawl-files] AdSense must not load in the base app shell.');
}

const adsTxt = await readFile(path.join(distDir, 'ads.txt'), 'utf8');
const expectedAdsTxt = 'google.com, pub-4829747375056254, DIRECT, f08c47fec0942fa0\n';
if (adsTxt !== expectedAdsTxt) {
  throw new Error('[crawl-files] ads.txt changed unexpectedly; preserve the publisher record byte-for-byte.');
}

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

const adsScript = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4829747375056254" crossorigin="anonymous"></script>';
const ssrBundle = await readFile(ssrEntry, 'utf8');
for (const symbol of ['renderApp', 'renderNotFound', 'renderPublicDocument', 'getPublicDocumentMetadata', 'getPublicDocumentRoutes']) {
  if (!ssrBundle.includes(symbol)) throw new Error('[crawl-files] The production React SSR bundle is missing ' + symbol + '.');
}

const ssrRenderer = await import(pathToFileURL(ssrEntry).href);
const publicRoutes = ssrRenderer.getPublicDocumentRoutes();
const renderedHome = await ssrRenderer.renderApp('/', true);
const renderedNotFound = ssrRenderer.renderNotFound();

const homepageH1Count = (renderedHome.markup.match(/<h1\b/gi) ?? []).length;
const editorialBlock = renderedHome.markup.match(/<section aria-labelledby="funspot-editorial-heading"[\s\S]*?<\/section>/i)?.[0] ?? '';
const editorialWords = wordCount(editorialBlock);
if (!renderedHome.markup.includes('funspot-editorial-heading') ||
    !renderedHome.markup.includes('Football makes more sense when you know the story behind the fixture.') ||
    !renderedHome.markup.includes('Cookie and Ads Disclosure') ||
    !renderedHome.markup.includes('href="/insights"') ||
    homepageH1Count !== 1 || editorialWords < 150 || editorialWords > 250) {
  throw new Error('[crawl-files] Homepage SSR must contain one H1, a 150–250 word editorial introduction and the public footer (found ' + editorialWords + ' editorial words).');
}
if (!renderedNotFound.includes("This page isn't here.") && !renderedNotFound.includes("This page isn&#x27;t here.")) {
  throw new Error('[crawl-files] React SSR did not produce the custom 404 content.');
}
assertFooter(renderedNotFound, '/404');

const notFoundMarker = '<div id="root"></div>';
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

function outputPath(route) {
  return path.join(distDir, ...route.split('/').filter(Boolean), 'index.html');
}
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
function wordCount(html) {
  const text = visibleText(html);
  return text ? text.split(/\s+/).length : 0;
}
function assertNoForbidden(html, label) {
  for (const value of forbidden) {
    if (html.includes(value)) throw new Error('[crawl-files] Forbidden placeholder "' + value + '" found in ' + label + '.');
  }
}
function assertFooter(html, label) {
  for (const route of requiredFooterPaths) {
    if (!html.includes('href="' + route + '"')) {
      throw new Error('[crawl-files] Footer link ' + route + ' is missing from ' + label + '.');
    }
  }
}

const results = [];
for (const route of publicRoutes) {
  const metadata = ssrRenderer.getPublicDocumentMetadata(route);
  if (!metadata) throw new Error('[crawl-files] Missing metadata for ' + route + '.');
  const renderedPage = await ssrRenderer.renderPublicDocument(route, CONTACT_EMAIL);
  const markup = renderedPage.markup;
  const h1Count = (markup.match(/<h1\b/gi) ?? []).length;
  if (h1Count !== 1) throw new Error('[crawl-files] Expected exactly one H1 on ' + route + ', found ' + h1Count + '.');
  assertNoForbidden(markup, route);
  assertFooter(markup, route);
  const words = wordCount(markup);
  if ((route === '/insights' && words < 300) || (route.startsWith('/insights/') && words < 900)) {
    throw new Error('[crawl-files] Editorial page ' + route + ' has only ' + words + ' words.');
  }
  if (route === '/contact' && !markup.includes(CONTACT_EMAIL)) {
    throw new Error('[crawl-files] Contact page did not render CONTACT_EMAIL.');
  }
  const attributes = ' data-page-path="' + escapeHtml(route) + '" data-contact-email="' + escapeHtml(CONTACT_EMAIL) + '" data-live-fixture="' + escapeHtml(JSON.stringify(renderedPage.liveFixture)) + '"';
  const html = withMetadata(withRoot('public-document', markup, attributes), metadata);
  if (!html.includes('<link rel="canonical" href="' + metadata.canonical + '">')) {
    throw new Error('[crawl-files] Canonical metadata is missing from ' + route + '.');
  }
  const target = outputPath(route);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
  results.push({ route, words, h1Count, canonical: metadata.canonical });
}

const robots = [
  'User-agent: Mediapartners-Google',
  'Allow: /',
  'Disallow: /app/',
  'Disallow: /login',
  'Disallow: /messages',
  'Disallow: /comments',
  'Disallow: /profile',
  'Disallow: /profiles/',
  'Disallow: /users/',
  'Disallow: /posts/',
  'Disallow: /post/',
  'Disallow: /api/',
  'Disallow: /.netlify/',
  '',
  'User-agent: *',
  'Allow: /',
  'Disallow: /app/',
  'Disallow: /login',
  'Disallow: /messages',
  'Disallow: /comments',
  'Disallow: /profile',
  'Disallow: /profiles/',
  'Disallow: /users/',
  'Disallow: /posts/',
  'Disallow: /post/',
  'Disallow: /api/',
  'Disallow: /.netlify/',
  '',
  'Sitemap: ' + origin + '/sitemap.xml',
  '',
].join('\n');
await writeFile(path.join(distDir, 'robots.txt'), robots, 'utf8');

for (const route of requiredFooterPaths) {
  try {
    await readFile(outputPath(route), 'utf8');
  } catch {
    throw new Error('[crawl-files] Footer target ' + route + ' was not generated and cannot resolve to a static 200 page.');
  }
}

const lastmod = new Date().toISOString().slice(0, 10);
const sitemapRoutes = ['/', ...publicRoutes];
const urls = sitemapRoutes.map((route) => {
  const loc = new URL(route, origin).href;
  return '  <url><loc>' + loc + '</loc><lastmod>' + lastmod + '</lastmod></url>';
});
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls,
  '</urlset>',
  '',
].join('\n');
await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

for (const route of sitemapRoutes) {
  if (!sitemap.includes('<loc>' + new URL(route, origin).href + '</loc>')) {
    throw new Error('[crawl-files] Sitemap is missing ' + route + '.');
  }
}
if (!robots.includes('User-agent: Mediapartners-Google') || !robots.includes('Sitemap: ' + origin + '/sitemap.xml')) {
  throw new Error('[crawl-files] robots.txt is missing the AdSense crawler or sitemap declaration.');
}
assertNoForbidden(renderedHome.markup, '/');
assertNoForbidden(renderedHome.queryState, '/ query state');
assertFooter(renderedHome.markup, '/');

console.table([
  { page: '/', status: 'PASS', words: wordCount(renderedHome.markup), h1: (renderedHome.markup.match(/<h1\b/gi) ?? []).length, canonical: origin + '/' },
  ...results.map((row) => ({ page: row.route, status: 'PASS', words: row.words, h1: row.h1Count, canonical: row.canonical })),
]);
console.info('[crawl-files] Generated ' + results.length + ' SSR public pages, robots.txt and sitemap.xml; verified placeholder removal, article length, H1, canonical and footer links.');
const functionSource = String.raw`import { renderApp, renderNotFound, renderPublicDocument, getPublicDocumentMetadata } from "../../apps/web/dist-ssr/entry-server.js";
const template = __SHELL__;
const contactEmail = __CONTACT_EMAIL__;
const adsScript = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4829747375056254" crossorigin="anonymous"></script>';

function withQueryState(html, serializedState) {
  const script = '<script id="funspot-query-state" type="application/json">' + serializedState + '</script>';
  return html.replace('</body>', script + '</body>');
}
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
function addNoindex(html) {
  const tag = '<meta name="robots" content="noindex,follow">';
  if (/<meta name="robots" content="[^"]*">/i.test(html)) {
    return html.replace(/<meta name="robots" content="[^"]*">/i, tag);
  }
  return html.replace('</head>', tag + '</head>');
}
export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const requestedPath = requestUrl.searchParams.get("path") || requestUrl.pathname;
  const normalizedPath = requestedPath.length > 1 ? requestedPath.replace(/\/+$/, "") : "/";
  const publicMetadata = getPublicDocumentMetadata(normalizedPath);
  if (publicMetadata) {
    const renderedPage = await renderPublicDocument(normalizedPath, contactEmail);
    const attributes = ' data-page-path="' + escapeHtml(normalizedPath) + '" data-contact-email="' + escapeHtml(contactEmail) + '" data-live-fixture="' + escapeHtml(JSON.stringify(renderedPage.liveFixture)) + '"';
    const html = withMetadata(withRoot("public-document", renderedPage.markup, attributes), publicMetadata);
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

  const isPrivateRoute = normalizedPath === "/login"
    || /^\/(messages|comments|profile|profiles|users|feed|posts|post)(?:\/|$)/.test(normalizedPath);
  const isAppRoute = normalizedPath === "/"
    || normalizedPath === "/login"
    || /^\/(messages|comments)(?:\/|$)/.test(normalizedPath);
  if (isAppRoute || isPrivateRoute) {
    const query = new URLSearchParams(requestUrl.searchParams);
    query.delete("path");
    const location = normalizedPath + (query.size ? "?" + query.toString() : "");
    const rendered = await renderApp(location, requestUrl.searchParams.get("ssr-smoke") !== "1");
    let html = withQueryState(withRoot("app", rendered.markup), rendered.queryState);
    if (isPrivateRoute) html = addNoindex(html);
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        ...(isPrivateRoute ? { "x-robots-tag": "noindex, follow" } : {}),
        "x-content-type-options": "nosniff",
        "x-funspot-render": "react-ssr",
      },
    });
  }

  const notFoundHtml = addNoindex(withRoot("not-found", renderNotFound())
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>Page not found | Funspot</title>')
    .replace(/<link rel="canonical" href="[^"]*">/i, ''));
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
`;
const generatedFunction = functionSource
  .replace('__SHELL__', () => JSON.stringify(shell))
  .replace('__CONTACT_EMAIL__', () => JSON.stringify(CONTACT_EMAIL));
const functionDir = path.join(repoDir, 'netlify', 'functions');
await mkdir(functionDir, { recursive: true });
const functionPath = path.join(functionDir, 'ssr.mjs');
await writeFile(functionPath, generatedFunction, 'utf8');

const { default: ssrHandler } = await import(pathToFileURL(functionPath).href);
const httpResults = [];
for (const route of ['/', ...publicRoutes]) {
  const requestUrl = new URL('/.netlify/functions/ssr', origin);
  requestUrl.searchParams.set('path', route);
  const response = await ssrHandler(new Request(requestUrl));
  const html = await response.text();
  if (response.status !== 200) {
    throw new Error('[crawl-files] SSR route ' + route + ' returned HTTP ' + response.status + '.');
  }
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count !== 1) throw new Error('[crawl-files] HTTP SSR route ' + route + ' has ' + h1Count + ' H1 elements.');
  assertNoForbidden(html, 'HTTP SSR ' + route);
  assertFooter(html, 'HTTP SSR ' + route);
  const expectedCanonical = route === '/' ? origin + '/' : ssrRenderer.getPublicDocumentMetadata(route)?.canonical;
  if (!expectedCanonical || !html.includes('<link rel="canonical" href="' + expectedCanonical + '">')) {
    throw new Error('[crawl-files] HTTP SSR route ' + route + ' is missing its www canonical.');
  }
  const words = wordCount(html);
  if ((route === '/insights' && words < 300) || (route.startsWith('/insights/') && words < 900)) {
    throw new Error('[crawl-files] HTTP SSR editorial route ' + route + ' has only ' + words + ' words.');
  }
  httpResults.push({ page: route, http: response.status, h1: h1Count, words, canonical: expectedCanonical });
}
for (const route of requiredFooterPaths) {
  if (!httpResults.some((row) => row.page === route && row.http === 200)) {
    throw new Error('[crawl-files] Footer destination ' + route + ' did not resolve to HTTP 200.');
  }
}
console.table(httpResults);
console.info('[crawl-files] Wrote the Netlify React SSR function and fetched every public route through it successfully.');
process.exit(0);
