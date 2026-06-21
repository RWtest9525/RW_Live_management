const icons = {
  email: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.94 6.34A2 2 0 014.62 5h10.76a2 2 0 011.68 1.34L10 10.71 2.94 6.34z" />
      <path d="M18 8.12l-7.48 4.63a1 1 0 01-1.04 0L2 8.12V13a2 2 0 002 2h12a2 2 0 002-2V8.12z" />
    </svg>
  ),
  lock: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 8V7a5 5 0 0110 0v1a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm2 0h6V7a3 3 0 00-6 0v1z" clipRule="evenodd" />
    </svg>
  ),
  user: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  ),
  phone: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 3a1 1 0 011-1h2.15a1 1 0 01.98.8l.74 3.7a1 1 0 01-.27.92L5.4 8.62a11.04 11.04 0 005.98 5.98l1.2-1.2a1 1 0 01.92-.27l3.7.74a1 1 0 01.8.98V17a1 1 0 01-1 1h-1C8.27 18 2 11.73 2 4V3z" />
    </svg>
  ),
  globe: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.93-9h-2.02a13.7 13.7 0 00-.55-3.04A6.02 6.02 0 0113.93 9zM10 4.06c.34.5.75 1.45.95 2.94h-1.9c.2-1.49.61-2.44.95-2.94zM8.74 5.96A13.7 13.7 0 008.09 9H6.07a6.02 6.02 0 012.67-3.04zM6.07 11h2.02c.12 1.17.35 2.2.65 3.04A6.02 6.02 0 016.07 11zm2.98 2h1.9c-.2 1.49-.61 2.44-.95 2.94-.34-.5-.75-1.45-.95-2.94zm2.31 1.04c.3-.84.53-1.87.65-3.04h2.02a6.02 6.02 0 01-2.67 3.04z" clipRule="evenodd" />
    </svg>
  ),
}

export function AuthField({ label, icon = 'email', right = null, className = '', ...inputProps }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2.5 block text-xs font-black uppercase tracking-[0.18em] text-slate-200">
        {label}
      </span>
      <span className="group flex items-center rounded-2xl border border-slate-600/70 bg-slate-900/90 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all focus-within:border-amber-300 focus-within:bg-slate-900 focus-within:ring-4 focus-within:ring-amber-300/15">
        <span className="mr-3 text-slate-300 transition-colors group-focus-within:text-amber-300">
          {icons[icon]}
        </span>
        <input
          {...inputProps}
          className="min-h-12 w-full bg-transparent text-base font-bold text-white outline-none placeholder:font-semibold placeholder:text-slate-500 sm:text-[17px]"
        />
        {right}
      </span>
    </label>
  )
}

export function PasswordToggle({ visible, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-3 rounded-xl p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-amber-200"
      aria-label={label}
    >
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-2.24-2.24A10.12 10.12 0 0019 10s-3.5-6-9-6c-1.46 0-2.79.42-3.94 1.05L3.28 2.22zM7.53 6.47l1.55 1.55A2 2 0 0112 10c0 .28-.06.54-.16.78l1.2 1.2A4 4 0 007.53 6.47z" clipRule="evenodd" />
          <path d="M3.65 6.48A10.24 10.24 0 001 10s3.5 6 9 6c.97 0 1.88-.19 2.72-.5l-2.03-2.03A4 4 0 016.53 9.31L3.65 6.48z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 4C4.5 4 1 10 1 10s3.5 6 9 6 9-6 9-6-3.5-6-9-6zm0 9a3 3 0 110-6 3 3 0 010 6z" />
          <path d="M10 11.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
        </svg>
      )}
    </button>
  )
}
