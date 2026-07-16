'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Assessment {
    id: string
    title: string
    recruiter_id: string
}

export default function Dashboard() {
    const router = useRouter()
    const [assessments, setAssessments] = useState<Assessment[]>([])
    const [title, setTitle] = useState('')
    const [selected, setSelected] = useState<string | null>(null)
    const [qType, setQType] = useState<'mcq' | 'code'>('mcq')
    const [prompt, setPrompt] = useState('')
    const [options, setOptions] = useState('A,B,C,D')
    const [correct, setCorrect] = useState('A')
    const [language, setLanguage] = useState('python')
    const [starter, setStarter] = useState('')
    const [testInput, setTestInput] = useState('')
    const [expected, setExpected] = useState('')
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        const res = await fetch('/api/assessments')
        if (res.status === 401) {
            router.push('/login')
            return
        }
        if (res.ok) {
            const data = await res.json()
            setAssessments(data)
        } else {
            setError('Failed to load assessments')
        }
    }, [router])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load()
    }, [load])

    async function createAssessment(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        const res = await fetch('/api/assessments', { method: 'POST', body: JSON.stringify({ title }), headers: { 'content-type': 'application/json' } })
        if (res.ok) {
            setTitle('')
            load()
        } else {
            const data = await res.json().catch(() => ({}))
            setError(data.error ?? 'Failed to create assessment')
        }
    }

    async function addQuestion(e: React.FormEvent) {
        e.preventDefault()
        if (!selected) return
        setError('')
        const body = qType === 'mcq'
            ? { type: 'mcq', prompt, options: options.split(',').map(o => o.trim()).filter(Boolean), correct_answer: correct.trim() }
            : { type: 'code', prompt, language, starter_code: starter, test_input: testInput, expected_output: expected }
        const res = await fetch(`/api/assessments/${selected}/questions`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })
        if (res.ok) {
            setPrompt('')
            setStarter('')
            setTestInput('')
            setExpected('')
        } else {
            const data = await res.json().catch(() => ({}))
            setError(data.error ?? 'Failed to add question')
        }
    }

    return (
        <div className="max-w-2xl mx-auto mt-10 p-4">
            <h1 className="text-xl font-bold mb-4">Your Assessments</h1>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={createAssessment} className="flex gap-2 mb-6">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="New assessment title" className="border p-2 rounded flex-1" required />
                <button className="bg-black text-white px-4 rounded">Create</button>
            </form>

            <ul className="mb-6">
                {assessments.map(a => (
                    <li key={a.id} className="flex justify-between items-center border-b py-2">
                        <span onClick={() => setSelected(a.id)} className="cursor-pointer">{a.title}</span>
                        <a className="text-blue-600 text-sm" href={`/exam/${a.id}`} target="_blank">candidate link ↗</a>
                    </li>
                ))}
            </ul>

            {selected && (
                <div className="border rounded p-4">
                    <h2 className="font-bold mb-2">Add question to selected assessment</h2>
                    <form onSubmit={addQuestion} className="flex flex-col gap-2">
                        <select value={qType} onChange={e => setQType(e.target.value as 'mcq' | 'code')} className="border p-2 rounded">
                            <option value="mcq">Multiple Choice</option>
                            <option value="code">Code</option>
                        </select>
                        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Question prompt" className="border p-2 rounded" required />
                        {qType === 'mcq' ? (
                            <>
                                <input value={options} onChange={e => setOptions(e.target.value)} placeholder="Options comma-separated" className="border p-2 rounded" />
                                <input value={correct} onChange={e => setCorrect(e.target.value)} placeholder="Correct answer" className="border p-2 rounded" />
                            </>
                        ) : (
                            <>
                                <select value={language} onChange={e => setLanguage(e.target.value)} className="border p-2 rounded">
                                    <option value="python">Python</option>
                                    <option value="javascript">JavaScript</option>
                                </select>
                                <textarea value={starter} onChange={e => setStarter(e.target.value)} placeholder="Starter code" className="border p-2 rounded font-mono text-sm" />
                                <input value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="Test stdin (optional)" className="border p-2 rounded" />
                                <input value={expected} onChange={e => setExpected(e.target.value)} placeholder="Expected stdout" className="border p-2 rounded" required />
                            </>
                        )}
                        <button className="bg-black text-white py-2 rounded">Add Question</button>
                    </form>
                </div>
            )}
        </div>
    )
}