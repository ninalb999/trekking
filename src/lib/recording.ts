import { getDistance } from 'geolib';

export type TrackPoint = { latitude: number; longitude: number; timestamp: number; accuracy: number | null; segment: number };
export class Recording {
  id = '';
  started = 0;
  pauseCount = 0;
  points: TrackPoint[] = [];
  distance = 0;
  status: 'idle' | 'recording' | 'paused' | 'finished' = 'idle';
  private accumulated = 0;
  private startedAt = 0;
  private segment = 0;
  private lastReadingAt = 0;
  start(now: number) { this.status = 'recording'; this.startedAt = now; if (!this.started) this.started = now; }
  elapsed(now: number) { return this.accumulated + (this.status === 'recording' ? Math.max(0, now - this.startedAt) : 0); }
  pause(now: number) {
    if (this.status !== 'recording') return;
    this.accumulated = this.elapsed(now);
    this.status = 'paused';
    this.pauseCount += 1;
  }
  resume(now: number) {
    if (this.status !== 'paused') return;
    this.segment += 1;
    this.lastReadingAt = 0;
    this.start(now);
  }
  finish(now: number, finalPoint?: Omit<TrackPoint, 'segment'>, finalPointStartsNewSegment = this.status === 'paused') {
    if (this.status === 'finished') return false;
    const pauses = this.pauseCount;
    this.pause(now);
    this.pauseCount = pauses;
    let accepted = false;
    if (finalPoint) {
      if (finalPointStartsNewSegment) { this.segment += 1; this.lastReadingAt = 0; }
      this.status = 'recording';
      accepted = this.add(finalPoint);
    }
    this.status = 'finished';
    return accepted;
  }
  add(point: Omit<TrackPoint, 'segment'>) {
    if (this.status !== 'recording' || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
      !Number.isFinite(point.timestamp) || point.accuracy === null || !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > 150) return false;
    const last = this.points.at(-1);
    if (last && point.timestamp <= last.timestamp) return false;
    if (this.lastReadingAt && point.timestamp - this.lastReadingAt > 15000) this.segment += 1;
    this.lastReadingAt = point.timestamp;
    if (last && last.segment === this.segment) {
      const meters = getDistance(last, point);
      const seconds = (point.timestamp - last.timestamp) / 1000;
      const noiseFloor = Math.max(5, Math.min(last.accuracy ?? 150, point.accuracy) / 2);
      if (meters < noiseFloor || meters / seconds > 8.34) return false;
      this.distance += meters;
    }
    this.points.push({ ...point, segment: this.segment });
    return true;
  }
  restore(data: { id: string; started: number; points: TrackPoint[]; distance: number; elapsed: number; pauseCount: number; status: string }) {
    this.id = data.id; this.started = data.started; this.points = data.points;
    this.distance = data.distance; this.accumulated = data.elapsed; this.pauseCount = data.pauseCount;
    this.segment = data.points.reduce((max, p) => Math.max(max, p.segment), 0);
    this.status = data.status === 'finished' ? 'finished' : 'paused';
  }
}

export function formatElapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
