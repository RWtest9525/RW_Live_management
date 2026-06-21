import { create } from 'zustand'
import {
  clearToken,
  getStoredToken,
  loginRequest,
  meRequest,
  storeToken,
} from '../services/authApi'

const getTotals = (apps, reviews) => {
  let verifiedLive = 0
  let dropped = 0
  const liveCountsByAppId = new Map()

  for (const review of reviews) {
    if (review.status === 'VERIFIED LIVE') {
      verifiedLive += 1
      liveCountsByAppId.set(review.appId, (liveCountsByAppId.get(review.appId) || 0) + 1)
    } else if (review.status === 'DROPPED') {
      dropped += 1
    }
  }

  const activeLinks = apps.filter((app) => app.monitoringStatus === 'ACTIVE').length
  const totalRevenue = apps.reduce(
    (sum, app) => sum + (liveCountsByAppId.get(app.id) || 0) * Number(app.ratePerReview ?? 0),
    0,
  )

  return {
    verifiedLive,
    dropped,
    activeLinks,
    totalRevenue,
  }
}

const fetchJsonWithAuth = async (url, token) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${url}`)
  }
  return payload
}

const usePortalStore = create((set, get) => ({
  isAuthenticated: false,
  authLoading: !!localStorage.getItem('rw_session_token'),
  authError: '',
  token: '',
  currentUser: null,
  apps: [],
  reviews: [],
  users: [],
  proofs: [],
  clients: [],
  theme: localStorage.getItem('portal-theme') || 'light',
  subscriptionsReady: false,
  syncState: {},
  maintenanceActive: false,
  maintenanceEndTime: null,
  maintenanceMessage: '',
  setCurrentUser: (user) => set({ currentUser: user }),
  refreshCurrentUser: async () => {
    const token = get().token || getStoredToken()
    if (!token) return null
    const response = await meRequest(token)
    set({ currentUser: response.user })
    return response.user
  },
  toggleTheme: () => {
    const nextTheme = get().theme === 'light' ? 'dark' : 'light'
    localStorage.setItem('portal-theme', nextTheme)
    set({ theme: nextTheme })
  },
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
        authError: '',
      })
      await get().loadInitialData()
      return { ok: true }
    } catch (error) {
      set({
        authLoading: false,
        authError: error.message,
        isAuthenticated: false,
        currentUser: null,
        token: '',
      })
      return { ok: false, error: error.message }
    }
  },
  hydrateSession: async () => {
    const token = getStoredToken()
    if (!token) return
    set({ authLoading: true, authError: '' })
    try {
      const response = await meRequest(token)
      set({
        isAuthenticated: true,
        token,
        currentUser: response.user,
        authLoading: false,
        authError: '',
      })
      await get().loadInitialData()
    } catch {
      clearToken()
      set({
        isAuthenticated: false,
        token: '',
        currentUser: null,
        authLoading: false,
        authError: '',
      })
    }
  },
  logout: () => {
    clearToken()
    set({
      isAuthenticated: false,
      token: '',
      currentUser: null,
      authError: '',
      subscriptionsReady: false,
      apps: [],
      reviews: [],
      proofs: [],
      users: [],
      clients: [],
    })
  },
  loadInitialData: async (filterUserId = null) => {
    const token = get().token || getStoredToken()
    if (!token) return

    const isAdmin = get().currentUser?.role === 'admin'
    const userQuery = filterUserId ? `&userId=${filterUserId}` : ''

    try {
      const listFetches = [
        fetchJsonWithAuth(`/api/data?type=apps${userQuery}`, token),
        fetchJsonWithAuth(`/api/data?type=clients${userQuery}`, token),
        fetchJsonWithAuth(`/api/data?type=proofs${userQuery}`, token),
      ]
      
      if (isAdmin) {
        listFetches.push(fetchJsonWithAuth('/api/data?type=users', token))
      }

      const [apps, clients, proofs, users] = await Promise.all(listFetches)

      // Sort clients alphabetically by name
      const sortedClients = (clients || []).sort((a, b) => 
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      )

      set({ 
        apps: Array.isArray(apps) ? apps : [],
        clients: sortedClients, 
        proofs: Array.isArray(proofs) ? proofs : [],
        users: Array.isArray(users) ? users : [],
        subscriptionsReady: true 
      })

      fetchJsonWithAuth(`/api/data?type=reviews${userQuery}`, token)
        .then((reviews) => {
          set({ reviews: Array.isArray(reviews) ? reviews : [] })
        })
        .catch((error) => {
          console.error('Failed to load reviews:', error)
        })
    } catch (error) {
      console.error('Failed to load initial data:', error)
      set({
        apps: [],
        clients: [],
        proofs: [],
        reviews: [],
        users: [],
      })
    }
  },
  refreshPortalLists: async (filterUserId = null) => {
    const token = get().token || getStoredToken()
    if (!token) return

    const isAdmin = get().currentUser?.role === 'admin'
    const userQuery = filterUserId ? `&userId=${filterUserId}` : ''

    try {
      const fetchUrls = [
        fetchJsonWithAuth(`/api/data?type=apps${userQuery}`, token),
        fetchJsonWithAuth(`/api/data?type=clients${userQuery}`, token),
        fetchJsonWithAuth(`/api/data?type=proofs${userQuery}`, token),
      ]

      if (isAdmin) {
        fetchUrls.push(fetchJsonWithAuth('/api/data?type=users', token))
      }

      const [apps, clients, proofs, users] = await Promise.all(fetchUrls)
      const sortedClients = (clients || []).sort((a, b) =>
        (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
      )

      set({
        apps: Array.isArray(apps) ? apps : [],
        clients: sortedClients,
        proofs: Array.isArray(proofs) ? proofs : [],
        users: Array.isArray(users) ? users : get().users,
        subscriptionsReady: true,
      })
    } catch (error) {
      console.error('Failed to refresh portal lists:', error)
    }
  },
  // NEW: Fetch reviews from Local SQLite API
  fetchLocalReviews: async (appId) => {
    try {
      const token = get().token || localStorage.getItem('rw_session_token');
      const response = await fetch(`/api/get-local-reviews?appId=${appId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch local reviews');
      const data = await response.json();
      
      const safeReviews = Array.isArray(get().reviews) ? get().reviews : [];
      const safeData = Array.isArray(data) ? data : [];
      const otherReviews = safeReviews.filter((r) => r.appId !== appId);
      set({ reviews: [...otherReviews, ...safeData] });
    } catch (error) {
      console.error('Error fetching local reviews:', error);
    }
  },
  setRatePerReview: async (appId, nextRate) => {
    const token = get().token || getStoredToken()
    await fetch('/api/data', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'app', id: appId, ratePerReview: nextRate })
    })
    get().loadInitialData()
  },
  getDashboardStats: () => {
    const { apps, reviews } = get()
    return getTotals(apps, reviews)
  },
  getAppById: (id) => get().apps.find((app) => app.id === id),
  getReviewsByAppId: (id) => get().reviews.filter((review) => review.appId === id),
  fetchMaintenanceStatus: async () => {
    try {
      const response = await fetch('/api/maintenance-status')
      if (response.ok) {
        const data = await response.json()
        set({
          maintenanceActive: data.active,
          maintenanceEndTime: data.endTime,
          maintenanceMessage: data.message,
        })
        return data
      }
    } catch (error) {
      console.error('Failed to fetch maintenance status:', error)
    }
    return null
  },
  updateMaintenanceSettings: async (payload) => {
    const token = get().token || localStorage.getItem('rw_session_token')
    try {
      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update maintenance settings')
      }
      await get().fetchMaintenanceStatus()
      return { ok: true }
    } catch (error) {
      console.error('Failed to update maintenance:', error)
      return { ok: false, error: error.message }
    }
  },
}))

export default usePortalStore
