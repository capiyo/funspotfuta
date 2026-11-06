import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidContactEmail } from './contact-email.mjs';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const forbidden = [
  /\bTODO\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /\blorem ipsum\b/i, /\bTYPE\s+REAL\b/i,
  /\[\s*(?:put|type|insert|your|replace)\b[^\]]*\]/i, /\{\{[^}]+\}\}/,
  /\b(?:replace[_ -]?me|your[_ -]?(?:email|phone|league|name|address))\b/i, /example\.(?:com|org|net)\b/i,
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
if (!pages.some((file) => path.relative(dist, file) === 'index.html')) throw new Error('[public-check] Root dist/index.html is missing.');
if (!pages.some((file) => path.relative(dist, file) === 'contact.html')) throw new Error('[public-check] contact.html missing.');
const failures = [];
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const relativePath = path.relative(dist, file);
  const rootStart = html.indexOf('<div id="root">');
  const rootEnd = html.lastIndexOf('</div>');
  const root = relativePath === 'index.html' && rootStart >= 0 && rootEnd > rootStart
    ? html.slice(rootStart + '<div id="root">'.length, rootEnd)
    : relativePath === 'index.html' ? '' : html;
  if (relativePath === 'index.html') {
    if (!root) failures.push('index.html is missing static HTML inside #root.');
    const words = root.replace(/<[^>]+>/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
    if (words < 250) failures.push(`index.html #root contains only ${words} static words; at least 250 are required.`);
  }
  for (const pattern of forbidden) {
    const match = root.match(pattern);
    if (match) failures.push(`${relativePath} #root contains forbidden text: ${match[0]}`);
  }
  if (relativePath === 'contact.html') {
    const email = /mailto:([A-Z0-9.!#$%&'*+/=?^\x60{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+)/i.exec(html)?.[1];
    if (!email || !isValidContactEmail(email) || !html.includes(`>${email}</a>`)) failures.push('contact.html requires a visible valid contact email and matching mailto link.');
  }
}
if (failures.length) throw new Error('[public-check] Validation failed:\n- ' + failures.join('\n- '));
console.info(`[public-check] ${pages.length} emitted HTML pages passed placeholder checks; root text and contact email are present.`);
