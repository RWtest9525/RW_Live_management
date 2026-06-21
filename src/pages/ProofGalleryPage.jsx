import { useMemo, useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { getStoredToken } from '../services/authApi'

const UNASSIGNED = '__unassigned__'

const getFinalProofDay = (app) => {
  const targetMs = app?.targetDate ? new Date(app.targetDate).getTime() : null
  const stopMs = app?.stopCheckingAfter ? new Date(app.stopCheckingAfter).getTime() : null
  if (!targetMs || !stopMs || Number.isNaN(targetMs) || Number.isNaN(stopMs)) return null
  return `Day ${Math.max(1, Math.round((stopMs - targetMs) / (1000 * 60 * 60 * 24)))}`
}

function ProofGalleryPage() {
  const proofs = usePortalStore((state) => state.proofs)
  const clients = usePortalStore((state) => state.clients)
  const apps = usePortalStore((state) => state.apps)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedProofId, setSelectedProofId] = useState('')

  const proofsForGallery = useMemo(() => {
    const safeProofs = Array.isArray(proofs) ? proofs : []
    const safeApps = Array.isArray(apps) ? apps : []
    return safeProofs
      .filter((proof) => {
        const app = safeApps.find((item) => item.id === proof.appId)
        const finalDay = getFinalProofDay(app)
        return !finalDay || proof.day === finalDay
      })
      .map((proof) => {
        const app = safeApps.find((item) => item.id === proof.appId)
        return {
          ...proof,
          resolvedClientId: proof.clientId || app?.clientId || UNASSIGNED,
        }
      })
  }, [proofs, apps])

  const proofClientIds = [...new Set(proofsForGallery.map((proof) => proof.resolvedClientId))]
  const galleryClients = clients.filter((client) => proofClientIds.includes(client.id))
  const unassignedCount = proofsForGallery.filter((proof) => proof.resolvedClientId === UNASSIGNED).length

  const clientProofs = selectedClientId
    ? proofsForGallery.filter((proof) => proof.resolvedClientId === selectedClientId)
    : []
  const clientDates = [...new Set(clientProofs.map((proof) => proof.date).filter(Boolean))].sort((a, b) =>
    b.localeCompare(a),
  )
  const dateProofs =
    selectedClientId && selectedDate ? clientProofs.filter((proof) => proof.date === selectedDate) : []
  const selectedProof = proofsForGallery.find((proof) => proof.id === selectedProofId) ?? null

  const getProofVideoUrl = (proof) => {
    if (!proof) return ''
    if (proof.videoUrl?.includes('/api/proof-video') && proof.videoUrl?.includes('token=')) return proof.videoUrl
    return `/api/proof-video?proofId=${proof.id}`
  }

  const driveFolderLabel = (proof) => {
    if (!proof) return ''
    const clientName =
      proof.resolvedClientId && proof.resolvedClientId !== UNASSIGNED
        ? clients.find((client) => client.id === proof.resolvedClientId)?.name || 'Client'
        : 'Client'
    const safeClient = String(clientName).replace(/[^\w.-]+/g, '_')
    const safeApp = String(proof.appName || 'App').replace(/[^\w.-]+/g, '_')
    return `${safeClient} / ${proof.date || '-'} / ${safeApp}`
  }

  const resetToClients = () => {
    setSelectedClientId('')
    setSelectedDate('')
    setSelectedProofId('')
  }

  const downloadFile = async (url, fallbackName) => {
    const token = getStoredToken()
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      alert(payload?.error || 'Excel download failed.')
      return
    }

    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="([^"]+)"/i)
    const fileName = match?.[1] || fallbackName
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  const downloadExcel = (proof) => {
    downloadFile(`/api/download-excel?proofId=${proof.id}`, `${proof.appName || 'Proof'}_${proof.date || 'report'}.xlsx`)
  }

  const downloadDroppedExcel = (proof) => {
    downloadFile(
      `/api/download-excel?type=dropped&appId=${proof.appId}&date=${proof.date}`,
      `${proof.appName || 'App'}_${proof.date || 'all'}_Dropped.xlsx`,
    )
  }

  const shareVideo = (proof) => {
    const videoUrl = getProofVideoUrl(proof)
    if (navigator.share) {
      navigator.share({ title: `Proof: ${proof.appName}`, text: `${proof.appName} ${proof.day}`, url: videoUrl }).catch(() => {})
      return
    }
    navigator.clipboard.writeText(videoUrl)
    alert('Video link copied.')
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Proof Gallery</h2>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <button
          type="button"
          onClick={resetToClients}
          className={`hover:text-blue-600 ${!selectedClientId ? 'font-bold text-blue-600' : ''}`}
        >
          All Clients
        </button>
        {selectedClientId ? (
          <>
            <span>/</span>
            <button
              type="button"
              onClick={() => {
                setSelectedDate('')
                setSelectedProofId('')
              }}
              className={`hover:text-blue-600 ${!selectedDate ? 'font-bold text-blue-600' : ''}`}
            >
              {selectedClientId === UNASSIGNED
                ? 'Unlinked'
                : clients.find((client) => client.id === selectedClientId)?.name || 'Client'}
            </button>
          </>
        ) : null}
        {selectedDate ? (
          <>
            <span>/</span>
            <span className="font-bold text-blue-600">{selectedDate}</span>
          </>
        ) : null}
      </div>

      {!selectedClientId ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {unassignedCount > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedClientId(UNASSIGNED)}
              className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm transition-all hover:border-amber-400 hover:shadow-md"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5 19h14L12 4 5 19z" />
                </svg>
              </div>
              <span className="font-semibold text-slate-900">Unlinked</span>
              <span className="mt-1 text-xs text-slate-600">{unassignedCount} recordings</span>
            </button>
          ) : null}
          {galleryClients.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => setSelectedClientId(client.id)}
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m2 0h14M9 7h1m4 0h1M9 11h1m4 0h1" />
                </svg>
              </div>
              <span className="font-semibold text-slate-900">{client.name}</span>
              <span className="mt-1 text-xs text-slate-500">
                {proofsForGallery.filter((proof) => proof.resolvedClientId === client.id).length} recordings
              </span>
            </button>
          ))}
          {galleryClients.length === 0 && unassignedCount === 0 ? (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-500">
              No proof recordings yet.
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedClientId && !selectedDate ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {clientDates.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              No proof recordings for this client yet.
            </div>
          ) : (
            clientDates.map((date) => (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-400 hover:shadow-md"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-900">{date}</span>
                <span className="mt-1 text-xs text-slate-500">
                  {clientProofs.filter((proof) => proof.date === date).length} videos
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedClientId && selectedDate ? (
        <>
          {selectedProof ? (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm">
              <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-white shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{selectedProof.appName}</h3>
                    <p className="text-sm text-slate-300">
                      {selectedProof.day} ({selectedProof.date})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProofId('')}
                    className="shrink-0 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                    aria-label="Close video preview"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="flex flex-1 items-center justify-center bg-black p-2 sm:p-4">
                  <video
                    className="aspect-video max-h-[72vh] w-full rounded-2xl bg-black object-contain"
                    controls
                    autoPlay
                    playsInline
                    src={getProofVideoUrl(selectedProof)}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-white/10 bg-slate-900 px-4 py-3">
                  <button onClick={() => shareVideo(selectedProof)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
                    Share Video
                  </button>
                  <button onClick={() => downloadExcel(selectedProof)} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                    Download Excel
                  </button>
                  <button onClick={() => downloadDroppedExcel(selectedProof)} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">
                    Dropped Excel
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dateProofs.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                No proofs for this date.
              </div>
            ) : (
              dateProofs.map((proof) => (
                <article key={proof.id} className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-400">
                  <div className="flex flex-1 flex-col">
                    <h3 className="font-semibold text-slate-900">{proof.appName}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {proof.day}
                      </span>
                      <span className="text-xs text-slate-500">{proof.date}</span>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedProofId(proof.id)}
                      className="flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-600 hover:text-white"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadExcel(proof)}
                      className="flex items-center justify-center rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white"
                    >
                      Excel
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

export default ProofGalleryPage
