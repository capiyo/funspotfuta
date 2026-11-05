import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const forbidden = [
  /\bTODO\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /\blorem ipsum\b/i,
  /\[\s*(?:put|type|insert|your|replace)\b[^\]]*\]/i,
  /\{\{[^}]+\}\}/,
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
if (!pages.some((file) => path.relative(dist, file) === 'contact.html')) {
  throw new Error('[public-check] contact.html missing.');
}
const failures = [];
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const relativePath = path.relative(dist, file);
  for (const pattern of forbidden) {
    const match = html.match(pattern);
    if (match) failures.push(`${relativePath} contains forbidden text: ${match[0]}`);
  }
  if (relativePath === 'contact.html') {
    const email = /mailto:([A-Z0-9.!#$%&'*+/=?^`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+)/i.exec(html);
    const domain = email?.[1].split('@').at(-1)?.toLowerCase() ?? '';
    const reserved = /(?:^|\\.)(?:invalid|example|test|localhost)$/.test(domain)
      || /^example\\.(?:com|org|net)$/.test(domain);
    const ciValidationAddress = process.env.CI === 'true' && email?.[1] === 'build-validation@invalid.invalid';
    if (!email || !html.includes(`>${email[1]}</a>`) || (reserved && !ciValidationAddress)) {
      failures.push('contact.html requires a visible real email address and matching mailto link.');
    }
  }
}
if (failures.length) throw new Error('[public-check] Validation failed:\n- ' + failures.join('\n- '));
console.info(`[public-check] ${pages.length} emitted HTML pages passed placeholder checks; contact email is present.`);
