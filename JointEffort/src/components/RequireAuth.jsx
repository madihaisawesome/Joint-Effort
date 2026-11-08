import { useEffect, useRef } from "react"
import { useLocation } from "react-router-dom"
import { authConfigured, useAuth } from "../context/Auth.jsx"

export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoading, login } = useAuth()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`
  const started = useRef(false)

  useEffect(() => {
    if (!authConfigured || isLoading || isAuthenticated || started.current) return
    started.current = true
    login(returnTo)
  }, [isAuthenticated, isLoading, login, returnTo])

  // Without Auth0 env vars, keep demo routes open so the backend coach still works.
  if (!authConfigured || isAuthenticated) return children

  return (
    <section className="page-narrow">
      <h1>Checking your account</h1>
      <p>One moment while Auth0 opens.</p>
    </section>
  )
}
