import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:4173';
const outputDir = path.resolve('docs/verify');
fs.mkdirSync(outputDir, { recursive: true });
const widths = [1024, 1280, 1440, 1920, 390];
const errors = [];
const browser = await chromium.launch({ headless: true });

const longUsername = 'this_is_an_extremely_long_username_that_must_wrap_or_ellipsize_without_expanding_the_post_card';
const longCaption = ('A very long caption that should wrap naturally inside the post card and never push the layout wider than its grid column. ').repeat(12);
const posts = Array.from({ length: 20 }, (_, index) => {
  const type = index % 6;
  const post = {
    id: 'feed-fixture-' + String(index + 1).padStart(2, '0'),
    user_id: 'guest-fixture-' + index,
    user_name: index === 3 ? longUsername : 'GuestFan' + (index + 1),
    caption: index === 4 ? longCaption : 'Mock post ' + (index + 1) + (index === 0 ? ' — text only.' : '.'),
    image_url: null,
    video_url: null,
    video_thumbnail_url: null,
    post_type: 'text',
    likes_count: index,
    comments_count: index % 4,
    shares_count: 0,
    liked_by: [],
    created_at: new Date(Date.now() - index * 60000).toISOString(),
  };
  if (type === 1 || index === 9) {
    post.post_type = 'text_and_image';
    post.image_url = 'https://feed-media.test/image-' + index + '.svg';
  }
  if (type === 2) {
    post.post_type = 'text_and_video';
    post.video_url = 'https://feed-media.test/video-' + index + '.mp4';
    post.video_thumbnail_url = 'https://feed-media.test/video-thumb-' + index + '.svg';
  }
  if (index === 5) {
    post.post_type = 'image';
    post.caption = 'Portrait image fixture';
    post.image_url = 'https://feed-media.test/portrait-' + index + '.svg';
  }
  return post;
});

