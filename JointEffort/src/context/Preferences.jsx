import { createContext, useContext, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "je-prefs"
const PreferencesContext = createContext(null)

const defaults = {
  textSize: "default",
  moreDetail: false,
  contrast: false,
  rate: 1,
}

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    return { ...defaults, ...saved }
  } catch {
    return defaults
  }
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    const root = document.documentElement
    root.dataset.text = prefs.textSize
    root.dataset.contrast = prefs.contrast ? "high" : "default"
    root.dataset.detail = prefs.moreDetail ? "on" : "off"
  }, [prefs])

  const value = useMemo(
    () => ({
      prefs,
      setTextSize: (textSize) => setPrefs((current) => ({ ...current, textSize })),
      setMoreDetail: (moreDetail) => setPrefs((current) => ({ ...current, moreDetail })),
      setContrast: (contrast) => setPrefs((current) => ({ ...current, contrast })),
      setRate: (rate) => setPrefs((current) => ({ ...current, rate })),
    }),
    [prefs],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error("usePreferences must be used inside PreferencesProvider")
  return value
}
