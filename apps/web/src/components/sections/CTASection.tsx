interface CTASectionProps {
  headline: string
  subtext: string
  buttonText: string
  buttonHref: string
}

export function CTASection({
  headline,
  subtext,
  buttonText,
  buttonHref,
}: CTASectionProps) {
  return (
    <section
      className="bg-[var(--color-primary)] py-20"
      aria-label="Appel à l'action"
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2
          className="text-3xl font-bold text-white sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {headline}
        </h2>
        <p
          className="mx-auto mt-5 max-w-xl text-lg text-white/80"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {subtext}
        </p>
        <a
          href={buttonHref}
          className="mt-8 inline-flex items-center rounded-lg bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {buttonText}
        </a>
      </div>
    </section>
  )
}
