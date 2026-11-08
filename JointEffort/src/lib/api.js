const API_BASE = import.meta.env.VITE_API_BASE || ""

export async function api(path, options = {}) {
  const { timeoutMs, headers: extraHeaders, signal, ...fetchOptions } = options
  const headers = { ...(extraHeaders || {}) }
  if (fetchOptions.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  let timedOut = false
  let timer
  const controller = signal ? null : timeoutMs ? new AbortController() : null
  if (timeoutMs && controller) {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      signal: signal || controller?.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || response.statusText || "Request failed")
    }
    return data
  } catch (error) {
    if (timedOut) throw new Error("Request timed out")
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function getHealth() {
  return api("/api/health")
}

export function getCurriculum() {
  return api("/api/curriculum")
}

export function createSession(curriculumId) {
  const body =
    curriculumId && String(curriculumId).trim()
      ? JSON.stringify({ curriculumId: String(curriculumId).trim() })
      : undefined
  return api("/api/sessions", {
    method: "POST",
    body,
    timeoutMs: 8000,
  })
}

export function evaluateSession(sessionId, body) {
  return api(`/api/sessions/${sessionId}/evaluate`, {
    method: "POST",
    body: JSON.stringify(body),
    // Never freeze the camera loop waiting on Gemini.
    timeoutMs: 3500,
  })
}

export function skipSessionStep(sessionId, stepId) {
  return api(`/api/sessions/${sessionId}/progress`, {
    method: "POST",
    body: JSON.stringify({ stepId, passed: true }),
    timeoutMs: 8000,
  })
}

export function getPrograms() {
  return api("/api/programs")
}

export function getBuddies() {
  return api("/api/buddies")
}

export function postBuddy(payload) {
  return api("/api/buddies", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function getMapPlaces(params = {}) {
  const query = new URLSearchParams(params).toString()
  return api(`/api/map/places${query ? `?${query}` : ""}`)
}
