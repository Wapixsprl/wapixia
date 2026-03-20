'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrgStatus = 'active' | 'past_due' | 'suspended' | 'canceled'
type OrgType = 'client' | 'reseller'

interface OrganizationBilling {
  id: string
  name: string
  type: OrgType
  mrr: number
  commissionDue: number
  status: OrgStatus
}

interface AdminBillingData {
  globalMrr: number
  pendingCommissionsTotal: number
  organizations: OrganizationBilling[]
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

function OrgStatusBadge({ status }: { status: OrgStatus }) {
  const map: Record<OrgStatus, { label: string; cls: string }> = {
    active: { label: 'Actif', cls: 'bg-emerald-100 text-emerald-700' },
    past_due: { label: 'Impaye', cls: 'bg-amber-100 text-amber-700' },
    suspended: { label: 'Suspendu', cls: 'bg-red-100 text-red-700' },
    canceled: { label: 'Annule', cls: 'bg-gray-100 text-gray-500' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function OrgTypeBadge({ type }: { type: OrgType }) {
  if (type === 'reseller') {
    return (
      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
        Revendeur
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
      Client
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminBillingPage() {
  const [data, setData] = useState<AdminBillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [processSuccess, setProcessSuccess] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiClient<AdminBillingData>('/api/v1/admin/billing')
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

  const handleProcessCommissions = async () => {
    try {
      setProcessing(true)
      setProcessSuccess(false)
      await apiClient('/api/v1/admin/commissions/process', { method: 'POST' })
      setProcessSuccess(true)
      void fetchData()
      setTimeout(() => setProcessSuccess(false), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de lancer les reversements')
    } finally {
      setProcessing(false)
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <LoadingSkeleton />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Facturation &mdash; Administration</h1>
      <p className="mt-1 text-sm text-gray-500">Vue globale du MRR, des organisations et des commissions.</p>

      {/* ---- KPI cards ---- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {/* Global MRR */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">MRR global</p>
          <p className="mt-1 text-2xl font-bold text-[#00D4B1]">{formatCurrency(data.globalMrr)}</p>
        </div>

        {/* Pending commissions */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Commissions en attente</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(data.pendingCommissionsTotal)}</p>
        </div>

        {/* Nb organizations */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Organisations</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{data.organizations.length}</p>
        </div>
      </div>

      {/* ---- Process commissions ---- */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={() => void handleProcessCommissions()}
          disabled={processing}
          className="rounded-lg bg-[#00D4B1] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00bfa0] focus:outline-none focus:ring-2 focus:ring-[#00D4B1] focus:ring-offset-2 disabled:opacity-50"
        >
          {processing ? 'Traitement en cours...' : 'Lancer les reversements du mois'}
        </button>
        {processSuccess && (
          <span className="text-sm font-medium text-emerald-600">Reversements lances avec succes.</span>
        )}
      </div>

      {/* ---- Organizations table ---- */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Organisations</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Organisation</th>
                <th className="px-6 py-3 font-medium text-gray-500">Type</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">MRR</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Commission due</th>
                <th className="px-6 py-3 font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.organizations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    Aucune organisation enregistree.
                  </td>
                </tr>
              )}
              {data.organizations.map((org) => (
                <tr key={org.id}>
                  <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">{org.name}</td>
                  <td className="px-6 py-3">
                    <OrgTypeBadge type={org.type} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-gray-700">{formatCurrency(org.mrr)}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-gray-700">{formatCurrency(org.commissionDue)}</td>
                  <td className="px-6 py-3">
                    <OrgStatusBadge status={org.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
