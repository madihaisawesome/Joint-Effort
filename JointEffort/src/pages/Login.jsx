import { Link, useSearchParams } from "react-router-dom"
import { authConfigured, useAuth } from "../context/Auth.jsx"
import { safeReturn } from "../lib/geo.js"
import { usePageTitle } from "../lib/title.js"

const reasons = {
  calendar: "An account keeps your personal calendar on this browser.",
  location: "An account keeps your saved map location on this browser.",
  camera: "An account is required before the camera coach opens.",
  profile: "An account opens your profile.",
}

export default function Login() {
  const { configured, isAuthenticated, isLoading, login, error } = useAuth()
  const [params] = useSearchParams()
  const returnTo = safeReturn(params.get("returnTo"))
  const reason = reasons[params.get("reason")] || ""
  usePageTitle("Log in")

  return (
    <section className="page-narrow">
      <h1>Log in</h1>
      <p>
        An account is only for your personal calendar, your saved map location, and starting the
        camera. Workouts and the saved location stay in this browser.
      </p>
      {reason ? <p>{reason}</p> : null}
      {isAuthenticated ? (
        <p>
          You are already logged in. <Link to={returnTo}>Continue</Link>
        </p>
      ) : null}
      {!authConfigured || !configured ? (
        <p>
          Log in is not set up on this computer yet. Add the Auth0 domain and client id to a
          .env file, then restart the site. Until then, the homepage, exercises, and event map
          stay open.
        </p>
      ) : (
        <button className="pill pill-dark" type="button" disabled={isLoading} onClick={() => login(returnTo)}>
          Continue to log in
        </button>
      )}
      {error ? <p role="alert">{error} Try the login button again.</p> : null}
    </section>
  )
}
