import { Link } from 'react-router-dom'

function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <h1 className="mb-6 text-3xl font-bold text-white">Terms and Conditions</h1>

        <div className="space-y-6 text-slate-300">
          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">1. Introduction</h2>
            <p>
              Welcome to Review World. By accessing or using our platform, you agree to comply with and be bound by these Terms and Conditions. Please read them carefully.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">2. Account Responsibility</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. Any activity occurring under your account is your sole responsibility. You agree to notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">3. Usage Policy</h2>
            <p>
              Review World provides automation and monitoring tools for application reviews. You agree to use these tools legally and ethically. Misuse of platform automation, including attempts to bypass security or interfere with other users&apos; data, may lead to immediate suspension.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">4. Subscription and Access</h2>
            <p>
              Access to Review World features is based on your selected plan (Trial, Monthly, or Yearly). Your access remains valid until the expiration date associated with your plan. We reserve the right to modify plan features or pricing with prior notice.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">5. Data Privacy</h2>
            <p>
              We value your privacy. Your data, including connected app information and generated proofs, is stored securely. We do not share your personal information with third parties except as required to provide our services.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">6. Limitation of Liability</h2>
            <p>
              Review World is provided &quot;as is&quot; without warranties of any kind. We are not liable for any direct, indirect, or incidental damages arising from your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold text-blue-400">7. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the platform after changes are posted constitutes your acceptance of the new terms.
            </p>
          </section>
        </div>

        <div className="mt-8 border-t border-slate-700 pt-6 text-center">
          <p className="text-sm text-slate-400">Last Updated: May 5, 2026</p>
          <Link
            to="/signup"
            className="mt-4 inline-flex rounded-lg bg-slate-800 px-6 py-2 font-medium text-white transition hover:bg-slate-700"
          >
            Back to Signup
          </Link>
        </div>
      </div>
    </div>
  )
}

export default TermsPage
