/**
 * Centralized environment variable access.
 *
 * Using `process.env.X!` scattered across the codebase means a missing
 * variable fails deep inside a Supabase call with a confusing error.
 * These helpers fail fast, at the call site, with a message that says
 * exactly what's missing.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check your .env.local file.`
    )
  }
  return value
}

/** Safe to use in browser code — must be prefixed NEXT_PUBLIC_. */
export function getPublicSupabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL')
}

export function getPublicSupabaseAnonKey(): string {
  return required('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

/** Server-only. Never import this from a 'use client' file. */
export function getSupabaseServiceRoleKey(): string {
  if (typeof window !== 'undefined') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must never be accessed from the browser')
  }
  return required('SUPABASE_SERVICE_ROLE_KEY')
}

/** Server-only. Returns null (feature disabled) instead of throwing, since AI grading is optional. */
export function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null
}
