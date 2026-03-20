'use client'

const MOCK_PILOTS = [
  { id: '1', name: 'Boulangerie Martin', sector: 'Artisan', status: 'live', lcp: '1.8s', seo: 92, cost: 47, uptime: 99.9 },
  { id: '2', name: 'Salon Beaute Liege', sector: 'Beaute', status: 'testing', lcp: '2.1s', seo: 85, cost: 52, uptime: 99.5 },
  { id: '3', name: 'Pizza Napoli', sector: 'Horeca', status: 'onboarding', lcp: '--', seo: 0, cost: 12, uptime: 0 },
  { id: '4', name: 'Immo Bruxelles', sector: 'Immobilier', status: 'live', lcp: '1.5s', seo: 88, cost: 63, uptime: 99.8 },
  { id: '5', name: 'Dr. Dupont', sector: 'Medical', status: 'testing', lcp: '1.9s', seo: 78, cost: 38, uptime: 99.2 },
]

const STATUS_COLORS: Record<string, string> = {
  live: 'bg-green-100 text-green-700',
  testing: 'bg-blue-100 text-blue-700',
  onboarding: 'bg-amber-100 text-amber-700',
  paused: 'bg-gray-100 text-gray-700',
}

export default function PilotsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pilotes</h1>
          <p className="mt-1 text-sm text-gray-500">Gestion des sites pilotes et suivi Go-Live</p>
        </div>
        <div className="flex gap-3">
          <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            2 Live
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            2 Testing
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            1 Onboarding
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Pilotes', value: '5', icon: '🏢' },
          { label: 'Uptime Moyen', value: '99.6%', icon: '🟢' },
          { label: 'Cout Total/mois', value: '212 EUR', icon: '💰' },
          { label: 'SEO Moyen', value: '86/100', icon: '📈' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{s.label}</span>
              <span className="text-xl">{s.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-500">Site Pilote</th>
                <th className="px-6 py-3 font-medium text-gray-500">Secteur</th>
                <th className="px-6 py-3 font-medium text-gray-500">Statut</th>
                <th className="px-6 py-3 font-medium text-gray-500">LCP</th>
                <th className="px-6 py-3 font-medium text-gray-500">SEO</th>
                <th className="px-6 py-3 font-medium text-gray-500">Cout/mois</th>
                <th className="px-6 py-3 font-medium text-gray-500">Uptime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MOCK_PILOTS.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-gray-500">{p.sector}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? ''}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{p.lcp}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 rounded-full bg-gray-200">
                        <div className="h-2 rounded-full bg-[#F5A623]" style={{ width: `${p.seo}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{p.seo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{p.cost} EUR</td>
                  <td className="px-6 py-4 text-gray-500">{p.uptime > 0 ? `${p.uptime}%` : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
