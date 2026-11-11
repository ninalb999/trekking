import test from 'node:test';
import assert from 'node:assert/strict';
import { locationErrorMessage, normalizeLocation } from '../src/lib/location.ts';

test('keeps a current approximate location for the map', () => {
  const reading = normalizeLocation({ coords: { latitude: -16.5, longitude: -68.15, accuracy: 900 }, timestamp: 100000 }, 101000);
  assert.deepEqual(reading, { latitude: -16.5, longitude: -68.15, accuracy: 900, timestamp: 100000 });
});

test('ignores stale and invalid positions', () => {
  const coords = { latitude: -16.5, longitude: -68.15, accuracy: 10 };
  assert.equal(normalizeLocation({ coords, timestamp: 1000 }, 32000), null);
  assert.equal(normalizeLocation({ coords: { ...coords, latitude: 91 }, timestamp: 1000 }, 1000), null);
  assert.equal(normalizeLocation({ coords, timestamp: 7000 }, 1000), null);
});

test('explains browser permission, unavailable position and timeout errors', () => {
  assert.match(locationErrorMessage({ code: 1 }, true), /navegador/);
  assert.match(locationErrorMessage({ code: 2 }, true), /servicios de ubicación/);
  assert.match(locationErrorMessage({ code: 3 }, true), /tardó demasiado/);
  assert.equal(locationErrorMessage('Activa la ubicación', false), 'Activa la ubicación');
});
