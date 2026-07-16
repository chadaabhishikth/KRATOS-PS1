import { createBrowserClient } from '@supabase/ssr'
import { getPublicSupabaseUrl, getPublicSupabaseAnonKey } from '@/lib/env'

export function supabaseBrowser() {
  return createBrowserClient(getPublicSupabaseUrl(), getPublicSupabaseAnonKey())
}
