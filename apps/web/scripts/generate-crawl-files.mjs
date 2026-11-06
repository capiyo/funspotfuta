import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(webDir, '../..');
const distDir = path.join(webDir, 'dist');
const origin = 'https://www.funspot.co.ke';
const pages = ['about.html', 'how-it-works.html', 'contact.html', 'terms.html', 'privacy.html'];
const marker = '<div id="public-home"><!--public-home-ssr--></div>';

await mkdir(distDir, { recursive: true });
await cp(path.join(webDir, 'public'), distDir, { recursive: true, force: true });

const email = process.env.FUNSPOT_CONTACT_EMAIL?.trim() ?? '';
if (!isValidContactEmail(email)) {
  throw new Error('[ssr] Set FUNSPOT_CONTACT_EMAIL to a valid contact email before building public pages.');
}
const contactPath = path.join(distDir, 'contact.html');
let contact = await readFile(contactPath, 'utf8');
if (!contact.includes('{{FUNSPOT_CONTACT_EMAIL}}')) {
  throw new Error('[crawl-files] Contact email template token is missing.');
}
contact = contact.replaceAll('{{FUNSPOT_CONTACT_EMAIL}}', email);
await writeFile(contactPath, contact, 'utf8');

const shell = await readFile(path.join(distDir, 'index.html'), 'utf8');
if (!shell.includes(marker)) throw new Error('[ssr] HTML shell is missing the public-home SSR marker.');
if (!shell.includes('<div id="root"></div>')) throw new Error('[ssr] HTML shell is missing the React application root.');
if (!shell.includes(`<link rel="canonical" href="${origin}/"`) ||
    !shell.includes(`<meta property="og:url" content="${origin}/"`) ||
    !shell.includes('google-adsense-account')) {
  throw new Error('[crawl-files] Homepage canonical, Open Graph or AdSense verification metadata is missing.');
}
if (shell.includes('pagead/js/adsbygoogle.js')) {
  throw new Error('[crawl-files] AdSense must not load in the SPA/SSR shell.');
}

const serverEntry = path.join(distDir, 'server', 'entry-server.js');
const { renderPublicHome } = await import(pathToFileURL(serverEntry).href);
const renderedHome = renderPublicHome();
const textOnly = renderedHome
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--([\s\S]*?)-->/g, ' ')
  .replace(/<[^>]+>/g, ' ');
const wordCount = textOnly.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
if (wordCount < 250) throw new Error(`[ssr] Server-rendered homepage has only ${wordCount} words; at least 250 are required.`);
if (/\b(?:TODO|TBD|placeholder|lorem ipsum|TYPE\s+REAL)\b/i.test(renderedHome)) {
  throw new Error('[ssr] Server-rendered homepage contains placeholder text.');
}
if (!/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(renderedHome)) {
  throw new Error('[ssr] Server-rendered homepage must contain one meaningful h1.');
}

// Keep a fully rendered static fallback for local previews and deployments
// where functions are unavailable. The Netlify function re-renders per request.
const prerendered = shell.replace(marker, `<div id="public-home">${renderedHome}</div>`);
await writeFile(path.join(distDir, 'index.html'), prerendered, 'utf8');

// Generate the deployable Netlify SSR function from the exact built shell.
// The template is embedded so the function does not depend on runtime filesystem paths.
const functionDir = path.join(repoDir, 'netlify', 'functions');
await mkdir(functionDir, { recursive: true });
const functionSource = `import { renderPublicHome } from "../../apps/web/dist/server/entry-server.js";

const template = ${JSON.stringify(shell)};
const marker = ${JSON.stringify(marker)};
export default async function handler(request) {
  const requestUrl = new URL(request.url);
  const requestedPath = requestUrl.searchParams.get("path") || requestUrl.pathname;
  const isHome = requestedPath === "/";
  const isMessageRoute = requestedPath === "/messages" || requestedPath.startsWith("/messages/");
  const commentPath = requestedPath.startsWith("/comments/") ? requestedPath.slice("/comments/".length) : "";
  const isCommentRoute = commentPath.length > 0 && !commentPath.includes("/");
  const isAppRoute = isMessageRoute || isCommentRoute || requestedPath === "/login";
  if (!isHome && !isAppRoute) {
    return new Response("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" },
    });
  }

  const publicMarkup = isHome
    ? '<div id="public-home">' + renderPublicHome() + '</div>'
    : '<div id="public-home"></div>';
  const html = template.replace(marker, publicMarkup);
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": isHome
        ? "public, max-age=0, s-maxage=300, stale-while-revalidate=86400"
        : "no-cache",
      "x-content-type-options": "nosniff",
      "x-funspot-render": "react-ssr",
    },
  });
}
`;
await writeFile(path.join(functionDir, 'ssr.mjs'), functionSource, 'utf8');

for (const page of pages) {
  const html = await readFile(path.join(distDir, page), 'utf8');
  const canonical = `${origin}/${page}`;
  for (const [label, ok] of [
    ['h1', /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)],
    ['paragraph', /<p\b[^>]*>[\s\S]*?<\/p>/i.test(html)],
    ['canonical', html.includes(`<link rel="canonical" href="${canonical}"`)],
    ['og:url', html.includes(`<meta property="og:url" content="${canonical}"`)],
    ['structured data', html.includes(`"url":"${canonical}"`)],
  ]) {
    if (!ok) throw new Error(`[crawl-files] ${page} missing ${label}.`);
  }
}

const rules = [
  'User-agent: Mediapartners-Google', 'Allow: /', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: Google-Display-Ads-Bot', 'Allow: /', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: AdsBot-Google', 'Allow: /', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  'User-agent: *', 'Allow: /', 'Allow: /ads.txt', 'Disallow: /messages', 'Disallow: /login', 'Disallow: /comments/', '',
  `Sitemap: ${origin}/sitemap.xml`, '',
].join('\n');
await writeFile(path.join(distDir, 'robots.txt'), rules, 'utf8');
const urls = ['/', ...pages.map((page) => `/${page}`)]
  .map((route) => `  <url><loc>${new URL(route, origin).href}</loc></url>`);
await writeFile(path.join(distDir, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls, '</urlset>', '',
].join('\n'), 'utf8');

console.info(`[ssr] Rendered the real public homepage on the server (${wordCount} words).`);
console.info('[ssr] Generated the Netlify request-time SSR function and static fallback.');
console.info('[crawl-files] Public pages, metadata, robots.txt and sitemap verified.');
