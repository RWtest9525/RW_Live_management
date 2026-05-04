import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import usePortalStore from '../store/usePortalStore'

function RecordPage() {
  const { id } = useParams()
  const app = usePortalStore((state) => state.getAppById(id))
  const appReviews = usePortalStore((state) => state.getReviewsByAppId(id))
  const [istTime, setIstTime] = useState(
    new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setIstTime(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">{app?.name ?? 'Record Session'}</h1>
        <div className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm">
          Live Date/Time IST: {istTime}
        </div>
        {appReviews
          .filter((review) => review.status === 'VERIFIED LIVE')
          .map((review) => (
            <article
              key={review.id}
              className="rounded-xl border border-white/20 bg-white/10 p-4"
            >
              <p className="font-semibold">{review.userName}</p>
              <p className="text-amber-400">{'★'.repeat(review.rating ?? 5)}</p>
              <p className="text-sm text-slate-200">{review.content}</p>
            </article>
          ))}
      </div>
    </div>
  )
}

export default RecordPage
