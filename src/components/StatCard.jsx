import usePortalStore from '../store/usePortalStore'

function StatCard({ title, value, tone = 'blue' }) {
  const theme = usePortalStore((state) => state.theme)
  
  const toneStyles = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
    red: 'from-rose-500 to-rose-600 shadow-rose-500/20',
    purple: 'from-violet-500 to-violet-600 shadow-violet-500/20',
  }

  return (
    <article className={`rounded-2xl border p-5 shadow-lg transition-all duration-300 transform hover:scale-[1.02] ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
      <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{title}</div>
      <div className={`mt-4 inline-flex rounded-2xl bg-gradient-to-r px-5 py-2 text-2xl font-black text-white shadow-xl ${toneStyles[tone]}`}>
        {value}
      </div>
    </article>
  )
}

export default StatCard
