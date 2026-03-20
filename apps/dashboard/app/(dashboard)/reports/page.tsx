'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'
import { createBrowserClient } from '../../../lib/supabase'

/* ---------- Types ---------- */

interface Report {
  id: string
  month: string
  score: number | null
  email_sent: boolean
  pdf_url: string | null
  created_at: string
}

/* ---------- Skeleton ---------- */

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/* ---------- Score color ---------- */

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 70) return 'bg-emerald-50'
  if (score >= 40) return 'bg-yellow-50'
  return 'bg-red-50'
}

/* ---------- Page ---------- */

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)

  const fetchReports = useCallback(async (sid: string) => {
    try {
      const result = await apiClient<Report[]>(
        `/api/v1/sites/${sid}/reports`
      )
      setReports(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }, [])

  useEffect(() => {
    async function init() {
      try {
        const supabase = createBrowserClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { data: site } = await supabase
          .from('sites')
          .select('id')
          .eq('owner_id', user?.id ?? '')
          .single()

        const id = site?.id as string | undefined

        if (id) {
          setSiteId(id)
          await fetchReports(id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    void init()
  }, [fetchReports])

  async function handleGenerate() {
    if (!siteId || generating) return
    setGenerating(true)
    setError(null)

    try {
      await apiClient(`/api/v1/sites/${siteId}/reports/generate`, {
        method: 'POST',
      })
      await fetchReports(siteId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la g\u00e9n\u00e9ration')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <ReportsSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={generating || !siteId}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00D4B1] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#00BFA0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          )}
          G&eacute;n&eacute;rer maintenant
        </button>
      </div>

      {/* Error */}
      {error !== null && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Reports list */}
      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                {/* Month */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-500"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>

                <div>
                  <p className="font-semibold text-gray-900">{report.month}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {report.score !== null && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${scoreBg(report.score)} ${scoreColor(report.score)}`}
                      >
                        Score : {report.score}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 ${
                        report.email_sent ? 'text-emerald-600' : 'text-gray-400'
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${
                          report.email_sent ? 'bg-emerald-500' : 'bg-gray-300'
                        }`}
                      />
                      {report.email_sent ? 'Email envoy\u00e9' : 'Email non envoy\u00e9'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {report.pdf_url !== null ? (
                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    T&eacute;l&eacute;charger PDF
                  </a>
                ) : (
                  <span className="inline-flex items-center rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-400">
                    PDF non disponible
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-gray-300"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <h3 className="mt-4 text-sm font-semibold text-gray-900">
            Aucun rapport
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            G&eacute;n&eacute;rez votre premier rapport de visibilit&eacute; en
            cliquant sur le bouton ci-dessus.
          </p>
        </div>
      )}
    </div>
  )
}
