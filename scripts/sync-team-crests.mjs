#!/usr/bin/env node
/**
 * Build the bundled football crest catalogue from TheSportsDB's Soccer team records.
 * Run with: npm run sync:team-crests
 * Optional: THESPORTSDB_API_KEY. Assets without a badge are skipped, never fabricated.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const API_KEY = process.env.THESPORTSDB_API_KEY || '3';
const API = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const WEB_DIR = path.join(ROOT, 'apps/web/public/team-crests');
const MOBILE_DIR = path.join(ROOT, 'apps/mobile/assets/team-crests');
const WEB_GENERATED = path.join(ROOT, 'apps/web/src/components/team-crest-catalog.generated.ts');
const MOBILE_GENERATED = path.join(ROOT, 'apps/mobile/src/components/team-crest-catalog.generated.ts');
const SOURCE_MANIFEST = path.join(ROOT, 'apps/web/public/team-crests/source-manifest.json');
const MAX_PARALLEL = 4;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

async function requestJson(url, attempt = 0) {
  const response = await fetch(url, { headers: { 'user-agent': 'Funspot-TeamCrest-Sync/1.0' } });
  if ((response.status === 429 || response.status >= 500) && attempt < 5) {
    await sleep(Math.min(1500 * (attempt + 1), 8000));
    return requestJson(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { await worker(items[index], index); }
      catch (error) { console.warn('Skipped item after error:', error instanceof Error ? error.message : error); }
    }
  });
  await Promise.all(workers);
}

function extensionFor(contentType, url) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'image/png') return '.png';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/jpeg' || type === 'image/jpg') return '.jpg';
  if (type === 'image/svg+xml') return '.svg';
  const pathname = new URL(url).pathname.toLowerCase();
  const match = pathname.match(/\.(png|webp|jpe?g|svg)$/);
  return match ? (match[1] === 'jpeg' ? '.jpg' : '.' + match[1]) : '.png';
}

await Promise.all([mkdir(WEB_DIR, { recursive: true }), mkdir(MOBILE_DIR, { recursive: true })]);
const leaguePayload = await requestJson(`${API}/all_leagues.php`);
const leagues = Array.isArray(leaguePayload.leagues) ? leaguePayload.leagues : [];
const soccerLeagues = leagues.filter((league) => String(league.strSport || '').toLowerCase() === 'soccer');
if (!soccerLeagues.length) throw new Error('The API returned no Soccer leagues; refusing to overwrite the existing catalogue.');

const teamsById = new Map();
await mapLimit(soccerLeagues, MAX_PARALLEL, async (league) => {
  const name = String(league.strLeague || '').trim();
  if (!name) return;
  const payload = await requestJson(`${API}/search_all_teams.php?l=${encodeURIComponent(name)}`);
  for (const team of Array.isArray(payload.teams) ? payload.teams : []) {
    if (team && team.idTeam && team.strTeam) teamsById.set(String(team.idTeam), team);
  }
  await sleep(120);
});

const teams = [...teamsById.values()].sort((a, b) => String(a.strTeam).localeCompare(String(b.strTeam)));
const catalog = [];
let downloaded = 0;
await mapLimit(teams, MAX_PARALLEL, async (team) => {
  const imageUrl = [team.strBadge, team.strTeamBadge, team.strLogo].find((value) => typeof value === 'string' && /^https?:\/\//i.test(value));
  if (!imageUrl) return;
  const response = await fetch(imageUrl, { headers: { 'user-agent': 'Funspot-TeamCrest-Sync/1.0' } });
  if (!response.ok) return;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('image/')) return;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 2_000_000) return;
  const ext = extensionFor(contentType, imageUrl);
  const filename = String(team.idTeam).replace(/[^a-zA-Z0-9_-]/g, '') + ext;
  await Promise.all([
    writeFile(path.join(WEB_DIR, filename), bytes),
    writeFile(path.join(MOBILE_DIR, filename), bytes),
  ]);
  const aliases = [team.strTeam, team.strAlternate, team.strLeague]
    .filter((value) => typeof value === 'string' && value.trim())
    .slice(0, 2);
  const keys = [...new Set([team.strTeam, team.strAlternate]
    .filter((value) => typeof value === 'string' && value.trim())
    .map(normalize).filter(Boolean))];
  catalog.push({ id: String(team.idTeam), name: String(team.strTeam), league: String(team.strLeague || ''),
    filename, source: imageUrl, aliases, keys });
  downloaded++;
});

if (!catalog.length) throw new Error('No crest assets downloaded; refusing to publish an empty catalogue.');
catalog.sort((a, b) => a.name.localeCompare(b.name));
const webMap = {};
const mobileMap = {};
for (const team of catalog) {
  for (const key of team.keys) {
    webMap[key] ||= '/team-crests/' + team.filename;
    mobileMap[key] ||= team.filename;
  }
}
const webTs = '// Generated by scripts/sync-team-crests.mjs. Do not edit by hand.\nexport const WEB_TEAM_CRESTS: Readonly<Record<string, string>> = ' +
  JSON.stringify(webMap, null, 2) + ';\n';
const mobileLines = ['// Generated by scripts/sync-team-crests.mjs. Do not edit by hand.',
  "import type { ImageSourcePropType } from 'react-native';",
  'export const MOBILE_TEAM_CRESTS: Readonly<Record<string, ImageSourcePropType>> = {'];
for (const [key, filename] of Object.entries(mobileMap)) {
  mobileLines.push(`  ${JSON.stringify(key)}: require('../../assets/team-crests/${filename}'),`);
}
mobileLines.push('};', '');
await Promise.all([
  writeFile(WEB_GENERATED, webTs),
  writeFile(MOBILE_GENERATED, mobileLines.join('\n')),
  writeFile(SOURCE_MANIFEST, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'TheSportsDB Soccer league/team badge endpoints',
    sourceTerms: 'Review TheSportsDB terms and each asset’s usage rights before commercial redistribution.',
    leagueCount: soccerLeagues.length,
    discoveredTeams: teams.length,
    downloadedCrests: downloaded,
    teams: catalog,
  }, null, 2) + '\n'),
]);
console.log(`Bundled ${downloaded} crests from ${teams.length} teams across ${soccerLeagues.length} soccer leagues.`);
