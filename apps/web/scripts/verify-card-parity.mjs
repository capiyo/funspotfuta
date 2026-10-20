import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:4173';
const output = path.resolve('docs/verify');
fs.mkdirSync(output, { recursive: true });
const pairs = [
  ['Wolverhampton Wanderers', 'Manchester United'],
  ['Manchester United', 'Brighton & Hove Albion'],
  ['Tottenham Hotspur', 'Crystal Palace'],
  ['Arsenal', 'Leeds United'],
  ['Real Sociedad', 'Athletic Club'],
  ['Newcastle United', 'West Ham United'],
  ['Paris Saint-Germain', 'Bayern Munich'],
  ['Internazionale', 'Atlético Madrid'],
];
const fixtures = pairs.map(([home_team, away_team], i) => ({
  id: 'card-parity-' + i, match_id: 'card-parity-' + i, home_team, away_team,
  league: ['Premier League', 'UEFA Champions League', 'La Liga'][i % 3],
  date: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
  status: 'upcoming', is_live: false, home_score: null, away_score: null,
  votes: i + 1, voters: [], available_for_voting: true,
}));
const channels = ['Premier League', 'World Cup', 'Local Derbies', 'Arsenal Fans'].map((name, i) => ({
  id: 'card-channel-' + i, channel_id: 'card-channel-' + i, name,
  image_url: 'https://images.test/channel-' + i + '.png', members: [], member_count: 20 + i,
  is_public: true, is_approved: true, is_active: true,
}));
const widths = [360, 390, 600, 700, 1280, 1920];
const structures = new Map();
const results = [];
const errors = [];
const browser = await chromium.launch({ headless: true });

async function mock(page) {
  await page.addInitScript((teamNames) => {
    const entries = {};
    for (const name of teamNames) entries[name.toLowerCase()] = {
      value: 'https://logos.test/' + encodeURIComponent(name.toLowerCase()) + '.svg',
      expiresAt: Date.now() + 86400000,
    };
    localStorage.setItem('funspot.teamLogos.v1', JSON.stringify(entries));
  }, pairs.flat());
  await page.route('**/api/games**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(fixtures),
  }));
  await page.route('**/api/channels/all**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(channels),
  }));
  await page.route('**/api/posts**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ posts: [], success: true, stats: {}, pagination: {} }),
  }));
  await page.route('https://www.thesportsdb.com/api/v1/json/3/searchteams.php**', route => {
    const name = new URL(route.request().url()).searchParams.get('t') || 'unknown';
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ teams: [{ strBadge: 'https://logos.test/' + encodeURIComponent(name.toLowerCase()) + '.svg' }] }),
    });
  });
  await page.route('https://logos.test/**', route => route.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#37c879"/></svg>',
  }));
  await page.route('https://images.test/**', route => route.fulfill({
    status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx0cAAAAASUVORK5CYII=', 'base64'),
  }));
  page.on('pageerror', error => errors.push(error.message));
}

const requiredSelectors = [
  '.match-card-channel-avatar',
  '.match-card-channel-name',
  '.match-card-date',
  '.match-card-league-line',
  '.match-card-comment-preview',
  '.match-card-prompt-line',
  'button[aria-label="Vote"],button[aria-label="Results"]',
  'button[aria-label="Poke on this match"]',
  'button[aria-label="Like"],button[aria-label="Unlike"]',
  'button[aria-label="Comments"]',
  'button[aria-label="Log in to comment"]',
  '.match-card-teams',
];

