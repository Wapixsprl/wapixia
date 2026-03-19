'use client'

import { useRef, useState } from 'react'

interface ContactFormProps {
  title?: string
  /** URL to POST the form data to */
  actionUrl?: string
  /** Called on successful submission when no actionUrl is given */
  onSubmit?: (data: ContactFormData) => void | Promise<void>
}

export interface ContactFormData {
  name: string
  email: string
  phone: string
  message: string
}

export function ContactForm({
  title = 'Contactez-nous',
  actionUrl,
  onSubmit,
}: ContactFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')

    try {
      const form = e.currentTarget
      const data: ContactFormData = {
        name: (form.elements.namedItem('name') as HTMLInputElement).value,
        email: (form.elements.namedItem('email') as HTMLInputElement).value,
        phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
        message: (form.elements.namedItem('message') as HTMLTextAreaElement)
          .value,
      }

      if (actionUrl) {
        const res = await fetch(actionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Erreur serveur')
      } else if (onSubmit) {
        await onSubmit(data)
      }

      setStatus('sent')
      formRef.current?.reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <section className="py-20" aria-labelledby="contact-title">
      <div className="mx-auto max-w-2xl px-6">
        {title && (
          <h2
            id="contact-title"
            className="text-center text-3xl font-bold text-[var(--color-primary)] sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {title}
          </h2>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-12 space-y-6"
          noValidate
        >
          <div>
            <label
              htmlFor="contact-name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Nom complet
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="contact-email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label
                htmlFor="contact-phone"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Téléphone
              </label>
              <input
                id="contact-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              required
              className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full rounded-lg bg-[var(--color-accent)] px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {status === 'sending' ? 'Envoi en cours...' : 'Envoyer'}
          </button>

          {status === 'sent' && (
            <p className="text-center text-sm font-medium text-green-600" role="status">
              Message envoyé avec succès !
            </p>
          )}
          {status === 'error' && (
            <p className="text-center text-sm font-medium text-red-600" role="alert">
              Une erreur est survenue. Veuillez réessayer.
            </p>
          )}
        </form>
      </div>
    </section>
  )
}
