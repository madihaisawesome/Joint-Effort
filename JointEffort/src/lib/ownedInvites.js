import { useEffect, useState } from "react"

export const OWNED_KEY = "je-owned-invites"
export const OWNED_EVENT = "je-owned-invites-changed"

export function readOwnedInvites() {
  try {
    const raw = localStorage.getItem(OWNED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function writeOwnedInvites(ids) {
  const next = Array.isArray(ids) ? ids.map(String) : []
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OWNED_EVENT, { detail: next }))
  }
  return next
}

export function rememberOwnedInvite(id) {
  if (!id) return readOwnedInvites()
  const current = readOwnedInvites()
  if (current.includes(id)) return current
  return writeOwnedInvites([id, ...current])
}

export function forgetOwnedInvite(id) {
  return writeOwnedInvites(readOwnedInvites().filter((item) => item !== id))
}

export function useOwnedInvites() {
  const [owned, setOwned] = useState(() => readOwnedInvites())

  useEffect(() => {
    function sync(next) {
      setOwned(Array.isArray(next) ? next.map(String) : readOwnedInvites())
    }
    function onCustom(event) {
      sync(event.detail)
    }
    function onStorage(event) {
      if (event.key === OWNED_KEY || event.key == null) sync()
    }
    function onFocus() {
      sync()
    }
    window.addEventListener(OWNED_EVENT, onCustom)
    window.addEventListener("storage", onStorage)
    window.addEventListener("focus", onFocus)
    return () => {
      window.removeEventListener(OWNED_EVENT, onCustom)
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  return owned
}
