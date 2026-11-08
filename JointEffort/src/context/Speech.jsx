import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { usePreferences } from "./Preferences.jsx"
import {
  ensureVoices,
  getActiveVoiceLabel,
  pauseSpeaking,
  pickVoice,
  probeGeminiVoice,
  refreshVoices,
  resumeSpeaking,
  speakText,
  stopSpeaking,
} from "../lib/speech.js"

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
  const [phase, setPhase] = useState("idle")
  const [snippet, setSnippet] = useState("")
  const [voiceName, setVoiceName] = useState("")
  const token = useRef(0)
  const rate = useRef(prefs.rate)
  rate.current = prefs.rate

  useEffect(() => {
    let cancelled = false
    const refreshLabel = async () => {
      const gemini = await probeGeminiVoice()
      if (cancelled) return
      if (gemini.available) {
        setVoiceName(gemini.voiceName)
        setPhase((current) => (current === "playing" || current === "paused" ? current : "idle"))
        return
      }
      const voices = refreshVoices()
      const voice = pickVoice(voices)
      setVoiceName(voice?.name || getActiveVoiceLabel() || "")
      setPhase((current) => {
        if (current === "playing" || current === "paused") return current
        return voices.length || "speechSynthesis" in window ? "idle" : "unavailable"
      })
    }
    refreshLabel()
    ensureVoices().then(refreshLabel)
    window.speechSynthesis?.addEventListener?.("voiceschanged", refreshLabel)
    const timer = window.setTimeout(refreshLabel, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.speechSynthesis?.removeEventListener?.("voiceschanged", refreshLabel)
    }
  }, [])

  useEffect(() => {
    token.current += 1
    stopSpeaking()
    clearMark()
    setSnippet("")
    setPhase("idle")
  }, [location.pathname])

  const speakAt = async (index, run) => {
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
    setPhase("playing")
    await speakText(text, {
      rate: Math.min(1.15, Math.max(0.75, rate.current * 0.94)),
      pitch: 1.05,
      onend: () => {
        if (run === token.current) speakAt(index + 1, run)
      },
      onerror: (event) => {
        if (event?.error === "interrupted" || event?.error === "canceled") return
        if (run !== token.current) return
        clearMark()
        setPhase("idle")
      },
    })
  }

  const play = () => {
    if (resumeSpeaking()) {
      setPhase("playing")
      return
    }
    stopSpeaking()
    const run = token.current + 1
    token.current = run
    speakAt(0, run)
  }

  const pause = () => {
    if (!pauseSpeaking()) return
    setPhase("paused")
  }

  const stop = () => {
    token.current += 1
    stopSpeaking()
    clearMark()
    setSnippet("")
    setPhase("idle")
  }

  const cameraPage = location.pathname === "/ai"
  const unavailable = phase === "unavailable"

  return (
    <SpeechContext.Provider value={{ phase, snippet, unavailable, cameraPage, voiceName, play, pause, stop }}>
      {children}
    </SpeechContext.Provider>
  )
}

export function useSpeech() {
  const value = useContext(SpeechContext)
  if (!value) throw new Error("useSpeech must be used inside SpeechProvider")
  return value
}
