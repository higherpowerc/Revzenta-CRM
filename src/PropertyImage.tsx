import { useEffect, useState } from 'react';

export interface PropertyImageProps {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number | null;
  longitude?: number | null;
  mode?: 'street' | 'satellite' | 'roadmap' | 'both';
  streetHeight?: number;
  satelliteHeight?: number;
}

const DEFAULT_MAPS_KEY = "AIzaSyCHFAvRTepznvgaeL_2O2JqPk4DhtzNugE";
let globalApiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || DEFAULT_MAPS_KEY;
let fetchPromise: Promise<string> | null = null;

function getOrFetchApiKey(): Promise<string> {
  if (globalApiKey) return Promise.resolve(globalApiKey);
  if (!fetchPromise) {
    fetchPromise = fetch('/api/public/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.googleMapsApiKey) {
          globalApiKey = data.googleMapsApiKey;
        }
        return globalApiKey;
      })
      .catch(() => "");
  }
  return fetchPromise;
}

function cleanLocation(
  address: string,
  city?: string,
  state?: string,
  zip?: string,
  lat?: number | null,
  lng?: number | null
): string {
  if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    return `${lat},${lng}`;
  }
  let full = address.trim();
  if (city && !full.toLowerCase().includes(city.toLowerCase())) {
    full += ', ' + city;
  }
  if (state && !full.toLowerCase().includes(state.toLowerCase())) {
    full += ', ' + state;
  }
  if (zip && !full.includes(zip)) {
    full += ' ' + zip;
  }
  return encodeURIComponent(full);
}

function buildStreetViewUrl(
  address: string,
  city?: string,
  state?: string,
  zip?: string,
  lat?: number | null,
  lng?: number | null,
  key?: string
): string {
  const loc = cleanLocation(address, city, state, zip, lat, lng);
  return (
    'https://maps.googleapis.com/maps/api/streetview?size=640x360&location=' +
    loc +
    '&fov=90&pitch=0&source=outdoor&key=' +
    (key || globalApiKey)
  );
}

function buildSatelliteUrl(
  address: string,
  city?: string,
  state?: string,
  zip?: string,
  lat?: number | null,
  lng?: number | null,
  key?: string
): string {
  const center = cleanLocation(address, city, state, zip, lat, lng);
  return (
    'https://maps.googleapis.com/maps/api/staticmap?center=' +
    center +
    '&zoom=19&size=640x360&maptype=satellite&markers=color:red%7C' +
    center +
    '&key=' +
    (key || globalApiKey)
  );
}

function buildRoadmapUrl(
  address: string,
  city?: string,
  state?: string,
  zip?: string,
  lat?: number | null,
  lng?: number | null,
  key?: string
): string {
  const center = cleanLocation(address, city, state, zip, lat, lng);
  return (
    'https://maps.googleapis.com/maps/api/staticmap?center=' +
    center +
    '&zoom=16&size=640x360&maptype=roadmap&markers=color:red%7C' +
    center +
    '&key=' +
    (key || globalApiKey)
  );
}

function NoKeyPlaceholder({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--panel-2, rgba(0,0,0,0.25))',
        border: '1px dashed var(--border, rgba(255,255,255,0.15))',
        borderRadius: '8px',
        color: 'var(--muted, #94a3b8)',
        gap: '6px',
        fontSize: '12px',
        textAlign: 'center',
        padding: '12px',
      }}
    >
      <span style={{ fontSize: '28px' }}>&#127968;</span>
      <span style={{ fontWeight: 600, color: 'var(--ink, #f8fafc)' }}>Property Photo</span>
      <span style={{ opacity: 0.8 }}>
        Add{' '}
        <code style={{ background: 'var(--line-strong, rgba(255,255,255,0.08))', padding: '1px 5px', borderRadius: '4px' }}>
          VITE_GOOGLE_MAPS_API_KEY
        </code>{' '}
        to activate live property photos
      </span>
    </div>
  );
}

function ImageSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background: 'var(--panel-2, rgba(255,255,255,0.05))',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted, #94a3b8)',
        fontSize: '12px',
      }}
    >
      <span>📷 Loading property picture...</span>
    </div>
  );
}

