import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.VERIFY_BASE_URL ?? 'http://127.0.0.1:4173';
const fixtureNames = [
  ['Arsenal', 'Leeds United', 'upcoming', null, null],
  ['Genoa', 'Fiorentina', 'live', 1, 0],
  ['Arsenal', 'Genoa', 'completed', 2, 1],
  ['Leeds United', 'Fiorentina', 'upcoming', null, null],
  ['Fiorentina', 'Arsenal', 'completed', 0, 0],
  ['Genoa', 'Leeds United', 'upcoming', null, null],
];
const fixtures = fixtureNames.map(([home_team, away_team, status, home_score, away_score], i) => ({
  _id: `verify-fixture-${i}`, match_id: `verify-fixture-${i}`, home_team, away_team,
  league: 'Premier League', date: '2026-10-20T18:00:00.000Z', time: '18:00',
  status, is_live: status === 'live', home_score, away_score, votes: 0, voters: [],
  available_for_voting: status !== 'completed',
}));
const channels = [{ channel_id: 'verify-channel', name: 'Premier League', member_count: 8, season: '2026', members: [], is_approved: true, is_active: true }];
const posts = [];

const browser = await chromium.launch({ headless: true });
await mkdir('docs/verify', { recursive: true });
const errors = [];
const requestTimes = [];
const teamRequests = new Map();

