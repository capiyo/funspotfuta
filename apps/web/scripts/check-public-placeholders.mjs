import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const forbidden = [
  /\bTODO\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /\blorem ipsum\b/i, /\bTYPE\s+REAL\b/i,
  /\[\s*(?:put|type|insert|your|replace)\b[^\]]*\]/i, /\{\{[^}]+\}\}/,
  /\b(?:replace[_ -]?me|your[_ -]?(?:email|phone|league|name|address))\b/i,
  /example\.(?:com|org|net)\b/i,
];

async function collectHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }
  return files;
}

const pages = await collectHtml(dist);
const indexPath = path.join(dist, 'index.html');
const contactPath = path.join(dist, 'contact.html');
if (!pages.includes(indexPath)) throw new Error('[public-check] Root index.html is missing.');
if (!pages.includes(contactPath)) throw new Error('[public-check] contact.html is missing.');

const html = await readFile(indexPath, 'utf8');
const publicStart = html.indexOf('<div id="public-home">');
const publicEnd = html.indexOf('</section>', publicStart);
const publicHome = publicStart >= 0 && publicEnd > publicStart
  ? html.slice(publicStart, publicEnd + '</section>'.length)
  : '';
if (!publicHome) throw new Error('[public-check] Server-rendered #public-home content is missing.');
const words = publicHome.replace(/<[^>]+>/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
if (words < 250) throw new Error(`[public-check] Server-rendered homepage contains only ${words} words.`);

const failures = [];
for (const file of pages) {
  const pageHtml = await readFile(file, 'utf8');
  const relativePath = path.relative(dist, file);
  for (const pattern of forbidden) {
    if (pattern.test(pageHtml)) failures.push(`${relativePath} contains forbidden placeholder text: ${pattern}`);
  }
  if (relativePath === 'contact.html') {
    const email = /mailto:([A-Z0-9.!#$%&'*+/=?^\x60{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+)/i.exec(pageHtml)?.[1];
    if (!email || !isValidContactEmail(email) || !pageHtml.includes(`>${email}</a>`)) {
      failures.push('contact.html requires a visible valid contact email and matching mailto link.');
    }
  }
}
if (failures.length) throw new Error('[public-check] Validation failed:\\n- ' + failures.join('\\n- '));
console.info(`[public-check] ${pages.length} emitted HTML pages passed; the homepage contains ${words} server-rendered words.`);
