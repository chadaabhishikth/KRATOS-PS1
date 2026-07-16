'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@monaco-editor/react'

interface Question {
    id: string
    prompt: string
    type: 'mcq' | 'code'
    options?: string[]
    starter_code?: string
    language?: string
}

export default function Exam() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [started, setStarted] = useState(false)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [attemptId, setAttemptId] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [error, setError] = useState('')
    const [starting, setStarting] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const events = useRef<{ type: string; ts: number }[]>([])

    useEffect(() => {
        if (!started) return
        fetch(`/api/assessments/${id}/questions`)
            .then(r => r.json())
            .then((qs: unknown) => {
                if (!Array.isArray(qs)) {
                    setError('Could not load questions for this assessment.')
                    return
                }
                setQuestions(qs)
                const init: Record<string, string> = {}
                qs.forEach((q: Question) => { init[q.id] = q.starter_code ?? '' })
                setAnswers(init)
            })
            .catch(() => setError('Could not load questions for this assessment.'))
        function onBlur() { events.current.push({ type: 'blur', ts: Date.now() }) }
        function onPaste() { events.current.push({ type: 'paste', ts: Date.now() }) }
        window.addEventListener('blur', onBlur)
        window.addEventListener('paste', onPaste)
        return () => { window.removeEventListener('blur', onBlur); window.removeEventListener('paste', onPaste) }
    }, [started, id])

    async function startExam(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setStarting(true)
        try {
            const res = await fetch('/api/attempts', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ assessment_id: id, candidate_name: name, candidate_email: email }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.id) {
                setError(data.error ?? 'Could not start the assessment. Please try again.')
                return
            }
            setAttemptId(data.id)
            setStarted(true)
        } catch {
            setError('Network error — please check your connection and try again.')
        } finally {
            setStarting(false)
        }
    }

    async function submit() {
        if (!attemptId || submitting) return
        setSubmitting(true)
        setError('')
        try {
            const res = await fetch(`/api/attempts/${attemptId}/submit`, {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ answers, events: events.current }),
            })
            if (res.ok) {
                router.push(`/results/${attemptId}`)
            } else {
                const data = await res.json().catch(() => ({}))
                setError(data.error ?? 'Submission failed. Please try again.')
                setSubmitting(false)
            }
        } catch {
            setError('Network error — please check your connection and try again.')
            setSubmitting(false)
        }
    }

    if (!started) return (
        <div className="max-w-sm mx-auto mt-20 p-6 border rounded-lg">
            <h1 className="text-xl font-bold mb-4">Start Assessment</h1>
            <form onSubmit={startExam} className="flex flex-col gap-3">
                <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} className="border p-2 rounded" required disabled={starting} maxLength={200} />
                <input placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded" required disabled={starting} maxLength={254} />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button className="bg-black text-white py-2 rounded disabled:opacity-50" disabled={starting}>
                    {starting ? 'Starting…' : 'Begin'}
                </button>
            </form>
        </div>
    )

    return (
        <div className="max-w-3xl mx-auto mt-10 p-4">
            {questions.map(q => (
                <div key={q.id} className="mb-8 border-b pb-6">
                    <p className="font-semibold mb-2">{q.prompt}</p>
                    {q.type === 'mcq' ? (
                        <div className="flex flex-col gap-1">
                            {q.options?.map((opt: string) => (
                                <label key={opt} className="flex gap-2 items-center">
                                    <input type="radio" name={q.id} value={opt}
                                        checked={answers[q.id] === opt}
                                        onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))} />
                                    {opt}
                                </label>
                            ))}
                        </div>
                    ) : (
                        <Editor height="250px" language={q.language ?? 'python'} value={answers[q.id]}
                            onChange={v => setAnswers(a => ({ ...a, [q.id]: v ?? '' }))} theme="vs-dark" />
                    )}
                </div>
            ))}
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <button onClick={submit} className="bg-black text-white px-6 py-2 rounded disabled:opacity-50" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Assessment'}
            </button>
        </div>
    )
}