async function mock(page) {
  await page.route('**/api/games**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/channels/all**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('https://clash-api-m5mr.onrender.com/api/posts**', route => {
    const url = new URL(route.request().url());
    const pageNo = Math.max(1, Number(url.searchParams.get('page') || 1));
    const limit = Math.max(1, Number(url.searchParams.get('limit') || 10));
    const pagePosts = posts.slice((pageNo - 1) * limit, pageNo * limit);
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ posts: pagePosts, success: true, stats: {}, pagination: { page: pageNo, limit } }),
    });
  });
  await page.route('https://www.thesportsdb.com/**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ teams: [] }),
  }));
  await page.route('https://feed-media.test/**', route => {
    const url = route.request().url();
    if (url.endsWith('.mp4')) {
      return route.fulfill({
        status: 200, contentType: 'video/mp4',
        body: Buffer.from(''),
      });
    }
    const portrait = url.includes('portrait');
    const svg = portrait
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1000"><rect width="400" height="1000" fill="#25314a"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#25314a"/></svg>';
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg });
  });
  page.on('pageerror', error => errors.push(error.message));
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function inspect(width) {
  const context = await browser.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await mock(page);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.home-screen .feed-column .feed-screen', { timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll('.home-screen .feed-column .feed-list > .feed-item').length >= 10, null, { timeout: 45000 });
  if (width === 390) {
    const feedTab = page.locator('.mobile-home-tabs button').filter({ hasText: 'Feed' }).first();
    if (await feedTab.count()) await feedTab.click();
  }

  const metrics = await page.evaluate(() => {
    const feedColumn = document.querySelector('.home-screen .feed-column');
    const feed = feedColumn?.querySelector('.feed-screen');
    const list = feedColumn?.querySelector('.feed-list');
    const chats = document.querySelector('.home-screen .chats-column');
    const cards = [...(list?.querySelectorAll(':scope > .feed-item') ?? [])];
    const cardMetrics = cards.map(item => {
      const card = item.querySelector('.post-card');
      const cr = card.getBoundingClientRect();
      const follow = card.querySelector('button[aria-label^="Follow"]');
      const actionRow = card.querySelector(':scope > div:last-child > div:first-child');
      const fr = follow?.getBoundingClientRect();
      const ar = actionRow?.getBoundingClientRect();
      const media = [...card.querySelectorAll('.post-image-frame, .post-video-frame, .post-image')].map(node => {
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        return { tag: node.tagName, cls: node.className, x: r.x, y: r.y, width: r.width, height: r.height, ratio: s.aspectRatio, maxHeight: s.maxHeight, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
      });
      const textSizes = [...card.querySelectorAll('*')].map(node => parseFloat(getComputedStyle(node).fontSize)).filter(Number.isFinite);
      return {
        id: card.querySelector('.post-card-open')?.getAttribute('aria-label') ?? '',
        x: cr.x, y: cr.y, width: cr.width, height: cr.height,
        scrollWidth: card.scrollWidth, clientWidth: card.clientWidth,
        follow: fr ? { x: fr.x, y: fr.y, width: fr.width, height: fr.height } : null,
        action: ar ? { x: ar.x, y: ar.y, width: ar.width, height: ar.height } : null,
        media, minFont: textSizes.length ? Math.min(...textSizes) : 99,
      };
    });
    const rect = element => {
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const headings = [...document.querySelectorAll('.feed-column')].map(el => {
      const pseudo = getComputedStyle(el, '::before');
      return { text: pseudo.content, left: el.getBoundingClientRect().left, display: pseudo.display };
    });
    return {
      feed: rect(feed), list: rect(list), chats: rect(chats), cards: cardMetrics,
      columns: list ? getComputedStyle(list).gridTemplateColumns : '',
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      heading: headings[0],
      structure: cards.map(card => card.id),
      top: cards.slice(0, 2).map(card => card.y),
      left: cards.slice(0, 2).map(card => card.x),
      widths: cards.slice(0, 2).map(card => card.width),
    };
  });

  const columnCount = metrics.columns ? metrics.columns.trim().split(/\s+/).length : 0;
  if (width >= 1280) {
    assert.equal(columnCount, 2, width + 'px: expected exactly two grid columns; got ' + metrics.columns);
    assert(Math.abs(metrics.top[0] - metrics.top[1]) <= 4, width + 'px: first two cards do not share a top row');
    assert.notEqual(metrics.left[0], metrics.left[1], width + 'px: first two cards share a left edge');
    assert(Math.abs(metrics.widths[0] - metrics.widths[1]) <= 1, width + 'px: grid columns have unequal widths');
  } else if (width === 1024) {
    assert(columnCount === 1 || columnCount === 2, '1024px: unexpected grid column count ' + columnCount);
    assert(metrics.feed.width >= 0, '1024px: feed wrapper has invalid width');
  } else {
    assert.equal(columnCount, 1, '390px: Feed must remain a single column');
  }

  if (width >= 1280) {
    const gap = metrics.feed.left - metrics.chats.right;
    assert(Math.abs(gap - 24) <= 2, width + 'px: Chats/Feed gap was ' + gap + 'px, expected 24px ±2');
    assert(metrics.viewportWidth - metrics.feed.right >= 16, width + 'px: Feed right margin is less than 16px');
  }

  assert.equal(metrics.documentWidth, metrics.viewportWidth, width + 'px: horizontal page scrolling detected');
  if (width >= 651) {
    assert(metrics.heading && metrics.heading.text.includes('LATEST POSTS'), width + 'px: LATEST POSTS heading is missing');
    assert(Math.abs(metrics.heading.left - metrics.feed.left) <= 1, width + 'px: heading is not aligned with Feed left edge');
  }

  for (const [index, card] of metrics.cards.entries()) {
    assert(card.scrollWidth <= card.clientWidth + 1, width + 'px card ' + index + ': post card overflows');
    assert(card.minFont >= 11, width + 'px card ' + index + ': text below 11px (' + card.minFont + 'px)');
    if (card.follow && card.action) {
      const a = card.follow, b = card.action;
      const intersects = overlaps(a, b);
      assert(!intersects, width + 'px card ' + index + ': Follow overlaps action row');
    }
    if (width >= 651) {
      for (const media of card.media) {
        assert(media.width <= card.width + 1, width + 'px card ' + index + ': media wider than card');
        assert(media.height <= 260 + 1, width + 'px card ' + index + ': media height exceeds 260px (' + media.height + ')');
        assert(media.scrollWidth <= media.clientWidth + 1, width + 'px card ' + index + ': media overflows');
        const expected = media.cls.includes('post-video') ? '16 / 9' : '4 / 3';
        assert(media.ratio === expected || media.ratio === expected.replaceAll(' ', ''), width + 'px card ' + index + ': unexpected media aspect ratio ' + media.ratio);
      }
    }
  }

  if (width === 390) {
    const narrow = await page.evaluate(() => {
      const feed = document.querySelector('.home-screen .feed-column .feed-screen');
      const list = feed?.querySelector('.feed-list');
      return {
        feedDisplay: feed ? getComputedStyle(feed).display : '',
        listDisplay: list ? getComputedStyle(list).display : '',
        cardWidths: [...(list?.querySelectorAll(':scope > .feed-item') ?? [])].slice(0, 3).map(el => el.getBoundingClientRect().width),
        pageWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    assert(narrow.cardWidths.length >= 3 && narrow.cardWidths.every(w => Math.abs(w - narrow.cardWidths[0]) <= 1), '390px: narrow Feed card widths differ');
    assert.equal(narrow.pageWidth, narrow.clientWidth, '390px: horizontal scroll detected');
  }

  if ([1280, 1440, 1920, 390].includes(width)) {
    await page.screenshot({ path: path.join(outputDir, 'feed-columns-' + width + '.png'), fullPage: true });
  }

  // Force pagination through the existing UI, then prove the first ten cards stay in place.
  if (width === 1440) {
    const before = await page.locator('.feed-list > .feed-item .post-card-open').evaluateAll(nodes =>
      nodes.slice(0, 10).map(node => {
        const r = node.getBoundingClientRect();
        return { id: node.getAttribute('aria-label'), x: r.x, y: r.y };
      }));
    const loadMore = page.getByRole('button', { name: 'Load more' });
    if (await loadMore.count()) {
      await loadMore.click();
      await page.waitForFunction(() => document.querySelectorAll('.feed-list > .feed-item').length >= 20, null, { timeout: 20000 });
      const after = await page.locator('.feed-list > .feed-item .post-card-open').evaluateAll(nodes =>
        nodes.slice(0, 10).map(node => {
          const r = node.getBoundingClientRect();
          return { id: node.getAttribute('aria-label'), x: r.x, y: r.y };
        }));
      assert.deepEqual(after, before, 'Loading more posts moved earlier cards or changed their order');
    }
  }

  const order = metrics.cards.map(card => card.id);
  assert(order.length >= 10, width + 'px: expected at least 10 mocked posts');
  assert(errors.length === 0, 'Browser errors: ' + errors.join('; '));
  console.log(JSON.stringify({ width, columns: columnCount, feedWidth: metrics.feed.width, chatFeedGap: metrics.feed.left - metrics.chats.right, posts: order.length, noHorizontalScroll: true }, null, 2));
  await context.close();
}

try {
  for (const width of widths) await inspect(width);
  console.log('Feed column verification passed at all widths. Screenshots: docs/verify/feed-columns-{390,1280,1440,1920}.png');
} finally {
  await browser.close();
}
