import { useEffect, useState } from 'react';

interface PropertyImageProps {
  address: string;
  city: string;
  state: string;
  zip?: string;
  latitude?: number | null;
  longitude?: number | null;
  mode?: 'street' | 'both';
  streetHeight?: number;
  satelliteHeight?: number;
}

let globalApiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || "";
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

function buildStreetViewUrl(address: string, city: string, state: string, zip?: string, key?: string): string {
  const loc = encodeURIComponent(address + ', ' + city + ', ' + state + (zip ? ' ' + zip : ''));
  return 'https://maps.googleapis.com/maps/api/streetview?size=640x360&location=' + loc + '&fov=90&pitch=0&source=outdoor&key=' + (key || globalApiKey);
}

function buildSatelliteUrl(address: string, city: string, state: string, zip?: string, lat?: number | null, lng?: number | null, key?: string): string {
  const center = (lat != null && lng != null) ? (lat + ',' + lng) : encodeURIComponent(address + ', ' + city + ', ' + state + (zip ? ' ' + zip : ''));
  return 'https://maps.googleapis.com/maps/api/staticmap?center=' + center + '&zoom=19&size=640x360&maptype=satellite&key=' + (key || globalApiKey);
}

function NoKeyPlaceholder({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '8px', color: 'var(--text-muted, #94a3b8)', gap: '6px', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
      <span style={{ fontSize: '28px' }}>&#127968;</span>
      <span style={{ fontWeight: 600 }}>Property Photo</span>
      <span style={{ opacity: 0.7 }}>
        Add{' '}
        <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px' }}>VITE_GOOGLE_MAPS_API_KEY</code>
        {' '}to environment variables to activate property photos
      </span>
    </div>
  );
}

function ImageSkeleton({ height }: { height: number }) {
  return <div style={{ height, background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }} />;
}

function PropertyImagePanel({ src, alt, height, fallbackSrc }: { src: string; alt: string; height: number; fallbackSrc?: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [usedFallback, setUsedFallback] = useState(false);
  const handleError = () => { if (!usedFallback && fallbackSrc) { setUsedFallback(true); } else { setStatus('error'); } };
  const activeSrc = usedFallback && fallbackSrc ? fallbackSrc : src;
  return (
    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height }}>
      {status === 'loading' && <ImageSkeleton height={height} />}
      {status === 'error' ? (
        <div style={{ height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '8px', color: 'var(--text-muted, #94a3b8)', fontSize: '12px', gap: '6px' }}>
          <span style={{ fontSize: '24px' }}>&#128247;</span>
          <span>No photo available for this address</span>
        </div>
      ) : (
        <img key={activeSrc} src={activeSrc} alt={alt} onLoad={() => setStatus('loaded')} onError={handleError} style={{ width: '100%', height, objectFit: 'cover', display: status === 'loaded' ? 'block' : 'none', borderRadius: '8px' }} />
      )}
      {status === 'loaded' && (
        <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.75)', background: 'rgba(0,0,0,0.45)', padding: '1px 5px', borderRadius: '3px', pointerEvents: 'none' }}>
          &#169; Google
        </div>
      )}
    </div>
  );
}

export default function PropertyImage({ address, city, state, zip, latitude, longitude, mode = 'street', streetHeight = 180, satelliteHeight = 180 }: PropertyImageProps) {
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
  const streetUrl = buildStreetViewUrl(address, city, state, zip, apiKey);
  const satelliteUrl = buildSatelliteUrl(address, city, state, zip, latitude, longitude, apiKey);
  if (mode === 'street') {
    return <PropertyImagePanel src={streetUrl} alt={'Street view of ' + address + ', ' + city + ', ' + state} height={streetHeight} fallbackSrc={satelliteUrl} />;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: '8px', marginBottom: '18px' }}>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Street View</div>
        <PropertyImagePanel src={streetUrl} alt={'Street view of ' + address} height={satelliteHeight} fallbackSrc={satelliteUrl} />
      </div>
      <div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted, #94a3b8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Satellite</div>
        <PropertyImagePanel src={satelliteUrl} alt={'Satellite view of ' + address} height={satelliteHeight} />
      </div>
    </div>
  );
}