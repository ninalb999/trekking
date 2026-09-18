import test from 'node:test';
import assert from 'node:assert/strict';

import { groupTrackSegments } from '../src/lib/route-map-data.ts';

test('groups persisted points by segment_no without bridging pauses', () => {
  const segments = groupTrackSegments([
    { latitude: -16.5, longitude: -68.1, segment_no: 0 },
    { latitude: -16.51, longitude: -68.11, segment_no: 0 },
    { latitude: -16.6, longitude: -68.2, segment_no: 1 },
  ]);
  assert.deepEqual(segments, [
    [[-16.5, -68.1], [-16.51, -68.11]],
    [[-16.6, -68.2]],
  ]);
});

test('continues supporting live in-memory segment values', () => {
  assert.deepEqual(groupTrackSegments([
    { latitude: 0, longitude: 0, segment: 0 },
    { latitude: 1, longitude: 1, segment: 2 },
  ]), [[[0, 0]], [[1, 1]]]);
});
