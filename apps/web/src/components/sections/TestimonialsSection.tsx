'use client'

import { useEffect, useRef, useState } from 'react'

interface Testimonial {
  author: string
  role: string
  rating: 1 | 2 | 3 | 4 | 5
  text: string
}

interface TestimonialsSectionProps {
  title: string
  testimonials: Testimonial[]
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} sur 5 étoiles`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`h-5 w-5 ${i < rating ? 'text-[var(--color-accent)]' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export function TestimonialsSection({
  title,
  testimonials,
}: TestimonialsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const container = scrollRef.current
    if (!container || testimonials.length < 2) return

    let animationId: number
    const speed = 0.5 // pixels per frame

    function step() {
      if (!container || isPaused) {
        animationId = requestAnimationFrame(step)
        return
      }
      container.scrollLeft += speed
      // Reset scroll when reaching halfway (duplicated items)
      if (container.scrollLeft >= container.scrollWidth / 2) {
        container.scrollLeft = 0
      }
      animationId = requestAnimationFrame(step)
    }

    animationId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animationId)
  }, [isPaused, testimonials.length])

  // Duplicate testimonials for seamless looping
  const displayItems =
    testimonials.length >= 2
      ? [...testimonials, ...testimonials]
      : testimonials

  return (
    <section className="py-20" aria-labelledby="testimonials-title">
      <div className="mx-auto max-w-7xl px-6">
        <h2
          id="testimonials-title"
          className="text-center text-3xl font-bold text-[var(--color-primary)] sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h2>

        <div
          ref={scrollRef}
          className="mt-14 flex gap-6 overflow-x-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          role="region"
          aria-label="Témoignages clients"
        >
          {displayItems.map((testimonial, index) => (
            <article
              key={`${testimonial.author}-${index}`}
              className="w-[340px] flex-shrink-0 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm"
            >
              <StarRating rating={testimonial.rating} />
              <blockquote
                className="mt-4 leading-relaxed text-gray-700"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                &ldquo;{testimonial.text}&rdquo;
              </blockquote>
              <footer className="mt-5 border-t border-gray-100 pt-4">
                <p
                  className="font-semibold text-[var(--color-primary)]"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {testimonial.author}
                </p>
                <p className="text-sm text-gray-500">{testimonial.role}</p>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
