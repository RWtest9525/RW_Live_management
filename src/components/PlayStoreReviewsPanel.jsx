export default function PlayStoreReviewsPanel({
  appName = 'App',
  appIcon,
  showCloseButton = false,
  onClose,
  children,
  footer,
}) {
  return (
    <div
      className="bg-white text-[#202124] antialiased"
      style={{ fontFamily: "'Roboto', system-ui, -apple-system, sans-serif" }}
    >
      <header className="border-b border-[#e8eaed] px-4 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f1f3f4]">
            {appIcon ? (
              <img src={appIcon} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-medium text-[#5f6368]">
                {String(appName).slice(0, 1)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-[17px] font-medium leading-snug text-[#202124]">{appName}</h2>
            <p className="mt-0.5 text-[14px] text-[#5f6368]">Ratings and reviews</p>
          </div>
          {showCloseButton ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-[#5f6368] hover:bg-black/5"
              aria-label="Close"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          ) : null}
        </div>
      </header>
      <div className="divide-y divide-[#e8eaed]">{children}</div>
      {footer ? <div className="border-t border-[#e8eaed]">{footer}</div> : null}
    </div>
  )
}
