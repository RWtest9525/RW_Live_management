import { create } from 'zustand'
import { mockApps, mockProofs, mockWorkers } from '../data/mockData'
import {
  seedAppsIfMissing,
  subscribeApps,
  subscribeProofs,
  subscribeReviews,
  updateAppRate,
} from '../services/firestorePortal'

const getTotals = (apps, reviews) => {
  const verifiedLive = reviews.filter((review) => review.status === 'VERIFIED LIVE').length
  const dropped = reviews.filter((review) => review.status === 'DROPPED').length
  const activeLinks = apps.filter((app) => app.active).length
  const totalRevenue = apps.reduce(
    (sum, app) =>
      sum +
      reviews.filter(
        (review) =>
          review.appId === app.id &&
          review.status === 'VERIFIED LIVE',
      ).length *
        Number(app.ratePerReview ?? 0),
    0,
  )

  return {
    verifiedLive,
    dropped,
    activeLinks,
    totalRevenue,
  }
}

const usePortalStore = create((set, get) => ({
  isAuthenticated: false,
  apps: mockApps,
  reviews: [],
  workers: mockWorkers,
  proofs: mockProofs,
  subscriptionsReady: false,
  syncState: {},
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
  initializeFirestore: async () => {
    if (get().subscriptionsReady) return
    await seedAppsIfMissing()
    const unsubs = [
      subscribeApps((apps) => set({ apps })),
      subscribeReviews((reviews) => set({ reviews })),
      subscribeProofs((proofs) => set({ proofs })),
    ]
    set({ subscriptionsReady: true, _firestoreUnsubs: unsubs })
  },
  setRatePerReview: async (appId, nextRate) => {
    const parsedRate = Number(nextRate)
    if (Number.isNaN(parsedRate) || parsedRate < 0) return
    await updateAppRate(appId, parsedRate)
  },
  getDashboardStats: () => {
    const { apps, reviews } = get()
    return getTotals(apps, reviews)
  },
  getAppById: (id) => get().apps.find((app) => app.id === id),
  getReviewsByAppId: (id) => get().reviews.filter((review) => review.appId === id),
}))

export default usePortalStore
