import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { usePreferences } from "./Preferences.jsx"

const SpeechContext = createContext(null)

function collectBlocks() {
  const main = document.getElementById("main")
  if (!main) return []
  return [...main.querySelectorAll("h1, h2, h3, p, li")].filter((element) => {
    if (element.closest("[data-skip-speech]")) return false
    if (element.closest(".is-spoken-skip")) return false
    if (!element.innerText.trim()) return false
    if (element.querySelector("h1, h2, h3, p, li")) return false
    return true
  })
}

function clearMark() {
  document.querySelectorAll(".is-spoken").forEach((element) => {
    element.classList.remove("is-spoken")
  })
}

export function SpeechProvider({ children }) {
  const location = useLocation()
  const { prefs } = usePreferences()
  const [phase, setPhase] = useState("speechSynthesis" in window ? "idle" : "unavailable")
  const [snippet, setSnippet] = useState("")
  const token = useRef(0)
  const rate = useRef(prefs.rate)
  rate.current = prefs.rate

  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      setPhase("unavailable")
      return undefined
    }
    const check = () => {
      const voices = window.speechSynthesis.getVoices()
      setPhase((current) => {
        if (current === "playing" || current === "paused") return current
        return voices.length ? "idle" : "unavailable"
      })
    }
    check()
    window.speechSynthesis.addEventListener?.("voiceschanged", check)
    const timer = window.setTimeout(check, 1200)
    return () => {
      window.clearTimeout(timer)
      window.speechSynthesis.removeEventListener?.("voiceschanged", check)
    }
  }, [])

  useEffect(() => {
    token.current += 1
    window.speechSynthesis?.cancel()
    clearMark()
    setSnippet("")
    setPhase("speechSynthesis" in window && window.speechSynthesis.getVoices().length ? "idle" : "unavailable")
  }, [location.pathname])

  const speakAt = (index, run) => {
    if (run !== token.current) return
    const blocks = collectBlocks()
    const block = blocks[index]
    if (!block) {
      clearMark()
      setSnippet("")
      setPhase("idle")
      return
    }
    clearMark()
    block.classList.add("is-spoken")
    const text = block.innerText.trim()
    setSnippet(text)
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en"
    utterance.rate = rate.current
    utterance.onend = () => speakAt(index + 1, run)
    utterance.onerror = (event) => {
      if (event.error === "interrupted" || event.error === "canceled") return
      clearMark()
      setPhase("idle")
    }
    window.speechSynthesis.speak(utterance)
    setPhase("playing")
  }

  const play = () => {
    if (!("speechSynthesis" in window)) {
      setPhase("unavailable")
      return
    }
    if (!window.speechSynthesis.getVoices().length) {
      setPhase("unavailable")
      return
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setPhase("playing")
      return
    }
    window.speechSynthesis.cancel()
    const run = token.current + 1
    token.current = run
    speakAt(0, run)
  }

  const pause = () => {
    if (!window.speechSynthesis?.speaking) return
    window.speechSynthesis.pause()
    setPhase("paused")
  }

  const stop = () => {
    token.current += 1
    window.speechSynthesis?.cancel()
    clearMark()
    setSnippet("")
    setPhase(window.speechSynthesis?.getVoices().length ? "idle" : "unavailable")
  }

  const cameraPage = location.pathname === "/ai"
  const unavailable = phase === "unavailable"

  return (
    <SpeechContext.Provider value={{ phase, snippet, unavailable, cameraPage, play, pause, stop }}>
      {children}
    </SpeechContext.Provider>
  )
}

export function useSpeech() {
  const value = useContext(SpeechContext)
  if (!value) throw new Error("useSpeech must be used inside SpeechProvider")
  return value
}
