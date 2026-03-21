'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserClient } from '../../../lib/supabase'

// ─── Types ────────────────────────────────────────────────────────
type Priority = 'low' | 'medium' | 'high' | 'urgent'
type Status = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed'
type Category = 'bug' | 'feature' | 'support' | 'content' | 'seo' | 'other'

interface Ticket {
  id: string
  site_id: string
  created_by: string
  assigned_to: string | null
  title: string
  description: string | null
  priority: Priority
  status: Status
  category: Category
  attachments: string[] | null
  created_at: string
}

interface UserRow {
  id: string
  email: string
  full_name: string | null
}

// ─── Constants ────────────────────────────────────────────────────
const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  urgent: { bg: 'bg-red-100', text: 'text-red-700' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  low: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
}

const STATUS_COLORS: Record<Status, { bg: string; text: string }> = {
  open: { bg: 'bg-blue-100', text: 'text-blue-700' },
  in_progress: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  waiting: { bg: 'bg-purple-100', text: 'text-purple-700' },
  resolved: { bg: 'bg-green-100', text: 'text-green-700' },
  closed: { bg: 'bg-gray-100', text: 'text-gray-500' },
}

const STATUS_LABELS: Record<Status, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  waiting: 'En attente',
  resolved: 'Resolu',
  closed: 'Ferme',
}

const CATEGORY_LABELS: Record<Category, string> = {
  bug: 'Bug',
  feature: 'Fonctionnalite',
  support: 'Support',
  content: 'Contenu',
  seo: 'SEO',
  other: 'Autre',
}

