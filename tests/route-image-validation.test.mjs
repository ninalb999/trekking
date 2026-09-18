import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTE_IMAGE_MAX_BYTES,
  assertRouteImageSize,
  isUuid,
  routeImageExtension,
  routeImageMime,
} from '../src/lib/route-image-validation.ts';

test('accepts only the image formats allowed by the private bucket', () => {
  assert.equal(routeImageMime('image/jpeg'), 'image/jpeg');
  assert.equal(routeImageMime('IMAGE/PNG'), 'image/png');
  assert.equal(routeImageMime(null, 'route.webp'), 'image/webp');
  assert.equal(routeImageExtension('image/jpeg'), 'jpg');
  assert.throws(() => routeImageMime('image/gif'), /JPG, PNG o WebP/);
});

test('rejects empty and oversized route images', () => {
  assert.doesNotThrow(() => assertRouteImageSize(ROUTE_IMAGE_MAX_BYTES));
  assert.throws(() => assertRouteImageSize(0), /vacía/);
  assert.throws(() => assertRouteImageSize(ROUTE_IMAGE_MAX_BYTES + 1), /5 MB/);
});

test('accepts only canonical UUID route identifiers', () => {
  assert.equal(isUuid('a3f57db4-6d25-4ed0-9321-c2994334b782'), true);
  assert.equal(isUuid('not-a-route'), false);
});
