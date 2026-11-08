import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./Auth.jsx"

const WorkoutsContext = createContext(null)

function storageKey(sub) {
  return `je-workouts:${sub}`
}

export function WorkoutsProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const [workouts, setWorkouts] = useState([])

  useEffect(() => {
    if (!isAuthenticated || !user?.sub) {
      setWorkouts([])
      return
    }
    try {
      setWorkouts(JSON.parse(localStorage.getItem(storageKey(user.sub)) || "[]"))
    } catch {
      setWorkouts([])
    }
  }, [isAuthenticated, user?.sub])

  useEffect(() => {
    if (!isAuthenticated || !user?.sub) return
    localStorage.setItem(storageKey(user.sub), JSON.stringify(workouts))
  }, [isAuthenticated, user?.sub, workouts])

  const value = useMemo(
    () => ({
      workouts,
      saveWorkout(entry) {
        setWorkouts((current) => {
          const next = {
            id: entry.id || crypto.randomUUID(),
            exerciseId: entry.exerciseId,
            date: entry.date,
            time: entry.time,
            note: entry.note?.trim() || "",
            status: entry.status || "planned",
          }
          const index = current.findIndex((item) => item.id === next.id)
          if (index === -1) return [...current, next]
          return current.map((item) => (item.id === next.id ? next : item))
        })
      },
      markDone(id) {
        setWorkouts((current) =>
          current.map((item) => (item.id === id ? { ...item, status: "done" } : item)),
        )
      },
      removeWorkout(id) {
        setWorkouts((current) => current.filter((item) => item.id !== id))
      },
    }),
    [workouts],
  )

  return <WorkoutsContext.Provider value={value}>{children}</WorkoutsContext.Provider>
}

export function useWorkouts() {
  const value = useContext(WorkoutsContext)
  if (!value) throw new Error("useWorkouts must be used inside WorkoutsProvider")
  return value
}
