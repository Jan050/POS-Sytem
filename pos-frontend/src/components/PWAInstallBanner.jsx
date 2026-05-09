import usePWAInstall from '../hooks/usePWAInstall'
import { useState } from 'react'

export default function PWAInstallBanner() {
  const { canInstall, install, isInstalling } = usePWAInstall()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa_banner_dismissed') === '1'
  )

  if (!canInstall || dismissed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80 animate-slide-in">
      <div className="card border-amber-500/40 bg-amber-500/10 p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-slate-900 font-bold text-lg">T</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-300 text-sm">Install TindahanPOS</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              Add to your home screen for faster access — works offline!
            </p>
          </div>
          <button
            onClick={() => { setDismissed(true); localStorage.setItem('pwa_banner_dismissed', '1') }}
            className="text-slate-500 hover:text-slate-300 p-1 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { setDismissed(true); localStorage.setItem('pwa_banner_dismissed', '1') }}
            className="btn btn-secondary flex-1 py-2 text-xs"
          >
            Not now
          </button>
          <button
            onClick={install}
            disabled={isInstalling}
            className="btn-primary flex-1 py-2 text-xs font-bold"
          >
            {isInstalling ? 'Installing…' : '📲 Install App'}
          </button>
        </div>
      </div>
    </div>
  )
}
