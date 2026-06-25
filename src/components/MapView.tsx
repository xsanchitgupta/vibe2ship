'use client';

import { mapsEnabled } from '@/lib/config';
import type { Issue } from '@/lib/types';
import CityMap from './CityMap';
import GoogleCityMap from './GoogleCityMap';

// Uses the real Google Map when a key is configured, otherwise the SVG fallback.
export default function MapView({
  issues,
  activeId,
  center,
}: {
  issues: Issue[];
  activeId?: string;
  center?: { lat: number; lng: number };
}) {
  return mapsEnabled() ? (
    <GoogleCityMap issues={issues} activeId={activeId} center={center} />
  ) : (
    <CityMap issues={issues} activeId={activeId} />
  );
}
