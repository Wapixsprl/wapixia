'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '../../lib/supabase'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar placeholder */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <span className="text-lg font-bold" style={{ color: '#00D4B1' }}>
            WapixIA
          </span>
          <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900">
            Dashboard
          </div>
          {/* Additional nav items will be added in future sprints */}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  )
}
