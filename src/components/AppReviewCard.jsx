const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-orange-500']

function AppReviewCard({ review, index }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${colors[index % colors.length]}`}>
          {review.user.slice(0, 1)}
        </div>
        <div className="w-full">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-800">{review.user}</p>
            <span className="text-xs text-slate-500">{review.time}</span>
          </div>
          <p className="mt-1 text-amber-500">{'★'.repeat(review.rating)}</p>
          <p className="mt-2 text-sm text-slate-600">{review.text}</p>
        </div>
      </div>
    </div>
  )
}

export default AppReviewCard
