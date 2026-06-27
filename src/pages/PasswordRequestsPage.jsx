import { useState, useEffect } from 'react'
import usePortalStore from '../store/usePortalStore'
import { getPasswordRequests, updatePasswordRequestStatus } from '../services/portalApi'
import { Link } from 'react-router-dom'

function PasswordRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)

  const fetchRequests = async () => {
    try {
      const data = await getPasswordRequests()
      setRequests(data)
    } catch (err) {
      console.error('Failed to fetch requests:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchRequests()
    }
  }, [currentUser])

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updated = await updatePasswordRequestStatus(id, newStatus)
      if (newStatus === 'approved' && updated?.temporaryPassword) {
        await navigator.clipboard?.writeText(updated.temporaryPassword).catch(() => {})
        alert(`Temporary password generated and copied:\n${updated.temporaryPassword}\n\nShare this with the user manually on WhatsApp or email.`)
      }
      fetchRequests()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const copyPassword = async (password) => {
    if (!password) return
    await navigator.clipboard?.writeText(password).catch(() => {})
    alert('Temporary password copied.')
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg font-bold text-rose-500">Access Denied. Admins only.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-5">
        <Link to="/dashboard" className={`rounded-full p-3 transition-all transform active:scale-90 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h2 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Password Reset Requests</h2>
          <p className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Approve or reject password change requests</p>
        </div>
      </div>

      <div className={`rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`${theme === 'dark' ? 'bg-slate-950 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'}`}>
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">User Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Request Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {requests.map((req) => (
                <tr key={req.id} className={`group transition-all ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{req.email || 'N/A'}</span>
                      <span className="text-[10px] font-bold text-slate-500">{req.phone || 'No phone'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Type: {req.passwordType}</span>
                      <span className="text-[10px] font-bold text-slate-500">{new Date(req.createdAt).toLocaleString()}</span>
                      {req.temporaryPassword ? (
                        <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Temporary Password</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <code className={`rounded-lg px-2 py-1 text-sm font-black ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
                              {req.temporaryPassword}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyPassword(req.temporaryPassword)}
                              className="rounded-lg bg-emerald-500 px-2 py-1 text-[10px] font-black uppercase text-white"
                            >
                              Copy
                            </button>
                            {req.phone ? (
                              <a
                                href={`https://wa.me/${String(req.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Your Reviews World temporary password is: ${req.temporaryPassword}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-black uppercase text-white"
                              >
                                WhatsApp
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      req.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                      req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {req.status === 'pending' && (
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleStatusChange(req.id, 'approved')}
                          className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(req.id, 'rejected')}
                          className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-black text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No requests found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PasswordRequestsPage
