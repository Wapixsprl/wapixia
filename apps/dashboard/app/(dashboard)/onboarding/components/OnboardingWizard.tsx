'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '../../../../lib/supabase'
import type { Answers, OnboardingSession } from '../types'
import StepIdentity from './steps/StepIdentity'
import StepServices from './steps/StepServices'
import StepPractical from './steps/StepPractical'
import StepBranding from './steps/StepBranding'
import StepDigital from './steps/StepDigital'
import StepSummary from './steps/StepSummary'

const TOTAL_STEPS = 20

const STEP_TITLES: Record<number, string> = {
  1: 'Nom de l\'entreprise',
  2: 'Secteur d\'activite',
  3: 'Localisation',
  4: 'Contact',
  5: 'Description',
  6: 'Prestations',
  7: 'Gamme de prix',
  8: 'Differenciation',
  9: 'Clientele cible',
  10: 'Horaires',
  11: 'Moyens de paiement',
  12: 'Options pratiques',
  13: 'Zone de couverture',
  14: 'Photos et visuels',
  15: 'Couleurs',
  16: 'Langues',
  17: 'Ton de communication',
  18: 'Reseaux sociaux',
  19: 'Google My Business',
  20: 'Recapitulatif',
}

interface Props {
  siteId: string
  initialSession?: OnboardingSession | null
}

export default function OnboardingWizard({ siteId, initialSession }: Props) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null)
  const [currentStep, setCurrentStep] = useState(initialSession?.current_step ?? 1)
  const [answers, setAnswers] = useState<Answers>(initialSession?.answers ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const prevStepRef = useRef(currentStep)

  const saveStep = useCallback(
    async (step: number, data: Answers) => {
      try {
        setSaving(true)
        setError(null)

        if (sessionId) {
          // Update existing session
          await supabase
            .from('onboarding_sessions')
            .update({
              current_step: step,
              answers: data,
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId)
        } else {
          // Create new session
          const { data: { user } } = await supabase.auth.getUser()
          const { data: newSession } = await supabase
            .from('onboarding_sessions')
            .insert({
              site_id: siteId,
              user_id: user?.id,
              current_step: step,
              answers: data,
              generation_status: 'pending',
            })
            .select('id')
            .single()

          if (newSession) {
            setSessionId(newSession.id)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de sauvegarde')
      } finally {
        setSaving(false)
      }
    },
    [siteId, sessionId, supabase],
  )

  // Auto-save when step changes
  useEffect(() => {
    if (prevStepRef.current !== currentStep) {
      void saveStep(prevStepRef.current, answers)
      prevStepRef.current = currentStep
    }
  }, [currentStep, answers, saveStep])

  function handleUpdate(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  function goNext() {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function goPrev() {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function handleComplete() {
    try {
      setSubmitting(true)
      setError(null)

      // Save the last step
      await saveStep(currentStep, answers)

      // Update onboarding session status
      if (sessionId) {
        await supabase
          .from('onboarding_sessions')
          .update({
            generation_status: 'done',
            answers,
            current_step: TOTAL_STEPS,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
      }

      // Save answers to site's onboarding_data and update site name/sector
      const siteUpdate: Record<string, unknown> = {
        onboarding_data: answers,
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      }

      // Update site name if provided
      if (answers.business_name) {
        siteUpdate.name = answers.business_name
        siteUpdate.slug = String(answers.business_name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
      }

      // Update sector if provided
      if (answers.sector) {
        siteUpdate.sector = answers.sector
      }

      // Update colors if provided
      if (answers.primary_color) {
        siteUpdate.primary_color = answers.primary_color
      }
      if (answers.secondary_color) {
        siteUpdate.secondary_color = answers.secondary_color
      }

      await supabase
        .from('sites')
        .update(siteUpdate)
        .eq('id', siteId)

      // Redirect to dashboard
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la finalisation')
      setSubmitting(false)
    }
  }

  const progress = (currentStep / TOTAL_STEPS) * 100
  const stepProps = { answers, onUpdate: handleUpdate, step: currentStep }

  function renderStep() {
    if (currentStep >= 1 && currentStep <= 5) return <StepIdentity {...stepProps} />
    if (currentStep >= 6 && currentStep <= 9) return <StepServices {...stepProps} />
    if (currentStep >= 10 && currentStep <= 13) return <StepPractical {...stepProps} />
    if (currentStep >= 14 && currentStep <= 17) return <StepBranding {...stepProps} />
    if (currentStep >= 18 && currentStep <= 19) return <StepDigital {...stepProps} />
    if (currentStep === 20) return <StepSummary {...stepProps} />
    return null
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">
            Etape {currentStep} / {TOTAL_STEPS}
          </span>
          <span className="text-sm text-gray-400">
            {STEP_TITLES[currentStep]}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#F5A623] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step content */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentStep === 1}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Precedent
        </button>

        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-xs text-gray-400">Sauvegarde...</span>
          )}

          {currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg bg-[#F5A623] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#E09510]"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={submitting}
              className="rounded-lg bg-[#F5A623] px-6 py-3 text-sm font-bold text-white transition-all hover:bg-[#E09510] hover:shadow-lg disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Finalisation...
                </span>
              ) : (
                'Terminer la configuration'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
