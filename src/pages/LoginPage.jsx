import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { AuthField, PasswordToggle } from '../components/AuthField'
import usePortalStore from '../store/usePortalStore'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const login = usePortalStore((state) => state.login)
  const isAuthenticated = usePortalStore((state) => state.isAuthenticated)
  const authLoading = usePortalStore((state) => state.authLoading)
  const authError = usePortalStore((state) => state.authError)
  const location = useLocation()
  const navigate = useNavigate()
  const redirectTo = location.state?.from?.pathname ?? '/dashboard'

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email || !password) return
    const result = await login({ email, password })
    if (result.ok) navigate(redirectTo, { replace: true })
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08040d] px-4 py-4 text-white lg:h-screen lg:py-6">
      <div className="absolute -left-24 top-8 h-[360px] w-[360px] rounded-full bg-violet-600/35 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-[420px] w-[420px] rounded-full bg-amber-400/25 blur-3xl" />
      <div className="absolute left-1/2 top-0 h-[260px] w-[700px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.12),transparent_20%),linear-gradient(135deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_34px)]" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] shadow-2xl shadow-black/60 backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden min-h-[500px] flex-col justify-between bg-[radial-gradient(circle_at_25%_20%,rgba(255,194,82,0.22),transparent_32%),linear-gradient(145deg,rgba(124,44,255,0.28),rgba(7,4,12,0.94)_56%,rgba(255,178,26,0.12))] p-8 lg:flex">
          <div>
            <div className="inline-flex items-center gap-4 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 shadow-xl shadow-black/20">
              <Logo className="h-12 w-12" />
              <div>
                <p className="text-base font-black uppercase leading-none tracking-tight">Reviews World</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Live proof suite</p>
              </div>
            </div>
            <p className="auth-cursive mt-6 text-2xl font-bold text-amber-200">Built for client-ready proof</p>
            <h2 className="mt-3 max-w-md text-3xl font-black leading-[1.05] tracking-tight text-white">
              Review tracking that looks sharp before it works hard.
            </h2>
            <p className="mt-4 max-w-md text-sm font-semibold leading-6 text-slate-200/90">
              Sync live reviews, generate proof recordings, and send clean reports from one secured command room.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Live', 'Review sync'],
              ['Proof', 'HD recording'],
              ['Drive', 'Auto upload'],
            ].map(([title, caption]) => (
              <div key={title} className="rounded-2xl border border-white/12 bg-white/[0.08] p-3 shadow-lg shadow-black/20">
                <p className="text-lg font-black text-white">{title}</p>
                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{caption}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative p-6 sm:p-8 lg:p-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo className="h-12 w-12" />
              <div>
                <p className="text-base font-black uppercase leading-none tracking-tight">Reviews World</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200">Secure portal</p>
              </div>
            </div>
            <span className="ml-auto rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              System live
            </span>
          </div>

          <p className="auth-cursive text-2xl font-bold text-amber-200">Welcome back, captain</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Login to your portal</h1>
          <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-300">
            Manage campaigns, proof videos, clients, payments, and Drive reports.
          </p>

          <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/20">
            <AuthField
              label="Email"
              icon="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
            <AuthField
              label="Password"
              icon="lock"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              right={
                <PasswordToggle
                  visible={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  label={showPassword ? 'Hide password' : 'Show password'}
                />
              }
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 text-[14px]">
            <Link to="/forgot-password" className="font-bold text-amber-200 hover:text-amber-100">
              Forgot password?
            </Link>
            <Link to="/signup" className="font-bold text-slate-300 hover:text-white">
              Create account
            </Link>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#7c2cff] via-[#d158ff] to-[#ffb21a] py-3 text-[14px] font-black uppercase tracking-[0.16em] text-white shadow-xl shadow-violet-950/40 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {authLoading ? 'Logging in...' : 'Login to Dashboard'}
          </button>

          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Protected local command panel
          </p>

          {authError ? (
            <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200">
              {authError}
            </p>
          ) : null}
        </form>
      </section>
    </main>
  )
}

export default LoginPage
