import { createGoogleOAuthAuthUrl, getDriveAuthStatus } from '../server/googleDriveAuth.js'

export default async function handler(req, res) {
  const authUrl = createGoogleOAuthAuthUrl()
  const status = getDriveAuthStatus()

  if (!authUrl) {
    return res.status(400).json({
      error: 'Google OAuth client is not configured.',
      nextStep:
        'Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env, then restart the server and open this URL again.',
      redirectUri: status.redirectUri,
    })
  }

  if (req.query?.format === 'json') {
    return res.status(200).json({ authUrl, redirectUri: status.redirectUri })
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RW Google Drive OAuth</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 760px; margin: 48px auto; padding: 0 20px; color: #172033; }
      .box { border: 1px solid #d8dee9; border-radius: 16px; padding: 24px; background: #f8fafc; }
      a.button { display: inline-block; margin-top: 16px; padding: 12px 18px; border-radius: 10px; background: #0f8b5f; color: white; text-decoration: none; font-weight: 700; }
      code { background: #eef2f7; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Connect Google Drive</h1>
      <p>This connects uploads to your real Google Drive account quota instead of the service account.</p>
      <p>Use this redirect URI in Google Cloud OAuth settings:</p>
      <p><code>${status.redirectUri}</code></p>
      <a class="button" href="${authUrl}">Sign in with Google Drive</a>
    </div>
  </body>
</html>`)
}
