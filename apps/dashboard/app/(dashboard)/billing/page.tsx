'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiClient } from '../../../lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubscriptionStatus = 'active' | 'past_due' | 'suspended' | 'canceled'

interface SubscriptionLineItem {
  label: string
  amountHt: number
}

interface Subscription {
  id: string
  planName: string
  status: SubscriptionStatus
  nextBillingDate: string
  amountHt: number
  tvaRate: number
  lineItems: SubscriptionLineItem[]
}

type InvoiceStatus = 'paid' | 'pending' | 'failed'

interface Invoice {
  id: string
  date: string
  description: string
  amountTtc: number
  status: InvoiceStatus
  pdfUrl: string
}

interface BillingData {
  subscription: Subscription
  invoices: Invoice[]
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

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const map: Record<SubscriptionStatus, { label: string; cls: string }> = {
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

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { label: string; cls: string }> = {
    paid: { label: 'Paye', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
    failed: { label: 'Echoue', cls: 'bg-red-100 text-red-700' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

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
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Suspended state
// ---------------------------------------------------------------------------

function SuspendedBanner({ onReactivate }: { onReactivate: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-red-100 p-4">
        <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
        </svg>
      </div>
      <h2 className="mt-6 text-2xl font-bold text-gray-900">Compte suspendu</h2>
      <p className="mt-2 max-w-md text-gray-500">
        Votre compte est actuellement suspendu suite a un defaut de paiement.
        Veuillez reactiver votre abonnement pour retrouver l&apos;acces a vos services.
      </p>
      <button
        onClick={onReactivate}
        className="mt-6 rounded-lg bg-[#00D4B1] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00bfa0] focus:outline-none focus:ring-2 focus:ring-[#00D4B1] focus:ring-offset-2"
      >
        Reactiver mon compte
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel modal
// ---------------------------------------------------------------------------

function CancelModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900">Annuler l&apos;abonnement</h3>
        <p className="mt-2 text-sm text-gray-500">
          Etes-vous sur de vouloir annuler votre abonnement ? Cette action prendra
          effet a la fin de la periode de facturation en cours.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            Retour
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Annulation...' : 'Confirmer l\'annulation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [canceling, setCanceling] = useState(false)

  const fetchBilling = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await apiClient<BillingData>('/api/v1/billing')
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBilling()
  }, [fetchBilling])

  const handleCancel = async () => {
    try {
      setCanceling(true)
      await apiClient('/api/v1/billing/cancel', { method: 'POST' })
      setCancelOpen(false)
      void fetchBilling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible d\'annuler l\'abonnement')
    } finally {
      setCanceling(false)
    }
  }

  const handleReactivate = async () => {
    try {
      setLoading(true)
      await apiClient('/api/v1/billing/reactivate', { method: 'POST' })
      void fetchBilling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de reactiver le compte')
      setLoading(false)
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
            onClick={() => void fetchBilling()}
            className="mt-4 rounded-lg bg-[#00D4B1] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00bfa0]"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  const { subscription, invoices } = data

  // Suspended state
  if (subscription.status === 'suspended') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <SuspendedBanner onReactivate={() => void handleReactivate()} />
      </div>
    )
  }

  const totalHt = subscription.lineItems.reduce((sum, item) => sum + item.amountHt, 0)
  const tvaAmount = Math.round(totalHt * subscription.tvaRate)
  const totalTtc = totalHt + tvaAmount

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Past due banner */}
      {subscription.status === 'past_due' && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-amber-700">
            Paiement en attente &mdash; veuillez regulariser votre situation pour eviter la suspension de votre compte.
          </p>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
      <p className="mt-1 text-sm text-gray-500">Gerez votre abonnement et consultez vos factures.</p>

      {/* ---- Subscription overview ---- */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Plan</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{subscription.planName}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Statut</p>
          <div className="mt-1">
            <StatusBadge status={subscription.status} />
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Prochain paiement</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatDate(subscription.nextBillingDate)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Montant TTC</p>
          <p className="mt-1 text-lg font-bold text-[#00D4B1]">{formatCurrency(totalTtc)}</p>
        </div>
      </div>

      {/* ---- Monthly breakdown ---- */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Detail mensuel</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Ligne</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Montant HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscription.lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-6 py-3 text-gray-900">{item.label}</td>
                  <td className="px-6 py-3 text-right text-gray-700">{formatCurrency(item.amountHt)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="px-6 py-3 font-medium text-gray-700">Total HT</td>
                <td className="px-6 py-3 text-right font-medium text-gray-700">{formatCurrency(totalHt)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-gray-500">TVA ({(subscription.tvaRate * 100).toFixed(0)}%)</td>
                <td className="px-6 py-3 text-right text-gray-500">{formatCurrency(tvaAmount)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 font-semibold text-gray-900">Total TTC</td>
                <td className="px-6 py-3 text-right font-semibold text-[#00D4B1]">{formatCurrency(totalTtc)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ---- Invoice history ---- */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Historique des paiements</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Date</th>
                <th className="px-6 py-3 font-medium text-gray-500">Description</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Montant</th>
                <th className="px-6 py-3 font-medium text-gray-500">Statut</th>
                <th className="px-6 py-3 text-right font-medium text-gray-500">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    Aucune facture pour le moment.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="whitespace-nowrap px-6 py-3 text-gray-900">{formatDate(inv.date)}</td>
                  <td className="px-6 py-3 text-gray-700">{inv.description}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-right text-gray-700">{formatCurrency(inv.amountTtc)}</td>
                  <td className="px-6 py-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-3 text-right">
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#00D4B1] hover:underline"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                      </svg>
                      PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Cancel button ---- */}
      {subscription.status === 'active' && (
        <div className="mt-10 border-t border-gray-200 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Zone de danger</h2>
          <p className="mt-1 text-sm text-gray-500">
            L&apos;annulation prendra effet a la fin de la periode de facturation en cours.
          </p>
          <button
            onClick={() => setCancelOpen(true)}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Annuler l&apos;abonnement
          </button>
        </div>
      )}

      <CancelModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void handleCancel()}
        loading={canceling}
      />
    </div>
  )
}