async function installMocks(page) {
  await page.route('**/api/games**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures) }));
  await page.route('**/api/channels/all**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(channels) }));
  await page.route('**/api/posts**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(posts) }));
  await page.route('https://www.thesportsdb.com/api/v1/json/3/searchteams.php**', async route => {
    const url = new URL(route.request().url());
    const name = (url.searchParams.get('t') ?? '').trim().toLowerCase();
    requestTimes.push(Date.now());
    teamRequests.set(name, (teamRequests.get(name) ?? 0) + 1);
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ teams: [{ strBadge: `https://logo.test/${encodeURIComponent(name)}.svg` }] }),
    });
  });
  await page.route('https://logo.test/**', route => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#37c879"/></svg>',
  }));
  page.on('pageerror', error => errors.push(error.message));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspectDesktop(width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await installMocks(page);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.match-card', { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll('.match-card').length >= 6, null, { timeout: 45000 });
  await page.waitForTimeout(500);
  const cards = page.locator('.match-card');
  const cardCount = await cards.count();
  assert(cardCount >= 6, `Expected 6 cards at ${width}px; got ${cardCount}`);
  for (let i = 0; i < cardCount; i++) {
    const card = cards.nth(i);
    const vote = card.locator('button[aria-label="Vote"],button[aria-label="Results"]').first();
    const poke = card.locator('button[aria-label="Poke on this match"]');
    assert(await vote.count() === 1, `Card ${i}: Vote/Results action missing at ${width}px`);
    assert(await poke.count() === 1, `Card ${i}: Poke missing at ${width}px`);
    const voteBox = await vote.boundingBox();
    const pokeBox = await poke.boundingBox();
    assert(voteBox && pokeBox, `Card ${i}: action bounds unavailable`);
    assert(Math.abs(voteBox.y - pokeBox.y) <= 2, `Card ${i}: Vote and Poke not on same row`);
    assert(pokeBox.x >= voteBox.x + voteBox.width - 1 && pokeBox.x - (voteBox.x + voteBox.width) <= 16, `Card ${i}: Poke does not directly follow Vote`);
    const pokeStyle = await poke.evaluate(el => {
      const circle = el.querySelector('.match-card-poke-circle');
      if (!circle) return null;
      const s = getComputedStyle(circle); const r = circle.getBoundingClientRect();
      return { width: r.width, height: r.height, radius: s.borderRadius, text: el.textContent?.trim() };
    });
    assert(pokeStyle && Math.abs(pokeStyle.width - 28) <= 1 && Math.abs(pokeStyle.height - 28) <= 1, `Card ${i}: Poke icon target is not 28x28`);
    assert(pokeStyle.radius === '50%', `Card ${i}: Poke icon is not circular: ${pokeStyle.radius}`);
    assert(pokeStyle.text === 'Poke', `Card ${i}: Poke label mismatch: ${pokeStyle.text}`);
    const preview = card.locator('.match-card-comment-preview').first();
    const prompt = card.locator('.match-card-prompt-line').first();
    const [previewBox, promptBox, previewColor, promptColor] = await Promise.all([
      preview.boundingBox(), prompt.boundingBox(),
      preview.evaluate(el => getComputedStyle(el).color),
      prompt.evaluate(el => getComputedStyle(el).color),
    ]);
    assert(previewBox && promptBox && promptBox.y >= previewBox.y + previewBox.height - 1, `Card ${i}: prompt line is not below comment preview`);
    assert(previewColor === promptColor, `Card ${i}: prompt color differs from preview (${promptColor} vs ${previewColor})`);
    const team = card.locator('.match-card-teams');
    const teamStyle = await team.evaluate(el => ({ color: getComputedStyle(el).color, box: el.getBoundingClientRect().toJSON() }));
    const primary = await card.evaluate(el => getComputedStyle(el).getPropertyValue('--match-primary').trim());
    const expectedPrimary = await card.evaluate(el => { const probe = document.createElement('span'); probe.style.color = 'var(--match-primary)'; el.appendChild(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; });
    assert(teamStyle.color === expectedPrimary && primary.length > 0, `Card ${i}: team group is not using primary color`);
    const logos = card.locator('.match-card-team-logo');
    assert(await logos.count() === 2, `Card ${i}: both team logos/fallbacks must render`);
    for (let j = 0; j < 2; j++) {
      const logo = await logos.nth(j).evaluate(el => {
        const s = getComputedStyle(el); const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height, radius: s.borderRadius };
      });
      assert(Math.abs(logo.width - 16) <= 1 && Math.abs(logo.height - 16) <= 1 && logo.radius === '50%', `Card ${i}: logo ${j} is not 16px circular`);
    }
    const left = await card.locator('.match-card-bottom').evaluate(el => {
      const row = el.getBoundingClientRect();
      const actions = el.querySelector('.match-card-actions').getBoundingClientRect();
      const teams = el.querySelector('.match-card-teams').getBoundingClientRect();
      return { row: row.toJSON(), actions: actions.toJSON(), teams: teams.toJSON() };
    });
    assert(left.actions.right <= left.teams.left + 1, `Card ${i}: team group overlaps left action group`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth);
  assert(!overflow, `Horizontal page overflow at ${width}px`);
  await page.screenshot({ path: `docs/verify/chats-card-${width}.png`, fullPage: true });
  const intervals = requestTimes.slice(1).map((time, i) => time - requestTimes[i]);
  assert(intervals.every(ms => ms >= 1000), `TheSportsDB request spacing below 1 second at ${width}px: ${intervals.join(', ')}`);
  for (const [team, count] of teamRequests) assert(count === 1, `Repeated team ${team} requested ${count} times at ${width}px`);
  requestTimes.length = 0;
  teamRequests.clear();
  await context.close();
}

try {
  await inspectDesktop(1280);
  await inspectDesktop(1920);
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const mobile = await mobileContext.newPage();
  await installMocks(mobile);
  await mobile.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await mobile.waitForSelector('.match-card', { timeout: 45000 });
  const mobileState = await mobile.locator('.match-card').first().evaluate(el => ({
    pokeHidden: getComputedStyle(el.querySelector('.match-card-poke')).display === 'none',
    teamsHidden: getComputedStyle(el.querySelector('.match-card-teams')).display === 'none',
    oldLeagueVisible: getComputedStyle(el.querySelector('.match-card-mobile-league')).display !== 'none',
    oldPredictionVisible: getComputedStyle(el.querySelector('.match-card-mobile-prediction')).display !== 'none',
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  assert(mobileState.pokeHidden && mobileState.teamsHidden && mobileState.oldLeagueVisible && mobileState.oldPredictionVisible && !mobileState.overflow, '390px mobile layout differs from the pre-change layout');
  await mobile.screenshot({ path: 'docs/verify/chats-card-390.png', fullPage: true });
  await mobileContext.close();
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ passed: true, desktopWidths: [1280, 1920], cardsPerWidth: 6, uniqueTeams: teamRequests.size, requestIntervalsMs: intervals, mobile390: mobileState, screenshots: ['docs/verify/chats-card-1280.png', 'docs/verify/chats-card-1920.png', 'docs/verify/chats-card-390.png'] }, null, 2));
} finally {
  await browser.close();
}
