import { useMemo, useState } from 'react'
import usePortalStore from '../store/usePortalStore'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

function MoneyTrackerPage() {
  const apps = usePortalStore((state) => state.apps)
  const reviews = usePortalStore((state) => state.reviews)
  const clients = usePortalStore((state) => state.clients)
  const theme = usePortalStore((state) => state.theme)

  const currentYear = new Date().getFullYear()
  const [selectedClientId, setSelectedClientId] = useState('all')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1) // 1-12

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const filteredApps = useMemo(() => {
    if (selectedClientId === 'all') return apps
    return apps.filter(app => app.clientId === selectedClientId)
  }, [apps, selectedClientId])

  const stats = useMemo(() => {
    // Calculate start and end date of selected month
    const startDate = new Date(selectedYear, selectedMonth - 1, 1)
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59)

    const appStats = filteredApps.map(app => {
      let appReviews = reviews.filter(r => r.appId === app.id && r.status === 'VERIFIED LIVE')
      
      appReviews = appReviews.filter(r => {
        const rDate = r.date?.toDate?.() ?? new Date(r.date ?? Date.now())
        return rDate >= startDate && rDate <= endDate
      })
      
      const count = appReviews.length
      const rate = Number(app.ratePerReview ?? 0)
      return {
        id: app.id,
        name: app.name,
        count,
        rate,
        total: count * rate
      }
    }).filter(s => s.count > 0) // Only show apps with activity

    const grandTotal = appStats.reduce((sum, s) => sum + s.total, 0)
    return { appStats, grandTotal, startDate, endDate }
  }, [filteredApps, reviews, selectedYear, selectedMonth])

  const generatePDF = (preview = false) => {
    const doc = new jsPDF()
    const clientName = selectedClientId === 'all' ? 'All Clients' : (clients.find(c => c.id === selectedClientId)?.name || 'Client')
    const monthLabel = months.find(m => m.value === selectedMonth)?.label
    const periodStr = `${monthLabel} ${selectedYear}`

    // Header Design
    doc.setFillColor(37, 99, 235) // blue-600
    doc.rect(0, 0, 210, 40, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('REVIEW WORLD', 14, 25)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('MONTHLY INVOICE / PAYOUT REPORT', 14, 33)

    // Report Info
    doc.setTextColor(15, 23, 42) // slate-900
    doc.setFontSize(10)
    doc.text(`CLIENT: ${clientName.toUpperCase()}`, 14, 50)
    doc.text(`PERIOD: ${periodStr.toUpperCase()}`, 14, 56)
    doc.text(`GENERATED: ${new Date().toLocaleString('en-IN')}`, 14, 62)
    doc.text(`DUE DATE: 10th ${months.find(m => m.value === (selectedMonth % 12 + 1))?.label} ${selectedMonth === 12 ? selectedYear + 1 : selectedYear}`, 14, 68)

    const tableData = stats.appStats.map(s => [
      s.name,
      s.count,
      `Rs ${s.rate}`,
      `Rs ${s.total}`
    ])

    autoTable(doc, {
      startY: 75,
      head: [['APPLICATION NAME', 'LIVE REVIEWS', 'RATE', 'TOTAL PAYOUT']],
      body: tableData,
      theme: 'striped',
      headStyles: { 
        fillColor: [15, 23, 42], 
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' }
      },
      styles: {
        fontSize: 9,
        cellPadding: 4
      },
      foot: [[
        { content: 'GRAND TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `Rs ${stats.grandTotal}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [37, 99, 235] } }
      ]],
      footStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42]
      }
    })

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Page ${i} of ${pageCount} - Review World Official Report`, 105, 285, { align: 'center' })
    }

    if (preview) {
      window.open(doc.output('bloburl'), '_blank')
    } else {
      doc.save(`Invoice_${clientName.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`)
    }
  }

  return (
    <section className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Money Tracker</h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Monthly billing and professional invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Client Filter</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={`rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
            >
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
            >
              {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={`rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${theme === 'dark' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`}
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-2 pt-5">
            <button
              onClick={() => generatePDF(true)}
              className={`rounded-xl px-5 py-2 text-sm font-bold transition-all transform active:scale-95 ${theme === 'dark' ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
            >
              Preview
            </button>
            <button
              onClick={() => generatePDF(false)}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all transform active:scale-95 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-xl overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={`${theme === 'dark' ? 'bg-slate-950 border-b border-slate-800' : 'bg-slate-50 border-b border-slate-200'}`}>
              <tr>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Application Name</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Live Reviews</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Rate (Rs)</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Total Payout</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'dark' ? 'divide-slate-800' : 'divide-slate-100'}`}>
              {stats.appStats.map((item) => (
                <tr key={item.id} className={`group transition-all ${theme === 'dark' ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'}`}>
                  <td className={`px-6 py-5 font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{item.name}</td>
                  <td className={`px-6 py-5 text-center font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{item.count}</td>
                  <td className={`px-6 py-5 text-center font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Rs {item.rate}</td>
                  <td className="px-6 py-5 text-right font-black text-emerald-500 text-base">Rs {item.total}</td>
                </tr>
              ))}
              {stats.appStats.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No activity for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className={`${theme === 'dark' ? 'bg-slate-950/50' : 'bg-slate-50'} border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
              <tr>
                <td colSpan="3" className={`px-6 py-6 text-right font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Grand Total Payout</td>
                <td className="px-6 py-6 text-right text-2xl font-black text-blue-500">Rs {stats.grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <div className={`p-4 rounded-xl text-center text-xs font-bold ${theme === 'dark' ? 'bg-slate-800/50 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
        Billing cycle completes on the last day of the month. Payouts processed by 10th of the following month.
      </div>
    </section>
  )
}

export default MoneyTrackerPage
