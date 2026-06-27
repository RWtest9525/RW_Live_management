import { useState, useEffect } from 'react'
import usePortalStore from '../store/usePortalStore'

function AdminMaintenancePage() {
  const maintenanceActive = usePortalStore((state) => state.maintenanceActive)
  const maintenanceEndTime = usePortalStore((state) => state.maintenanceEndTime)
  const maintenanceMessage = usePortalStore((state) => state.maintenanceMessage)
  const fetchMaintenanceStatus = usePortalStore((state) => state.fetchMaintenanceStatus)
  const updateMaintenanceSettings = usePortalStore((state) => state.updateMaintenanceSettings)
  const theme = usePortalStore((state) => state.theme)

  const [timeInput, setTimeInput] = useState('00:30:00')
  const [messageInput, setMessageInput] = useState(
    'We are improving your experience. Please wait until the maintenance window is complete.'
  )
  const [showConfig, setShowConfig] = useState(true)
  const [timeLeft, setTimeLeft] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    fetchMaintenanceStatus().then((data) => {
      if (data) {
        setMessageInput(data.message)
      }
    })
  }, [fetchMaintenanceStatus])

  // Timer countdown implementation
  useEffect(() => {
    if (!maintenanceActive || !maintenanceEndTime) {
      setTimeLeft('')
      return
    }

    const updateTimer = () => {
      const diff = maintenanceEndTime - Date.now()
      if (diff <= 0) {
        setTimeLeft('00:00:00')
        fetchMaintenanceStatus()
        return
      }

      const totalSecs = Math.floor(diff / 1000)
      const hrs = Math.floor(totalSecs / 3600)
      const mins = Math.floor((totalSecs % 3600) / 60)
      const secs = totalSecs % 60

      const format = (num) => String(num).padStart(2, '0')
      setTimeLeft(`${format(hrs)}:${format(mins)}:${format(secs)}`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [maintenanceActive, maintenanceEndTime, fetchMaintenanceStatus])

  const formatEndTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleString()
  }

  const handlePreset = (durationStr) => {
    setTimeInput(durationStr)
  }

  const handleUpdate = async (activate) => {
    setStatusMessage('')
    const payload = {
      active: activate,
      message: messageInput,
    }
    if (activate) {
      // Validate HH:MM:SS regex
      const regex = /^([0-9]{2}):([0-9]{2}):([0-9]{2})$/
      if (!regex.test(timeInput)) {
        setStatusMessage('Error: Time format must be HH:MM:SS (e.g. 00:30:00)')
        return
      }
      payload.duration = timeInput
    }

    const res = await updateMaintenanceSettings(payload)
    if (res.ok) {
      setStatusMessage(`Maintenance successfully turned ${activate ? 'ON' : 'OFF'}.`)
    } else {
      setStatusMessage(`Error: ${res.error}`)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Title */}
      <h2 className={`mb-6 text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
        Maintenance Mode
      </h2>

      {/* Main Status Card */}
      <div className={`relative overflow-hidden rounded-[2rem] p-6 shadow-xl border ${
        theme === 'dark' 
          ? 'bg-slate-900/60 border-slate-800 shadow-slate-950/40' 
          : 'bg-white border-slate-100 shadow-slate-200/50'
      }`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/5 via-purple-600/5 to-transparent opacity-60" />
        
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Admin Control</p>
              <h3 className={`mt-1 text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                Maintenance is {maintenanceActive ? 'ON' : 'OFF'}
              </h3>
              {maintenanceActive && maintenanceEndTime && (
                <p className="mt-1 text-xs font-bold text-slate-500">
                  Ends: {formatEndTime(maintenanceEndTime)}
                </p>
              )}
            </div>

            {/* Toggle Switch */}
            <button
              onClick={() => handleUpdate(!maintenanceActive)}
              className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-300 focus:outline-none ${
                maintenanceActive ? 'bg-rose-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-7 w-7 transform rounded-full bg-white font-black text-[10px] leading-7 text-center shadow-lg transition-transform duration-300 ${
                maintenanceActive ? 'translate-x-8 text-rose-500' : 'translate-x-1 text-slate-700'
              }`}>
                {maintenanceActive ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Countdown Block (shows if active) */}
          {maintenanceActive && (
            <div className={`mt-2 rounded-2xl border p-5 text-center ${
              theme === 'dark' 
                ? 'bg-slate-950/60 border-slate-800' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Remaining Time</p>
              <p className={`font-mono text-4xl font-bold tracking-wider mt-1 ${theme === 'dark' ? 'text-amber-200' : 'text-blue-600'}`}>
                {timeLeft || '00:00:00'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Accordion Settings Toggle */}
      <div className={`mt-6 rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100'
      }`}>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className={`flex w-full items-center justify-between px-6 py-4 text-sm font-black uppercase tracking-wider ${
            theme === 'dark' ? 'text-slate-300 hover:bg-slate-800/40' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5 text-blue-500 animate-[spin_6s_linear_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure Maintenance Settings
          </span>
          <span className="text-[11px] font-bold lowercase text-slate-400">
            {showConfig ? 'Hide' : '+ Show'}
          </span>
        </button>

        {showConfig && (
          <div className="p-6 border-t border-slate-800/20 space-y-5">
            {/* Timer input */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                Maintenance time (HH:MM:SS)
              </label>
              <input
                type="text"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                placeholder="00:30:00"
                className={`w-full rounded-xl border px-4 py-3 font-mono text-lg font-bold outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'border-slate-700 bg-slate-950 text-white focus:ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-blue-500/10'
                }`}
              />
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                Example: 01:30:00 for 1 hour 30 minutes. Maximum 72:00:00.
              </p>

              {/* Preset buttons */}
              <div className="mt-3 flex gap-2 flex-wrap">
                {[
                  { label: '15m', val: '00:15:00' },
                  { label: '30m', val: '00:30:00' },
                  { label: '1h', val: '01:00:00' },
                  { label: '2h', val: '02:00:00' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handlePreset(item.val)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider border ${
                      theme === 'dark'
                        ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                        : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom message */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                Message for users
              </label>
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                rows={3}
                className={`w-full rounded-xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 ${
                  theme === 'dark'
                    ? 'border-slate-700 bg-slate-950 text-white focus:ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-blue-500/10'
                }`}
              />
            </div>

            {/* Hint box */}
            <div className={`rounded-xl border p-4 text-xs font-bold leading-5 flex items-start gap-3.5 ${
              theme === 'dark'
                ? 'bg-blue-950/20 border-blue-900/40 text-blue-300'
                : 'bg-blue-50 border-blue-100 text-blue-700'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0 mt-0.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>Users will see a full-screen maintenance page with countdown. Admin account will keep working normally.</span>
            </div>

            {/* Control buttons */}
            <div className="flex justify-between items-center gap-4 pt-3 border-t border-slate-800/10">
              <button
                onClick={() => handleUpdate(false)}
                className={`rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-widest border transition ${
                  theme === 'dark'
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Turn Off
              </button>
              <button
                onClick={() => handleUpdate(true)}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition"
              >
                Update Timer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Success/Error status display */}
      {statusMessage && (
        <p className={`mt-4 rounded-xl border px-4 py-3 text-center text-xs font-bold ${
          statusMessage.startsWith('Error')
            ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        }`}>
          {statusMessage}
        </p>
      )}
    </div>
  )
}

export default AdminMaintenancePage
