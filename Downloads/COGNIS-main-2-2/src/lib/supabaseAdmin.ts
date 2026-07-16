import { createClient } from '@supabase/supabase-js'
import { getPublicSupabaseUrl, getSupabaseServiceRoleKey } from '@/lib/env'

/**
 * Service-role client — bypasses Row Level Security entirely.
 * NEVER import this file from a 'use client' component, and never send
 * its key to the browser. Every route that uses this client MUST perform
 * its own authorization check (see assertOwnership()-style checks in the
 * API routes) since RLS is not there to protect it.
 */
export function supabaseAdmin() {
  return createClient(getPublicSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false },
  })
}
