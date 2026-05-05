const TOKEN_KEY = 'rw_session_token'

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY)

export const storeToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY)
}

const parseApiPayload = async (response) => {
  const raw = await response.text()
  try {
    return JSON.parse(raw)
  } catch {
    const trimmed = raw.trim()
    const isHtmlResponse = trimmed.startsWith('<!doctype') || trimmed.startsWith('<html')
    if (isHtmlResponse) {
      throw new Error(
        'API endpoint is not available. If you are running locally, start the backend with Vercel or deploy the API first.',
      )
    }
    throw new Error(
      trimmed || `Server returned ${response.status} ${response.statusText}`,
    )
  }
}

export const loginRequest = async ({ email, password }) => {
  const response = await fetch('/api/auth-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = await parseApiPayload(response)
  if (!response.ok) throw new Error(payload.error ?? 'Login failed')
  return payload
}

export const meRequest = async (token) => {
  const response = await fetch('/api/auth-me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await parseApiPayload(response)
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
  const payload = await parseApiPayload(response)
  if (!response.ok) throw new Error(payload.error ?? 'Create user failed')
  return payload
}

export const signupRequest = async ({
  name,
  phone,
  country,
  email,
  password,
}) => {
  const response = await fetch('/api/auth-signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, country, email, password }),
  })
  const payload = await parseApiPayload(response)
  if (!response.ok) throw new Error(payload.error ?? 'Signup failed')
  return payload
}
