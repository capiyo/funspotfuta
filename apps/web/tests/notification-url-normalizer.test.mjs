import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shared = await readFile(path.join(root, 'public/notification-url-normalizer.js'), 'utf8');
const app = await readFile(path.join(root, 'src/App.tsx'), 'utf8');
const sw = await readFile(path.join(root, 'public/firebase-messaging-sw.js'), 'utf8');

function load() {
  const context = { URL, location: { origin: 'https://www.funspot.co.ke' } };
  context.window = context;
  context.self = context;
  vm.runInNewContext(shared, context);
  return context.FunspotNotificationUrl.normalize;
}

test('notification URLs normalize to the canonical root application scope', () => {
  assert.match(app, /window\.FunspotNotificationUrl\?\.normalize\(notice\.data\?\.url\)/);
  assert.match(sw, /importScripts\('\/notification-url-normalizer\.js'\)/);
  assert.match(sw, /const normalize = self\.FunspotNotificationUrl\?\.normalize/);
  const normalize = load();
  for (const [input, expected] of [
    ['/','/'],
    ['/app','/'],
    ['/app/','/'],
    ['/login','/login'],
    ['/messages','/messages'],
    ['/messages/channel?fixtureId=f1#last','/messages/channel'],
    ['https://www.funspot.co.ke/comments/post-1?x=1','/comments/post-1'],
    ['/app/login','/login'],
    ['/app/messages/channel','/messages/channel'],
    ['/app/comments/post-1','/comments/post-1'],
    ['/messages/a/b','/'],
    ['/comments/','/'],
    ['/other','/'],
    ['https://evil.example/messages/x','/'],
    ['javascript:alert(1)','/'],
    ['', '/'],
    [null, '/'],
  ]) {
    assert.equal(normalize(input), expected, String(input));
  }
});
