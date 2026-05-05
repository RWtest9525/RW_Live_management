import { useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { createUserRequest } from '../services/authApi'

function WorkerPanelPage() {
  const workers = usePortalStore((state) => state.workers)
  const users = usePortalStore((state) => state.users)
  const currentUser = usePortalStore((state) => state.currentUser)
  const token = usePortalStore((state) => state.token)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [validityMode, setValidityMode] = useState('trial')
  const [message, setMessage] = useState('')

  const handleCreateUser = async (event) => {
    event.preventDefault()
    try {
      await createUserRequest({
        token,
        name,
        email,
        phone,
        password,
        validityMode,
      })
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setValidityMode('trial')
      setMessage('User created successfully with dedicated Drive folder.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Worker Panel</h2>
        <p className="text-sm text-slate-500">Manage staff accounts and availability</p>
      </div>
      {currentUser?.role === 'admin' ? (
        <form
          onSubmit={handleCreateUser}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="User name"
            required
          />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Email"
            required
          />
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Phone number"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Temporary password"
            required
          />
          <select
            value={validityMode}
            onChange={(event) => setValidityMode(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="trial">Free Trial (1 month)</option>
            <option value="1-month">1 Month</option>
            <option value="1-year">1 Year</option>
            <option value="lifetime">Lifetime</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Add User
          </button>
        </form>
      ) : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Validity</th>
            </tr>
          </thead>
          <tbody>
            {(users.length ? users : workers).map((worker) => (
              <tr key={worker.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-800">{worker.name}</td>
                <td className="px-4 py-3">{worker.email ?? '-'}</td>
                <td className="px-4 py-3">{worker.accessPlan ?? worker.role ?? '-'}</td>
                <td className="px-4 py-3">{worker.validUntil ? new Date(worker.validUntil).toLocaleDateString('en-IN') : 'No expiry'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default WorkerPanelPage
