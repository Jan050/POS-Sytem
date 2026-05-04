/**
 * useOnlineStatus.js
 * Reactive hook that tracks whether the browser has network connectivity.
 *
 * Uses both:
 *   - window.navigator.onLine (instant, but can lie — reports "online" even without internet)
 *   - online/offline events (reliable signal for connection changes)
 *
 * On low-end Android devices, this is the most reliable method available
 * without making test HTTP requests.
 */
import { useState, useEffect } from 'react'

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}

export default useOnlineStatus
