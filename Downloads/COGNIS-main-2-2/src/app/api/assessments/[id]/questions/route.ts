import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cleanString, isUuid, LIMITS } from '@/lib/validation'

const QUESTION_TYPES = ['mcq', 'code'] as const
type QuestionType = typeof QUESTION_TYPES[number]

const LANGUAGES = ['python', 'javascript'] as const

async function assertOwnership(assessmentId: string, userId: string) {
  const admin = supabaseAdmin()
  const { data } = await admin
    .from('assessments')
    .select('recruiter_id')
    .eq('id', assessmentId)
    .single()
  return data?.recruiter_id === userId
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid assessment id' }, { status: 400 })

    const supabase = await supabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await assertOwnership(id, user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const type = body?.type as QuestionType
    if (!QUESTION_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${QUESTION_TYPES.join(', ')}` }, { status: 400 })
    }

    const prompt = cleanString(body?.prompt, LIMITS.PROMPT_MAX)
    if (!prompt) {
      return NextResponse.json({ error: `Missing or invalid prompt (max ${LIMITS.PROMPT_MAX} chars)` }, { status: 400 })
    }

    const insertPayload: Record<string, unknown> = {
      assessment_id: id,
      type,
      prompt,
      options: null,
      correct_answer: null,
      language: null,
      starter_code: null,
      test_input: null,
      expected_output: null,
    }

    if (type === 'mcq') {
      const rawOptions = body?.options
      if (!Array.isArray(rawOptions) || rawOptions.length < 2 || rawOptions.length > LIMITS.OPTIONS_MAX_COUNT) {
        return NextResponse.json({ error: `options must be an array of 2-${LIMITS.OPTIONS_MAX_COUNT} strings` }, { status: 400 })
      }
      const options = rawOptions.map((o) => cleanString(o, LIMITS.OPTION_MAX))
      if (options.some((o) => o === null)) {
        return NextResponse.json({ error: `Each option must be a non-empty string (max ${LIMITS.OPTION_MAX} chars)` }, { status: 400 })
      }
      const correctAnswer = cleanString(body?.correct_answer, LIMITS.OPTION_MAX)
      if (!correctAnswer || !options.includes(correctAnswer)) {
        return NextResponse.json({ error: 'correct_answer must match one of the provided options' }, { status: 400 })
      }
      insertPayload.options = options
      insertPayload.correct_answer = correctAnswer
    } else {
      const language = LANGUAGES.includes(body?.language as typeof LANGUAGES[number])
        ? body.language
        : 'python'
      const expectedOutput = cleanString(body?.expected_output, LIMITS.STDOUT_MAX)
      if (!expectedOutput) {
        return NextResponse.json({ error: `Missing or invalid expected_output (max ${LIMITS.STDOUT_MAX} chars)` }, { status: 400 })
      }
      const starterCode = typeof body?.starter_code === 'string' ? body.starter_code.slice(0, LIMITS.CODE_MAX) : null
      const testInput = typeof body?.test_input === 'string' ? body.test_input.slice(0, LIMITS.STDIN_MAX) : null

      insertPayload.language = language
      insertPayload.starter_code = starterCode
      insertPayload.test_input = testInput
      insertPayload.expected_output = expectedOutput
    }

    const admin = supabaseAdmin()
    const { data, error } = await admin.from('questions').insert(insertPayload).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Intentionally public/unauthenticated: candidates taking an exam are not
// logged in, and only ever know the exam's assessment id. correct_answer
// and expected_output are stripped below so this never leaks grading data.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid assessment id' }, { status: 400 })

    const admin = supabaseAdmin()
    const { data, error } = await admin
      .from('questions')
      .select('*')
      .eq('assessment_id', id)
      .order('order_index')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const safe = (data ?? []).map((q: Record<string, unknown>) => {
      const rest = { ...q }
      delete rest.correct_answer
      delete rest.expected_output
      return rest
    })
    return NextResponse.json(safe)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
