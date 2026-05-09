import { useState, useEffect } from 'react'

/**
 * Hook to handle PWA "Add to Home Screen" install prompt.
 * Works on Chrome/Edge Android and desktop.
 */
const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled,   setIsInstalled]   = useState(false)
  const [isInstalling,  setIsInstalling]  = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!installPrompt) return
    setIsInstalling(true)
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setIsInstalled(true)
      setInstallPrompt(null)
    } finally {
      setIsInstalling(false)
    }
  }

  return { installPrompt, isInstalled, isInstalling, install, canInstall: !!installPrompt && !isInstalled }
}

export default usePWAInstall
