'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../lib/supabase'
import { apiClient } from '../../../lib/api'
import type { OnboardingSession } from './types'
import OnboardingWizard from './components/OnboardingWizard'

export default function OnboardingPage() {
  const router = useRouter()
  const [siteId, setSiteId] = useState<string | null>(null)
  const [session, setSession] = useState<OnboardingSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        // Get the user's site
        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('owner_id', user.id)
          .single()

        if (!site) {
          setError('Aucun site trouve. Veuillez contacter le support.')
          setLoading(false)
          return
        }

        setSiteId(site.id as string)

        // Fetch existing onboarding session
        try {
          const existing = await apiClient<OnboardingSession>(
            `/api/v1/sites/${site.id}/onboarding`,
          )
          if (existing.status === 'generating') {
            router.push('/onboarding/generating')
            return
          }
          if (existing.status === 'done') {
            router.push('/overview')
            return
          }
          setSession(existing)
        } catch {
          // No session yet, that's fine — start fresh
          setSession(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [router])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D4B1]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (!siteId) return null

  return (
    <div className="py-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Configurez votre site
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Repondez aux questions pour generer votre site intelligent
        </p>
      </div>
      <OnboardingWizard siteId={siteId} initialSession={session} />
    </div>
  )
}
