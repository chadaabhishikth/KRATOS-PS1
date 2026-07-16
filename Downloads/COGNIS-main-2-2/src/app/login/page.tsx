'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Ensure your supabaseBrowser utility invokes createBrowserClient() correctly
    const supabase = supabaseBrowser()
    
    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Force Next.js to drop server-side caches for the incoming route
    router.refresh()
    
    // A micro-timeout forces the JS event loop to yield, giving the 
    // storage/cookie engine an instant to persist the tokens.
    setTimeout(() => {
      router.push('/dashboard')
    }, 100)
  }

  return (
    <div className="max-w-sm mx-auto mt-20 p-6 border rounded-lg">
      <h1 className="text-xl font-bold mb-4">
        {mode === 'login' ? 'Recruiter Login' : 'Create Recruiter Account'}
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={e => setEmail(e.target.value)}
          className="border p-2 rounded" 
          required 
          disabled={loading}
        />
        <input 
          type="password" 
          placeholder="Password (min 6 chars)" 
          value={password} 
          onChange={e => setPassword(e.target.value)}
          className="border p-2 rounded" 
          required 
          minLength={6} 
          disabled={loading}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button 
          type="submit" 
          className="bg-black text-white py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Processing...' : mode === 'login' ? 'Log In' : 'Sign Up'}
        </button>
      </form>
      <button 
        className="text-sm text-blue-600 mt-3 block" 
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        disabled={loading}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
      </button>
    </div>
  )
}
