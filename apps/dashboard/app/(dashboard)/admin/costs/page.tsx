'use client'

const COST_CATEGORIES = [
  { label: 'Infrastructure (Coolify/VPS)', amount: 89, trend: '+2%', color: '#3B82F6' },
  { label: 'IA (Claude API)', amount: 67, trend: '-5%', color: '#8B5CF6' },
  { label: 'Supabase (DB + Auth)', amount: 25, trend: '0%', color: '#10B981' },
  { label: 'Email (Brevo)', amount: 15, trend: '+1%', color: '#F59E0B' },
  { label: 'DNS (Cloudflare)', amount: 0, trend: '0%', color: '#6366F1' },
  { label: 'Monitoring', amount: 16, trend: '0%', color: '#EC4899' },
]

const COST_PER_SITE = [
  { site: 'Boulangerie Martin', ai: 12, infra: 18, email: 3, total: 33 },
  { site: 'Salon Beaute Liege', ai: 18, infra: 18, email: 5, total: 41 },
  { site: 'Pizza Napoli', ai: 5, infra: 5, email: 0, total: 10 },
  { site: 'Immo Bruxelles', ai: 22, infra: 18, email: 4, total: 44 },
  { site: 'Dr. Dupont', ai: 10, infra: 18, email: 3, total: 31 },
]

export default function CostsPage() {
  const total = COST_CATEGORIES.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Couts & Budget</h1>
        <p className="mt-1 text-sm text-gray-500">Suivi financier mensuel de l'infrastructure WapixIA</p>
      </div>

      {/* Total + KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border-2 border-[#F5A623]/30 bg-[#F5A623]/5 p-5">
          <span className="text-sm text-gray-500">Cout Total / mois</span>
          <p className="mt-2 text-3xl font-bold text-gray-900">{total} EUR</p>
          <p className="mt-1 text-xs text-gray-400">5 sites actifs</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-gray-500">Cout Moyen / site</span>
          <p className="mt-2 text-2xl font-bold text-gray-900">{Math.round(total / 5)} EUR</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-gray-500">Budget Mensuel</span>
          <p className="mt-2 text-2xl font-bold text-gray-900">300 EUR</p>
          <div className="mt-2 h-2 rounded-full bg-gray-200">
            <div className="h-2 rounded-full bg-[#F5A623]" style={{ width: `${Math.min((total / 300) * 100, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-400">{Math.round((total / 300) * 100)}% utilise</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <span className="text-sm text-gray-500">Marge Restante</span>
          <p className="mt-2 text-2xl font-bold text-green-600">{300 - total} EUR</p>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Repartition des couts</h2>
        <div className="space-y-3">
          {COST_CATEGORIES.map((cat) => (
            <div key={cat.label} className="flex items-center gap-4">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="w-52 text-sm text-gray-700">{cat.label}</span>
              <div className="flex-1">
                <div className="h-6 rounded bg-gray-100">
                  <div
                    className="flex h-6 items-center rounded px-2 text-xs font-medium text-white"
                    style={{ width: `${Math.max((cat.amount / total) * 100, 8)}%`, backgroundColor: cat.color }}
                  >
                    {cat.amount} EUR
                  </div>
                </div>
              </div>
              <span className={`text-xs font-medium ${cat.trend.startsWith('+') ? 'text-red-500' : cat.trend.startsWith('-') ? 'text-green-500' : 'text-gray-400'}`}>
                {cat.trend}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost per Site */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Cout par site</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">Site</th>
              <th className="px-6 py-3 font-medium text-gray-500">IA</th>
              <th className="px-6 py-3 font-medium text-gray-500">Infra</th>
              <th className="px-6 py-3 font-medium text-gray-500">Email</th>
              <th className="px-6 py-3 font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {COST_PER_SITE.map((s) => (
              <tr key={s.site} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{s.site}</td>
                <td className="px-6 py-4 text-gray-500">{s.ai} EUR</td>
                <td className="px-6 py-4 text-gray-500">{s.infra} EUR</td>
                <td className="px-6 py-4 text-gray-500">{s.email} EUR</td>
                <td className="px-6 py-4 font-semibold text-gray-900">{s.total} EUR</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
