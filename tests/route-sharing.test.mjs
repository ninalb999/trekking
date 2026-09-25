import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/route-sharing.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function loadModule(envValue) {
  const exports = {};
  new Function('require', 'exports', 'process', compiled)(() => ({}), exports, { env: { EXPO_PUBLIC_APP_URL: envValue } });
  return exports;
}

test('uses the configured HTTPS origin for public route links', () => {
  const { getRouteShareUrl } = loadModule('https://trekking.example.com/');
  assert.equal(getRouteShareUrl('route/123'), 'https://trekking.example.com/rutas/route%2F123');
});

test('falls back to the stable native scheme when no web origin is configured', () => {
  const { getRouteShareUrl } = loadModule('');
  assert.equal(getRouteShareUrl('demo-laguna-escondida'), 'trekkingapp://rutas/demo-laguna-escondida');
});

test('does not create links for private routes', () => {
  const { getRouteShareUrl } = loadModule('https://trekking.example.com');
  assert.equal(getRouteShareUrl('route-1', 'private'), null);
});
