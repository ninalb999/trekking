import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/saved-public-routes.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function loadModule() {
  const exports = {};
  new Function('require', 'exports', compiled)(() => ({}), exports);
  return exports;
}

test('public route is converted into a complete local saved route without claiming remote photos are offline', () => {
  const detail = {
    id: 'route-public-1', name: 'Laguna', description: 'Ruta pública', difficulty: 'Novato',
    ownerName: 'Explorador', distanceMeters: 1200, durationSeconds: 600, pauseCount: 1,
    publishedAt: '2026-09-24T10:00:00.000Z', imagePath: 'route/photo.jpg', equipment: ['Agua'], pointCount: 1,
    points: [{ latitude: -16.5, longitude: -68.1, accuracy: 5, timestamp: 1000, segment: 0 }],
    places: [{ id: 'point-1', name: 'Mirador', description: 'Vista', type: 'otro', services: [], latitude: -16.5, longitude: -68.1, accuracy: null, timestamp: 1000, photo: 'https://example.test/photo.jpg', photoPath: 'route/point.jpg' }],
  };
  const route = loadModule().toSavedPublicRoute(detail, 'owner-1', 2000);
  assert.equal(route.id, detail.id);
  assert.equal(route.ownerId, 'owner-1');
  assert.equal(route.status, 'finished');
  assert.deepEqual(route.points, detail.points);
  assert.equal(route.places[0].photo, undefined);
  assert.equal(route.places[0].photoPath, undefined);
  assert.equal(route.updatedAt, 2000);
});
