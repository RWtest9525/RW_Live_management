import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const login = usePortalStore((state) => state.login)
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const authLoading = usePortalStore((state) => state.authLoading)
  const authError = usePortalStore((state) => state.authError)
  const navigate = useNavigate()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email || !password) return
    const result = await login({ email, password })
    if (result.ok) navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white">Review World Login</h1>
        <p className="mt-1 text-sm text-slate-400">Secure access to business dashboard</p>
        <div className="mt-5 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
            placeholder="Email"
          />
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="rounded-lg bg-slate-700 px-3 text-sm text-white"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <button type="submit" className="mt-5 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-500">
          {authLoading ? 'Logging in...' : 'Login to Dashboard'}
        </button>
        {authError ? <p className="mt-3 text-sm text-rose-400">{authError}</p> : null}
        <p className="mt-4 text-sm text-slate-300">
          New user?{' '}
          <Link to="/signup" className="text-blue-400 underline">
            Create account
          </Link>
        </p>
      </form>
    </div>
  )
}

export default LoginPage
