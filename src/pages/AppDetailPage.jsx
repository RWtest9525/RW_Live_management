import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import InfiniteReviewList from '../components/InfiniteReviewList'
import { mockReviews } from '../data/mockData'
import usePortalStore from '../store/usePortalStore'
import { matchesHintWise, matchesNoHint } from '../utils/hintFilter'

const sampleInputs = [' ,hello', ',,,wrong', ' .', '..double', 'Aplus', ' 9check']

function AppDetailPage() {
  const { id } = useParams()
  const app = usePortalStore((state) => state.getAppById(id))
  const appReviews = usePortalStore((state) => state.getReviewsByAppId(id))
  const [watermarkMode, setWatermarkMode] = useState(false)
  const [hintMode, setHintMode] = useState('hint-wise')

  const filteredPreview = useMemo(() => {
    if (!app) return []
    return sampleInputs.filter((input) =>
      hintMode === 'hint-wise' ? matchesHintWise(input, app.hintSymbol) : matchesNoHint(input),
    )
  }, [app, hintMode])

  const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  if (!app) {
    return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">App not found</div>
  }

  return (
    <section className="relative space-y-6">
      {watermarkMode ? (
        <div className="pointer-events-none fixed bottom-4 right-4 rounded-lg bg-black/70 px-3 py-2 text-xs font-semibold text-white">
          Live Date/Time IST: {istTime}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{app.name}</h2>
          <p className="text-sm text-slate-500">Detailed monitoring and review feed</p>
        </div>
        {!watermarkMode ? (
          <button
            type="button"
            onClick={() => setWatermarkMode(true)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Enable Watermark Mode
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setWatermarkMode(false)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Exit Watermark Mode
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setHintMode('hint-wise')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${hintMode === 'hint-wise' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            Hint-Wise
          </button>
          <button
            type="button"
            onClick={() => setHintMode('no-hint')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${hintMode === 'no-hint' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            No Hint
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Active hint symbol: <span className="font-semibold">{app.hintSymbol}</span>
        </p>
        <p className="mt-2 text-sm text-slate-700">Matched sample inputs: {filteredPreview.join(', ') || 'No match'}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Play Store Style Reviews</h3>
        <InfiniteReviewList
          reviews={
            appReviews.length
              ? appReviews.map((review, index) => ({
                  id: review.id ?? `${index}`,
                  user: review.userName ?? 'User',
                  rating: review.rating ?? 5,
                  time: 'live',
                  text: review.content ?? '',
                }))
              : mockReviews
          }
        />
      </div>
    </section>
  )
}

export default AppDetailPage
