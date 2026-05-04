import usePortalStore from '../store/usePortalStore'

function WorkerPanelPage() {
  const workers = usePortalStore((state) => state.workers)

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Worker Panel</h2>
        <p className="text-sm text-slate-500">Manage staff accounts and availability</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{worker.name}</td>
                <td className="px-4 py-3">{worker.role}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs ${worker.status === 'Online' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {worker.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default WorkerPanelPage
