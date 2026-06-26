'use client';

import { useEffect, useRef, useState } from 'react';
import { MAPS_KEY, mapsEnabled } from '@/lib/config';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Crosshair, Loader2 } from 'lucide-react';

interface Props {
  location: string;
  setLocation: (val: string) => void;
  onLocationFound: (coords: { lat: number; lng: number } | null) => void;
  coords: { lat: number; lng: number } | null;
}

function LocationInputInner({ location, setLocation, onLocationFound, coords }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');
  const geocoding = useMapsLibrary('geocoding');
  const [locating, setLocating] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    const options: google.maps.places.AutocompleteOptions = {
      fields: ['geometry', 'name', 'formatted_address'],
    };

    autocompleteRef.current = new places.Autocomplete(inputRef.current, options);
    
    // Add event listener for place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onLocationFound({ lat, lng });
        setLocation(place.formatted_address || place.name || '');
      }
    });

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [places, onLocationFound, setLocation]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        onLocationFound({ lat, lng });
        
        // Reverse geocode to get address
        if (geocoding) {
          const geocoder = new geocoding.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              setLocation(results[0].formatted_address);
            } else {
              setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
            }
            setLocating(false);
          });
        } else {
          setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="flex gap-2 w-full">
      <input
        ref={inputRef}
        className="input-field"
        placeholder="e.g. Indiranagar, near 100ft Road"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={useMyLocation}
        disabled={locating}
        style={{ whiteSpace: 'nowrap' }}
      >
        {locating ? <Loader2 size={15} className="spin" /> : <Crosshair size={15} />}
        {coords ? 'Located' : 'Use GPS'}
      </button>
    </div>
  );
}

export default function LocationInput(props: Props) {
  if (!mapsEnabled()) {
    return <LocationInputInner {...props} />;
  }

  return (
    <APIProvider apiKey={MAPS_KEY!}>
      <LocationInputInner {...props} />
    </APIProvider>
  );
}
