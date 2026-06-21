import { google } from 'googleapis'
import { serviceAccount } from './googleServiceAccount.js'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DEFAULT_REDIRECT_URI = 'http://localhost:3000/api/google-oauth-callback'

const cleanEnv = (value) => {
  if (!value) return ''
  return String(value).trim().replace(/^['"]|['"]$/g, '')
}

export const getGoogleOAuthConfig = () => ({
  clientId: cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_ID),
  clientSecret: cleanEnv(process.env.GOOGLE_OAUTH_CLIENT_SECRET),
  refreshToken: cleanEnv(process.env.GOOGLE_OAUTH_REFRESH_TOKEN),
  redirectUri: cleanEnv(process.env.GOOGLE_OAUTH_REDIRECT_URI) || DEFAULT_REDIRECT_URI,
})

export const createGoogleOAuthClient = () => {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig()
  if (!clientId || !clientSecret) return null
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export const createGoogleOAuthAuthUrl = () => {
  const client = createGoogleOAuthClient()
  if (!client) return null
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [DRIVE_SCOPE],
  })
}

export const exchangeGoogleOAuthCode = async (code) => {
  const client = createGoogleOAuthClient()
  if (!client) throw new Error('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are required.')
  const { tokens } = await client.getToken(code)
  return tokens
}

export const getDriveAuth = () => {
  const oauth = getGoogleOAuthConfig()
  if (oauth.clientId && oauth.clientSecret && oauth.refreshToken) {
    const client = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret, oauth.redirectUri)
    client.setCredentials({ refresh_token: oauth.refreshToken })
    return { auth: client, mode: 'oauth' }
  }

  if (serviceAccount?.client_email && serviceAccount?.private_key) {
    return {
      auth: new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: [DRIVE_SCOPE],
      }),
      mode: 'service_account',
    }
  }

  return { auth: null, mode: 'missing' }
}

export const getDriveAuthStatus = () => {
  const oauth = getGoogleOAuthConfig()
  const hasServiceAccount = Boolean(serviceAccount?.client_email && serviceAccount?.private_key)
  const mode =
    oauth.clientId && oauth.clientSecret && oauth.refreshToken
      ? 'oauth'
      : hasServiceAccount
        ? 'service_account'
        : 'missing'

  return {
    mode,
    folderId: cleanEnv(process.env.GOOGLE_DRIVE_FOLDER_ID),
    oauthClient: Boolean(oauth.clientId && oauth.clientSecret),
    oauthRefreshToken: Boolean(oauth.refreshToken),
    serviceAccount: hasServiceAccount,
    serviceAccountEmail: serviceAccount?.client_email || null,
    redirectUri: oauth.redirectUri,
  }
}
