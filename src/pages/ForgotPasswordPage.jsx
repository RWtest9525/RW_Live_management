import { useState } from 'react'
import { Link } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'
import { requestPasswordReset } from '../services/authApi'
import Logo from '../components/Logo'

function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [passwordType, setPasswordType] = useState('standard')
  const [step, setStep] = useState(1)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const theme = usePortalStore((state) => state.theme)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const res = await requestPasswordReset({ identifier, passwordType, step })
      if (res.step === 2) {
        setStep(2)
        setMessage('User found. Please select password type.')
      } else {
        setMessage(res.message || 'Your password reset request was sent to admin. After approval, admin will share your temporary password on WhatsApp or email.')
        setStep(3) // Success state
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`flex min-h-screen items-center justify-center p-6 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`w-full max-w-md rounded-3xl border p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-500 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Logo className="h-20 w-20" />
          </div>
          <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {step === 3 ? 'Request Sent' : 'Forgot Password?'}
          </h2>
          <p className={`mt-2 text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {step === 1 && "Enter your Email or Phone"}
            {step === 2 && "Choose your password type"}
            {step === 3 && "Admin will share temporary password"}
          </p>
        </div>

        {step < 3 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {step === 1 && (
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Email or Phone Number</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-600' : 'border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400'}`}
                  placeholder="Email or Phone"
                  required
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">New Password Type</label>
                <select
                  value={passwordType}
                  onChange={(e) => setPasswordType(e.target.value)}
                  className={`w-full rounded-xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
                >
                  <option value="standard">Standard</option>
                  <option value="temporary">Temporary</option>
                  <option value="secure">Secure</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all transform active:scale-95 disabled:bg-blue-300"
            >
              {loading ? 'Processing...' : step === 1 ? 'Verify User' : 'Send Request'}
            </button>
          </form>
        )}

        {message && (
          <div className="mt-6 rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/20">
            <p className="text-center text-sm font-bold text-emerald-500">{message}</p>
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-xl bg-rose-500/10 p-4 border border-rose-500/20">
            <p className="text-center text-sm font-bold text-rose-500">{error}</p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className={`text-sm font-black uppercase tracking-widest transition-all hover:text-blue-500 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
