import Image from 'next/image'

interface SocialLink {
  platform: string
  url: string
  /** SVG icon as a React node */
  icon: React.ReactNode
}

interface FooterLink {
  label: string
  href: string
}

interface FooterProps {
  businessName: string
  logoUrl?: string
  description?: string
  address?: string
  phone?: string
  email?: string
  navLinks?: FooterLink[]
  legalLinks?: FooterLink[]
  socialLinks?: SocialLink[]
}

export function Footer({
  businessName,
  logoUrl,
  description,
  address,
  phone,
  email,
  navLinks = [],
  legalLinks = [],
  socialLinks = [],
}: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className="bg-[var(--color-primary)] text-white"
      aria-label="Pied de page"
    >
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          {/* Business info */}
          <div>
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={`${businessName} logo`}
                width={160}
                height={48}
                className="h-10 w-auto"
              />
            ) : (
              <p
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {businessName}
              </p>
            )}
            {description && (
              <p
                className="mt-4 max-w-xs text-sm leading-relaxed text-white/70"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {description}
              </p>
            )}
            {/* Contact details */}
            <div
              className="mt-6 space-y-2 text-sm text-white/70"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {address && <p>{address}</p>}
              {phone && (
                <p>
                  <a href={`tel:${phone}`} className="hover:text-white">
                    {phone}
                  </a>
                </p>
              )}
              {email && (
                <p>
                  <a href={`mailto:${email}`} className="hover:text-white">
                    {email}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Navigation links */}
          {navLinks.length > 0 && (
            <nav aria-label="Liens du pied de page">
              <p
                className="text-sm font-semibold uppercase tracking-wider text-white/50"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Navigation
              </p>
              <ul className="mt-4 space-y-3">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-white/70 transition-colors hover:text-[var(--color-accent)]"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div>
              <p
                className="text-sm font-semibold uppercase tracking-wider text-white/50"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Suivez-nous
              </p>
              <div className="mt-4 flex gap-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.platform}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-[var(--color-accent)]"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p
            className="text-xs text-white/50"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            &copy; {currentYear} {businessName}. Tous droits réservés.
          </p>
          {legalLinks.length > 0 && (
            <nav aria-label="Liens légaux" className="flex gap-6">
              {legalLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-xs text-white/50 transition-colors hover:text-white"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
    </footer>
  )
}
