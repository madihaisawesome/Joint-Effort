import { useEffect, useState } from "react"

export const JOINED_KEY = "je-joined-invites"
export const JOINED_EVENT = "je-joined-invites-changed"

export function readJoinedInvites() {
  try {
    const raw = localStorage.getItem(JOINED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function writeJoinedInvites(ids) {
  const next = Array.isArray(ids) ? ids.map(String) : []
  try {
    localStorage.setItem(JOINED_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(JOINED_EVENT, { detail: next }))
  }
  return next
}

/** Live list of invite ids this browser marked as interested. */
export function useJoinedInvites() {
  const [joined, setJoined] = useState(() => readJoinedInvites())

  useEffect(() => {
    function sync(next) {
      setJoined(Array.isArray(next) ? next.map(String) : readJoinedInvites())
    }
    function onCustom(event) {
      sync(event.detail)
    }
    function onStorage(event) {
      if (event.key === JOINED_KEY || event.key == null) sync()
    }
    function onFocus() {
      sync()
    }
    window.addEventListener(JOINED_EVENT, onCustom)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener(JOINED_EVENT, onCustom)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  return joined
}
