import { getDistance } from 'geolib';

export type TrackPoint = { latitude: number; longitude: number; timestamp: number; accuracy: number | null; segment: number };
export class Recording {
  points: TrackPoint[] = [];
  distance = 0;
  status: 'idle' | 'recording' | 'paused' | 'finished' = 'idle';
  private accumulated = 0;
  private startedAt = 0;
  private segment = 0;
  start(now: number) { this.status = 'recording'; this.startedAt = now; }
  elapsed(now: number) { return this.accumulated + (this.status === 'recording' ? Math.max(0, now - this.startedAt) : 0); }
  pause(now: number) {
    if (this.status !== 'recording') return;
    this.accumulated = this.elapsed(now);
    this.status = 'paused';
  }
  resume(now: number) {
    if (this.status !== 'paused') return;
    this.segment += 1;
    this.start(now);
  }
  finish(
    now: number,
    finalPoint?: Omit<TrackPoint, 'segment'>,
    finalPointStartsNewSegment = this.status === 'paused',
  ) {
    if (this.status === 'finished') return false;
    if (this.status === 'recording') this.pause(now);
    let finalPointAccepted = false;
    if (finalPoint) {
      if (finalPointStartsNewSegment) this.segment += 1;
      const previousStatus = this.status;
      this.status = 'recording';
      finalPointAccepted = this.add(finalPoint);
      this.status = previousStatus;
    }
    this.status = 'finished';
    return finalPointAccepted;
  }
  add(point: Omit<TrackPoint, 'segment'>) {
    if (this.status !== 'recording' || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
      point.accuracy === null || point.accuracy > 50) return false;
    const last = this.points.at(-1);
    if (last && point.timestamp <= last.timestamp) return false;
    if (last && last.segment === this.segment) {
      const meters = getDistance(last, point);
      if (meters < 3 || meters / ((point.timestamp - last.timestamp) / 1000) > 12) return false;
      this.distance += meters;
    }
    this.points.push({ ...point, segment: this.segment });
    return true;
  }
}

export function formatElapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
