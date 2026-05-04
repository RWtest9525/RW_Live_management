import { useMemo, useState } from 'react'
import usePortalStore from '../store/usePortalStore'

function MoneyTrackerPage() {
  const apps = usePortalStore((state) => state.apps)
  const reviews = usePortalStore((state) => state.reviews)
  const setRatePerReview = usePortalStore((state) => state.setRatePerReview)
  const [toast, setToast] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  const totalPayout = useMemo(
    () =>
      apps.reduce((sum, app) => {
        const verifiedCount = reviews.filter(
          (review) => review.appId === app.id && review.status === 'VERIFIED LIVE',
        ).length
        return sum + verifiedCount * Number(app.ratePerReview ?? 0)
      }, 0),
    [apps, reviews],
  )

  const handleCopy = async () => {
    const allVerified = apps.flatMap((app) => app.verifiedUsernames)
    await navigator.clipboard.writeText(allVerified.join('\n'))
    setToast('Verified usernames copied')
    setTimeout(() => setToast(''), 1800)
  }

  const handleCopyByDate = async () => {
    const dateKey = selectedDate
      ? new Date(selectedDate).toDateString()
      : new Date().toDateString()
    const verifiedNames = reviews
      .filter((review) => review.status === 'VERIFIED LIVE')
      .filter((review) => {
        const reviewDate = review.date?.toDate?.() ?? new Date(review.date ?? Date.now())
        return reviewDate.toDateString() === dateKey
      })
      .map((review) => review.userName)

    await navigator.clipboard.writeText(verifiedNames.join('\n'))
    setToast(`Copied ${verifiedNames.length} verified names`)
    setTimeout(() => setToast(''), 1800)
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Money Tracker</h2>
          <p className="text-sm text-slate-500">Configure rate and auto-calculate payouts</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button onClick={handleCopyByDate} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Copy All Verified Names
          </button>
          <button onClick={handleCopy} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Copy Legacy List
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700" htmlFor="rate">
          Rate per Review (Rs)
        </label>
        <input
          id="rate"
          type="text"
          value="Rate is app-specific below"
          disabled
          className="mt-2 w-64 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-500"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">App</th>
              <th className="px-4 py-3">Verified Live</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Payout</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((app) => (
              <tr key={app.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{app.name}</td>
                <td className="px-4 py-3">
                  {
                    reviews.filter(
                      (review) =>
                        review.appId === app.id &&
                        review.status === 'VERIFIED LIVE',
                    ).length
                  }
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    defaultValue={app.ratePerReview ?? 10}
                    min="0"
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                    onBlur={(event) => setRatePerReview(app.id, event.target.value)}
                  />
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-600">
                  Rs{' '}
                  {reviews.filter(
                    (review) =>
                      review.appId === app.id &&
                      review.status === 'VERIFIED LIVE',
                  ).length * Number(app.ratePerReview ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-right text-lg font-bold text-slate-900">Total Payout: Rs {totalPayout}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Payment Invoice</h3>
        <p className="mt-1 text-sm text-slate-500">
          Total Live Reviews x Rate = Total Payable Amount
        </p>
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          {apps.map((app) => {
            const liveCount = reviews.filter(
              (review) => review.appId === app.id && review.status === 'VERIFIED LIVE',
            ).length
            const payable = liveCount * Number(app.ratePerReview ?? 0)
            return (
              <div key={app.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{app.name}</span>
                <span>
                  {liveCount} x Rs {app.ratePerReview} = <strong>Rs {payable}</strong>
                </span>
              </div>
            )
          })}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base font-semibold text-slate-900">
            <span>Total Payable</span>
            <span>Rs {totalPayout}</span>
          </div>
        </div>
      </div>
      {toast ? <div className="fixed bottom-4 right-4 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">{toast}</div> : null}
    </section>
  )
}

export default MoneyTrackerPage
