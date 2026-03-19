'use client'

import { useRouter } from 'next/navigation'
import { LoginForm } from '@wapixia/ui'
import { createBrowserClient } from '../../../lib/supabase'

export default function ResellerLoginPage() {
  const router = useRouter()

  async function handleLogin(email: string, password: string) {
    const supabase = createBrowserClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    router.push('/')
    router.refresh()
  }

  return (
    <LoginForm
      onSubmit={handleLogin}
      title="Espace Revendeur"
      subtitle="Connectez-vous à votre espace revendeur"
      brandColor="#00D4B1"
    />
  )
}
