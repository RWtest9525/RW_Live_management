import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

if (!serviceAccountJson) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable.')
}

const serviceAccount = JSON.parse(serviceAccountJson)

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ??
      'rw-invoice-live-tracker.firebasestorage.app',
  })
}

export const adminDb = getFirestore()
export const adminStorage = getStorage().bucket()
