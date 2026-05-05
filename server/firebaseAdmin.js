import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

if (!serviceAccountJson) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.')
}

const normalizedServiceAccountJson = serviceAccountJson.replace(/\\n/g, '\n')
export const serviceAccount = JSON.parse(normalizedServiceAccountJson)

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  })
}

export const adminDb = getFirestore()
