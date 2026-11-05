import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const shared=await readFile(path.join(root,'public/notification-url-normalizer.js'),'utf8');
const app=await readFile(path.join(root,'src/App.tsx'),'utf8');
const sw=await readFile(path.join(root,'public/firebase-messaging-sw.js'),'utf8');
function load(globalName){const context={URL,location:{origin:'https://www.funspot.co.ke'}};context[globalName]=context;vm.runInNewContext(shared,context);return context.FunspotNotificationUrl.normalize;}
test('foreground and service worker use identical shared URL normalization',()=>{
 assert.match(app,/window\.FunspotNotificationUrl\?\.normalize\(notice\.data\?\.url\)/);
 assert.match(sw,/importScripts\('\/notification-url-normalizer\.js'\)/);
 assert.match(sw,/const normalize = self\.FunspotNotificationUrl\?\.normalize/);
 assert.match(sw,/normalize\(event\.notification\.data\?\.url\)/);
 const foreground=load('window'),worker=load('self');
 for(const [input,expected] of [['/app/','/app/'],['/app/messages/c?fixtureId=x','/app/messages/c?fixtureId=x'],['https://www.funspot.co.ke/app/comments/p#r','/app/comments/p#r'],['/messages/c','/app/'],['https://evil.example/app/','/app/'],['javascript:alert(1)','/app/'],['','/app/'],[null,'/app/']]){
  assert.equal(foreground(input),expected);assert.equal(worker(input),expected);assert.equal(foreground(input),worker(input));
 }
});
