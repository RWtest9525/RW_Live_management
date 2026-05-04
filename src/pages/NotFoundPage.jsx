import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-white">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-slate-300">Page not found</p>
      <Link to="/dashboard" className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500">
        Go to Dashboard
      </Link>
    </div>
  )
}

export default NotFoundPage
