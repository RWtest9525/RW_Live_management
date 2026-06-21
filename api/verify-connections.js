import { getDriveStorageStatus } from '../server/driveStorage.js'

export default async function handler(req, res) {
  // Allow both GET and POST for connectivity checks
  const driveStatus = getDriveStorageStatus()
  const driveReady = Boolean(driveStatus.folderId && driveStatus.mode !== 'missing')
  return res.status(200).json({
    dataStore: 'sqlite',
    googleDrive: driveReady ? `${driveStatus.mode}_configured` : 'missing_env',
    googleDriveDetails: {
      mode: driveStatus.mode,
      folderId: driveStatus.folderId || null,
      oauthClient: driveStatus.oauthClient,
      oauthRefreshToken: driveStatus.oauthRefreshToken,
      serviceAccount: driveStatus.serviceAccount,
      serviceAccountEmail: driveStatus.serviceAccountEmail,
      redirectUri: driveStatus.redirectUri,
    },
    sqlite: 'active',
  })
}
