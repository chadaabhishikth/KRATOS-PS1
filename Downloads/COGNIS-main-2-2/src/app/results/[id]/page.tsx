'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Attempt {
    id: string
    score: number
    max_score: number
    risk_score: number
    ai_feedback: string
    submitted_at?: string
}

export default function Results() {
    const { id } = useParams<{ id: string }>()
    const [attempt, setAttempt] = useState<Attempt | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        fetch(`/api/attempts/${id}`)
            .then(async r => {
                const data = await r.json().catch(() => ({}))
                if (!r.ok) throw new Error(data.error ?? 'Failed to load results')
                setAttempt(data)
            })
            .catch(e => setError(e.message ?? 'Failed to load results'))
    }, [id])

    if (error) return <p className="text-center mt-20 text-red-600">{error}</p>
    if (!attempt) return <p className="text-center mt-20">Loading...</p>

    const riskLabel = attempt.risk_score > 0.5 ? 'High' : attempt.risk_score > 0.2 ? 'Medium' : 'Low'
    const riskColor = attempt.risk_score > 0.5 ? 'bg-red-100 text-red-700' : attempt.risk_score > 0.2 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'

    return (
        <div className="max-w-xl mx-auto mt-16 p-6 border rounded-lg">
            <h1 className="text-xl font-bold mb-2">Assessment Complete</h1>
            <p className="mb-2">Score: {attempt.score} / {attempt.max_score}</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${riskColor}`}>
                Risk: {riskLabel} ({(attempt.risk_score * 100).toFixed(0)}%)
            </span>
            <div className="mt-4">
                <h2 className="font-semibold mb-1">AI Feedback</h2>
                <p className="text-sm text-gray-700">{attempt.ai_feedback}</p>
            </div>
        </div>
    )
}