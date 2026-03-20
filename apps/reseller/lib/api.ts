import { createBrowserClient } from './supabase'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010'

export async function apiClient<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const supabase = createBrowserClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(
      (body as { message?: string }).message ??
        `Erreur API ${res.status}`,
    )
  }

  return res.json() as Promise<T>
}
