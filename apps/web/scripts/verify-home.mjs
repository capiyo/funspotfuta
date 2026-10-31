import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.HOME_VERIFY_URL ?? 'http://127.0.0.1:4173';
const output = path.resolve('docs/verify');
fs.mkdirSync(output, { recursive: true });

const teams = [
  ['Manchester City', 'Brighton & Hove Albion', 'upcoming'],
  ['Wolverhampton Wanderers', 'Borussia Mönchengladbach', 'live'],
  ['Liverpool', 'Manchester City', 'completed'], ['Roma', 'Napoli', 'upcoming'],
  ['Chelsea', 'Everton', 'upcoming'], ['Real Madrid', 'Barcelona', 'completed'],
  ['Inter', 'AC Milan', 'live'], ['Bayern Munich', 'Dortmund', 'upcoming'],
];
const games = teams.map(([home_team, away_team, status], i) => ({
  id: `home-verify-${i}`, match_id: `home-verify-${i}`, home_team, away_team,
  league: 'Premier League', date: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
  status, is_live: status === 'live', home_score: status === 'completed' ? 2 : null,
  away_score: status === 'completed' ? 1 : null, votes: 0, voters: [],
}));
const channels = ['Premier League', 'World Cup', 'Local Derbies', 'Arsenal Fans'].map((name, i) => ({
  id: `home-channel-${i}`, channel_id: `home-channel-${i}`, name,
  image_url: `https://images.test/channel-${i}.png`, members: [], member_count: 20 + i,
  is_public: true, is_approved: true, is_active: true,
}));
const posts = Array.from({ length: 4 }, (_, i) => ({
  id: `home-post-${i}`, user_id: `home-user-${i}`, user_name: ['maya', 'john_w', 'lee', 'sam'][i],
  caption: `A sample post for the Home visual verification (${i + 1}).`,
  created_at: new Date(Date.now() - i * 60000).toISOString(), likes_count: i + 2,
  comments_count: i, post_type: i === 3 ? 'video' : 'image',
  video_url: i === 3 ? 'https://media.test/highlights.mp4' : null,
  image_url: i === 3 ? null : `https://images.test/post-${i}.jpg`,
}));

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  await page.route('**/api/games**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(games) }));
  await page.route('**/api/channels/all**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ channels }) }));
  await page.route('**/api/posts**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ posts, success: true, stats: {}, pagination: {} }) }));
  await page.route('https://images.test/**', route => route.fulfill({
    status: 200, contentType: route.request().url().endsWith('.mp4') ? 'video/mp4' : 'image/png',
    body: route.request().url().endsWith('.mp4') ? Buffer.alloc(0) : Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jx0cAAAAASUVORK5CYII=', 'base64'),
  }));
  await page.route('https://media.test/**', route => route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) }));
  await page.route('https://www.thesportsdb.com/api/v1/json/3/searchteams.php**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ teams: null }),
  }));
  page.on('pageerror', error => errors.push(error.message));

  async function inspect(width) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.home-screen .profile-sidebar-rich', { state: 'attached', timeout: 45000 });
    await page.waitForTimeout(1000);
    if (width >= 651) {
      await page.waitForSelector('.home-screen .match-card', { timeout: 45000 });
      const layout = await page.evaluate(() => {
        const rect = selector => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        const style = (selector, pseudo) => {
          const el = document.querySelector(selector);
          return el ? getComputedStyle(el, pseudo).cssText || {
            color: getComputedStyle(el, pseudo).color,
            height: getComputedStyle(el, pseudo).height,
            boxShadow: getComputedStyle(el, pseudo).boxShadow,
          } : null;
        };
        const logo = rect('.desktop-home-header a[aria-label="Funspot home"]');
        const sidebar = rect('.home-screen .profile-sidebar-rich');
        const workspace = rect('.home-screen .workspace');
        const homeColumns = rect('.home-screen .home-columns');
        const chatsColumn = rect('.home-screen .chats-column');
        const feedColumn = rect('.home-screen .feed-column');
        const feedHeaderStyle = style('.home-screen .feed-column', '::before');
        const navbar = rect('.home-screen .desktop-home-header');
        const borders = [...document.querySelectorAll('.home-screen *')].filter(el => {
          if (el.closest('.profile-card, .balance-card, .member-card')) return false;
          const s = getComputedStyle(el);
          return ['borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'].some(k => parseFloat(s[k]) > 0);
        }).slice(0, 8).map(el => ({ tag: el.tagName, className: typeof el.className === 'string' ? el.className : '' }));
        const shadows = [...document.querySelectorAll('.home-screen *')].filter(el => {
          if (el.matches('.desktop-home-header') || el.closest('.profile-card, .balance-card, .member-card')) return false;
          return getComputedStyle(el).boxShadow !== 'none';
        }).slice(0, 8).map(el => typeof el.className === 'string' ? el.className : el.tagName);
        const channelImages = [...document.querySelectorAll('.desktop-home-header .desktop-channel-avatar')].map(el => {
          const r = el.getBoundingClientRect();
          return { width: r.width, height: r.height, radius: getComputedStyle(el).borderRadius };
        });
        const media = [...document.querySelectorAll('.feed-column img:not(.mini-avatar), .feed-column video')].map(el => {
          const r = el.getBoundingClientRect();
          return { height: r.height, radius: getComputedStyle(el).borderRadius };
        });
        const login = document.querySelector('.profile-sidebar-rich .profile-guest-login');
        const loginRect = login?.getBoundingClientRect();
        return {
          viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth,
          logo, sidebar, workspace, homeColumns, navbar, chatsColumn, feedColumn,
          containerMargins: sidebar && feedColumn ? [sidebar.x, innerWidth - feedColumn.right] : null,
          borders, shadows, channelImages, media,
          login: login && loginRect ? {
            height: loginRect.height, background: getComputedStyle(login).backgroundColor,
            color: getComputedStyle(login).color, radius: getComputedStyle(login).borderRadius,
          } : null,
          feedCardsRight: Math.max(0, ...[...document.querySelectorAll('.home-screen .feed-column .post-card, .home-screen .feed-column .feed-item')].map(el => el.getBoundingClientRect().right)),
          chatsWidth: document.querySelector('.home-screen .chats-column')?.getBoundingClientRect().width ?? 0,
          cardChecks: [...document.querySelectorAll('.home-screen .match-card')].map(card => {
            const leagues = [...card.querySelectorAll('.match-card-league-line')];
            const secondary = card.querySelector('.match-card-mobile-league');
            const actions = card.querySelector('.match-card-actions');
            const vote = actions?.querySelector('button');
            const poke = actions?.querySelector('.match-card-poke');
            const team = card.querySelector('.match-card-teams');
            const t = team?.getBoundingClientRect(), l = actions?.getBoundingClientRect(), c = card.getBoundingClientRect();
            const names = [...card.querySelectorAll('.match-card-team-name')].map(name => ({
              name: (name.textContent ?? '').trim(), length: (name.textContent ?? '').trim().length,
              scrollWidth: name.scrollWidth, clientWidth: name.clientWidth, textOverflow: getComputedStyle(name).textOverflow,
            }));
            return {
              leagueCount: leagues.length, leagueVisible: leagues.length === 1 && getComputedStyle(leagues[0]).display !== 'none',
              secondaryVisible: secondary ? getComputedStyle(secondary).display !== 'none' : false,
              adjacentVotePoke: !!vote && !!poke && vote.closest('.match-card-action-slot')?.parentElement === poke.closest('.match-card-action-slot')?.parentElement && Math.abs([...actions.children].indexOf(vote.closest('.match-card-action-slot')) - [...actions.children].indexOf(poke.closest('.match-card-action-slot'))) === 1,
              teamOverlap: !!(t && l && t.left < l.right && t.right > l.left && t.top < l.bottom && t.bottom > l.top),
              teamRight: t?.right ?? null, cardRight: c.right, names,
            };
          }),
          cardCount: document.querySelectorAll('.home-screen .match-card').length,
          feedCount: document.querySelectorAll('.home-screen .feed-column .post-card, .home-screen .feed-column .feed-item').length,
        };
      });
      assert(layout.logo && layout.sidebar && Math.abs(layout.logo.x - layout.sidebar.x) <= 1,
        `Logo/sidebar left edges differ at ${width}px: ${JSON.stringify({ logo: layout.logo, sidebar: layout.sidebar })}`);
      assert(layout.navbar && Math.abs(layout.navbar.height - 56) <= 1, `Navbar height at ${width}px is ${layout.navbar?.height}`);
      assert(layout.chatsColumn && layout.feedColumn,
        `Chats and Feed columns must both be present at ${width}px`);
      assert(Math.abs(layout.chatsColumn.y - layout.feedColumn.y) <= 1,
        `Chats and Feed columns are not aligned at ${width}px`);
      assert(layout.documentWidth <= width, `Horizontal overflow at ${width}px: ${layout.documentWidth}`);
      assert(layout.channelImages.every(x => Math.abs(x.width - 20) <= 1 && Math.abs(x.height - 20) <= 1 && x.radius === '50%'),
        `Channel avatar geometry invalid at ${width}px: ${JSON.stringify(layout.channelImages)}`);
      assert(layout.media.every(x => x.height <= 420.5), `Feed media exceeds 420px at ${width}px: ${JSON.stringify(layout.media)}`);
      assert(layout.borders.length === 0, `Unexpected Home borders at ${width}px: ${JSON.stringify(layout.borders)}`);
      assert(layout.shadows.length === 0, `Unexpected Home shadows at ${width}px: ${JSON.stringify(layout.shadows)}`);
      assert(layout.containerMargins[0] <= 18 && layout.containerMargins[1] <= 18,
        `Workspace gutters exceed 16px ±2 at ${width}px: ${layout.containerMargins}`);
      if (width === 1920 && layout.feedCardsRight > 0) {
        const spare = width - layout.feedCardsRight;
        assert(spare < 100, `Feed content spare width should be <100px at 1920px, got ${spare}`);
      }
      assert(layout.homeColumns && Math.abs(layout.chatsWidth - layout.homeColumns.width / 2) <= 2,
        `Chats and Feed should each occupy half of the available columns at ${width}px: ${JSON.stringify({ chatsWidth: layout.chatsWidth, columnsWidth: layout.homeColumns?.width })}`);
      for (const card of layout.cardChecks) {
        assert(card.leagueCount === 1 && card.leagueVisible, `Expected one visible league line per card; found ${card.leagueCount}`);
        assert(!card.secondaryVisible, 'Redundant secondary league line is visible on desktop');
        assert(card.adjacentVotePoke, 'Vote and Poke must be adjacent on every card');
        assert(!card.teamOverlap, 'Team group overlaps the action group');
        assert(card.teamRight === null || card.teamRight <= card.cardRight + 1, 'Team group exceeds the card');
        for (const name of card.names) {
          if (name.length <= 28) {
            assert(name.scrollWidth <= name.clientWidth, `Team name clipped: ${name.name}`);
            assert(name.textOverflow !== 'ellipsis', `Short team name ellipsized: ${name.name}`);
          }
        }
      }
      const expectedVisibleFixtures = games.length;
      assert(layout.cardCount === expectedVisibleFixtures, `Expected all ${expectedVisibleFixtures} fixtures (live, upcoming, and completed) at ${width}px, got ${layout.cardCount}`);
      assert(layout.feedCount >= 4, `Expected 4 feed posts at ${width}px, got ${layout.feedCount}`);
      assert(layout.login && layout.login.height >= 32 && layout.login.background !== 'rgba(0, 0, 0, 0)',
        `Guest login button is not filled at ${width}px: ${JSON.stringify(layout.login)}`);
      await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true });
      return layout;
    }
    const narrow = await page.evaluate(() => ({
      width: innerWidth,
      header: getComputedStyle(document.querySelector('.mobile-home-header') ?? document.querySelector('.desktop-home-header')).display,
      tabs: getComputedStyle(document.querySelector('.mobile-home-tabs')).display,
      columns: getComputedStyle(document.querySelector('.home-columns')).display,
      sidebar: getComputedStyle(document.querySelector('.profile-sidebar-rich')).width,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    assert(narrow.width === 390 && !narrow.overflow, `Narrow layout overflows: ${JSON.stringify(narrow)}`);
    assert(narrow.tabs !== 'none', `Narrow Chats/Feed tabs are hidden: ${JSON.stringify(narrow)}`);
    return narrow;
  }

  const desktop = [];
  for (const width of [1280, 1440, 1920]) desktop.push(await inspect(width));
  const narrow = await inspect(390);

  // Clicking the Feed action must open the comments modal over Home at every
  // responsive breakpoint (not just make the deep link render correctly).
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (width < 651) {
      await page.locator('.mobile-home-tabs').getByText('feed', { exact: true }).click();
      await page.waitForSelector('.home-screen .feed-column.mobile-tab-active', { timeout: 10000 });
    }
    await page.waitForSelector('.home-screen .feed-column .post-card', { timeout: 45000 });
    await page.locator('.home-screen .feed-column button[aria-label="Comments"]').first().click();
    await page.waitForURL(url => /^\/comments\//.test(url.pathname), { timeout: 10000 });
    await page.waitForSelector('[role="dialog"][aria-label="Comments"]', { timeout: 15000 });
    const commentsModal = await page.evaluate(() => ({
      dialog: document.querySelector('[role="dialog"][aria-label="Comments"]')?.getBoundingClientRect().toJSON(),
      homeMounted: !!document.querySelector('.home-screen'),
      close: !!document.querySelector('button[aria-label="Close comments"]'),
      ariaModal: document.querySelector('[role="dialog"][aria-label="Comments"]')?.getAttribute('aria-modal'),
    }));
    assert(commentsModal.dialog && commentsModal.dialog.height > 300 && commentsModal.dialog.height < 1000,
      `Comments is not presented as a modal at ${width}px: ${JSON.stringify(commentsModal)}`);
    assert(commentsModal.homeMounted && commentsModal.close && commentsModal.ariaModal === 'true',
      `Comments modal should overlay Home and provide an accessible close action at ${width}px: ${JSON.stringify(commentsModal)}`);
    await page.getByRole('button', { name: 'Close comments' }).evaluate(element => element.click());
    await page.waitForURL(url => url.pathname === '/', { timeout: 10000 });
  }

  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  console.log(JSON.stringify({ desktop, narrow390: narrow, pageErrors: errors }, null, 2));
} finally {
  await browser.close();
}
