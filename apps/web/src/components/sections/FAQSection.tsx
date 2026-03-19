'use client'

import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSectionProps {
  title: string
  items: FAQItem[]
}

function FAQAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-gray-200">
      <h3>
        <button
          type="button"
          className="flex w-full items-center justify-between py-5 text-left"
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <span
            className="text-lg font-medium text-[var(--color-primary)]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {item.question}
          </span>
          <svg
            className={`ml-4 h-5 w-5 flex-shrink-0 text-[var(--color-accent)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </h3>
      <div
        className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
        role="region"
      >
        <p
          className="leading-relaxed text-gray-600"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {item.answer}
        </p>
      </div>
    </div>
  )
}

/**
 * FAQ section with accordion and Schema.org FAQPage structured data.
 */
export function FAQSection({ title, items }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Schema.org FAQPage JSON-LD
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <section className="py-20" aria-labelledby="faq-title">
      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="mx-auto max-w-3xl px-6">
        <h2
          id="faq-title"
          className="text-center text-3xl font-bold text-[var(--color-primary)] sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h2>

        <div className="mt-12">
          {items.map((item, index) => (
            <FAQAccordionItem
              key={item.question}
              item={item}
              isOpen={openIndex === index}
              onToggle={() =>
                setOpenIndex(openIndex === index ? null : index)
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}