async function inspect(width) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await mock(page);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.home-screen .match-card', { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll('.home-screen .match-card').length >= 8, null, { timeout: 45000 });
  await page.waitForSelector('.home-screen .match-card-channel-avatar', { timeout: 15000 });
  const cards = page.locator('.home-screen .match-card');
  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    const structure = await card.evaluate(el => ({
      classes: [...el.classList].sort(),
      descendants: [...el.querySelectorAll('*')].map(n => ({ tag: n.tagName, classes: [...n.classList].sort() })),
    }));
    structures.set(width + ':' + i, structure);
    for (const selector of requiredSelectors) {
      assert(await card.locator(selector).count() === 1,
        'Card ' + i + ' at ' + width + 'px: missing/duplicated ' + selector);
    }
    const inOrder = await card.evaluate((el, selectors) => {
      const nodes = selectors.map(selector => el.querySelector(selector));
      return nodes.every((node, index) => !!node && (index === 0 || !!(nodes[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)));
    }, requiredSelectors);
    assert(inOrder, 'Card ' + i + ' at ' + width + 'px: required DOM order differs');

    const avatar = await card.locator('.match-card-channel-avatar').evaluate(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el), img = el.querySelector('img');
      return { width: r.width, height: r.height, radius: s.borderRadius, imageRadius: img ? getComputedStyle(img).borderRadius : null };
    });
    assert(Math.abs(avatar.width - 24) <= .5 && Math.abs(avatar.height - 24) <= .5 && avatar.radius === '50%',
      'Card ' + i + ': channel image/fallback is not 24px circular at ' + width + 'px: ' + JSON.stringify(avatar));
    if (avatar.imageRadius !== null) assert(avatar.imageRadius === '50%', 'Channel image is not circular');
    assert(await card.locator('.match-card-league-line').count() === 1, 'Expected exactly one league line');

    const metrics = await card.evaluate(el => {
      const channel = el.querySelector('.match-card-channel-avatar').getBoundingClientRect();
      const league = el.querySelector('.match-card-league-line').getBoundingClientRect();
      const preview = el.querySelector('.match-card-comment-preview').getBoundingClientRect();
      const prompt = el.querySelector('.match-card-prompt-line').getBoundingClientRect();
      const previewText = getComputedStyle(el.querySelector('.match-card-preview-text')).color;
      const promptText = getComputedStyle(el.querySelector('.match-card-prompt-line')).color;
      const poke = el.querySelector('.match-card-poke');
      const circle = poke.querySelector('.match-card-poke-circle');
      const pokeRect = circle.getBoundingClientRect();
      const actionSelectors = [
        'button[aria-label="Vote"],button[aria-label="Results"]',
        'button[aria-label="Poke on this match"]',
        'button[aria-label="Like"],button[aria-label="Unlike"]',
        'button[aria-label="Comments"]',
        'button[aria-label="Log in to comment"]',
      ];
      const actionTops = actionSelectors.slice(0, 4).map(s => el.querySelector(s).getBoundingClientRect().top);
      const promptRect = el.querySelector('button[aria-label="Log in to comment"]').getBoundingClientRect();
      const teams = el.querySelector('.match-card-teams');
      const tr = teams.getBoundingClientRect();
      const ar = el.querySelector('.match-card-actions').getBoundingClientRect();
      const names = [...teams.querySelectorAll('.match-card-team-name')].map(n => ({ text: n.textContent.trim(), client: n.clientWidth, scroll: n.scrollWidth }));
      const logos = [...teams.querySelectorAll('.match-card-team-logo')].map(n => {
        const r = n.getBoundingClientRect();
        return { width: r.width, height: r.height, radius: getComputedStyle(n).borderRadius };
      });
      return {
        channelX: channel.x, leagueX: league.x,
        previewBottom: preview.bottom, promptTop: prompt.top,
        previewText, promptText,
        pokeWidth: pokeRect.width, pokeHeight: pokeRect.height, pokeRadius: getComputedStyle(circle).borderRadius,
        pointer: !!poke.querySelector('svg'), pokeText: poke.textContent.trim(),
        actionTops, promptRect: promptRect.toJSON(), actionsBottom: ar.bottom,
        teamRect: tr.toJSON(), actionsRect: ar.toJSON(), names, logos,
      };
    });
    assert(Math.abs(metrics.channelX - metrics.leagueX) <= 1, 'League line is not aligned with channel image at ' + width + 'px');
    assert(metrics.promptTop >= metrics.previewBottom - .5, 'Random line is above comment preview at ' + width + 'px');
    assert(metrics.promptText === metrics.previewText, 'Random line color differs from comment at ' + width + 'px');
    assert(Math.abs(metrics.pokeWidth - 28) <= .5 && Math.abs(metrics.pokeHeight - 28) <= .5 && metrics.pokeRadius === '50%',
      'Poke circle is not 28x28 circular at ' + width + 'px');
    assert(metrics.pointer && metrics.pokeText === 'Poke', 'Poke Pointer icon/label missing');
    if (width < 651) {
      assert(Math.max(...metrics.actionTops) - Math.min(...metrics.actionTops) <= 4,
        'Vote/Poke/Like/Comments are not on one row at ' + width + 'px: ' + metrics.actionTops.join(','));
      assert(metrics.promptRect.top >= metrics.actionsBottom - 0.5,
        'Login prompt starts before the action row ends at ' + width + 'px');
    } else {
      const desktopTops = [...metrics.actionTops, metrics.promptRect.top, metrics.teamRect.top];
      assert(Math.max(...desktopTops) - Math.min(...desktopTops) <= 4,
        'Desktop actions, login prompt and team group are not on one row at ' + width + 'px: ' + desktopTops.join(','));
    }
    assert(metrics.names.length === 2 && metrics.names.every(n => n.text && n.scroll <= n.client),
      'Team names truncated at ' + width + 'px: ' + JSON.stringify(metrics.names));
    const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    assert(!intersects(metrics.teamRect, metrics.actionsRect),
      'Team group overlaps action group at ' + width + 'px');
    assert(!intersects(metrics.teamRect, metrics.promptRect),
      'Team group overlaps login prompt at ' + width + 'px');
    assert(metrics.logos.length === 2 && metrics.logos.every(l => Math.abs(l.width - 16) <= .5 && Math.abs(l.height - 16) <= .5 && l.radius === '50%'),
      'Team logos/fallbacks are not 16px circular at ' + width + 'px');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.body.scrollWidth > document.body.clientWidth);
  assert(!overflow, 'Horizontal page scroll at ' + width + 'px');
  if (width === 390 || width === 1280) await page.screenshot({ path: path.join(output, 'chats-card-parity-' + width + '.png'), fullPage: true });
  results.push({ width, cardsChecked: 3, horizontalScroll: false });
  await context.close();
}

try {
  for (const width of widths) await inspect(width);
  for (let i = 0; i < 3; i++) {
    const reference = structures.get('390:' + i);
    for (const width of widths) assert.deepEqual(structures.get(width + ':' + i), reference,
      'Card ' + i + ' structure differs at ' + width + 'px versus 390px');
  }
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  console.log(JSON.stringify({ passed: true, widths: results, structureParity: true, screenshots: ['docs/verify/chats-card-parity-390.png', 'docs/verify/chats-card-parity-1280.png'] }, null, 2));
} finally {
  await browser.close();
}
