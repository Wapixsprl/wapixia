'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

interface NavItem {
  label: string
  href: string
}

interface HeaderProps {
  businessName: string
  logoUrl?: string
  navItems: NavItem[]
  ctaText?: string
  ctaHref?: string
}

export function Header({
  businessName,
  logoUrl,
  navItems,
  ctaText,
  ctaHref,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 shadow-sm backdrop-blur-sm'
          : 'bg-transparent'
      }`}
      role="banner"
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"
        aria-label="Navigation principale"
      >
        {/* Logo / Business name */}
        <a href="/" className="flex items-center gap-3" aria-label={`${businessName} - Accueil`}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${businessName} logo`}
              width={140}
              height={40}
              className="h-8 w-auto"
              priority
            />
          ) : (
            <span
              className={`text-xl font-bold transition-colors ${
                scrolled ? 'text-[var(--color-primary)]' : 'text-white'
              }`}
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {businessName}
            </span>
          )}
        </a>

        {/* Desktop navigation */}
        <ul className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-[var(--color-accent)] ${
                  scrolled ? 'text-gray-700' : 'text-white/90'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA + Mobile burger */}
        <div className="flex items-center gap-4">
          {ctaText && ctaHref && (
            <a
              href={ctaHref}
              className="hidden rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] md:inline-flex"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {ctaText}
            </a>
          )}

          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileMenuOpen ? (
              <svg
                className={`h-6 w-6 ${scrolled ? 'text-gray-900' : 'text-white'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className={`h-6 w-6 ${scrolled ? 'text-gray-900' : 'text-white'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="border-t border-gray-100 bg-white md:hidden" role="dialog" aria-label="Menu mobile">
          <ul className="space-y-1 px-6 py-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="block rounded-lg px-3 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-[var(--color-accent)]"
                  style={{ fontFamily: 'var(--font-body)' }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          {ctaText && ctaHref && (
            <div className="border-t border-gray-100 px-6 py-4">
              <a
                href={ctaHref}
                className="block w-full rounded-lg bg-[var(--color-accent)] px-5 py-3 text-center text-sm font-semibold text-white"
                style={{ fontFamily: 'var(--font-body)' }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {ctaText}
              </a>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
