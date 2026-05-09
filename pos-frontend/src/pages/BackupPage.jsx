import { useState, useRef } from 'react'
import { backupApi } from '../api'
import { useToast } from '../components/ui/Toast'
import { formatDateTime } from '../utils/formatters'

export default function BackupPage() {
  const toast = useToast()
  const fileRef = useRef(null)

  const [exporting,  setExporting]  = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [restoring,  setRestoring]  = useState(false)
  const [restoreFile,setRestoreFile]= useState(null)
  const [preview,    setPreview]    = useState(null)
  const [restoreResult, setRestoreResult] = useState(null)

  const handleExport = async () => {
    if (!exportPassword) {
      toast('Enter your current password to export backup', 'error')
      return
    }
    setExporting(true)
    try {
      const data = await backupApi.export({ currentPassword: exportPassword })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `tindahan-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportPassword('')
      toast('Backup downloaded ✅', 'success')
    } catch (err) {
      toast(err.message || 'Export failed', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRestoreResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result)
        setRestoreFile(parsed)
        setPreview(parsed)
      } catch {
        toast('Invalid JSON file', 'error')
        setRestoreFile(null)
        setPreview(null)
      }
    }
    reader.readAsText(file)
  }

  const handleRestore = async () => {
    if (!restoreFile?.data?.products?.length) return toast('No products to restore', 'error')
    setRestoring(true)
    try {
      const res = await backupApi.restoreProducts({ products: restoreFile.data.products })
      setRestoreResult(res)
      toast(res.message, 'success')
    } catch (err) {
      toast(err.message || 'Restore failed', 'error')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-surface-800 border-b border-surface-700 shrink-0">
        <h1 className="font-display font-semibold text-xl text-slate-100">Backup & Restore</h1>
        <p className="text-slate-500 text-sm">Export your data or restore from a previous backup</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {/* Export Section */}
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-500/15 rounded-xl flex items-center justify-center text-2xl shrink-0">
              📤
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-slate-100">Export Backup</h2>
              <p className="text-slate-400 text-sm mt-1">
                Downloads a JSON file containing all your products, orders, expenses, and utang records.
                Save this file somewhere safe (Google Drive, USB, etc).
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="btn-primary mt-4 px-5 py-2.5 text-sm font-semibold"
              >
                {exporting ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Exporting…
                  </span>
                ) : '📥 Download Backup'}
              </button>
              <div className="mt-3">
                <label className="text-xs text-slate-400 block mb-1.5">Re-enter current password</label>
                <input
                  type="password"
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Required for secure export"
                  className="input px-3 py-2.5 max-w-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Restore Section */}
        <div className="card p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/15 rounded-xl flex items-center justify-center text-2xl shrink-0">
              📂
            </div>
            <div className="flex-1">
              <h2 className="font-display font-semibold text-slate-100">Restore Products</h2>
              <p className="text-slate-400 text-sm mt-1">
                Import products from a backup file. Only new products will be added — existing ones are skipped.
                Orders, expenses, and utang are read-only and won't be restored (to prevent duplicates).
              </p>

              <div className="mt-4 space-y-3">
                {/* File picker */}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn btn-secondary px-4 py-2.5 text-sm"
                  >
                    📁 Select Backup File
                  </button>
                </div>

                {/* Preview */}
                {preview && (
                  <div className="bg-surface-900 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Backup Info</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Exported:</span> <span className="text-slate-300">{formatDateTime(preview.exportedAt)}</span></div>
                      <div><span className="text-slate-500">By:</span> <span className="text-slate-300 font-mono">{preview.exportedBy || '—'}</span></div>
                      <div><span className="text-slate-500">Products:</span> <span className="text-amber-400 font-bold">{preview.counts?.products || 0}</span></div>
                      <div><span className="text-slate-500">Orders:</span> <span className="text-slate-300">{preview.counts?.orders || 0}</span></div>
                      <div><span className="text-slate-500">Expenses:</span> <span className="text-slate-300">{preview.counts?.expenses || 0}</span></div>
                      <div><span className="text-slate-500">Utang:</span> <span className="text-slate-300">{preview.counts?.utang || 0}</span></div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2">
                      <p className="text-amber-300 text-xs font-medium">
                        ⚠️ This will add {preview.counts?.products || 0} products to your store.
                        Duplicate products (same name) will be skipped.
                      </p>
                    </div>

                    <button
                      onClick={handleRestore}
                      disabled={restoring}
                      className="btn btn-secondary w-full py-2.5 text-sm font-semibold mt-2 border-blue-500/40 text-blue-300 hover:bg-blue-500/10"
                    >
                      {restoring ? 'Restoring…' : '🔄 Restore Products'}
                    </button>
                  </div>
                )}

                {/* Result */}
                {restoreResult && (
                  <div className="bg-green-900/30 border border-green-700/40 rounded-xl p-4">
                    <p className="text-green-300 font-semibold text-sm">✅ Restore Complete</p>
                    <p className="text-green-400/80 text-xs mt-1">{restoreResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Safety tips */}
        <div className="card p-5 bg-surface-900/50">
          <h3 className="font-semibold text-slate-300 text-sm mb-3">💡 Backup Best Practices</h3>
          <ul className="space-y-2 text-xs text-slate-500">
            <li className="flex gap-2"><span>📅</span> Export a backup at the end of each week</li>
            <li className="flex gap-2"><span>☁️</span> Save to Google Drive or send to your email</li>
            <li className="flex gap-2"><span>🔒</span> Keep backups private — they contain your sales data</li>
            <li className="flex gap-2"><span>♻️</span> Use restore to set up a new device or after data loss</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
