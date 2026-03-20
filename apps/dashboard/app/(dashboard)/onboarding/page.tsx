'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../lib/supabase'
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
        let { data: site } = await supabase
          .from('sites')
          .select('id, onboarding_done, status')
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        // If no site exists, create one automatically
        if (!site) {
          // Get user's organization
          const { data: userData } = await supabase
            .from('users')
            .select('organization_id')
            .eq('id', user.id)
            .single()

          if (!userData) {
            setError('Profil utilisateur introuvable.')
            setLoading(false)
            return
          }

          const slug = `site-${Date.now()}`
          const { data: newSite, error: createErr } = await supabase
            .from('sites')
            .insert({
              organization_id: userData.organization_id,
              owner_user_id: user.id,
              name: 'Nouveau Site',
              slug,
              sector: 'autre',
              temp_domain: `${slug}.wapixia.be`,
              hosting_type: 'wapixia',
              plan: 'subscription',
              plan_price: 49,
              status: 'setup',
            })
            .select('id, onboarding_done, status')
            .single()

          if (createErr || !newSite) {
            setError('Impossible de creer le site. Veuillez reessayer.')
            setLoading(false)
            return
          }

          site = newSite
        }

        setSiteId(site.id as string)

        // If onboarding already done, redirect to dashboard
        if (site.onboarding_done) {
          router.push('/')
          return
        }

        // Check for existing onboarding session in Supabase
        const { data: existingSession } = await supabase
          .from('onboarding_sessions')
          .select('id, site_id, current_step, answers, generation_status')
          .eq('site_id', site.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (existingSession) {
          if (existingSession.generation_status === 'generating') {
            router.push('/onboarding/generating')
            return
          }
          if (existingSession.generation_status === 'done') {
            router.push('/')
            return
          }
          setSession({
            id: existingSession.id,
            site_id: existingSession.site_id,
            current_step: existingSession.current_step ?? 1,
            answers: existingSession.answers ?? {},
            status: (existingSession.generation_status ?? 'in_progress') as OnboardingSession['status'],
          })
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
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
