'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../../lib/supabase'
import { apiClient } from '../../../../lib/api'
import type { GenerationStatus } from '../types'

const GENERATION_STEPS = [
  { label: 'Analyse de votre activite...', range: [0, 20] as const },
  { label: 'Generation du contenu...', range: [20, 60] as const },
  { label: 'Mise en forme du site...', range: [60, 80] as const },
  { label: 'Deploiement en cours...', range: [80, 100] as const },
]

function getActiveStepIndex(progress: number): number {
  for (let i = GENERATION_STEPS.length - 1; i >= 0; i--) {
    if (progress >= GENERATION_STEPS[i].range[0]) return i
  }
  return 0
}

export default function GeneratingPage() {
  const router = useRouter()
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'generating' | 'done' | 'failed'>('generating')
  const [error, setError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const pollStatus = useCallback(async (id: string) => {
    try {
      const data = await apiClient<GenerationStatus>(
        `/api/v1/sites/${id}/onboarding/status`,
      )
      setProgress(data.progress ?? 0)

      if (data.status === 'done') {
        setStatus('done')
        setProgress(100)
        if (intervalRef.current) clearInterval(intervalRef.current)
        setTimeout(() => router.push('/overview'), 1500)
      } else if (data.status === 'failed') {
        setStatus('failed')
        setError(data.error ?? 'Une erreur est survenue')
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } catch (err) {
      // Don't stop polling on transient errors
      console.error('Poll error:', err)
    }
  }, [router])

  useEffect(() => {
    async function init() {
      const supabase = createBrowserClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!site) {
        router.push('/onboarding')
        return
      }

      const id = site.id as string
      setSiteId(id)

      // Initial poll
      await pollStatus(id)

      // Poll every 5 seconds
      intervalRef.current = setInterval(() => {
        void pollStatus(id)
      }, 5000)
    }

    void init()

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [router, pollStatus])

  async function handleRetry() {
    if (!siteId) return
    setStatus('generating')
    setError(null)
    setProgress(0)

    try {
      await apiClient(`/api/v1/sites/${siteId}/onboarding/complete`, {
        method: 'POST',
      })
      intervalRef.current = setInterval(() => {
        void pollStatus(siteId)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du relancement')
      setStatus('failed')
    }
  }

  const activeIndex = getActiveStepIndex(progress)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Animated spinner */}
        {status === 'generating' && (
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center">
            <div className="absolute h-24 w-24 animate-spin rounded-full border-4 border-[#00D4B1]/20 border-t-[#00D4B1]" />
            <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-[#00D4B1]/10 border-b-[#00D4B1]/60" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
        )}

        {status === 'done' && (
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-[#00D4B1]/10">
            <svg className="h-12 w-12 text-[#00D4B1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {status === 'failed' && (
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-red-50">
            <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}

        <h1 className="mb-2 text-xl font-bold text-gray-900">
          {status === 'generating' && 'Creation de votre site en cours...'}
          {status === 'done' && 'Votre site est pret !'}
          {status === 'failed' && 'Oups, une erreur est survenue'}
        </h1>

        {status === 'generating' && (
          <p className="mb-8 text-sm text-gray-500">
            Cela prend generalement 1 a 3 minutes
          </p>
        )}

        {/* Progress bar */}
        {status !== 'failed' && (
          <div className="mb-8">
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#00D4B1] transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
          </div>
        )}

        {/* Generation steps */}
        {status === 'generating' && (
          <div className="space-y-3 text-left">
            {GENERATION_STEPS.map((step, i) => {
              const isDone = i < activeIndex
              const isActive = i === activeIndex
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all ${
                    isActive ? 'bg-[#00D4B1]/5' : ''
                  }`}
                >
                  {isDone ? (
                    <svg className="h-5 w-5 shrink-0 text-[#00D4B1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isActive ? (
                    <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[#00D4B1]/30 border-t-[#00D4B1]" />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-gray-200" />
                  )}
                  <span
                    className={`text-sm ${
                      isDone
                        ? 'text-gray-400 line-through'
                        : isActive
                          ? 'font-medium text-gray-900'
                          : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Error state */}
        {status === 'failed' && (
          <div className="space-y-4">
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleRetry()}
              className="rounded-lg bg-[#00D4B1] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#00BFA0]"
            >
              Reessayer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
