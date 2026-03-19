interface GoogleMapProps {
  /** Latitude */
  lat: number
  /** Longitude */
  lng: number
  /** Human-readable address for display and alt text */
  address: string
  /** Map zoom level (1-20). Defaults to 15. */
  zoom?: number
  /** Height of the map container. Defaults to 400px. */
  height?: number
}

/**
 * Embedded Google Map using an iframe embed (no API key required).
 * For production with an API key, switch to the Maps Embed API URL.
 */
export function GoogleMap({
  lat,
  lng,
  address,
  zoom = 15,
  height = 400,
}: GoogleMapProps) {
  const query = encodeURIComponent(address)
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`

  return (
    <section aria-label={`Carte : ${address}`} className="w-full">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div
          className="overflow-hidden rounded-2xl border border-gray-200"
          style={{ height }}
        >
          <iframe
            title={`Google Maps - ${address}`}
            src={src}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        <p
          className="mt-3 text-center text-sm text-gray-500"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {address}
        </p>
      </div>
    </section>
  )
}
