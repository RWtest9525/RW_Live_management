import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { mockApps } from '../data/mockData'
import { db } from '../lib/firebase'

const appsCollection = collection(db, 'apps')
const reviewsCollection = collection(db, 'reviews')
const proofsCollection = collection(db, 'proofs')
const usersCollection = collection(db, 'users')

const toAppModel = (id, data) => ({
  id,
  packageId: data.packageId ?? '',
  name: data.name ?? data.packageId ?? 'Unknown App',
  category: data.category ?? 'General',
  active: data.monitoringStatus === 'ACTIVE',
  monitoringStatus: data.monitoringStatus ?? 'ACTIVE',
  ratePerReview: Number(data.ratePerReview ?? 10),
  targetCount: Number(data.targetCount ?? 0),
  syncedAt: data.lastSyncedAt?.toDate?.()?.toLocaleString?.('en-IN') ?? 'Not synced',
  verifiedLive: 0,
  dropped: 0,
  verifiedUsernames: [],
  hintSymbol: data.selectedHint ?? ',',
  proofStatus: data.proofStatus ?? 'Pending',
})

export const seedAppsIfMissing = async () => {
  const snapshot = await getDocs(appsCollection)
  if (!snapshot.empty) return

  const batch = writeBatch(db)
  mockApps.forEach((app) => {
    const ref = doc(appsCollection)
    batch.set(ref, {
      name: app.name,
      packageId: `com.reviewworld.${app.id}`,
      category: app.category,
      targetCount: app.verifiedLive + app.dropped,
      ratePerReview: 10,
      monitoringStatus: app.active ? 'ACTIVE' : 'PAUSED',
      selectedHint: app.hintSymbol ?? ',',
      lastSyncedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
  })
  await batch.commit()
}

const byOwnerQuery = (collectionRef, ownerUserId, ownerField = 'ownerUserId') => {
  if (!ownerUserId) return query(collectionRef, orderBy('name'))
  return query(collectionRef, where(ownerField, '==', ownerUserId))
}

export const subscribeApps = ({ ownerUserId, isAdmin, onData }) =>
  onSnapshot(
    isAdmin ? query(appsCollection, orderBy('name')) : byOwnerQuery(appsCollection, ownerUserId),
    (snapshot) => {
    onData(snapshot.docs.map((entry) => toAppModel(entry.id, entry.data())))
    },
  )

export const subscribeReviews = ({ ownerUserId, isAdmin, onData }) =>
  onSnapshot(isAdmin ? reviewsCollection : query(reviewsCollection, where('ownerUserId', '==', ownerUserId)), (snapshot) => {
    onData(
      snapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
    )
  })

export const subscribeProofs = ({ ownerUserId, isAdmin, onData }) =>
  onSnapshot(
    isAdmin
      ? query(proofsCollection, orderBy('createdAt', 'desc'))
      : query(proofsCollection, where('ownerUserId', '==', ownerUserId)),
    (snapshot) => {
    onData(
      snapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
        createdAt:
          entry.data().createdAt?.toDate?.()?.toLocaleString?.('en-IN') ??
          'Pending',
      })),
    )
    },
  )

export const subscribeUsers = (onData) =>
  onSnapshot(query(usersCollection, orderBy('createdAt', 'desc')), (snapshot) => {
    onData(
      snapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      })),
    )
  })

export const updateAppRate = async (appId, ratePerReview) => {
  await updateDoc(doc(db, 'apps', appId), { ratePerReview: Number(ratePerReview) })
}

export const createAppRecord = async (payload) =>
  addDoc(appsCollection, {
    name: payload.name,
    packageId: payload.packageId,
    category: payload.category ?? 'General',
    targetCount: Number(payload.targetCount ?? 0),
    ratePerReview: Number(payload.ratePerReview ?? 10),
    selectedHint: payload.selectedHint ?? ',',
    monitoringStatus: payload.monitoringStatus ?? 'ACTIVE',
    ownerUserId: payload.ownerUserId ?? null,
    createdAt: serverTimestamp(),
    lastSyncedAt: serverTimestamp(),
  })

export const updateReviewStatus = async (reviewId, status) =>
  updateDoc(doc(db, 'reviews', reviewId), { status, updatedAt: serverTimestamp() })

export const getAppReviews = async (appId) => {
  const snapshot = await getDocs(query(reviewsCollection, where('appId', '==', appId)))
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
}

export const upsertReview = async (reviewId, payload) =>
  setDoc(
    doc(db, 'reviews', reviewId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
