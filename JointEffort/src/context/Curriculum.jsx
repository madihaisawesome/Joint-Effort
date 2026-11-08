import { createContext, useContext, useEffect, useMemo, useState } from "react"
import {
  curriculumToExercises,
  fallbackExercises,
  getExercise as lookupExercise,
  setExercises,
} from "../data/exercises.js"
import { getCurriculum } from "../lib/api.js"

const CurriculumContext = createContext(null)

export function CurriculumProvider({ children }) {
  const [curriculum, setCurriculum] = useState(null)
  const [list, setList] = useState(fallbackExercises)
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getCurriculum()
        if (cancelled) return
        const next = curriculumToExercises(data)
        setExercises(next)
        setCurriculum(data)
        setList(next)
        setStatus("ready")
        setError("")
      } catch (err) {
        if (cancelled) return
        setExercises(fallbackExercises)
        setCurriculum(null)
        setList(fallbackExercises)
        setStatus("offline")
        setError(err.message || "Backend unavailable")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(
    () => ({
      curriculum,
      exercises: list,
      status,
      error,
      getExercise: (id) => lookupExercise(id) || list.find((item) => item.id === id) || null,
    }),
    [curriculum, error, list, status],
  )

  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>
}

export function useCurriculum() {
  const value = useContext(CurriculumContext)
  if (!value) throw new Error("useCurriculum needs CurriculumProvider")
  return value
}
