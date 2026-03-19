import Image from 'next/image'

interface HeroSectionProps {
  headline: string
  subheadline: string
  ctaPrimaryText: string
  ctaPrimaryHref: string
  ctaSecondaryText?: string
  ctaSecondaryHref?: string
  backgroundImageUrl?: string
}

export function HeroSection({
  headline,
  subheadline,
  ctaPrimaryText,
  ctaPrimaryHref,
  ctaSecondaryText,
  ctaSecondaryHref,
  backgroundImageUrl,
}: HeroSectionProps) {
  return (
    <section
      className="relative flex min-h-[80vh] items-center justify-center overflow-hidden"
      aria-label="Section principale"
    >
      {/* Background image */}
      {backgroundImageUrl && (
        <Image
          src={backgroundImageUrl}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-[var(--color-primary)]/80" />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-24 text-center">
        <h1
          className="text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {headline}
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-lg text-white/80 sm:text-xl"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {subheadline}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={ctaPrimaryHref}
            className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {ctaPrimaryText}
          </a>

          {ctaSecondaryText && ctaSecondaryHref && (
            <a
              href={ctaSecondaryHref}
              className="inline-flex items-center rounded-lg border-2 border-white/30 px-8 py-4 text-base font-semibold text-white transition-colors hover:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {ctaSecondaryText}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
