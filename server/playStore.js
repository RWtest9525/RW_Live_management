import gplay from 'google-play-scraper'

export const extractPackageId = (value) => {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw)
      const packageId = url.searchParams.get('id')
      return packageId ? packageId.trim() : ''
    } catch {
      return ''
    }
  }

  return raw
}

export const fetchPlayStoreMetadata = async (linkOrPackageId) => {
  const packageId = extractPackageId(linkOrPackageId)
  if (!packageId) {
    throw new Error('Enter a valid Play Store link or package ID.')
  }

  try {
    const app = await gplay.app({
      appId: packageId,
      lang: 'en',
      country: 'in',
    })

    return {
      packageId,
      appName: app.title ?? packageId,
      icon: app.icon ?? '',
      score: Number(app.score ?? 0),
      developer: app.developer ?? '',
      url: app.url ?? `https://play.google.com/store/apps/details?id=${packageId}`,
      summary: app.summary ?? '',
    }
  } catch {
    throw new Error(
      `Play Store app not found or link is invalid for India region: ${packageId}.`,
    )
  }
}
