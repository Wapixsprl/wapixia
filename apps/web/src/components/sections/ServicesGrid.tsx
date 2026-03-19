interface ServiceItem {
  name: string
  description: string
  /** SVG icon as a React node, or an emoji string */
  icon: React.ReactNode
}

interface ServicesGridProps {
  title: string
  subtitle?: string
  services: ServiceItem[]
}

export function ServicesGrid({ title, subtitle, services }: ServicesGridProps) {
  return (
    <section className="py-20" aria-labelledby="services-title">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2
            id="services-title"
            className="text-3xl font-bold text-[var(--color-primary)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="mx-auto mt-4 max-w-2xl text-lg text-gray-600"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.name}
              className="group rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-2xl text-[var(--color-accent)]"
                aria-hidden="true"
              >
                {service.icon}
              </div>
              <h3
                className="text-xl font-semibold text-[var(--color-primary)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {service.name}
              </h3>
              <p
                className="mt-3 leading-relaxed text-gray-600"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {service.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
