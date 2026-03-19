interface FeatureItem {
  icon: React.ReactNode
  title: string
  description: string
}

interface FeaturesSectionProps {
  title: string
  subtitle?: string
  features: FeatureItem[]
}

export function FeaturesSection({
  title,
  subtitle,
  features,
}: FeaturesSectionProps) {
  return (
    <section
      className="bg-gray-50 py-20"
      aria-labelledby="features-title"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2
            id="features-title"
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

        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="text-center">
              <div
                className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-3xl text-[var(--color-accent)]"
                aria-hidden="true"
              >
                {feature.icon}
              </div>
              <h3
                className="text-lg font-semibold text-[var(--color-primary)]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {feature.title}
              </h3>
              <p
                className="mt-2 leading-relaxed text-gray-600"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
