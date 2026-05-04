import { initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCcZVGW1RbttlioM9COEkxgG4sWI1OPOeE',
  authDomain: 'rw-invoice-live-tracker.firebaseapp.com',
  projectId: 'rw-invoice-live-tracker',
  storageBucket: 'rw-invoice-live-tracker.firebasestorage.app',
  messagingSenderId: '853584107013',
  appId: '1:853584107013:web:cc73a8eb474e7e5b242e6c',
  measurementId: 'G-R9BN9FCFX7',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)

export const setupAnalytics = async () => {
  if (typeof window === 'undefined') return null
  const supported = await isSupported()
  if (!supported) return null
  return getAnalytics(firebaseApp)
}
