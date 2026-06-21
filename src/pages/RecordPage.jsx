import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PlayStoreReviewsPanel from '../components/PlayStoreReviewsPanel'
import PlayStoreReviewRow from '../components/PlayStoreReviewRow'

function RecordPage() {
  const { id } = useParams()
  const [recordData, setRecordData] = useState({ app: null, reviews: [] })
  const [recordReady, setRecordReady] = useState(false)
  const [recordError, setRecordError] = useState('')

  useEffect(() => {
    if (!id) return

    let cancelled = false
    const loadRecordData = async () => {
      setRecordReady(false)
      setRecordError('')
      try {
        const token = localStorage.getItem('rw_session_token')
        const response = await fetch(`/api/record-data?appId=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || 'Unable to load recording data')
        if (!cancelled) {
          setRecordData({
            app: payload.app ?? null,
            reviews: Array.isArray(payload.reviews) ? payload.reviews : [],
          })
        }
      } catch (error) {
        if (!cancelled) {
          setRecordError(error.message)
          setRecordData({ app: null, reviews: [] })
        }
      } finally {
        if (!cancelled) {
          setRecordReady(true)
          window.__RW_RECORD_READY = true
        }
      }
    }

    window.__RW_RECORD_READY = false
    void loadRecordData()

    return () => {
      cancelled = true
    }
  }, [id])

  const app = recordData.app
  const appReviews = useMemo(() => {
    const list = Array.isArray(recordData.reviews) ? recordData.reviews : []
    return list.slice().sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
  }, [recordData.reviews])

  return (
    <main
      data-record-ready={recordReady ? 'true' : 'false'}
      className="min-h-screen bg-[#dadce0] px-8 py-8"
      style={{ fontFamily: "'Roboto', system-ui, sans-serif" }}
    >
      <div className="mx-auto w-[760px] overflow-hidden rounded-t-[28px] bg-white shadow-[0_18px_55px_rgba(60,64,67,0.25)] ring-1 ring-black/5">
        <div className="[&>div>header]:px-8 [&>div>header]:pb-5 [&>div>header]:pt-7 [&>div>header_img]:h-20 [&>div>header_img]:w-20 [&>div>header_h2]:text-[25px] [&>div>header_p]:text-[18px] [&_article]:px-8 [&_article]:py-7 [&_article_img]:h-14 [&_article_img]:w-14 [&_article_p]:text-[20px] [&_article_p]:leading-[1.42] [&_article_svg]:h-[18px] [&_article_svg]:w-[18px]">
          <PlayStoreReviewsPanel appName={app?.name ?? 'App'} appIcon={app?.icon} showCloseButton={false}>
            {appReviews.length ? (
              appReviews.map((review, index) => (
                <PlayStoreReviewRow
                  key={review.id ?? index}
                  review={review}
                  index={index}
                  developerName={app?.developer}
                />
              ))
            ) : !recordReady ? (
              <div className="px-8 py-12 text-center text-[18px] text-[#5f6368]">
                Preparing verified reviews...
              </div>
            ) : recordError ? (
              <div className="px-8 py-12 text-center text-[18px] text-[#b3261e]">{recordError}</div>
            ) : (
              <div className="px-8 py-12 text-center text-[18px] text-[#5f6368]">
                No verified reviews loaded yet.
              </div>
            )}
          </PlayStoreReviewsPanel>
        </div>
      </div>
    </main>
  )
}

export default RecordPage
