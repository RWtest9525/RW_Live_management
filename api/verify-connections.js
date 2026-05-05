import { FieldValue } from 'firebase-admin/firestore'
import { createDriveTestDocument } from '../server/driveStorage.js'
import { adminDb } from '../server/firebaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const driveTest = await createDriveTestDocument()
    const firestoreRef = await adminDb.collection('systemChecks').add({
      type: 'backend-connection-test',
      createdAt: FieldValue.serverTimestamp(),
      driveFileId: driveTest.fileId,
      driveWebViewLink: driveTest.webViewLink,
      status: 'OK',
    })

    return res.status(200).json({
      ok: true,
      message: 'Drive and Firestore connections verified.',
      driveTest,
      firestoreTest: {
        collection: 'systemChecks',
        documentId: firestoreRef.id,
      },
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
}
