function Logo({ className = "h-10 w-10" }) {
  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
      <div className="relative h-full aspect-square overflow-hidden rounded-full border border-slate-700 bg-black p-[5%] shadow-md">
        <img 
          src="/logo.png" 
          alt="Reviews World" 
          className="h-full w-full rounded-full object-contain"
          onLoad={(e) => {
            if (e.target.naturalWidth <= 1) {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }
          }}
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'flex'
          }}
        />
        <div style={{ display: 'none' }} className="h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-violet-700 via-slate-950 to-amber-500 text-white font-black">
          <svg viewBox="0 0 100 100" className="h-2/3 w-2/3">
            <path 
              fill="currentColor" 
              d="M20 20 L40 20 L50 50 L60 20 L80 20 L65 80 L35 80 Z" 
            />
            <path 
              fill="rgba(255,255,255,0.5)" 
              d="M10 30 L30 30 L40 60 L50 30 L70 30 L55 90 L25 90 Z" 
              transform="translate(10, -5)"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default Logo
