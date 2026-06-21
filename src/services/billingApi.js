import { getStoredToken } from './authApi'

const parsePayload = async (response) => {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || payload.details || 'Billing request failed')
  return payload
}

export const getBillingStatus = async () => {
  const token = getStoredToken()
  const response = await fetch('/api/billing-status', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parsePayload(response)
}

export const createBillingOrder = async (planId) => {
  const token = getStoredToken()
  const response = await fetch('/api/billing-create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId }),
  })
  return parsePayload(response)
}

export const verifyBillingPayment = async (paymentPayload) => {
  const token = getStoredToken()
  const response = await fetch('/api/billing-verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(paymentPayload),
  })
  return parsePayload(response)
}

export const markBillingPaymentFailed = async ({ orderId, paymentId, reason }) => {
  const token = getStoredToken()
  const response = await fetch('/api/billing-mark-failed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId, paymentId, reason }),
  })
  return parsePayload(response)
}

export const getAdminSubscriptions = async () => {
  const token = getStoredToken()
  const response = await fetch('/api/admin-subscriptions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parsePayload(response)
}

export const loadRazorpayCheckout = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = resolve
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout. Check internet connection.'))
    document.body.appendChild(script)
  })
