import { Navigate, useLocation } from "react-router-dom"
import { authConfigured, useAuth } from "../context/Auth.jsx"

export default function RequireAuth({ reason, children }) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // Without Auth0 env vars, keep demo routes open so the backend coach still works.
  if (!authConfigured) return children

  if (isLoading) {
    return (
      <section className="page-narrow">
        <h1>Checking your account</h1>
        <p>One moment while the login check finishes.</p>
      </section>
    )
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`
    const params = new URLSearchParams({ returnTo, reason })
    return <Navigate to={`/login?${params.toString()}`} replace />
  }

  return children
}
