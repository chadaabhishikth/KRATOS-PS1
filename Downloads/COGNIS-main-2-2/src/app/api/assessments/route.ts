import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { cleanString, LIMITS } from '@/lib/validation'
import { checkRateLimit } from '@/lib/rateLimit'

export async function GET() {
    try {
        const supabase = await supabaseServer()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = supabaseAdmin()
        const { data, error } = await admin
            .from('assessments')
            .select('*')
            .eq('recruiter_id', user.id)
            .order('id') // TODO: switch to .order('created_at') once that column exists

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data ?? [])
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await supabaseServer()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Recruiters are authenticated, but still rate-limit assessment
        // creation so a compromised/malicious session can't mass-spam rows.
        const rl = checkRateLimit(`create-assessment:${user.id}`, { limit: 20, windowMs: 60_000 })
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Too many requests, please slow down' }, { status: 429 })
        }

        let body: unknown
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const title = cleanString((body as { title?: unknown })?.title, LIMITS.TITLE_MAX)
        if (!title) {
            return NextResponse.json({ error: `Missing or invalid title (max ${LIMITS.TITLE_MAX} chars)` }, { status: 400 })
        }

        const admin = supabaseAdmin()
        const { data, error } = await admin
            .from('assessments')
            .insert({
                title,
                recruiter_id: user.id
            })
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