const ALL_STATUSES: Status[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed']
const ALL_PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
const ALL_CATEGORIES: Category[] = ['bug', 'feature', 'support', 'content', 'seo', 'other']

export default function TicketsPage() {
  const [siteId, setSiteId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<Category | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState<Priority>('medium')
  const [formCategory, setFormCategory] = useState<Category>('support')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createBrowserClient()

  // Resolve site
  useEffect(() => {
    async function resolveSite() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('owner_user_id', user.id)
        .single()
      if (site?.id) setSiteId(site.id)
      else {
        const { data: first } = await supabase.from('sites').select('id').limit(1).single()
        if (first?.id) setSiteId(first.id)
      }
    }
    void resolveSite()
  }, [supabase])

  // Fetch users
  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase.from('users').select('id, email, full_name')
      if (data) setUsers(data)
    }
    void fetchUsers()
  }, [supabase])

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    if (!siteId) return
    setLoading(true)
    let query = supabase
      .from('tickets')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })

    if (statusFilter) query = query.eq('status', statusFilter)
    if (priorityFilter) query = query.eq('priority', priorityFilter)
    if (categoryFilter) query = query.eq('category', categoryFilter)

    const { data } = await query
    if (data) setTickets(data)
    setLoading(false)
  }, [siteId, statusFilter, priorityFilter, categoryFilter, supabase])

  useEffect(() => { void fetchTickets() }, [fetchTickets])

  // Create ticket
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!siteId || !userId || !formTitle.trim()) return
    setSubmitting(true)
    await supabase.from('tickets').insert({
      site_id: siteId,
      created_by: userId,
      assigned_to: formAssignedTo || null,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      priority: formPriority,
      status: 'open' as Status,
      category: formCategory,
    })
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormCategory('support')
    setFormAssignedTo('')
    setShowModal(false)
    setSubmitting(false)
    await fetchTickets()
  }

  // Update status inline
  async function handleStatusChange(ticketId: string, newStatus: Status) {
    setStatusUpdating(ticketId)
    await supabase.from('tickets').update({ status: newStatus }).eq('id', ticketId)
    await fetchTickets()
    setStatusUpdating(null)
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, status: newStatus } : null)
    }
  }

  function getUserName(uid: string | null) {
    if (!uid) return '—'
    const u = users.find(u => u.id === uid)
    return u?.full_name || u?.email || uid.slice(0, 8)
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="mt-1 text-sm text-gray-500">Gerez les demandes et incidents de votre site.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#F5A623] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#E09600] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouveau ticket
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as Status | '')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
        >
          <option value="">Tous les statuts</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as Priority | '')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
        >
          <option value="">Toutes les priorites</option>
          {ALL_PRIORITIES.map(p => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value as Category | '')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
        >
          <option value="">Toutes les categories</option>
          {ALL_CATEGORIES.map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        {(statusFilter || priorityFilter || categoryFilter) && (
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setPriorityFilter(''); setCategoryFilter('') }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#F5A623]" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white">
          <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-gray-400">Aucun ticket trouve</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 font-medium text-gray-500">Titre</th>
                <th className="px-4 py-3 font-medium text-gray-500">Priorite</th>
                <th className="px-4 py-3 font-medium text-gray-500">Statut</th>
                <th className="hidden px-4 py-3 font-medium text-gray-500 md:table-cell">Categorie</th>
                <th className="hidden px-4 py-3 font-medium text-gray-500 lg:table-cell">Assigne a</th>
                <th className="hidden px-4 py-3 font-medium text-gray-500 lg:table-cell">Cree le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map(ticket => (
                <tr
                  key={ticket.id}
                  className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{ticket.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority].bg} ${PRIORITY_COLORS[ticket.priority].text}`}>
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      value={ticket.status}
                      onChange={e => void handleStatusChange(ticket.id, e.target.value as Status)}
                      disabled={statusUpdating === ticket.id}
                      className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#F5A623] ${STATUS_COLORS[ticket.status].bg} ${STATUS_COLORS[ticket.status].text} ${statusUpdating === ticket.id ? 'opacity-50' : ''}`}
                    >
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className="text-gray-600">{CATEGORY_LABELS[ticket.category]}</span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="text-gray-600">{getUserName(ticket.assigned_to)}</span>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="text-gray-400">
                      {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail view modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedTicket(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold text-gray-900">{selectedTicket.title}</h2>
              <button type="button" onClick={() => setSelectedTicket(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[selectedTicket.priority].bg} ${PRIORITY_COLORS[selectedTicket.priority].text}`}>
                {PRIORITY_LABELS[selectedTicket.priority]}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[selectedTicket.status].bg} ${STATUS_COLORS[selectedTicket.status].text}`}>
                {STATUS_LABELS[selectedTicket.status]}
              </span>
              <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                {CATEGORY_LABELS[selectedTicket.category]}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400">Assigne a</p>
                <p className="font-medium text-gray-700">{getUserName(selectedTicket.assigned_to)}</p>
              </div>
              <div>
                <p className="text-gray-400">Cree par</p>
                <p className="font-medium text-gray-700">{getUserName(selectedTicket.created_by)}</p>
              </div>
              <div>
                <p className="text-gray-400">Cree le</p>
                <p className="font-medium text-gray-700">
                  {new Date(selectedTicket.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Changer le statut</p>
                <select
                  value={selectedTicket.status}
                  onChange={e => void handleStatusChange(selectedTicket.id, e.target.value as Status)}
                  disabled={statusUpdating === selectedTicket.id}
                  className="mt-0.5 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                >
                  {ALL_STATUSES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm text-gray-400">Description</p>
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {selectedTicket.description || 'Aucune description fournie.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New ticket modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Nouveau ticket</h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={e => void handleCreate(e)} className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Titre *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  placeholder="Resume du probleme ou de la demande"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={4}
                  placeholder="Decrivez le probleme en detail..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                />
              </div>

              {/* Priority + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Priorite</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as Priority)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                  >
                    {ALL_PRIORITIES.map(p => (
                      <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Categorie</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as Category)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                  >
                    {ALL_CATEGORIES.map(c => (
                      <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Assigner a</label>
                <select
                  value={formAssignedTo}
                  onChange={e => setFormAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#F5A623] focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
                >
                  <option value="">Non assigne</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting || !formTitle.trim()}
                  className="rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#E09600] disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Creation...' : 'Creer le ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
