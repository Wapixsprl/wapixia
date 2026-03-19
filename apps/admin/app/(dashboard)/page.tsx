'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '../../lib/supabase'

interface UserProfile {
  firstName: string
  email: string
}

export default function AdminDashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [orgCount, setOrgCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const supabase = createBrowserClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        setProfile({
          firstName:
            (user.user_metadata?.first_name as string) ??
            (user.user_metadata?.firstName as string) ??
            user.email?.split('@')[0] ??
            'Admin',
          email: user.email ?? '',
        })

        // Fetch organisation count (placeholder - table may not exist yet)
        const { count } = await supabase
          .from('organisations')
          .select('*', { count: 'exact', head: true })

        setOrgCount(count ?? 0)
      }

      setLoading(false)
    }

    void loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#00D4B1]" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenue, {profile?.firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{profile?.email}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">
            SuperAdmin Dashboard
          </h2>
          <p className="mt-2 text-3xl font-bold text-gray-900">{orgCount}</p>
          <p className="mt-1 text-sm text-gray-500">organisations</p>
        </div>
      </div>
    </div>
  )
}
