import { useEffect, useMemo, useRef, useState } from 'react'
import AppReviewCard from './AppReviewCard'

function InfiniteReviewList({ reviews }) {
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
    <div className="space-y-3">
      {visibleReviews.map((review, index) => (
        <AppReviewCard key={review.id} review={review} index={index} />
      ))}
      <div ref={loaderRef} className="py-3 text-center text-sm text-slate-500">
        {hasMore ? 'Loading more reviews...' : 'No more reviews'}
      </div>
    </div>
  )
}

export default InfiniteReviewList
