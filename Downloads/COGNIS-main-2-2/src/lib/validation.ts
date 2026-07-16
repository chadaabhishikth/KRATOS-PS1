/**
 * Shared request-input validation for API routes.
 * Keeping this centralized avoids each route inventing its own
 * (possibly inconsistent, possibly missing) checks.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Pragmatic email check — good enough to reject junk without the false-negative
// footguns of a "perfect" RFC 5322 regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const LIMITS = {
  TITLE_MAX: 200,
  PROMPT_MAX: 5000,
  NAME_MAX: 200,
  EMAIL_MAX: 254,
  OPTION_MAX: 500,
  OPTIONS_MAX_COUNT: 20,
  CODE_MAX: 20000, // guards against abuse / runaway AI-grading cost
  STDIN_MAX: 5000,
  STDOUT_MAX: 5000,
  EVENTS_MAX_COUNT: 5000,
} as const

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= LIMITS.EMAIL_MAX && EMAIL_RE.test(value)
}

/** Trims and enforces a max length. Returns null if empty after trimming or too long. */
export function cleanString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLen) return null
  return trimmed
}

export function isNonEmptyString(value: unknown, maxLen: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLen
}
