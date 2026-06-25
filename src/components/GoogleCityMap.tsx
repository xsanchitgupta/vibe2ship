'use client';

import { useState } from 'react';
import Link from 'next/link';
import { APIProvider, Map, Marker, InfoWindow } from '@vis.gl/react-google-maps';
import { MAPS_KEY } from '@/lib/config';
import { CITY } from '@/lib/geo';
import type { Issue } from '@/lib/types';
import { SEVERITY_COLOR, SeverityBadge, StatusBadge, CategoryIcon } from './ui';

function pinIcon(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='13' cy='13' r='8' fill='${color}' stroke='white' stroke-width='2.5'/><circle cx='13' cy='13' r='11' fill='${color}' fill-opacity='0.18'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Real Google Map. Renders only when an API key is present; callers fall back to
// the lightweight SVG CityMap otherwise.
export default function GoogleCityMap({
  issues,
  activeId,
  center: centerProp,
}: {
  issues: Issue[];
  activeId?: string;
  center?: { lat: number; lng: number };
}) {
  const [sel, setSel] = useState<string | null>(activeId ?? null);
  if (!MAPS_KEY) return null;

  const selected = issues.find((i) => i.id === sel);
  const center = selected?.geo ?? centerProp ?? issues[0]?.geo ?? CITY.center;

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '16 / 10',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--surface-border)',
      }}
    >
      <APIProvider apiKey={MAPS_KEY}>
        <Map
          key={centerProp ? `${centerProp.lat.toFixed(3)},${centerProp.lng.toFixed(3)}` : 'all'}
          defaultCenter={center}
          defaultZoom={selected ? 15 : centerProp ? 14 : 12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          {issues.map((i) => (
            <Marker
              key={i.id}
              position={i.geo}
              title={i.title}
              icon={pinIcon(SEVERITY_COLOR[i.severity])}
              onClick={() => setSel(i.id)}
            />
          ))}

          {selected && (
            <InfoWindow position={selected.geo} onCloseClick={() => setSel(null)}>
              <div style={{ minWidth: 210, maxWidth: 250, color: '#18181b', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ color: SEVERITY_COLOR[selected.severity], display: 'inline-flex' }}>
                    <CategoryIcon category={selected.category} size={15} />
                  </span>
                  <strong style={{ fontSize: 13 }}>{selected.title}</strong>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  <SeverityBadge severity={selected.severity} />
                  <StatusBadge status={selected.status} />
                </div>
                <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8 }}>
                  {selected.location}
                </div>
                <Link
                  href={`/issues/${selected.id}`}
                  style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
                >
                  View details →
                </Link>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
