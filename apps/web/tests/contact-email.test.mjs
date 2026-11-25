import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidContactEmail } from '../scripts/contact-email.mjs';
test('rejects empty, malformed, placeholder and reserved contact addresses', () => {
  for (const value of ['', '   ', 'not-an-email', 'a..b@funspot.co.ke', '.bad@funspot.co.ke', 'TODO', 'TODO@example.org', 'TYPE REAL',
    'TYPE REAL@funspot.co.ke', 'contact@funspot.invalid', 'contact@funspot.test',
    'contact@funspot.example', 'contact@localhost', 'contact@sub.localhost',
    'contact@example.com', 'contact@example.org', 'contact@example.net', 'contact@sub.example.com']) {
    assert.equal(isValidContactEmail(value), false, String(value));
  }
});
test('accepts a valid Funspot contact address', () => {
  assert.equal(isValidContactEmail('ci-check@funspot.co.ke'), true);
});
