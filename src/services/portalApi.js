import { getStoredToken } from './authApi'

export const createClientRecord = async (payload) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'client', ...payload }),
  })
  return response.json()
}

export const updateClientRecord = async (id, payload) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'client', id, ...payload }),
  })
  return response.json()
}

export const deleteClientRecord = async (id) => {
  const token = getStoredToken()
  const response = await fetch(`/api/data?type=client&id=${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to delete client')
  }
  return response.json()
}

export const updateAppRate = async (appId, ratePerReview) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'app', id: appId, ratePerReview: Number(ratePerReview) }),
  })
  return response.json()
}

export const createAppRecord = async (payload) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'app', ...payload }),
  })
  return response.json()
}

export const updateAppRecord = async (appId, payload) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'app', id: appId, ...payload }),
  })
  return response.json()
}

export const deleteAppRecord = async (appId) => {
  const token = getStoredToken()
  const response = await fetch(`/api/data?type=app&id=${appId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to delete app')
  }
  return response.json()
}

export const updateUserRecord = async (userId, payload) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'user', id: userId, ...payload }),
  })
  return response.json()
}

export const deleteUserRecord = async (userId) => {
  const token = getStoredToken()
  await fetch(`/api/data?type=user&id=${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export const getPasswordRequests = async () => {
  const token = getStoredToken()
  const response = await fetch('/api/data?type=password_requests', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.json()
}

export const updatePasswordRequestStatus = async (id, status) => {
  const token = getStoredToken()
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ type: 'password_request', id, status }),
  })
  return response.json()
}

export const subscribeApps = () => {}
export const subscribeProofs = () => {}
export const subscribeClients = () => {}
export const subscribeUsers = () => {}
export const subscribeReviews = () => {}
