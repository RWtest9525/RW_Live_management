import { create } from 'zustand'
import { mockApps, mockProofs, mockWorkers } from '../data/mockData'
import {
  seedAppsIfMissing,
  subscribeApps,
  subscribeProofs,
  subscribeReviews,
  subscribeUsers,
  updateAppRate,
} from '../services/firestorePortal'
import {
  clearToken,
  getStoredToken,
  loginRequest,
  meRequest,
  storeToken,
} from '../services/authApi'

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
  authLoading: false,
  authError: '',
  token: '',
  currentUser: null,
  apps: mockApps,
  reviews: [],
  workers: mockWorkers,
  users: [],
  proofs: mockProofs,
  subscriptionsReady: false,
  syncState: {},
  login: async ({ email, password }) => {
    set({ authLoading: true, authError: '' })
    try {
      const response = await loginRequest({ email, password })
      storeToken(response.token)
      set({
        isAuthenticated: true,
        token: response.token,
        currentUser: response.user,
        authLoading: false,
      })
      await get().initializeFirestore()
      return { ok: true }
    } catch (error) {
      set({ authLoading: false, authError: error.message, isAuthenticated: false })
      return { ok: false, error: error.message }
    }
  },
  hydrateSession: async () => {
    const token = getStoredToken()
    if (!token) return
    set({ authLoading: true })
    try {
      const response = await meRequest(token)
      set({
        isAuthenticated: true,
        token,
        currentUser: response.user,
        authLoading: false,
      })
      await get().initializeFirestore()
    } catch {
      clearToken()
      set({
        isAuthenticated: false,
        token: '',
        currentUser: null,
        authLoading: false,
      })
    }
  },
  logout: () => {
    clearToken()
    const unsubs = get()._firestoreUnsubs ?? []
    unsubs.forEach((fn) => fn?.())
    set({
      isAuthenticated: false,
      token: '',
      currentUser: null,
      subscriptionsReady: false,
      apps: [],
      reviews: [],
      proofs: [],
      users: [],
    })
  },
  initializeFirestore: async () => {
    if (get().subscriptionsReady) return
    const currentUser = get().currentUser
    if (!currentUser) return
    await seedAppsIfMissing()
    const isAdmin = currentUser.role === 'admin'
    const unsubs = [
      subscribeApps({
        ownerUserId: currentUser.id,
        isAdmin,
        onData: (apps) => set({ apps }),
      }),
      subscribeReviews({
        ownerUserId: currentUser.id,
        isAdmin,
        onData: (reviews) => set({ reviews }),
      }),
      subscribeProofs({
        ownerUserId: currentUser.id,
        isAdmin,
        onData: (proofs) => set({ proofs }),
      }),
    ]
    if (isAdmin) {
      unsubs.push(subscribeUsers((users) => set({ users })))
    }
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
