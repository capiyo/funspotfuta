import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const baseURL = process.env.PROFILE_VERIFY_URL || 'http://127.0.0.1:4173';
const outDir = path.resolve('docs/verify');
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.route('**/api/channels/all**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/games**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.route('**/api/posts**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(500);
  const sidebar = page.locator('.profile-sidebar-rich').first();
  await sidebar.waitFor({ state: 'visible', timeout: 15000 });
  const sidebarResults = await sidebar.evaluate(el => {
    const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const header = el.querySelector('.profile-header-row');
    const avatar = header?.querySelector('[class*="headerAvatar"], .home-avatar');
    const name = header?.querySelector('.profile-header-name-column');
    const cards = [...el.querySelectorAll('.profile-guest-field')].map(card => {
      const label=card.querySelector('label');
      const value=card.querySelector('strong, span');
      const cs=getComputedStyle(card);
      return {rect:rect(card), label:label?rect(label):null,value:value?rect(value):null,borderStyle:cs.borderStyle,borderTopWidth:cs.borderTopWidth};
    });
    const tabs=[...el.querySelectorAll('.profile-channel-tabbar [role="tab"]')].map(rect);
    const stars=[...el.querySelectorAll('.profile-channel-panel svg')].filter(e=>e.getAttribute('class')?.includes('lucide-star')).map(rect);
    const stat=el.querySelector('.profile-channel-panel [style*="width: 60px"]')?.parentElement;
    return {header:header?rect(header):null,avatar:avatar?rect(avatar):null,name:name?rect(name):null,cards,tabs,stars:stars.slice(0,5),stat:stat?rect(stat):null,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth};
  });
  assert(sidebarResults.header && sidebarResults.avatar && sidebarResults.name, 'Profile avatar/name header missing');
  assert(Math.abs(sidebarResults.avatar.y-sidebarResults.name.y)<8, 'Avatar and name column do not share a row');
  for (const card of sidebarResults.cards) {
    assert(card.label && card.value, 'Info card missing label/value');
    assert(card.label.bottom <= card.value.top + 1, 'Info label is not above value');
    assert.equal(card.borderStyle, 'solid', 'Info card border style missing');
    assert.equal(card.borderTopWidth, '1px', 'Info card border is not 1px');
  }
  const login = sidebar.locator('.profile-guest-login').first();
  if (await login.count()) {
    const buttonBox=await login.boundingBox();
    const parentBox=await login.evaluate(el=>el.parentElement.getBoundingClientRect().width);
    assert(buttonBox && buttonBox.width >= parentBox-2 && buttonBox.height >= 32, 'Guest Log In button does not span container or is too short');
  }
  if (sidebarResults.tabs.length >= 3) {
    const tops=sidebarResults.tabs.map(t=>t.y);
    assert(Math.max(...tops)-Math.min(...tops)<=2,'Channel tabs do not share one row');
  }
  if (sidebarResults.stars.length >= 5) {
    const tops=sidebarResults.stars.map(t=>t.y);
    assert(Math.max(...tops)-Math.min(...tops)<=2,'Rating stars do not share one row');
  }
  assert(sidebarResults.scrollWidth<=sidebarResults.clientWidth+1,'Sidebar has horizontal overflow');
  await page.screenshot({path:path.join(outDir,'profile-sidebar-1280.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'networkidle',timeout:45000});
  const profileTrigger=page.getByRole('button',{name:/profile/i}).first();
  if (await profileTrigger.count()) await profileTrigger.click();
  else {
    const menu=page.getByRole('button',{name:/menu/i}).first();
    if (await menu.count()) { await menu.click(); const item=page.getByText(/^Profile$/).first(); if(await item.count()) await item.click(); }
  }
  await page.waitForTimeout(300);
  const modal=page.locator('.profile-modal-shell, [role="dialog"]').first();
  if (await modal.count()) {
    await modal.screenshot({path:path.join(outDir,'profile-modal-390.png')});
    const overflow=await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1);
    assert(overflow,'Profile modal has horizontal overflow');
  } else {
    console.warn('Could not automatically open profile modal at 390px; modal screenshot/assertions incomplete.');
  }
  console.log(JSON.stringify({sidebar:sidebarResults, narrowModalOpened:await modal.count()>0, screenshots:['docs/verify/profile-sidebar-1280.png','docs/verify/profile-modal-390.png']},null,2));
} finally { await browser.close(); }
