import { useEffect, useMemo, useRef, useState } from 'react'
import PlayStoreReviewsPanel from './PlayStoreReviewsPanel'
import PlayStoreReviewRow from './PlayStoreReviewRow'

function InfiniteReviewList({ reviews, app }) {
  const [visibleCount, setVisibleCount] = useState(4)
  const loaderRef = useRef(null)

  const visibleReviews = useMemo(() => reviews.slice(0, visibleCount), [reviews, visibleCount])
  const hasMore = visibleCount < reviews.length

  useEffect(() => {
    const node = loaderRef.current
    if (!node || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((current) => Math.min(current + 3, reviews.length))
        }
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, reviews.length])

  return (
    <PlayStoreReviewsPanel
      appName={app?.name ?? 'App'}
      appIcon={app?.icon}
      showCloseButton={false}
      footer={
        <div ref={loaderRef} className="py-4 text-center text-[13px] text-[#5f6368]">
          {hasMore ? 'Loading more reviews…' : reviews.length ? 'No more reviews' : ''}
        </div>
      }
    >
      {visibleReviews.map((review, index) => (
        <PlayStoreReviewRow
          key={review.id ?? `${index}`}
          review={review}
          index={index}
          developerName={app?.developer}
        />
      ))}
    </PlayStoreReviewsPanel>
  )
}

export default InfiniteReviewList
