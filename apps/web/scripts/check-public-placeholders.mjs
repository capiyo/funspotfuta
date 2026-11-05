import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const forbidden = [/\bTODO\b/i,/\bTBD\b/i,/\bplaceholder\b/i,/\blorem ipsum\b/i,/\[\s*(?:put|type|insert|your|replace)\b[^\]]*\]/i,/example\.(?:com|org|net)\b/i];
const entries = await readdir(dist,{withFileTypes:true});
const pages = entries.filter(e=>e.isFile()&&e.name.endsWith('.html')).map(e=>path.join(dist,e.name));
if(!pages.some(p=>path.basename(p)==='contact.html')) throw new Error('[public-check] contact.html missing.');
const failures=[];
for(const file of pages){
 const html=await readFile(file,'utf8');
 for(const pattern of forbidden){const match=html.match(pattern);if(match)failures.push(`${path.basename(file)} contains ${match[0]}`);}
 if(path.basename(file)==='contact.html'){
  const email=/mailto:([A-Z0-9.!#$%&'*+/=?^`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+)/i.exec(html);
  if(!email||!html.includes(`>${email[1]}</a>`))failures.push('contact.html requires a visible valid email and matching mailto link.');
 }
}
if(failures.length)throw new Error('[public-check] Validation failed:\n- '+failures.join('\n- '));
console.info(`[public-check] ${pages.length} public pages passed placeholder and contact checks.`);
