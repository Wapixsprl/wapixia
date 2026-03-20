'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommissionStatus = 'pending' | 'paid'

interface CommissionRow {
  month: string
  nbClients: number
  mrr: number
  rate: number
  commissionAmount: number
  status: CommissionStatus
  paidDate: string | null
}

interface CommissionsData {
  totalMrr: number
  mrrDelta: number
  pendingCommission: number
  affiliateLink: string
  history: CommissionRow[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function formatMonth(iso: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat('fr-BE', { month: 'long', year: 'numeric' }).format(d)
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-BE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function CommissionStatusBadge({ status }: { status: CommissionStatus }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        Verse
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      En attente
    </span>
  )
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-xs text-gray-400">-- vs mois dernier</span>
  }
  const positive = value > 0
  return (
    <span className={`text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? '+' : ''}{formatCurrency(value)} vs mois dernier
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CommissionsPage() {
  const [data, setData] = useState<CommissionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiClient<CommissionsData>('/api/v1/reseller/commissions')
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silently
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <LoadingSkeleton />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={() => void fetchData()}
            className="mt-4 rounded-lg bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00bfa0]"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
      <p className="mt-1 text-sm text-gray-500">Suivez vos revenus et l&apos;historique de vos commissions.</p>

      {/* ---- KPI cards ---- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {/* MRR */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">MRR total clients</p>
          <p className="mt-1 text-2xl font-bold text-[#00D4B1]">{formatCurrency(data.totalMrr)}</p>
          <div className="mt-1">
            <DeltaBadge value={data.mrrDelta} />
          </div>
        </div>

        {/* Pending */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Commission en attente</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(data.pendingCommission)}</p>
          <p className="mt-1 text-xs text-gray-400">Ce mois-ci</p>
        </div>

        {/* Clients count */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Clients actifs</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {data.history.length > 0 ? data.history[0].nbClients : 0}
          </p>
          <p className="mt-1 text-xs text-gray-400">Periode courante</p>
        </div>
      </div>

      {/* ---- Commission history ---- */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Historique des commissions</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Mois</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Clients</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">MRR</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Taux</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Commission</th>
                <th className="px-6 py-3 font-medium text-gray-500">Statut</th>
                <th className="px-6 py-3 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    Aucune commission pour le moment.
                  </td>
                </tr>
              )}
              {data.history.map((row, idx) => (
                <tr key={idx}>
                  <td className="whitespace-nowrap px-6 py-3 text-gray-900">{formatMonth(row.month)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{row.nbClients}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-gray-700">{formatCurrency(row.mrr)}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{(row.rate * 100).toFixed(0)}%</td>
                  <td className="whitespace-nowrap px-6 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(row.commissionAmount)}
                  </td>
                  <td className="px-6 py-3">
                    <CommissionStatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-gray-500">
                    {row.paidDate ? formatDate(row.paidDate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Affiliate link ---- */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Lien d&apos;affiliation</h2>
        <p className="mt-1 text-sm text-gray-500">Partagez ce lien pour parrainer de nouveaux clients.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono text-gray-700">
            {data.affiliateLink}
          </div>
          <button
            onClick={() => void handleCopy(data.affiliateLink)}
            className="shrink-0 rounded-lg bg-[#00D4B1] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#00bfa0] focus:outline-none focus:ring-2 focus:ring-[#00D4B1] focus:ring-offset-2"
          >
            {copied ? 'Copie !' : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  )
}
