'use client'

import {
  type Answers,
  type StepProps,
  SECTORS,
  PRICE_RANGES,
  PAYMENT_METHODS,
  BOOLEAN_OPTIONS,
  LANGUAGES,
  TONES,
  RADIUS_OPTIONS,
  DAYS,
} from '../../types'

interface DaySchedule {
  open: boolean
  start: string
  end: string
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </h3>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}

function lookupLabel(
  list: ReadonlyArray<{ value: string; label: string }>,
  val: string,
): string {
  return list.find((i) => i.value === val)?.label ?? val
}

function renderIdentity(a: Answers) {
  const sector = a.sector as string | undefined
  const hours = a.hours as Record<string, DaySchedule> | undefined

  return (
    <>
      <SectionTitle>Identite</SectionTitle>
      <Row label="Entreprise" value={a.company_name as string} />
      <Row label="Secteur" value={sector ? lookupLabel(SECTORS, sector) : undefined} />
      <Row label="Ville" value={`${a.zip ?? ''} ${a.city ?? ''}`.trim() || undefined} />
      {a.address && <Row label="Adresse" value={a.address as string} />}
      <Row label="Telephone" value={a.phone as string} />
      <Row label="Email" value={a.contact_email as string} />
      {a.existing_website && <Row label="Site actuel" value={a.existing_website as string} />}
      {a.description && (
        <Row
          label="Description"
          value={
            <span className="line-clamp-3">{a.description as string}</span>
          }
        />
      )}
      {hours && (
        <Row
          label="Horaires"
          value={
            <div className="space-y-0.5">
              {DAYS.map((day) => {
                const d = hours[day]
                if (!d) return null
                return (
                  <div key={day} className="text-xs">
                    <span className="inline-block w-20">{day}</span>
                    {d.open ? `${d.start} - ${d.end}` : 'Ferme'}
                  </div>
                )
              })}
            </div>
          }
        />
      )}
    </>
  )
}

function renderServices(a: Answers) {
  const services = a.services as string[] | undefined
  const priceRange = a.price_range as string | undefined

  return (
    <>
      <SectionTitle>Prestations</SectionTitle>
      {services && (
        <Row
          label="Services"
          value={services.filter(Boolean).join(', ')}
        />
      )}
      <Row
        label="Gamme de prix"
        value={priceRange ? lookupLabel(PRICE_RANGES, priceRange) : undefined}
      />
      {a.differentiator && <Row label="Differenciation" value={a.differentiator as string} />}
      {a.target_audience && <Row label="Cible" value={a.target_audience as string} />}
    </>
  )
}

function renderPractical(a: Answers) {
  const payments = a.payment_methods as string[] | undefined
  const radius = a.radius as string | undefined
  const activeOptions = BOOLEAN_OPTIONS.filter((o) => a[o.key] === true)

  return (
    <>
      <SectionTitle>Pratique</SectionTitle>
      {payments && payments.length > 0 && (
        <Row
          label="Paiements"
          value={payments.map((p) => lookupLabel(PAYMENT_METHODS, p)).join(', ')}
        />
      )}
      {activeOptions.length > 0 && (
        <Row
          label="Options"
          value={activeOptions.map((o) => o.label).join(', ')}
        />
      )}
      <Row
        label="Rayon"
        value={radius ? lookupLabel(RADIUS_OPTIONS, radius) : undefined}
      />
      {a.main_cities && <Row label="Villes" value={a.main_cities as string} />}
    </>
  )
}

function renderBranding(a: Answers) {
  const languages = a.languages as string[] | undefined
  const tone = a.tone as string | undefined

  return (
    <>
      <SectionTitle>Branding</SectionTitle>
      {!a.color_auto && (
        <Row
          label="Couleurs"
          value={
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-5 w-5 rounded border"
                style={{ backgroundColor: (a.color_primary as string) ?? '#F5A623' }}
              />
              <span
                className="inline-block h-5 w-5 rounded border"
                style={{ backgroundColor: (a.color_secondary as string) ?? '#1E293B' }}
              />
            </div>
          }
        />
      )}
      {a.color_auto && <Row label="Couleurs" value="Automatiques" />}
      {languages && (
        <Row
          label="Langues"
          value={languages.map((l) => lookupLabel(LANGUAGES, l)).join(', ')}
        />
      )}
      <Row
        label="Ton"
        value={tone ? lookupLabel(TONES, tone) : undefined}
      />
    </>
  )
}

function renderDigital(a: Answers) {
  const socials = ['social_facebook', 'social_instagram', 'social_linkedin', 'social_youtube']
  const activeSocials = socials.filter((k) => a[k])

  return (
    <>
      <SectionTitle>Presence digitale</SectionTitle>
      {activeSocials.length > 0 && (
        <Row
          label="Reseaux"
          value={activeSocials
            .map((k) => k.replace('social_', ''))
            .join(', ')}
        />
      )}
      {a.has_gmb && (
        <>
          <Row label="Google My Business" value="Oui" />
          {a.gmb_rating && <Row label="Note GMB" value={`${a.gmb_rating}/5`} />}
          {a.gmb_review_count && (
            <Row label="Avis GMB" value={`${a.gmb_review_count} avis`} />
          )}
        </>
      )}
    </>
  )
}

export default function StepSummary({ answers }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-lg font-bold text-gray-900">
          Recapitulatif de vos informations
        </h2>
        <div className="space-y-6">
          {renderIdentity(answers)}
          {renderServices(answers)}
          {renderPractical(answers)}
          {renderBranding(answers)}
          {renderDigital(answers)}
        </div>
      </div>
    </div>
  )
}
