import { useState } from 'react'
import usePortalStore from '../store/usePortalStore'

function ProofGalleryPage() {
  const proofs = usePortalStore((state) => state.proofs)
  const [selectedProofId, setSelectedProofId] = useState('')
  const selectedProof = proofs.find((proof) => proof.id === selectedProofId) ?? null

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Proof Gallery</h2>
        <p className="text-sm text-slate-500">7th-day automated recordings and audit proof</p>
      </div>
      {selectedProof?.videoUrl ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{selectedProof.appName}</h3>
              <p className="text-sm text-slate-500">{selectedProof.day}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProofId('')}
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Close Preview
            </button>
          </div>
          <video
            className="mt-4 w-full rounded-xl bg-slate-950"
            controls
            src={selectedProof.videoUrl}
          >
            Your browser does not support inline video playback.
          </video>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {proofs.map((proof) => (
          <article key={proof.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900">{proof.appName}</h3>
            <p className="mt-1 text-sm text-slate-500">{proof.day}</p>
            <p className="mt-3 text-xs text-slate-500">Generated: {proof.createdAt}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedProofId(proof.id)}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                Preview Recording
              </button>
              <a
                href={proof.downloadUrl ?? proof.videoUrl ?? '#'}
                download
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Download MP4
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ProofGalleryPage
