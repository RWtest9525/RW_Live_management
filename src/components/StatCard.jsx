function StatCard({ title, value, tone = 'blue' }) {
  const toneStyles = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    red: 'from-rose-500 to-rose-600',
    purple: 'from-violet-500 to-violet-600',
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className={`mt-3 inline-flex rounded-xl bg-gradient-to-r px-3 py-1 text-2xl font-bold text-white ${toneStyles[tone]}`}>
        {value}
      </div>
    </article>
  )
}

export default StatCard
