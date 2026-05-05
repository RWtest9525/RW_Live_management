const TOKEN_KEY = 'rw_session_token'

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY)

export const storeToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
}

export const loginRequest = async ({ email, password }) => {
  const response = await fetch('/api/auth-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? 'Login failed')
  return payload
}

export const meRequest = async (token) => {
  const response = await fetch('/api/auth-me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? 'Session invalid')
  return payload
}

export const createUserRequest = async ({ token, ...body }) => {
  const response = await fetch('/api/admin-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error ?? 'Create user failed')
  return payload
}
