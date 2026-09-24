import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/local-routes.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function loadModule(storage) {
  const exports = {};
  new Function('require', 'exports', compiled)(name => {
    assert.equal(name, '@react-native-async-storage/async-storage');
    return storage;
  }, exports);
  return exports;
}

function createStorage() {
  const entries = new Map();
  return {
    setItem: async (key, value) => { entries.set(key, value); },
    removeItem: async key => { entries.delete(key); },
    getAllKeys: async () => [...entries.keys()],
    multiGet: async keys => keys.map(key => [key, entries.get(key) ?? null]),
  };
}

const route = {
  id: 'route-1', ownerId: 'owner-1', name: 'Sendero', description: 'Hasta el mirador',
  distance: 1234, elapsed: 90000, difficulty: 'Novato', visibility: 'private',
  points: [{ latitude: -16.5, longitude: -68.1, segment: 0, timestamp: 1000, accuracy: 5 }],
  places: [{ id: 'place-1', name: 'Mirador', latitude: -16.5, longitude: -68.1, services: [] }],
  equipment: ['Agua'], started: 1000, ended: 91000, pauseCount: 0,
  status: 'finished', updatedAt: 91000, syncedAt: 91000,
};

test('downloads survive module reload with complete route data and remain scoped to the owner', async () => {
  const storage = createStorage();
  await loadModule(storage).saveOfflineRoute(route);
  const restarted = loadModule(storage);
  assert.deepEqual(await restarted.loadOfflineRoutes(route.ownerId), [route]);
  assert.deepEqual(await restarted.loadOfflineRoutes('another-owner'), []);
  assert.deepEqual(await restarted.loadOfflineRoutes(null), []);
  assert.deepEqual(await restarted.loadLocalRoutes(route.ownerId), []);
});

test('sync cache updates and removing downloads do not alter each other', async () => {
  const routes = loadModule(createStorage());
  await routes.saveLocalRoute(route);
  await routes.saveOfflineRoute(route);
  const updated = { ...route, name: 'Nombre actualizado', updatedAt: 92000 };
  await routes.saveLocalRoute(updated);
  assert.deepEqual(await routes.loadOfflineRoutes(route.ownerId), [route]);
  await routes.removeOfflineRoute(route.id);
  assert.deepEqual(await routes.loadOfflineRoutes(route.ownerId), []);
  assert.deepEqual(await routes.loadLocalRoutes(route.ownerId), [updated]);
});

test('a failed write rejects and a retry can save the download', async () => {
  const storage = createStorage();
  const setItem = storage.setItem;
  storage.setItem = async () => { throw new Error('Storage full'); };
  const routes = loadModule(storage);
  await assert.rejects(routes.saveOfflineRoute(route), /Storage full/);
  assert.deepEqual(await routes.loadOfflineRoutes(route.ownerId), []);
  storage.setItem = setItem;
  await routes.saveOfflineRoute(route);
  assert.deepEqual(await routes.loadOfflineRoutes(route.ownerId), [route]);
});
