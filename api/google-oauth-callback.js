import { exchangeGoogleOAuthCode } from '../server/googleDriveAuth.js'

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export default async function handler(req, res) {
  const code = req.query?.code
  if (!code) {
    return res.status(400).json({ error: 'Missing Google OAuth code.' })
  }

  try {
    const tokens = await exchangeGoogleOAuthCode(code)
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Google did not return a refresh token.',
        nextStep:
          'Open /api/google-oauth-start again and approve access. If needed, remove this app from your Google account permissions first, then retry.',
      })
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RW Google Drive OAuth Complete</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 820px; margin: 48px auto; padding: 0 20px; color: #172033; }
      .box { border: 1px solid #d8dee9; border-radius: 16px; padding: 24px; background: #f8fafc; }
      textarea { width: 100%; min-height: 82px; border-radius: 10px; border: 1px solid #cbd5e1; padding: 12px; }
      code { background: #eef2f7; padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Google Drive connected</h1>
      <p>Add this line to your <code>.env</code>, then restart <code>npm run dev</code>:</p>
      <textarea readonly>GOOGLE_OAUTH_REFRESH_TOKEN=${escapeHtml(refreshToken)}</textarea>
      <p>After restart, open <code>/api/verify-connections</code>. It should show OAuth mode.</p>
    </div>
  </body>
</html>`)
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to exchange Google OAuth code.',
    })
  }
}
