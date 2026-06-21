import 'dotenv/config'
import { createGoogleOAuthAuthUrl, exchangeGoogleOAuthCode, getDriveAuthStatus } from '../server/googleDriveAuth.js'

const codeArg = process.argv.find((arg) => arg.startsWith('--code='))
const code = codeArg ? codeArg.slice('--code='.length) : ''
const status = getDriveAuthStatus()

if (!status.oauthClient) {
  console.log('Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env')
  console.log(`OAuth redirect URI to add in Google Cloud: ${status.redirectUri}`)
  process.exit(1)
}

if (code) {
  const tokens = await exchangeGoogleOAuthCode(code)
  if (!tokens.refresh_token) {
    console.log('No refresh token returned. Re-run consent with prompt=consent or remove old app access and try again.')
    process.exit(1)
  }
  console.log('Add this to .env:')
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`)
} else {
  console.log('Open this URL, sign in with your 5TB Google Drive account, and approve Drive access:')
  console.log(createGoogleOAuthAuthUrl())
  console.log('')
  console.log(`Redirect URI configured by this app: ${status.redirectUri}`)
}
