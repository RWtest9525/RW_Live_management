function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h1 className="text-2xl font-bold">Terms and Conditions</h1>
        <p className="mt-3 text-sm text-slate-300">
          By creating an account, you agree to use Review World legally, keep credentials
          private, and avoid misuse of platform automation.
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Access validity depends on your selected plan. Expired or policy-violating accounts
          may be suspended.
        </p>
      </div>
    </div>
  )
}

export default TermsPage
