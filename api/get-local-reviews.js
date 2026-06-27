import localDb from '../server/localDb.js';
import { readActiveUserFromRequest } from '../server/auth.js';

const IST_OFFSET_MINUTES = 330;
const DAY_MS = 24 * 60 * 60 * 1000;

const getIstListingDayUtcWindow = (targetDate) => {
  const targetMs = new Date(targetDate).getTime();
  if (Number.isNaN(targetMs)) {
    return null;
  }

  const targetIstMs = targetMs + IST_OFFSET_MINUTES * 60 * 1000;
  const istDayStart = Math.floor(targetIstMs / DAY_MS) * DAY_MS;
  const startMs = istDayStart - IST_OFFSET_MINUTES * 60 * 1000;
  const endMs = startMs + DAY_MS;

  return { startMs, endMs };
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { appId } = req.query;

  if (!appId) {
    return res.status(400).json({ error: 'appId is required' });
  }

  try {
    const user = readActiveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized or account is not active' });
    }

    const isAdmin = user.role === 'admin';
    const app = localDb.prepare('SELECT id, targetDate FROM apps WHERE id = ?').get(appId);
    const listingWindow = app?.targetDate ? getIstListingDayUtcWindow(app.targetDate) : null;
    let reviews;

    if (isAdmin) {
      // Admins can see all reviews for an app
      reviews = localDb.prepare('SELECT * FROM reviews WHERE appId = ? ORDER BY datetime(date) DESC, rowid DESC').all(appId);
    } else {
      // Users can only see reviews they own
      reviews = localDb.prepare('SELECT * FROM reviews WHERE appId = ? AND ownerUserId = ? ORDER BY datetime(date) DESC, rowid DESC').all(appId, user.id);
    }

    const safeReviews = Array.isArray(reviews) ? reviews : [];
    const filteredReviews = listingWindow
      ? safeReviews.filter((review) => {
          const reviewMs = new Date(review.date).getTime();
          return !Number.isNaN(reviewMs) && reviewMs >= listingWindow.startMs && reviewMs < listingWindow.endMs;
        })
      : safeReviews;

    res.status(200).json(filteredReviews);
  } catch (error) {
    console.error('Error fetching local reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
}
