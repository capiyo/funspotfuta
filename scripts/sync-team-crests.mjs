#!/usr/bin/env node
/**
 * Download and bundle the open football-logos SVG catalogue, then generate platform-local lookup maps while preserving SVG aspect ratios.
 * Web receives the original SVGs; React Native receives optimized local PNGs.
 * Requires sharp to be available in node_modules (the GitHub workflow installs it ephemerally); sync commits rebase onto the latest branch.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE_REPO = 'JoseArroyave/football-logos';
const SOURCE_BRANCH = 'main';
const API_TREE = `https://api.github.com/repos/${SOURCE_REPO}/git/trees/${SOURCE_BRANCH}?recursive=1`;
const RAW_BASE = `https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/`;
const WEB_DIR = path.join(ROOT, 'apps/web/public/team-crests');
const MOBILE_DIR = path.join(ROOT, 'apps/mobile/assets/team-crests');
const WEB_GENERATED = path.join(ROOT, 'apps/web/src/components/team-crest-catalog.generated.ts');
const MOBILE_GENERATED = path.join(ROOT, 'apps/mobile/src/components/team-crest-catalog.generated.ts');
const MANIFEST = path.join(WEB_DIR, 'source-manifest.json');
const NOTICE = path.join(WEB_DIR, 'THIRD_PARTY_LICENSES.txt');
const PARALLEL = 8;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function candidateKeys(name) {
  const normalized = normalize(name);
  const keys = [normalized];
  const suffixes = [
    ' football club', ' athletic club', ' association football club', ' fc', ' cf', ' sc',
    ' afc', ' ac', ' fk', ' sk', ' sv', ' ks', ' fk', ' club', ' football',
  ];
  let simplified = normalized;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      if (simplified.endsWith(suffix) && simplified.length > suffix.length + 1) {
        simplified = simplified.slice(0, -suffix.length).trim();
        changed = true;
        break;
      }
    }
  }
  if (simplified && simplified !== normalized) keys.push(simplified);
  return [...new Set(keys.filter(Boolean))];
}

async function request(url, attempt = 0) {
  const response = await fetch(url, { headers: { 'user-agent': 'Funspot-TeamCrest-Sync/1.0' } });
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await sleep(Math.min(1000 * (attempt + 1), 6000));
    return request(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        await worker(items[index], index);
      } catch (error) {
        console.warn('Skipped source crest after conversion error:', items[index]?.path,
          error instanceof Error ? error.message : error);
      }
    }
  });
  await Promise.all(workers);
}

await Promise.all([mkdir(WEB_DIR, { recursive: true }), mkdir(MOBILE_DIR, { recursive: true })]);

const treeResponse = await request(API_TREE);
const treeData = await treeResponse.json();
if (!Array.isArray(treeData.tree) || treeData.truncated) {
  throw new Error('Source asset tree was incomplete; refusing to publish a partial catalogue.');
}
const svgFiles = treeData.tree.filter((item) =>
  item.type === 'blob' && /^logos\/.+\.svg$/i.test(item.path)
).sort((a, b) => a.path.localeCompare(b.path));
if (svgFiles.length < 4000) throw new Error(`Expected 4,000+ SVG crests, found ${svgFiles.length}; refusing partial sync.`);

const licenseResponse = await request(`https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/LICENSE`);
const licenseText = await licenseResponse.text();
if (!/MIT License/i.test(licenseText)) throw new Error('Expected MIT source license was not found.');
const readmeResponse = await request(`https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/README.md`);
const sourceReadme = await readmeResponse.text();

const catalog = [];
const webMap = {};
const mobileMap = {};
let completed = 0;
await mapLimit(svgFiles, PARALLEL, async (file) => {
  const relative = file.path.slice('logos/'.length);
  const basename = path.posix.basename(relative, '.svg');
  const country = path.posix.dirname(relative);
  const safeName = relative.replace(/\.svg$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const mobileFilename = safeName + '.png';
  const webPath = '/team-crests/' + relative.split('/').map(encodeURIComponent).join('/');
  const rawResponse = await request(RAW_BASE + file.path.split('/').map(encodeURIComponent).join('/'));
  const svg = Buffer.from(await rawResponse.arrayBuffer());
  if (!svg.length || svg.length > 5_000_000 || !svg.toString('utf8').includes('<svg')) {
    console.warn('Skipped invalid or oversized SVG:', file.path);
    return;
  }
  let png;
  try {
    const svgText = svg.toString('utf8');
    const rasterSvgText = svgText.replace(/<svg\b([^>]*)>/i, (_root, attributes) => {
      const viewBoxMatch = attributes.match(/viewBox\s*=\s*["']([^"']+)["']/i);
      const viewBox = viewBoxMatch?.[1].trim().split(/[\s,]+/).map(Number);
      let width = 512;
      let height = 512;
      if (viewBox && viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0) {
        const ratio = viewBox[2] / viewBox[3];
        if (ratio > 1) height = Math.max(1, Math.round(512 / ratio));
        else width = Math.max(1, Math.round(512 * ratio));
      }
      const cleaned = attributes.replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      return `<svg${cleaned} width="${width}" height="${height}">`;
    });
    png = await sharp(Buffer.from(rasterSvgText), { density: 72, limitInputPixels: 16_000_000 })
      .resize({ width: 256, height: 256, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
  } catch (error) {
    console.warn('Skipped SVG that could not be rasterized safely:', file.path,
      error instanceof Error ? error.message : error);
    return;
  }
  await Promise.all([
    mkdir(path.dirname(path.join(WEB_DIR, relative)), { recursive: true }),
    mkdir(path.dirname(path.join(MOBILE_DIR, mobileFilename)), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(WEB_DIR, relative), svg),
    writeFile(path.join(MOBILE_DIR, mobileFilename), png),
  ]);
  const name = basename.replace(/[_-]+/g, ' ').trim();
  const keys = candidateKeys(name);
  for (const key of keys) {
    webMap[key] ||= webPath;
    mobileMap[key] ||= mobileFilename;
  }
  catalog.push({ name, country, sourcePath: file.path, webPath, mobilePath: 'assets/team-crests/' + mobileFilename, normalizedKeys: keys });
  completed++;
  if (completed % 250 === 0) console.log(`Bundled ${completed}/${svgFiles.length} crests`);
});

if (completed < 4500) {
  throw new Error(`Only ${completed} crests converted successfully; refusing to publish an incomplete catalogue.`);
}
catalog.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
const webTs = '// Generated by scripts/sync-team-crests.mjs. Do not edit by hand.\nexport const WEB_TEAM_CRESTS: Readonly<Record<string, string>> = ' +
  JSON.stringify(webMap, null, 2) + ';\n';
const mobileLines = [
  '// Generated by scripts/sync-team-crests.mjs. Do not edit by hand.',
  "import type { ImageSourcePropType } from 'react-native';",
  'export const MOBILE_TEAM_CRESTS: Readonly<Record<string, ImageSourcePropType>> = {',
];
for (const [key, filename] of Object.entries(mobileMap)) {
  mobileLines.push(`  ${JSON.stringify(key)}: require('../../assets/team-crests/${filename}'),`);
}
mobileLines.push('};', '');

const attribution = `Football crest assets are bundled from ${SOURCE_REPO} (${RAW_BASE}).
The source repository's MIT license is reproduced below. Club and federation marks may also be trademarks; their owners retain their respective rights. This catalogue is provided for team identification. Confirm the rights applicable to each mark and your use before commercial deployment.

${licenseText}

Source README (for provenance):
${sourceReadme.slice(0, 12000)}
`;
await Promise.all([
  writeFile(WEB_GENERATED, webTs),
  writeFile(MOBILE_GENERATED, mobileLines.join('\n')),
  writeFile(NOTICE, attribution),
  writeFile(MANIFEST, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceRepository: SOURCE_REPO,
    sourceBranch: SOURCE_BRANCH,
    sourceCommit: treeData.sha || null,
    sourceSvgCount: svgFiles.length,
    bundledCrestCount: completed,
    webFormat: 'original SVG',
    mobileFormat: '256x256 transparent PNG',
    teams: catalog,
  }, null, 2) + '\n'),
]);
console.log(`Bundled ${completed} local crests for web and React Native from ${SOURCE_REPO}.`);
