import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/validation'

// GET /api/attempts/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        if (!isUuid(id)) return NextResponse.json({ error: 'Invalid attempt id' }, { status: 400 })

        const admin = supabaseAdmin()

        // Fetch attempt details
        const { data: attempt, error: attemptError } = await admin
            .from('attempts')
            .select('*')
            .eq('id', id)
            .single()

        if (attemptError || !attempt) {
            return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
        }

        // Authenticate user to see if they are a recruiter
        const supabase = await supabaseServer()
        let isOwner = false

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: assessment } = await admin
                    .from('assessments')
                    .select('recruiter_id')
                    .eq('id', attempt.assessment_id)
                    .single()

                if (assessment && assessment.recruiter_id === user.id) {
                    isOwner = true
                }
            }
        } catch {
            // If auth check fails, treat as candidate (isOwner = false)
        }

        if (isOwner) {
            // Recruiter who owns the assessment can view all fields
            return NextResponse.json(attempt)
        }

        // Candidates can only view a restricted public result set to prevent email/answer leakage
        const safeAttempt = {
            id: attempt.id,
            score: attempt.score,
            max_score: attempt.max_score,
            risk_score: attempt.risk_score,
            ai_feedback: attempt.ai_feedback,
            submitted_at: attempt.submitted_at,
        }

        return NextResponse.json(safeAttempt)
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
