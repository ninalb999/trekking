import test from 'node:test';
import assert from 'node:assert/strict';

import { screenAfterAuthEvent } from '../src/lib/auth-events.ts';

test('initial session and explicit sign-in leave authentication screens', () => {
  assert.equal(screenAfterAuthEvent('INITIAL_SESSION', true, 'login'), 'home');
  assert.equal(screenAfterAuthEvent('SIGNED_IN', true, 'register'), 'home');
});

test('token refresh never changes the active screen', () => {
  for (const screen of ['home', 'routes', 'record', 'point', 'finish', 'detail']) {
    assert.equal(screenAfterAuthEvent('TOKEN_REFRESHED', true, screen), screen);
  }
});

test('repeated sign-in does not interrupt an authenticated activity', () => {
  assert.equal(screenAfterAuthEvent('SIGNED_IN', true, 'record'), 'record');
  assert.equal(screenAfterAuthEvent('SIGNED_IN', true, 'detail'), 'detail');
});

test('sign-out always returns to login', () => {
  assert.equal(screenAfterAuthEvent('SIGNED_OUT', false, 'record'), 'login');
  assert.equal(screenAfterAuthEvent('SIGNED_OUT', false, 'home'), 'login');
});
