import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import { signupRequest } from '../services/authApi'

function SignupPage() {
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    phone: '',
    country: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('Password and confirm password must match.')
      return
    }
    if (!form.acceptedTerms) {
      setError('Please accept Terms and Conditions.')
      return
    }

    setLoading(true)
    try {
      await signupRequest(form)
      navigate('/login')
    } catch (signupError) {
      setError(signupError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        <h1 className="text-2xl font-bold text-white">Create Account</h1>
        <p className="mt-1 text-sm text-slate-400">Start your Review World access</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500" placeholder="Name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
          <input className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500" placeholder="Phone Number" value={form.phone} onChange={(e) => update('phone', e.target.value)} required />
          <input className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500" placeholder="Country" value={form.country} onChange={(e) => update('country', e.target.value)} required />
          <input type="email" className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500" placeholder="Email ID" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              placeholder="Password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="rounded-lg bg-slate-700 px-3 text-sm text-white">
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              placeholder="Confirm Password"
              value={form.confirmPassword}
              onChange={(e) => update('confirmPassword', e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="rounded-lg bg-slate-700 px-3 text-sm text-white">
              {showConfirmPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(e) => update('acceptedTerms', e.target.checked)}
          />
          I have read all{' '}
          <a className="text-blue-400 underline" href="/terms-and-conditions" target="_blank" rel="noreferrer">
            Terms and Conditions
          </a>
        </label>

        <button
          type="submit"
          className="mt-5 w-full rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-500"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        <p className="mt-4 text-sm text-slate-300">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  )
}

export default SignupPage
