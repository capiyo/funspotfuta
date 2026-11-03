import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const baseURL = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:4173';
const fixture = {
  id: 'match-details-tabs-fixture',
  match_id: 'match-details-tabs-fixture',
  home_team: 'Arsenal',
  away_team: 'Chelsea',
  league: 'Premier League',
  date: new Date(Date.now() + 3600000).toISOString(),
  status: 'upcoming',
  is_live: false,
  home_score: null,
  away_score: null,
  votes: 0,
  voters: [],
  available_for_voting: true,
};
let statisticsReady = false;
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('usertoken', 'match-details-test-token');
    localStorage.setItem('user', JSON.stringify({ id: 'match-details-user', username: 'Match Details Tester' }));
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.route('**/api/games**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([fixture]),
  }));
  await page.route('**/api/channels/all**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ channels: [] }),
  }));
  await page.route('**/api/channels/user/match-details-user', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ channels: [] }),
  }));
  await page.route('**/api/posts**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ posts: [], success: true, stats: {}, pagination: {} }),
  }));
  await page.route('**/api/votes/votes/user/match-details-user', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }));
  await page.route('https://clash-api-m5mr.onrender.com/api/games/*/lineups', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: {
      home_formation: '4-3-3',
      away_formation: '4-2-3-1',
      home_starting_xi: [],
      away_starting_xi: [],
      home_bench: [],
      away_bench: [],
    } }),
  }));
  await page.route('https://clash-api-m5mr.onrender.com/api/games/*/statistics/latest', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(statisticsReady
      ? { success: true, data: { ball_possession_home: 54, ball_possession_away: 46, total_shots_home: 5, total_shots_away: 3 } }
      : { success: true, data: { statistics: [] } }),
  }));
  await page.route('https://clash-api-m5mr.onrender.com/api/games/*/statistics', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { statistics: [] } }),
  }));
  await page.route('**/.netlify/functions/team-crest**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, crestUrl: null }),
  }));

  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForSelector('.home-screen .match-card', { timeout: 45000 });
  const openDetails = page.getByRole('button', { name: /Open match details:/ }).first();
  await openDetails.click();
  let dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await dialog.getByRole('button', { name: 'LINEUPS' }).waitFor({ state: 'visible' });
  assert.equal(await dialog.getByRole('button', { name: 'STATS' }).count(), 0,
    'Stats tab must stay hidden until usable statistics exist');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached', timeout: 10000 });

  statisticsReady = true;
  await openDetails.click();
  dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await dialog.getByRole('button', { name: 'STATS' }).waitFor({ state: 'visible', timeout: 15000 });

  await page.evaluate(() => {
    const area = document.querySelector('[role="dialog"] .no-scrollbar');
    if (!area) throw new Error('Match details swipe surface was not found');
    const start = new Touch({ identifier: 1, target: area, clientX: 280, clientY: 360 });
    const end = new Touch({ identifier: 1, target: area, clientX: 120, clientY: 360 });
    area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [start], changedTouches: [start] }));
    area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [end] }));
  });
  await dialog.getByText('Possession', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });

  await page.evaluate(() => {
    const area = document.querySelector('[role="dialog"] .no-scrollbar');
    if (!area) throw new Error('Match details swipe surface was not found');
    const start = new Touch({ identifier: 2, target: area, clientX: 120, clientY: 360 });
    const end = new Touch({ identifier: 2, target: area, clientX: 280, clientY: 360 });
    area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [start], changedTouches: [start] }));
    area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [end] }));
  });
  await dialog.getByText('4-3-3', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
  console.log(JSON.stringify({ passed: true, noStatsShowsLineupsOnly: true, swipeToStats: true, swipeBackToLineups: true }));
  await context.close();
} finally {
  await browser.close();
}
