import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../dist');
const forbidden = [
  /\bTODO\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /\blorem ipsum\b/i,
  /\[\s*(?:put|type|insert|your|replace)\b[^\]]*\]/i,
  /\b(?:your|insert|replace)\s+(?:email|phone|league|name|address)\s+(?:here|goes here)\b/i,
  /example\.(?:com|org|net)\b/i,
];
const entries = await readdir(distDir, { withFileTypes: true });
const pages = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => path.join(distDir, entry.name));
if (!pages.length) throw new Error('[public-check] No public HTML pages were emitted.');
const failures = [];
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    const match = html.match(pattern);
    if (match) failures.push(`${path.relative(distDir, file)} contains forbidden text: ${match[0]}`);
  }
}
if (failures.length) throw new Error('[public-check] Public page placeholder check failed:\n- ' + failures.join('\n- '));
console.info(`[public-check] Checked ${pages.length} public HTML pages; no TODO or placeholder text found.`);
