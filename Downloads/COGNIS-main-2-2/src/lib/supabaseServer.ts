import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getPublicSupabaseUrl, getPublicSupabaseAnonKey } from '@/lib/env'

export async function supabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component render, where cookies can't be
          // mutated. Safe to ignore as long as middleware refreshes the
          // session (see middleware.ts).
        }
      },
    },
  })
}
