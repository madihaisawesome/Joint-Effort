import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./Auth.jsx"

const PlaceContext = createContext(null)
const pendingKey = "je-pending-place"

export const campus = {
  label: "University of Calgary, 2500 University Drive NW",
  shortLabel: "University of Calgary",
  lat: 51.078,
  lng: -114.1335,
}

function storageKey(sub) {
  return `je-place:${sub}`
}

export function PlaceProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const [place, setPlace] = useState(campus)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState(
    "Showing events near the University of Calgary, 2500 University Drive NW.",
  )

  useEffect(() => {
    if (!isAuthenticated || !user?.sub) {
      setSaved(false)
      return
    }
    const pending = sessionStorage.getItem(pendingKey)
    if (pending) {
      const next = JSON.parse(pending)
      localStorage.setItem(storageKey(user.sub), JSON.stringify(next))
      sessionStorage.removeItem(pendingKey)
      setPlace(next)
      setSaved(true)
      setStatus(`Saved this location on this browser: ${next.label}.`)
      return
    }
    const raw = localStorage.getItem(storageKey(user.sub))
    if (!raw) return
    const next = JSON.parse(raw)
    setPlace(next)
    setSaved(true)
    setStatus(`Showing your saved location: ${next.label}.`)
  }, [isAuthenticated, user?.sub])

  const value = useMemo(
    () => ({
      place,
      saved,
      status,
      setStatus,
      choose(next) {
        setPlace(next)
        setSaved(false)
        setStatus(`Showing events near ${next.label}. This location is not saved yet.`)
      },
      save() {
        if (!isAuthenticated || !user?.sub) {
          sessionStorage.setItem(pendingKey, JSON.stringify(place))
          return false
        }
        localStorage.setItem(storageKey(user.sub), JSON.stringify(place))
        setSaved(true)
        setStatus("Saved this location on this browser.")
        return true
      },
    }),
    [isAuthenticated, place, saved, status, user?.sub],
  )

  return <PlaceContext.Provider value={value}>{children}</PlaceContext.Provider>
}

export function usePlace() {
  const value = useContext(PlaceContext)
  if (!value) throw new Error("usePlace must be used inside PlaceProvider")
  return value
}
