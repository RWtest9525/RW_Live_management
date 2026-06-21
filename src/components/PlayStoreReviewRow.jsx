import { formatPlayStoreDate } from '../utils/playStoreFormat'

const AVATAR_BG = ['#e97100', '#9c27b0', '#e91e63', '#7e57c2', '#00897b', '#43a047', '#3949ab']

function avatarColorForUser(name, index) {
  const key = String(name || 'user')
  let h = 0
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) | 0
  return AVATAR_BG[(Math.abs(h) + index) % AVATAR_BG.length]
}

function StarRow({ rating }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)))
  return (
    <span className="inline-flex items-center gap-px" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width={14}
          height={14}
          viewBox="0 0 24 24"
          className="shrink-0"
          fill={i < n ? '#01875f' : '#e3e3e3'}
        >
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </span>
  )
}

function MoreMenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5f6368" aria-hidden>
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
  )
}

export default function PlayStoreReviewRow({ review, index = 0, developerName = '' }) {
  const user = String(review.userName ?? review.user ?? 'User')
  const userImage = String(review.userImage ?? review.avatar ?? '').trim()
  const initial = user.trim().slice(0, 1).toUpperCase() || 'U'
  const bg = avatarColorForUser(user, index)
  const rating = Number(review.rating ?? review.score ?? 5)
  const body = String(review.content ?? review.text ?? '')
  const dateIso = review.date ?? review.time
  const reply = String(review.replyText || '').trim()
  const replyDate = formatPlayStoreDate(review.replyDate)
  const helpful = Number(review.thumbsUpCount ?? 0) || 0
  const devLabel = String(developerName || 'Developer').trim() || 'Developer'

  return (
    <article className="px-4 py-4">
      <div className="flex items-start gap-3">
        {userImage ? (
          <img
            src={userImage}
            alt={user}
            className="h-10 w-10 shrink-0 rounded-full bg-slate-200 object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
              const fallback = event.currentTarget.nextElementSibling
              if (fallback) fallback.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
          style={{ backgroundColor: bg, display: userImage ? 'none' : 'flex' }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[15px] font-medium leading-snug text-[#202124]">{user}</p>
            <button
              type="button"
              className="shrink-0 rounded-full p-1 opacity-80 hover:bg-black/5"
              aria-label="More options"
            >
              <MoreMenuIcon />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StarRow rating={rating} />
            <span className="text-[13px] text-[#5f6368]">{formatPlayStoreDate(dateIso)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-snug text-[#202124]">{body}</p>
          {helpful > 0 ? (
            <p className="mt-3 text-[13px] text-[#5f6368]">
              {helpful === 1
                ? '1 person found this review helpful'
                : `${helpful} people found this review helpful`}
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-[13px] text-[#5f6368]">Did you find this helpful?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-[#dadce0] px-4 py-1.5 text-[13px] font-medium text-[#01875f]">
                Yes
              </span>
              <span className="inline-flex items-center rounded-full border border-[#dadce0] px-4 py-1.5 text-[13px] font-medium text-[#5f6368]">
                No
              </span>
            </div>
          </div>
          {reply ? (
            <div className="mt-4 rounded-lg bg-[#f1f3f4] px-3 py-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-[#202124]">{devLabel}</span>
                {replyDate ? <span className="text-[12px] text-[#5f6368]">{replyDate}</span> : null}
              </div>
              <p className="whitespace-pre-wrap text-[14px] leading-snug text-[#202124]">{reply}</p>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
