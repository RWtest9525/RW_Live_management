import { useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { createClientRecord, deleteClientRecord, updateClientRecord } from '../services/portalApi'
import { Link } from 'react-router-dom'

function ClientManagementPage() {
  const clients = usePortalStore((state) => state.clients)
  const theme = usePortalStore((state) => state.theme)
  const currentUser = usePortalStore((state) => state.currentUser)
  const loadInitialData = usePortalStore((state) => state.loadInitialData)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showClientModal, setShowClientModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAddOrUpdateClient = async (e) => {
    e.preventDefault()
    if (!name || !currentUser) return
    setLoading(true)
    setMessage('Processing...')
    try {
      if (editingId) {
        await updateClientRecord(editingId, { name, email, phone })
        setMessage('Client updated successfully')
      } else {
        console.log('Adding new client:', name)
        const res = await createClientRecord({ 
          name, 
          email, 
          phone, 
          ownerUserId: currentUser.id 
        })
        console.log('Client add response:', res)
        setMessage(`Client "${name}" added successfully and Drive folder triggered.`)
      }
      setName('')
      setEmail('')
      setPhone('')
      setEditingId(null)
      setShowClientModal(false)
      await loadInitialData()
    } catch (err) {
      console.error('Client action failed:', err)
      setMessage('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (client) => {
    setEditingId(client.id)
    setName(client.name)
    setEmail(client.email || '')
    setPhone(client.phone || '')
    setShowClientModal(true)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setName('')
    setEmail('')
    setPhone('')
    setShowClientModal(false)
  }

  const handleDeleteClient = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return
    try {
      await deleteClientRecord(id)
      loadInitialData()
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <Link to="/dashboard" className={`rounded-full p-3 transition-all transform active:scale-90 ${theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <div>
            <h2 className={`text-3xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Client Management</h2>
            <p className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Add and manage your clients</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null)
            setName('')
            setEmail('')
            setPhone('')
            setShowClientModal(true)
          }}
          className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-700 active:scale-95"
        >
          + Add Client
        </button>
      </div>

      {showClientModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className={`w-full max-w-3xl rounded-3xl border p-5 shadow-2xl sm:p-7 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h3 className={`text-lg font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{editingId ? 'Edit Client Details' : 'Add New Client'}</h3>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">Drive folder will be prepared automatically.</p>
              </div>
              <button
                type="button"
                onClick={cancelEdit}
                className={`rounded-full p-2 transition-all ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                aria-label="Close client form"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddOrUpdateClient} className="grid gap-4 md:gap-5 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Client Name</label>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email Address</label>
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone Number</label>
            <input
              type="text"
              placeholder="+91 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full rounded-xl border px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white placeholder-slate-500' : 'border-slate-200 bg-slate-50 text-slate-900'}`}
            />
          </div>
          <div className="flex gap-2 items-end md:col-span-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 disabled:bg-blue-300 transition-all transform active:scale-95"
            >
              {loading ? '...' : editingId ? 'Update' : 'Add Client'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className={`rounded-xl px-4 py-3 text-sm font-black transition-all ${theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
          </div>
        </div>
      )}

      {message && <p className="text-xs font-bold text-blue-500 animate-pulse">{message}</p>}

      <div className={`rounded-3xl border shadow-xl overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`${theme === 'dark' ? 'bg-slate-950 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'}`}>
              <tr>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Client Details</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Contact Info</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {clients.map((client) => (
                <tr key={client.id} className={`group transition-all ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-8 py-5">
                    <span className={`text-sm font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                      {client.name}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{client.email || '-'}</span>
                      <span className="text-[10px] font-bold text-slate-500">{client.phone || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 sm:px-8 py-5 text-right">
                    <div className="flex justify-end gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(client)}
                        aria-label={`Edit ${client.name}`}
                        title="Edit"
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${theme === 'dark' ? 'border-slate-600 bg-slate-800 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-500' : 'border-slate-200 bg-white text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClient(client.id)}
                        aria-label={`Delete ${client.name}`}
                        title="Delete"
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${theme === 'dark' ? 'border-slate-600 bg-slate-800 text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-500' : 'border-slate-200 bg-white text-rose-600 hover:bg-rose-600 hover:text-white hover:border-rose-600'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No clients registered yet</p>
                    </div>
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

export default ClientManagementPage
