import { useEffect, useRef } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { authConfigured, useAuth } from "../context/Auth.jsx"
import { safeReturn } from "../lib/geo.js"

export default function Login() {
  const { configured, isAuthenticated, isLoading, login, error } = useAuth()
  const [params] = useSearchParams()
  const returnTo = safeReturn(params.get("returnTo"))
  const started = useRef(false)

  useEffect(() => {
    if (!authConfigured || !configured || isLoading || isAuthenticated || started.current) return
    started.current = true
    login(returnTo)
  }, [configured, isAuthenticated, isLoading, login, returnTo])

  if (isAuthenticated) return <Navigate to={returnTo} replace />

  return (
    <section className="page-narrow">
      <h1>Log in</h1>
      {!authConfigured || !configured ? (
        <p>
          Log in is not set up on this computer yet. Add the Auth0 domain and client id to a
          .env file, then restart the site. Until then, the homepage, exercises, and event map
          stay open.
        </p>
      ) : (
        <p>Opening Auth0…</p>
      )}
      {error ? <p role="alert">{error} Try Register Now again.</p> : null}
    </section>
  )
}
