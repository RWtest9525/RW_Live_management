import localDb from '../server/localDb.js';
import { readActiveUserFromRequest, verifySignedToken } from '../server/auth.js';
import {
  buildReviewExcelBuffer,
  getDroppedReviewsForAppDate,
  getVerifiedReviewsForAppDate,
} from '../server/excelReport.js';

export default async function handler(req, res) {
  try {
    const { proofId, type, appId, date, token } = req.query;
    const user = await readActiveUserFromRequest(req);
    const signedAccess = verifySignedToken(token);
    const hasValidExcelToken =
      signedAccess?.typ === 'excel-download' &&
      signedAccess.appId === appId &&
      String(signedAccess.date || '') === String(date || '');

    if (!user && !hasValidExcelToken) return res.status(401).json({ error: 'Unauthorized' });

    let reviews = [];
    let fileName = 'report.xlsx';

    if (proofId) {
      // 1. Export based on a specific proof
      const proof = localDb.prepare('SELECT * FROM proofs WHERE id = ?').get(proofId);
      if (!proof) return res.status(404).json({ error: 'Proof not found' });
      if (user?.role !== 'admin' && proof.ownerUserId !== user?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const client = localDb.prepare('SELECT name FROM clients WHERE id = ?').get(proof.clientId);
      fileName = `${client?.name || 'Client'}_${proof.date}_${proof.appName}_DayProof.xlsx`;
      
      reviews = localDb.prepare(`
        SELECT userName, content, rating, date 
        FROM reviews 
        WHERE appId = ? AND status = 'VERIFIED LIVE'
        ORDER BY datetime(date) DESC, rowid DESC
      `).all(proof.appId);
    } else if (type === 'dropped') {
      if (!appId) return res.status(400).json({ error: 'appId required for dropped list' });
      const app = localDb.prepare('SELECT name, ownerUserId FROM apps WHERE id = ?').get(appId);
      if (!app) return res.status(404).json({ error: 'App not found' });
      if (user?.role !== 'admin' && app.ownerUserId !== user?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      fileName = `${app?.name || 'App'}_${date || 'All'}_Dropped.xlsx`;
      
      reviews = getDroppedReviewsForAppDate({ appId, date });
    } else if (appId) {
      // 2. Export based on appId and optional date (used for Telegram links)
      const app = localDb.prepare('SELECT name, ownerUserId FROM apps WHERE id = ?').get(appId);
      if (!app) return res.status(404).json({ error: 'App not found' });
      if (!hasValidExcelToken && user?.role !== 'admin' && app.ownerUserId !== user?.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      fileName = `${app.name}_${date || 'Report'}.xlsx`;
      
      reviews = getVerifiedReviewsForAppDate({ appId, date });
    }

    const { buffer, fileName: safeName } = buildReviewExcelBuffer({ reviews, fileName });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('Excel Export Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
