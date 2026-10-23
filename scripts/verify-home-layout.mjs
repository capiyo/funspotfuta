import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.HOME_VERIFY_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve('docs/verify');
fs.mkdirSync(outDir, { recursive: true });
const widths = [1024, 1280, 1440, 1920];
const baselinePath = path.resolve('scripts/home-layout-baseline-390.json');
const baseline = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;
const recordBaseline = process.argv.includes('--record-baseline');

const fixtures = {
  games: Array.from({ length: 6 }, (_, i) => ({
    id: `fixture-${i + 1}`, fixtureId: `fixture-${i + 1}`,
    homeTeam: ['Arsenal', 'Liverpool', 'Chelsea', 'Everton', 'Leeds', 'Spurs'][i],
    awayTeam: ['City', 'United', 'Brighton', 'Villa', 'Forest', 'West Ham'][i],
    league: ['Premier League', 'Championship', 'Premier League'][i % 3],
    date: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
    status: 'upcoming', isLive: false, votes: 17 + i, voters: [],
    homeScore: null, awayScore: null,
  })),
  channels: ['Army', 'YNWA', 'Toppers', 'Gunners'].map((name, i) => ({
    id: `channel-${i + 1}`, channelId: `channel-${i + 1}`, name,
    members: [], memberCount: 10 + i, isPublic: true,
  })),
  posts: Array.from({ length: 3 }, (_, i) => ({
    id: `post-${i + 1}`, userId: `user-${i + 1}`, username: ['capiyo', 'fan_one', 'fan_two'][i],
    caption: `Sample feed post ${i + 1}`, createdAt: new Date().toISOString(),
    media: [], likesCount: 3 + i, commentsCount: 1,
  })),
};

function fulfillFor(url) {
  if (/\/api\/games(?:\?|$)/.test(url)) return fixtures.games;
  if (/\/api\/channels\/all(?:\?|$)/.test(url)) return fixtures.channels;
  if (/\/api\/posts(?:\?|$)/.test(url)) return fixtures.posts;
  return null;
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  await page.route('**/api/**', async route => {
    const payload = fulfillFor(route.request().url());
    if (payload) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
      return;
    }
    await route.continue();
  });
  page.on('pageerror', error => console.error('[browser pageerror]', error.message));

  async function metrics(width) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(800);
    const result = await page.evaluate(() => {
      const rect = element => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      };
      const cards = [...document.querySelectorAll('.home-screen .chats-column .match-card')];
      const feedCards = [...document.querySelectorAll('.home-screen .feed-column .post-card, .home-screen .feed-column .feed-item')];
      const first = cards[0];
      const content = first?.querySelector(':scope > div[style*="padding"]');
      const header = content?.children[0];
      const league = content?.children[1];
      const comment = content?.children[2];
      const actions = first?.lastElementChild;
      const filter = document.querySelector('.home-screen .chats-column .segmented-control');
      const columns = document.querySelector('.home-screen .home-columns');
      const chats = document.querySelector('.home-screen .chats-column');
      const feed = document.querySelector('.home-screen .feed-column');
      const overflowElements = [...document.querySelectorAll('.home-screen .chats-column *, .home-screen .feed-column *')]
        .filter(el => el.scrollWidth > el.clientWidth + 1)
        .slice(0, 12)
        .map(el => ({ tag: el.tagName, className: typeof el.className === 'string' ? el.className : '', scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
      const gap = (a, b) => a && b ? Math.round((b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) * 100) / 100 : null;
      return {
        width,
        cardHeights: cards.slice(0, 3).map(el => Math.round(el.getBoundingClientRect().height * 100) / 100),
        rowGaps: { headerToLeague: gap(header, league), leagueToComment: gap(league, comment), commentToActions: gap(comment, actions) },
        columnGap: first && feedCards[0] ? Math.round((feedCards[0].getBoundingClientRect().left - first.getBoundingClientRect().right) * 100) / 100 : null,
        filterRightDelta: filter && first ? Math.round((filter.getBoundingClientRect().right - first.getBoundingClientRect().right) * 100) / 100 : null,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        overflowElements,
        columns: columns ? rect(columns) : null,
        chats: chats ? rect(chats) : null,
        feed: feed ? rect(feed) : null,
        rowRects: { header: header ? rect(header) : null, league: league ? rect(league) : null, comment: comment ? rect(comment) : null, actions: actions ? rect(actions) : null },
        cardCount: cards.length,
        feedCount: feedCards.length,
      };
    });
    await page.screenshot({ path: path.join(outDir, `home-${width}.png`), fullPage: true });
    return result;
  }

  const results = [];
  for (const width of widths) {
    const m = await metrics(width);
    results.push(m);
    assert(m.cardCount >= 3, `Expected at least 3 Chats cards at ${width}px, found ${m.cardCount}`);
    assert(m.feedCount >= 1, `Expected at least one Feed card at ${width}px, found ${m.feedCount}`);
    for (const height of m.cardHeights) assert(height >= 105 && height <= 130, `Chats card height ${height}px outside 105-130px at ${width}px`);
    assert(m.columnGap !== null && Math.abs(m.columnGap - 5) <= 1, `Column gap ${m.columnGap}px at ${width}px`);
    assert(m.filterRightDelta !== null && Math.abs(m.filterRightDelta) <= 1, `Filter/card right edge delta ${m.filterRightDelta}px at ${width}px`);
    assert(m.documentWidth <= m.viewportWidth, `Document horizontal overflow at ${width}px: ${m.documentWidth} > ${m.viewportWidth}`);
    assert.equal(m.overflowElements.length, 0, `Horizontal overflow inside Home columns at ${width}px: ${JSON.stringify(m.overflowElements)}`);
    for (const key of ['headerToLeague', 'leagueToComment', 'commentToActions']) {
      assert(m.rowGaps[key] !== null, `Missing row geometry ${key} at ${width}px`);
    }
  }
  const narrow = await metrics(390);
  assert(narrow.cardCount >= 1, 'No Chats cards at 390px');
  assert(narrow.documentWidth <= narrow.viewportWidth, 'Document horizontal overflow at 390px');
  const narrowMetrics = { cardHeights: narrow.cardHeights, rowGaps: narrow.rowGaps };
  if (recordBaseline) {
    fs.writeFileSync(baselinePath, JSON.stringify(narrowMetrics, null, 2) + '\\n');
    console.log('Recorded 390px baseline:', JSON.stringify(narrowMetrics));
  } else if (!baseline) {
    console.error('390px baseline comparison NOT VERIFIED: scripts/home-layout-baseline-390.json is missing. Check out the parent commit and run this script with --record-baseline, then restore the target commit and rerun.');
    process.exitCode = 2;
  } else {
    assert.deepEqual(narrowMetrics, baseline, 'Narrow 390px card heights or row gaps differ from parent-commit baseline');
  }
  console.log(JSON.stringify({ desktop: results, narrow390: narrow, narrowBaselineCompared: !recordBaseline && !!baseline }, null, 2));
} finally {
  await browser.close();
}
