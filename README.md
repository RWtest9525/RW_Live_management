# Review World Live Checker

A comprehensive monitoring system for Play Store reviews with automated proof generation.

## 🚀 Features

- **Multi-user Dashboard**: Manage multiple apps and monitor review status.
- **Automated Sync**: Hourly syncing of reviews from Google Play Store.
- **Proof Generation**: Automated video proof generation using Playwright.
- **Google Drive Integration**: Automatically stores generated proofs in user-specific folders.
- **Telegram Reports**: Daily summaries sent via Telegram Bot.

## 🛠️ Setup

1. **Clone and Install**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in the required values:
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: Your Firebase Service Account JSON string.
   - `GOOGLE_DRIVE_FOLDER_ID`: The root folder ID where proofs will be stored.
   - `PORTAL_BASE_URL`: The URL where the app is hosted (used for proof generation).
   - `CRON_SECRET`: A secret string to protect your automation endpoints.

3. **Development**:
   ```bash
   npm run dev
   ```

## 🌍 Deployment (Vercel)

1. **Frontend**: Vite handles the build automatically.
2. **API**: Vercel Functions handle the logic in the `api/` folder.
3. **Cron Jobs**: 
   Add a `vercel.json` with a `crons` section or use the Vercel Dashboard to trigger:
   - `/api/automation-run` (Hourly)
   - `/api/cron-daily-report` (Daily)

   *Note: Ensure `CRON_SECRET` is set in Vercel Environment Variables and passed in the Authorization header as `Bearer <secret>`.*

## 🔒 Security

- **Admin Account**: Default admin is `reviewsworld01@gmail.com`. Password can be configured in `server/auth.js`.
- **JWT Auth**: Secure session management using custom signed tokens.
- **Protected Routes**: Frontend and Backend both verify user roles and validity.

## 📦 Dependencies

- **Frontend**: React 19, Tailwind CSS 4, Zustand.
- **Backend**: Firebase Admin, Playwright, fluent-ffmpeg, google-play-scraper.
