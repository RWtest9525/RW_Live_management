import { getStoredToken } from './authApi'

const parseJson = async (response) => {
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed')
  }
  return payload
}

export const lookupPlayStoreApp = async (value) => {
  const response = await fetch('/api/app-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  return parseJson(response)
}

export const fetchApps = async () => {
  const token = getStoredToken()
  const response = await fetch('/api/data?type=apps', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to fetch apps')
  return response.json()
}

export const createMonitoringApp = async (payload) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ type: 'app', ...payload }),
  })
  if (!response.ok) throw new Error('Failed to create app')
  return response.json()
}

export const updateAppRate = async (appId, ratePerReview) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ type: 'app', id: appId, ratePerReview }),
  })
  if (!response.ok) throw new Error('Failed to update app rate')
  return response.json()
}

export const deleteApp = async (appId) => {
  const token = getStoredToken()
  const response = await fetch(`/api/data?type=app&id=${appId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!response.ok) throw new Error('Failed to delete app')
  return response.json()
}
