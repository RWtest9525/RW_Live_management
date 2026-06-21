import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { AuthField, PasswordToggle } from '../components/AuthField'
import { signupRequest } from '../services/authApi'
import usePortalStore from '../store/usePortalStore'

const countryCodes = {
  india: '+91',
  'united states': '+1',
  usa: '+1',
  us: '+1',
  'united kingdom': '+44',
  uk: '+44',
  canada: '+1',
  bangladesh: '+880',
  pakistan: '+92',
  uae: '+971',
  'united arab emirates': '+971',
  australia: '+61',
  germany: '+49',
  france: '+33',
}

const countryFlags = {
  'india': 'in',
  'united states': 'us',
  'usa': 'us',
  'us': 'us',
  'united kingdom': 'gb',
  'uk': 'gb',
  'england': 'gb',
  'canada': 'ca',
  'bangladesh': 'bd',
  'pakistan': 'pk',
  'united arab emirates': 'ae',
  'uae': 'ae',
  'australia': 'au',
  'germany': 'de',
  'france': 'fr',
}

const getCountryFlag = (country) => {
  const name = (country || '').trim().toLowerCase()
  if (!name) return 'globe'
  
  const matchedKey = Object.keys(countryFlags).find((key) => name.includes(key))
  if (matchedKey) {
    const code = countryFlags[matchedKey]
    return (
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        className="w-5 h-3.5 rounded-sm object-cover inline-block align-middle"
        alt={name}
      />
    )
  }
  return 'globe'
}

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

  const handleCountryChange = (val) => {
    update('country', val)
    const normalized = val.trim().toLowerCase()
    const matched = Object.keys(countryCodes).find((k) => normalized.includes(k))
    if (matched) {
      const code = countryCodes[matched]
      if (!form.phone || !form.phone.startsWith('+')) {
        update('phone', `${code} `)
      }
    }
  }

  const handlePhoneChange = (val) => {
    const normalizedCountry = form.country.trim().toLowerCase()
    const matchedKey = Object.keys(countryCodes).find((k) => normalizedCountry.includes(k))
    
    if (matchedKey) {
      const code = countryCodes[matchedKey]
      let maxDigits = 10
      if (['uae', 'united arab emirates', 'australia', 'france'].includes(matchedKey)) {
        maxDigits = 9
      } else if (matchedKey === 'germany') {
        maxDigits = 11
      }
      
      const valNoSpace = val.replace(/\s+/g, '')
      const codeNoSpace = code.replace(/\s+/g, '')
      
      if (valNoSpace.startsWith(codeNoSpace)) {
        const remaining = valNoSpace.slice(codeNoSpace.length)
        const digitsOnly = remaining.replace(/\D/g, '')
        
        if (digitsOnly.length > maxDigits) {
          return
        }
        
        const formatted = digitsOnly.length > 0 ? `${code} ${digitsOnly}` : `${code} `
        update('phone', formatted)
        return
      }
    }
    
    update('phone', val.slice(0, 16))
  }

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08040d] px-4 py-4 text-white lg:h-screen lg:py-6">
      <div className="absolute -left-20 bottom-0 h-[420px] w-[420px] rounded-full bg-violet-600/30 blur-3xl" />
      <div className="absolute -right-24 top-0 h-[430px] w-[430px] rounded-full bg-amber-400/25 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.05)_0_1px,transparent_1px_34px)]" />

      <section className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/12 bg-white/[0.06] shadow-2xl shadow-black/60 backdrop-blur-2xl lg:grid-cols-[0.82fr_1.18fr]">
        <aside className="hidden min-h-[500px] flex-col justify-between bg-[radial-gradient(circle_at_35%_18%,rgba(255,194,82,0.22),transparent_32%),linear-gradient(145deg,rgba(124,44,255,0.28),rgba(7,4,12,0.94)_58%,rgba(255,178,26,0.12))] p-8 lg:flex">
          <div>
            <div className="inline-flex items-center gap-4 rounded-full border border-white/15 bg-black/25 px-4 py-2.5">
              <Logo className="h-12 w-12" />
              <div>
                <p className="text-base font-black uppercase leading-none tracking-tight">Reviews World</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Access request</p>
              </div>
            </div>
            <p className="auth-cursive mt-6 text-2xl font-bold text-amber-200">Launch your review desk</p>
            <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
              Get approved. Start monitoring. Share proof.
            </h2>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-200/90">
              Your account request goes to admin, then you can manage apps, records, reports, and client proof folders.
            </p>
          </div>
          <div className="space-y-2.5">
            {['Private client reports', 'Google Drive proof links', 'Telegram-ready summaries'].map((item) => (
              <div key={item} className="rounded-xl border border-white/12 bg-white/[0.08] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </aside>

        <form onSubmit={handleSubmit} className="relative p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 lg:hidden">
              <Logo className="h-12 w-12" />
              <div>
                <p className="text-base font-black uppercase leading-none tracking-tight">Reviews World</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-amber-200">Create access</p>
              </div>
            </div>
          </div>

          <p className="auth-cursive text-2xl font-bold text-amber-200">New control room account</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">Create account</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
            Request access for live review monitoring, proof videos, and client reporting.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/20">
            <div className="grid gap-4 md:grid-cols-2">
              <AuthField
                label="Full Name"
                icon="user"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
              />
              <AuthField
                label="Phone Number"
                icon="phone"
                value={form.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+91 ..."
                autoComplete="tel"
                required
              />
              <AuthField
                label="Country"
                icon={getCountryFlag(form.country)}
                value={form.country}
                onChange={(e) => handleCountryChange(e.target.value)}
                placeholder="India"
                autoComplete="country-name"
                required
              />
              <AuthField
                label="Email ID"
                icon="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <AuthField
                label="Password"
                icon="lock"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Create password"
                autoComplete="new-password"
                required
                right={
                  <PasswordToggle
                    visible={showPassword}
                    onClick={() => setShowPassword((value) => !value)}
                    label={showPassword ? 'Hide password' : 'Show password'}
                  />
                }
              />
              <AuthField
                label="Confirm Password"
                icon="lock"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
                right={
                  <PasswordToggle
                    visible={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  />
                }
              />
            </div>
          </div>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200/15 bg-black/20 p-3.5 text-sm font-bold text-slate-200">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-400"
            checked={form.acceptedTerms}
            onChange={(e) => update('acceptedTerms', e.target.checked)}
          />
          <span>
            I accept the{' '}
            <Link className="text-amber-200 hover:text-amber-100" to="/terms-and-conditions">
              Terms and Conditions
            </Link>
          </span>
        </label>

        <button
          type="submit"
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#7c2cff] via-[#b65cff] to-[#ffb21a] py-3 text-[14px] font-black uppercase tracking-[0.16em] text-white shadow-xl shadow-violet-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create My Account'}
        </button>
        {error ? (
          <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-center text-xs font-bold text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col items-center justify-center gap-3 border-t border-white/10 pt-4 text-sm font-bold text-slate-300 sm:flex-row sm:gap-6">
          <Link to="/login" className="text-amber-200 hover:text-amber-100">
            Already have an account?
          </Link>
        </div>
        </form>
      </section>
    </main>
  )
}

export default SignupPage
