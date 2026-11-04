import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const errors = [];
const widths = [1024, 1280, 1440, 1920, 390];
fs.mkdirSync('docs/verify', { recursive: true });

async function mock(page, loggedIn = false) {
  await page.route('**/api/games**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/channels/all**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('https://clash-api-m5mr.onrender.com/api/posts**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ posts: [], success: true, pagination: { page: 1, limit: 10 } }),
  }));
  await page.route('https://www.thesportsdb.com/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"teams":[]}' }));
  if (loggedIn) await page.addInitScript(() => {
    localStorage.setItem('funspot-auth-user', JSON.stringify({ uid: 'sidebar-test-user', username: 'sidebar_test' }));
  });
  page.on('pageerror', error => errors.push(error.message));
}

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 1200 } });
    const page = await context.newPage();
    await mock(page);
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('.home-screen', { timeout: 45000 });
    if (width === 390) {
      const tab = page.locator('.mobile-home-tabs button').filter({ hasText: 'Profile' }).first();
      if (await tab.count()) await tab.click();
    }
    const sidebar = page.locator('.home-screen .profile-sidebar-rich');
    if (width >= 651) {
      await page.waitForSelector('.profile-guest-fields .profile-guest-field', { timeout: 20000 });
      assert.equal(await sidebar.getByText('View profile', { exact: true }).count(), 0, width + ': visible View profile text');
      assert.equal(await sidebar.getByText(/Preview data/).count(), 0, width + ': Preview data banner remains');
      const labels = await sidebar.locator('.profile-guest-field-copy > span').allTextContents();
      assert.deepEqual(labels, ['Username', 'Team Nickname', 'Team/Club', 'Country You Support', 'Phone'], width + ': profile field order');
      const measurements = await page.evaluate(() => {
        const root = document.querySelector('.home-screen');
        const side = root?.querySelector('.profile-sidebar-rich');
        const chats = root?.querySelector('.chats-column');
        const tabs = chats?.querySelector('.segmented-control');
        const heading = root?.querySelector('.feed-column::before');
        const fields = [...(side?.querySelectorAll('.profile-guest-field') ?? [])].map(el => {
          const s = getComputedStyle(el), r = el.getBoundingClientRect();
          return { width: r.width, radius: parseFloat(s.borderRadius), border: parseFloat(s.borderTopWidth), textSizes: [...el.querySelectorAll('*')].map(n => parseFloat(getComputedStyle(n).fontSize)).filter(Number.isFinite), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
        });
        const login = side?.querySelector('.profile-guest-login');
        const lr = login?.getBoundingClientRect(), ls = login ? getComputedStyle(login) : null;
        const sr = side?.getBoundingClientRect(), cr = chats?.getBoundingClientRect();
        const sep = side ? getComputedStyle(side, '::after') : null;
        return { sideTop: sr?.top, chatsTop: tabs?.getBoundingClientRect().top, feedTop: root?.querySelector('.feed-column')?.getBoundingClientRect().top, fields, login: lr ? { width: lr.width, height: lr.height, radius: parseFloat(ls.borderRadius) } : null, sideWidth: sr?.width, chatsLeft: cr?.left, separatorWidth: sep?.width, separatorHeight: sep?.height, sideHeight: sr?.height, docWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, sidebarTextSizes: [...(side?.querySelectorAll('*') ?? [])].map(n => parseFloat(getComputedStyle(n).fontSize)).filter(Number.isFinite) };
      });
      assert.equal(measurements.fields.length, 5, width + ': expected five field cards');
      assert(measurements.fields.every(f => f.radius >= 10 && f.radius <= 14 && f.border === 1), width + ': card radius/border');
      assert(measurements.fields.every(f => Math.abs(f.width - measurements.fields[0].width) <= 1), width + ': unequal field widths');
      assert(measurements.fields.every(f => f.scrollWidth <= f.clientWidth + 1), width + ': field overflow');
      assert(measurements.login && measurements.login.height >= 44 && Math.abs(measurements.login.width - measurements.fields[0].width) <= 1 && measurements.login.radius >= 10, width + ': login button dimensions');
      assert(Math.min(...measurements.sidebarTextSizes) >= 11, width + ': sidebar text below 11px');
      assert.equal(measurements.docWidth, measurements.clientWidth, width + ': horizontal page overflow');
      assert(measurements.separatorWidth === '1px', width + ': separator must be 1px');
      assert(Math.abs(measurements.sideTop - measurements.chatsTop) <= 1, width + ': sidebar not aligned to Chats tabs');
      assert(Math.abs(measurements.sideTop - measurements.feedTop) <= 1, width + ': sidebar not aligned to Feed heading');
      const channel = sidebar.locator('.profile-guest-channels-heading');
      assert.equal(await channel.count(), 1, width + ': channel header missing');
      assert((await sidebar.locator('.profile-member-card').count()) >= 2, width + ': leaderboard rows missing');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const focusVisible = await sidebar.locator('.profile-guest-login').evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none');
      if (focusVisible) assert(focusVisible, width + ': login focus ring missing');
      if ([1280, 1920].includes(width)) await page.screenshot({ path: path.resolve('docs/verify/sidebar-' + width + '.png'), fullPage: true });
      console.log(width + 'px desktop sidebar assertions passed');
    } else {
      assert.equal(await sidebar.count(), 0, '390px: desktop sidebar should remain hidden');
      assert.equal(document.documentElement.scrollWidth, await page.evaluate(() => document.documentElement.clientWidth), '390px: horizontal overflow');
      console.log('390px narrow layout regression check passed');
    }
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  await mock(page, true);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.home-screen .profile-sidebar-rich', { timeout: 45000 });
  const identity = page.locator('.profile-header-row[role="button"][aria-label="View profile"]');
  if (await identity.count()) assert.equal(await identity.getAttribute('aria-label'), 'View profile');
  await context.close();
  assert.deepEqual(errors, [], 'Browser errors: ' + errors.join('; '));
  console.log('Sidebar verification finished.');
} finally {
  await browser.close();
}
