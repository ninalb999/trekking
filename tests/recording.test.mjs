import test from 'node:test';
import assert from 'node:assert/strict';
import { Recording, formatElapsed } from '../src/lib/recording.ts';

const point = (longitude, timestamp, accuracy = 5) => ({ latitude: 0, longitude, timestamp, accuracy });
test('captures initial point and accumulates distance and active time', () => {
  const track = new Recording();
  track.start(1000);
  assert.equal(track.add(point(0, 1000)), true);
  track.add(point(0, 11000));
  assert.equal(track.add(point(0.001, 21000)), true);
  assert.ok(track.distance >= 110 && track.distance <= 112);
  assert.equal(track.elapsed(21000), 20000);
});
test('pause freezes metrics and resume does not bridge the paused movement', () => {
  const track = new Recording();
  track.start(1000); track.add(point(0, 1000)); track.add(point(0, 11000)); track.add(point(0.001, 21000));
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
  for (const candidate of [point(1, 2000), point(0.001, 1000), point(0.001, 21000, 200), point(181, 21000)]) {
    assert.equal(track.add(candidate), false);
  }
  assert.equal(track.points.length, 1);
  assert.equal(track.distance, 0);
});
test('GPS loss creates a new segment without inventing distance', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  track.add(point(0.01, 31000));
  assert.equal(track.distance, 0);
  assert.equal(track.points[1].segment, 1);
  assert.equal(track.elapsed(31000), 30000);
});
test('degraded accuracy is accepted but stationary drift is filtered', () => {
  const track = new Recording(); track.start(1000);
  assert.equal(track.add(point(0, 1000, 100)), true);
  assert.equal(track.add(point(0.0001, 6000, 100)), false);
  assert.equal(track.distance, 0);
  assert.equal(track.add(point(0.0006, 11000, 100)), true);
  assert.ok(track.distance > 60);
});
test('restore keeps metrics and resumes with a separate segment', () => {
  const track = new Recording();
  track.restore({ id: 'test', started: 1000, points: [{ ...point(0, 1000), segment: 0 }], distance: 25, elapsed: 5000, pauseCount: 1, status: 'recording' });
  assert.equal(track.status, 'paused'); assert.equal(track.elapsed(100000), 5000);
  track.resume(100000); track.add(point(1, 100000));
  assert.equal(track.distance, 25); assert.equal(track.points[1].segment, 1);
});
test('finish is idempotent and ignores further locations', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  track.finish(11000); track.finish(21000);
  assert.equal(track.elapsed(31000), 10000);
  assert.equal(track.add(point(0.001, 31000)), false);
  assert.equal(formatElapsed(3661000), '01:01:01');
});

test('fresh final position is included without adding time or a pause', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  assert.equal(track.finish(11000, point(0.0005, 11000)), true);
  assert.ok(track.distance >= 55 && track.distance <= 56);
  assert.equal(track.elapsed(30000), 10000);
  assert.equal(track.pauseCount, 0);
  assert.equal(track.finish(30000, point(0.001, 30000)), false);
});

test('finish from pause does not bridge movement or extend duration', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  track.pause(11000);
  assert.equal(track.finish(31000, point(1, 31000)), true);
  assert.equal(track.elapsed(50000), 10000);
  assert.equal(track.distance, 0);
  assert.equal(track.points.at(-1).segment, 1);
});

test('unreliable endpoint retains the last valid point', () => {
  const track = new Recording(); track.start(1000); track.add(point(0, 1000));
  assert.equal(track.finish(11000, point(0.0005, 11000, 200)), false);
  assert.equal(track.points.length, 1);
  assert.equal(track.status, 'finished');
});
