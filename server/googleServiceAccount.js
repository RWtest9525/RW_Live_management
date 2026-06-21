/**
 * Google Cloud service account JSON from environment (Drive API JWT auth).
 * Set `GOOGLE_SERVICE_ACCOUNT_JSON` to the full JSON object as a string (GCP key format).
 * `FIREBASE_SERVICE_ACCOUNT_JSON` is accepted as a local fallback because this
 * project uses the same service account for Firebase Admin and Drive locally.
 */
let parsed = null
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (raw) {
  try {
    const cleaned = String(raw).trim().replace(/^['"]|['"]$/g, '')
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message)
  }
}

let serviceAccount = parsed
if (serviceAccount && typeof serviceAccount.private_key === 'string') {
  serviceAccount = {
    ...serviceAccount,
    private_key: serviceAccount.private_key.replace(/\\n/g, '\n'),
  }
}

export { serviceAccount }