function PropertyImagePanel({
  src,
  alt,
  height,
  fallbackSrc,
  fallbackSrc2,
}: {
  src: string;
  alt: string;
  height: number;
  fallbackSrc?: string;
  fallbackSrc2?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [fallbackLevel, setFallbackLevel] = useState<number>(0);

  const activeSrc =
    fallbackLevel === 0
      ? src
      : fallbackLevel === 1 && fallbackSrc
      ? fallbackSrc
      : fallbackLevel === 2 && fallbackSrc2
      ? fallbackSrc2
      : src;

  const handleError = () => {
    if (fallbackLevel === 0 && fallbackSrc) {
      setFallbackLevel(1);
    } else if (fallbackLevel === 1 && fallbackSrc2) {
      setFallbackLevel(2);
    } else {
      setStatus('error');
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '8px',
        overflow: 'hidden',
        height,
        background: 'var(--panel-2, #0b1329)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
      }}
    >
      {status === 'loading' && <ImageSkeleton height={height} />}
      {status === 'error' ? (
        <div
          style={{
            height,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--panel-2, rgba(0,0,0,0.2))',
            border: '1px dashed var(--border, rgba(255,255,255,0.12))',
            borderRadius: '8px',
            color: 'var(--muted, #94a3b8)',
            fontSize: '12px',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '24px' }}>&#128247;</span>
          <span>No property photo available for this location</span>
        </div>
      ) : (
        <img
          key={activeSrc}
          src={activeSrc}
          alt={alt}
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          style={{
            width: '100%',
            height,
            objectFit: 'cover',
            display: status === 'loaded' ? 'block' : 'none',
            borderRadius: '8px',
          }}
        />
      )}
      {status === 'loaded' && (
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '6px',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.85)',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 6px',
            borderRadius: '4px',
            pointerEvents: 'none',
            fontWeight: 600,
          }}
        >
          &#169; Google Maps
        </div>
      )}
    </div>
  );
}

export default function PropertyImage({
  address,
  city = '',
  state = '',
  zip = '',
  latitude,
  longitude,
  mode = 'street',
  streetHeight = 180,
  satelliteHeight = 180,
}: PropertyImageProps) {
  const [apiKey, setApiKey] = useState(globalApiKey);
  const [checking, setChecking] = useState(!globalApiKey);

  useEffect(() => {
    if (!globalApiKey) {
      getOrFetchApiKey().then((k) => {
        if (k) setApiKey(k);
        setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return <ImageSkeleton height={streetHeight} />;
  }

  if (!apiKey) return <NoKeyPlaceholder height={streetHeight} />;

  const streetUrl = buildStreetViewUrl(address, city, state, zip, latitude, longitude, apiKey);
  const satelliteUrl = buildSatelliteUrl(address, city, state, zip, latitude, longitude, apiKey);
  const roadmapUrl = buildRoadmapUrl(address, city, state, zip, latitude, longitude, apiKey);

  if (mode === 'street') {
    return (
      <PropertyImagePanel
        src={streetUrl}
        alt={'Street view of ' + address + ', ' + city + ', ' + state}
        height={streetHeight}
        fallbackSrc={satelliteUrl}
        fallbackSrc2={roadmapUrl}
      />
    );
  }

  if (mode === 'satellite') {
    return (
      <PropertyImagePanel
        src={satelliteUrl}
        alt={'Satellite aerial view of ' + address + ', ' + city + ', ' + state}
        height={satelliteHeight}
        fallbackSrc={roadmapUrl}
      />
    );
  }

  if (mode === 'roadmap') {
    return (
      <PropertyImagePanel
        src={roadmapUrl}
        alt={'Map view of ' + address + ', ' + city + ', ' + state}
        height={streetHeight}
        fallbackSrc={satelliteUrl}
      />
    );
  }

  // mode === 'both'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: '8px' }}>
      <div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--muted, #94a3b8)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '4px',
          }}
        >
          Street View
        </div>
        <PropertyImagePanel
          src={streetUrl}
          alt={'Street view of ' + address}
          height={satelliteHeight}
          fallbackSrc={satelliteUrl}
          fallbackSrc2={roadmapUrl}
        />
      </div>
      <div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--muted, #94a3b8)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '4px',
          }}
        >
          Satellite Aerial
        </div>
        <PropertyImagePanel
          src={satelliteUrl}
          alt={'Satellite view of ' + address}
          height={satelliteHeight}
          fallbackSrc={roadmapUrl}
        />
      </div>
    </div>
  );
}