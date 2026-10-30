#!/usr/bin/env node
/**
 * Download exactly the curated 180 canonical club crests and generate local
 * SVG (web) / transparent PNG (React Native) catalogues.
 * Selection contains 180 unique clubs plus the separate national-team set.
 * Selection is explicit and competition-aware; aliases resolve to the same
 * canonical asset, never to duplicate image files.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
const SELECTION_FILE = path.join(ROOT, 'scripts/team-crest-selection.json');
const NOTICE = path.join(WEB_DIR, 'THIRD_PARTY_LICENSES.txt');
const MANIFEST = path.join(WEB_DIR, 'source-manifest.json');
const EXPECTED_COUNT = 180;
const EXPECTED_NATIONAL_TEAM_COUNT = 228;
const EXPECTED_TOTAL_COUNT = EXPECTED_COUNT + EXPECTED_NATIONAL_TEAM_COUNT;
const PARALLEL = 8;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function candidateKeys(name) {
  const normalized = normalize(name);
  const keys = [normalized];
  const suffixes = [' football club', ' athletic club', ' association football club', ' fc', ' cf', ' sc',
    ' afc', ' ac', ' fk', ' sk', ' sv', ' ks', ' club', ' football'];
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
  const response = await fetch(url, { headers: { 'user-agent': 'Funspot-TeamCrest-Sync/2.0' } });
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await sleep(Math.min(1000 * (attempt + 1), 6000));
    return request(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response;
}
async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const failures = [];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { await worker(items[index], index); }
      catch (error) {
        failures.push({ item: items[index], error });
        console.error('Failed crest:', items[index]?.path,
          error instanceof Error ? error.message : error);
      }
    }
  });
  await Promise.all(workers);
  if (failures.length) throw new Error(`${failures.length} of ${items.length} selected crests failed conversion; refusing partial publish.`);
}

const selection = JSON.parse(await readFile(SELECTION_FILE, 'utf8'));
if (!Array.isArray(selection.teams) || selection.teams.length !== EXPECTED_COUNT ||
    selection.targetCount !== EXPECTED_COUNT || !Array.isArray(selection.nationalTeams) ||
    selection.nationalTeams.length !== EXPECTED_NATIONAL_TEAM_COUNT ||
    selection.nationalTeamCount !== EXPECTED_NATIONAL_TEAM_COUNT) {
  throw new Error(`Selection must contain ${EXPECTED_COUNT} clubs and ${EXPECTED_NATIONAL_TEAM_COUNT} national teams.`);
}
const allTeams = [...selection.teams, ...selection.nationalTeams];
const selectedPaths = allTeams.map((team) => team.sourcePath);
if (new Set(selectedPaths).size !== EXPECTED_TOTAL_COUNT) {
  throw new Error('Selection contains duplicate source paths; every team must have one canonical image.');
}
for (const team of allTeams) {
  if (!team.name || !team.country || !team.sourcePath?.startsWith('logos/') ||
      !Array.isArray(team.competitions) || !Array.isArray(team.aliases)) {
    throw new Error(`Invalid selection entry: ${JSON.stringify(team)}`);
  }
}

// Refuse truncated upstream data and verify every selected source path before
// touching the working asset folders.
const treeResponse = await request(API_TREE);
const treeData = await treeResponse.json();
if (!Array.isArray(treeData.tree) || treeData.truncated) {
  throw new Error('Source asset tree was incomplete; refusing to publish a partial catalogue.');
}
const sourceSvgPaths = new Set(treeData.tree.filter((item) =>
  item.type === 'blob' && /^logos\/.+\.svg$/i.test(item.path)
).map((item) => item.path));
const missing = selectedPaths.filter((sourcePath) => !sourceSvgPaths.has(sourcePath));
if (missing.length) throw new Error(`Selected source crests missing upstream: ${missing.join(', ')}`);
const licenseResponse = await request(`https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/LICENSE`);
const licenseText = await licenseResponse.text();
if (!/MIT License/i.test(licenseText)) throw new Error('Expected MIT source license was not found.');
const readmeResponse = await request(`https://raw.githubusercontent.com/${SOURCE_REPO}/${SOURCE_BRANCH}/README.md`);
const sourceReadme = await readmeResponse.text();

const teamBySource = new Map(allTeams.map((team) => [team.sourcePath, team]));
const svgFiles = treeData.tree.filter((item) =>
  item.type === 'blob' && teamBySource.has(item.path)
).sort((a, b) => a.path.localeCompare(b.path));
if (svgFiles.length !== EXPECTED_TOTAL_COUNT) {
  throw new Error(`Expected ${EXPECTED_TOTAL_COUNT} selected SVGs, found ${svgFiles.length}.`);
}

// Remove the old oversized catalogue only after all source paths and licence
// checks pass. A failed run is never committed by the workflow.
await Promise.all([
  rm(WEB_DIR, { recursive: true, force: true }),
  rm(MOBILE_DIR, { recursive: true, force: true }),
]);
await Promise.all([
  mkdir(WEB_DIR, { recursive: true }),
  mkdir(MOBILE_DIR, { recursive: true }),
]);

const catalog = [];
const webMap = {};
const mobileMap = {};
let completed = 0;
let completedClubs = 0;
let completedNationalTeams = 0;
await mapLimit(svgFiles, PARALLEL, async (file) => {
  const team = teamBySource.get(file.path);
  const relative = file.path.slice('logos/'.length);
  const basename = path.posix.basename(relative, '.svg');
  const country = path.posix.dirname(relative);
  const safeName = relative.replace(/\.svg$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const mobileFilename = safeName + '.png';
  const webPath = '/team-crests/' + relative.split('/').map(encodeURIComponent).join('/');
  const rawResponse = await request(RAW_BASE + file.path.split('/').map(encodeURIComponent).join('/'));
  const svg = Buffer.from(await rawResponse.arrayBuffer());
  if (!svg.length || svg.length > 5_000_000 || !svg.toString('utf8').includes('<svg')) {
    throw new Error(`Invalid or oversized SVG: ${file.path}`);
  }
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
  const png = await sharp(Buffer.from(rasterSvgText), { density: 72, limitInputPixels: 16_000_000 })
    .resize({ width: 256, height: 256, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();

  await Promise.all([
    mkdir(path.dirname(path.join(WEB_DIR, relative)), { recursive: true }),
    mkdir(path.dirname(path.join(MOBILE_DIR, mobileFilename)), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(WEB_DIR, relative), svg),
    writeFile(path.join(MOBILE_DIR, mobileFilename), png),
  ]);

  const sourceName = basename.replace(/[_-]+/g, ' ').trim();
  const keys = new Set([
    ...candidateKeys(team.name),
    ...team.aliases.flatMap(candidateKeys),
    ...candidateKeys(sourceName),
  ]);
  for (const key of keys) {
    if (webMap[key] && webMap[key] !== webPath) {
      throw new Error(`Ambiguous crest key "${key}" maps to multiple teams.`);
    }
    webMap[key] = webPath;
    mobileMap[key] = mobileFilename;
  }
  catalog.push({
    type: team.type || 'club', name: team.name, country, sourcePath: file.path, webPath,
    mobilePath: 'assets/team-crests/' + mobileFilename,
    competitions: team.competitions, aliases: team.aliases,
  });
  if (team.type === 'national') completedNationalTeams++;
  else completedClubs++;
  completed++;
  if (completed % 30 === 0) console.log(`Bundled ${completed}/${EXPECTED_TOTAL_COUNT} selected crests`);
});

if (completed !== EXPECTED_TOTAL_COUNT || catalog.length !== EXPECTED_TOTAL_COUNT ||
    completedClubs !== EXPECTED_COUNT || completedNationalTeams !== EXPECTED_NATIONAL_TEAM_COUNT) {
  throw new Error(`Expected ${EXPECTED_COUNT} clubs and ${EXPECTED_NATIONAL_TEAM_COUNT} national teams; got ${completedClubs} clubs and ${completedNationalTeams} national teams. Refusing partial publish.`);
}
catalog.sort((a, b) => a.name.localeCompare(b.name));
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
    season: selection.season,
    sourceRepository: SOURCE_REPO,
    sourceBranch: SOURCE_BRANCH,
    sourceCommit: treeData.sha || null,
    sourceSvgCount: svgFiles.length,
    bundledCrestCount: completed,
    bundledClubCrestCount: completedClubs,
    bundledNationalTeamCrestCount: completedNationalTeams,
    selectionFile: 'scripts/team-crest-selection.json',
    webFormat: 'original SVG',
    mobileFormat: '256x256 transparent PNG',
    teams: catalog,
  }, null, 2) + '\n'),
]);
console.log(`Bundled ${completedClubs} canonical club crests and ${completedNationalTeams} national-team crests for web and React Native.`);
