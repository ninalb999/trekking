export type MapTrackPoint = {
  latitude: number;
  longitude: number;
  segment?: number;
  segment_no?: number;
};

export function groupTrackSegments(points: readonly MapTrackPoint[]) {
  const segments = new Map<number, [number, number][]>();
  for (const point of points) {
    const segmentNumber = point.segment_no ?? point.segment ?? 0;
    const segment = segments.get(segmentNumber) ?? [];
    segment.push([point.latitude, point.longitude]);
    segments.set(segmentNumber, segment);
  }
  return [...segments.values()];
}
