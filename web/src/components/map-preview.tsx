import { ExternalLink, MapPinned } from "lucide-react";

/**
 * Google Maps Embed when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured; otherwise an honest fallback
 * (coordinates + OpenStreetMap link). The embed key must be HTTP-referrer restricted in Google Cloud.
 */
export function MapPreview({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;
  if (key) {
    return (
      <iframe
        title={`Map: ${label}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
        className="h-56 w-full rounded-lg border border-border" allowFullScreen
        src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${lat},${lng}&zoom=15`}
      />
    );
  }
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-secondary-soft p-4 text-center text-on-secondary-soft">
      <MapPinned className="size-7" aria-hidden />
      <p className="font-semibold">{label}</p>
      <p className="t-small tabular-nums">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
      <a href={osm} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold underline underline-offset-4">
        Open in OpenStreetMap <ExternalLink className="size-3.5" aria-hidden />
      </a>
      <p className="t-caption opacity-80">Interactive map is off: no Google Maps key is configured.</p>
    </div>
  );
}
