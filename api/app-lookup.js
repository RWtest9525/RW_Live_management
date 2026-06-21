import gplay from 'google-play-scraper'

export default async function handler(req, res) {
  console.log(`[API] App Lookup Request: ${req.method}`)
  
  // Allow both GET and POST for better compatibility with frontend
  if (req.method !== 'GET' && req.method !== 'POST') {
    console.error(`[API] Method not allowed: ${req.method}`)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    let packageId = ''

    if (req.method === 'POST') {
      const { value } = req.body || {}
      if (!value) return res.status(400).json({ error: 'Value is required' })
      
      // Extract package ID from URL if provided
      if (value.includes('id=')) {
        packageId = value.split('id=')[1].split('&')[0]
      } else {
        packageId = value
      }
    } else {
      // GET method
      packageId = req.query.packageId
    }

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID or Play Store URL is required' })
    }

    console.log(`Looking up app details for: ${packageId}`)
    const detail = await gplay.app({ appId: packageId, lang: 'en', country: 'in' })
    
    return res.status(200).json({
      name: detail.title,
      packageId: detail.appId,
      icon: detail.icon,
      developer: detail.developer,
      category: detail.genre,
      storeUrl: detail.url,
      starRating: detail.score,
    })
  } catch (error) {
    console.error(`App lookup failed:`, error.message)
    return res.status(404).json({ error: 'App not found on Play Store. Please check the URL or Package ID.' })
  }
}
