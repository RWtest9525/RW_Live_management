export const SUBSCRIPTION_PLANS = {
  weekly_199: {
    id: 'weekly_199',
    name: 'Starter Week',
    priceInr: 199,
    durationDays: 7,
    listLimit: 100,
    storageGb: 10,
    telegramNotifications: false,
    badge: 'Best for testing',
    benefits: [
      '1 week portal access',
      '100 app list entries',
      '10 GB proof recording storage',
      'Same sync quality and proof recording engine',
      'Client-wise proof gallery',
    ],
  },
  monthly_499: {
    id: 'monthly_499',
    name: 'Growth Month',
    priceInr: 499,
    durationDays: 30,
    listLimit: 1000,
    storageGb: 50,
    telegramNotifications: true,
    badge: 'Popular',
    benefits: [
      '1 month portal access',
      '1000 app list entries',
      '50 GB proof recording storage',
      'Same sync quality and proof recording engine',
      'Telegram automatic notifications',
    ],
  },
  monthly_999: {
    id: 'monthly_999',
    name: 'Pro Month',
    priceInr: 999,
    durationDays: 30,
    listLimit: 1000,
    storageGb: 100,
    telegramNotifications: true,
    badge: 'More storage',
    benefits: [
      '1 month portal access',
      '1000 app list entries',
      '100 GB proof recording storage',
      'Same sync quality and proof recording engine',
      'Telegram automatic notifications',
    ],
  },
  yearly_9999: {
    id: 'yearly_9999',
    name: 'Agency Year',
    priceInr: 9999,
    durationDays: 365,
    listLimit: null,
    storageGb: null,
    telegramNotifications: false,
    badge: 'Unlimited',
    benefits: [
      '1 year portal access',
      'Unlimited app list entries',
      'Unlimited proof recording storage',
      'Same sync quality and proof recording engine',
      'Best value for agencies',
    ],
  },
}

/**
 * Scraper API Key Subscription Plans & Limits
 * Request Limit = Maximum Number of API Fetch Calls allowed for the key
 */
export const API_SCRAPER_PLANS = {
  Weekly: {
    id: 'Weekly',
    name: 'Weekly Plan',
    priceInr: 199,
    durationDays: 7,
    requestLimit: 200,
    isUnlimited: false,
    label: 'Weekly Plan (₹199 - 200 Fetch Calls / 7 Days)',
    description: '7 Days Access - 200 total API fetch requests allowed',
  },
  Monthly: {
    id: 'Monthly',
    name: 'Monthly Plan',
    priceInr: 999,
    durationDays: 30,
    requestLimit: 1000,
    isUnlimited: false,
    label: 'Monthly Plan (₹999 - 1000 Fetch Calls / 30 Days)',
    description: '30 Days Access - 1000 total API fetch requests allowed',
  },
  Enterprise: {
    id: 'Enterprise',
    name: 'Enterprise Plan (Yearly)',
    priceInr: 10000,
    durationDays: 365,
    requestLimit: 999999999,
    isUnlimited: true,
    label: 'Enterprise Yearly Plan (₹10,000 - Unlimited Fetches / 365 Days)',
    description: '365 Days Access - Unlimited API fetch requests allowed',
  },
}

export const getSubscriptionPlan = (planId) => SUBSCRIPTION_PLANS[planId] ?? null

export const isUnlimited = (value) => value === null || value === undefined || value >= 999999000

export const formatPlanLimit = (value, suffix = '') =>
  isUnlimited(value) ? 'Unlimited' : `${value}${suffix}`
