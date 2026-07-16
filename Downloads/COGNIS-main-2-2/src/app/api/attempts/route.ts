import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cleanString, isUuid, isValidEmail, LIMITS } from '@/lib/validation'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

// POST /api/attempts
// Public/unauthenticated: this is how a candidate starts an exam.
export async function POST(req: NextRequest) {
    try {
        const ip = getClientIp(req)
        const rl = checkRateLimit(`start-attempt:${ip}`, { limit: 10, windowMs: 60_000 })
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 })
        }

        let body: Record<string, unknown>
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const assessmentId = body?.assessment_id
        const candidateName = cleanString(body?.candidate_name, LIMITS.NAME_MAX)
        const candidateEmail = cleanString(body?.candidate_email, LIMITS.EMAIL_MAX)

        if (!isUuid(assessmentId) || !candidateName || !candidateEmail) {
            return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
        }
        if (!isValidEmail(candidateEmail)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
        }

        const admin = supabaseAdmin()

        // Validate assessment exists in database
        const { data: assessment, error: assessErr } = await admin
            .from('assessments')
            .select('id')
            .eq('id', assessmentId)
            .single()

        if (assessErr || !assessment) {
            return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
        }

        const { data, error } = await admin
            .from('attempts')
            .insert({ assessment_id: assessmentId, candidate_name: candidateName, candidate_email: candidateEmail })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
