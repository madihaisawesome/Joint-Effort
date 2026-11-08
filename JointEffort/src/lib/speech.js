/**
 * Speech helpers — Gemini AI voice first, browser TTS as fallback.
 */

import { synthesizeSpeech } from "./api.js"

const PREFERRED = [
  /aria/i,
  /jenny/i,
  /michelle/i,
  /natural/i,
  /neural/i,
  /online \(natural\)/i,
  /google us english/i,
  /google uk english female/i,
  /google.*english/i,
  /samantha/i,
  /karen/i,
  /moira/i,
  /serena/i,
  /fiona/i,
  /female/i,
  /en-us/i,
  /en_us/i,
]

const AVOID = [/espeak/i, /compact/i, /robot/i]

let cachedVoice = null
let voicesReady = false
let geminiAvailable = null
let geminiVoiceName = "Aoede"
let currentAudio = null
let speakGeneration = 0

function scoreVoice(voice) {
  const label = `${voice.name} ${voice.lang}`
  if (AVOID.some((pattern) => pattern.test(label))) return -100
  if (!/^en/i.test(voice.lang || "")) return -50

  let score = 0
  if (/^en-US/i.test(voice.lang)) score += 8
  else if (/^en-GB/i.test(voice.lang)) score += 6
  else if (/^en/i.test(voice.lang)) score += 4

  PREFERRED.forEach((pattern, index) => {
    if (pattern.test(label)) score += 40 - index
  })

  if (/natural|neural|online/i.test(voice.name)) score += 20
  if (voice.localService === false && /natural|neural|online/i.test(voice.name)) score += 10

  if (/david|zira|mark|microsoft.*desktop/i.test(voice.name) && !/natural|neural/i.test(voice.name)) {
    score -= 15
  }

  return score
}

export function pickVoice(voices = []) {
  if (!voices.length) return null
  if (cachedVoice) {
    const stillThere = voices.find((voice) => voice.voiceURI === cachedVoice.voiceURI)
    if (stillThere) return stillThere
  }
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))
  cachedVoice = ranked[0] || null
  return cachedVoice
}

export function refreshVoices() {
  if (!("speechSynthesis" in window)) return []
  const voices = window.speechSynthesis.getVoices()
  if (voices.length) {
    voicesReady = true
    pickVoice(voices)
  }
  return voices
}

export function ensureVoices() {
  if (!("speechSynthesis" in window)) return Promise.resolve([])
  const existing = refreshVoices()
  if (existing.length) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", done)
      resolve(refreshVoices())
    }
    window.speechSynthesis.addEventListener?.("voiceschanged", done)
    window.setTimeout(done, 800)
  })
}

export function stopSpeaking() {
  speakGeneration += 1
  window.speechSynthesis?.cancel()
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.onerror = null
    currentAudio.pause()
    currentAudio.src = ""
    currentAudio = null
  }
}

export function pauseSpeaking() {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause()
    return "audio"
  }
  if (window.speechSynthesis?.speaking) {
    window.speechSynthesis.pause()
    return "browser"
  }
  return null
}

export function resumeSpeaking() {
  if (currentAudio && currentAudio.paused) {
    currentAudio.play().catch(() => {})
    return "audio"
  }
  if (window.speechSynthesis?.paused) {
    window.speechSynthesis.resume()
    return "browser"
  }
  return null
}

export async function probeGeminiVoice() {
  if (geminiAvailable !== null) {
    return {
      available: geminiAvailable,
      voiceName: geminiAvailable ? `Gemini ${geminiVoiceName}` : "",
    }
  }
  try {
    const { getHealth } = await import("./api.js")
    const health = await getHealth()
    geminiAvailable = Boolean(health?.tts?.configured)
    if (health?.tts?.voice) geminiVoiceName = health.tts.voice
  } catch {
    geminiAvailable = false
  }
  return {
    available: geminiAvailable,
    voiceName: geminiAvailable ? `Gemini ${geminiVoiceName}` : "",
  }
}

function playAudioBase64(audio, mimeType, options = {}, generation) {
  return new Promise((resolve) => {
    if (generation !== speakGeneration) {
      resolve(null)
      return
    }
    const url = `data:${mimeType || "audio/wav"};base64,${audio}`
    const element = new Audio(url)
    currentAudio = element
    element.playbackRate = Math.min(1.2, Math.max(0.8, options.rate ?? 1))
    element.onended = () => {
      if (currentAudio === element) currentAudio = null
      if (generation === speakGeneration) options.onend?.()
      resolve(element)
    }
    element.onerror = () => {
      if (currentAudio === element) currentAudio = null
      if (generation === speakGeneration) {
        options.onerror?.({ error: "audio-error" })
      }
      resolve(null)
    }
    element.play().catch(() => {
      if (currentAudio === element) currentAudio = null
      if (generation === speakGeneration) {
        options.onerror?.({ error: "audio-error" })
      }
      resolve(null)
    })
  })
}

function speakBrowser(text, options = {}, generation) {
  if (!text || !("speechSynthesis" in window)) return null
  if (generation !== speakGeneration) return null

  const utterance = new SpeechSynthesisUtterance(String(text).trim())
  utterance.lang = "en-US"
  utterance.rate = options.rate ?? 0.92
  utterance.pitch = options.pitch ?? 1.05
  utterance.volume = options.volume ?? 1

  const voices = refreshVoices()
  const voice = pickVoice(voices)
  if (voice) {
    utterance.voice = voice
    if (voice.lang) utterance.lang = voice.lang
  }

  utterance.onend = () => {
    if (generation === speakGeneration) options.onend?.()
  }
  utterance.onerror = (event) => {
    if (generation === speakGeneration) options.onerror?.(event)
  }

  window.speechSynthesis.cancel()
  window.setTimeout(() => {
    if (generation !== speakGeneration) return
    if (!voicesReady) refreshVoices()
    const latest = pickVoice(window.speechSynthesis.getVoices())
    if (latest) utterance.voice = latest
    window.speechSynthesis.speak(utterance)
  }, 40)

  return utterance
}

/**
 * Speak text with Gemini AI voice when available, else browser TTS.
 * @param {string} text
 * @param {{ rate?: number, pitch?: number, onend?: () => void, onerror?: (event: { error?: string }) => void }} [options]
 */
export async function speakText(text, options = {}) {
  const cleaned = String(text || "").trim()
  if (!cleaned) return null

  const generation = ++speakGeneration
  window.speechSynthesis?.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }

  const probe = await probeGeminiVoice()
  if (probe.available && generation === speakGeneration) {
    try {
      const result = await synthesizeSpeech(cleaned)
      if (generation !== speakGeneration) return null
      if (result?.audio) {
        if (result.voice) geminiVoiceName = result.voice
        geminiAvailable = true
        return playAudioBase64(result.audio, result.mimeType, options, generation)
      }
    } catch (error) {
      console.warn("Gemini TTS failed, using browser voice:", error.message || error)
      geminiAvailable = false
    }
  }

  if (generation !== speakGeneration) return null
  return speakBrowser(cleaned, options, generation)
}

export function getActiveVoiceLabel() {
  if (geminiAvailable) return `Gemini ${geminiVoiceName}`
  const voice = pickVoice(refreshVoices())
  return voice?.name || ""
}
