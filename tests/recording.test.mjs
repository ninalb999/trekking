import test from 'node:test';
import assert from 'node:assert/strict';
import { Recording, formatElapsed } from '../src/lib/recording.ts';

const point = (longitude, timestamp, accuracy = 5) => ({ latitude: 0, longitude, timestamp, accuracy });
test('captures initial point and accumulates distance and active time', () => {
  const track = new Recording();
  track.start(1000);
  assert.equal(track.add(point(0, 1000)), true);
  assert.equal(track.add(point(0.001, 21000)), true);
  assert.ok(track.distance >= 110 && track.distance <= 112);
  assert.equal(track.elapsed(21000), 20000);
});
test('pause freezes metrics and resume does not bridge the paused movement', () => {
  const track = new Recording();
  track.start(1000); track.add(point(0, 1000)); track.add(point(0.001, 21000));
  track.pause(21000);
  const distance = track.distance;
  assert.equal(track.add(point(1, 31000)), false);
  assert.equal(track.elapsed(50000), 20000);
  track.resume(51000); track.add(point(1, 51000));
  assert.equal(track.distance, distance);
  assert.equal(track.points.at(-1).segment, 1);
  assert.equal(track.elapsed(61000), 30000);
});
test('rejects poor accuracy, stale readings, impossible coordinates and jumps', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  for (const candidate of [point(1, 2000), point(0.001, 1000), point(0.001, 21000, 100), point(181, 21000)]) {
    assert.equal(track.add(candidate), false);
  }
  assert.equal(track.points.length, 1);
  assert.equal(track.distance, 0);
});
test('finish is idempotent and ignores further locations', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  track.finish(11000, point(0.001, 11000)); track.finish(21000, point(0.002, 21000));
  assert.equal(track.elapsed(31000), 10000);
  assert.equal(track.points.length, 2);
  assert.ok(track.distance >= 110 && track.distance <= 112);
  assert.equal(track.add(point(0.001, 31000)), false);
  assert.equal(formatElapsed(3661000), '01:01:01');
});
