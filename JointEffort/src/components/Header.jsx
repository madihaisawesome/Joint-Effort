import { Link, NavLink, useLocation } from "react-router-dom"
import { useAuth } from "../context/Auth.jsx"
import { usePreferences } from "../context/Preferences.jsx"
import { useSpeech } from "../context/Speech.jsx"
import logoMark from "../assets/logo-mark.svg"
import logoDetail from "../assets/logo-detail.svg"

const loggedOut = [
  { to: "/", label: "Home", end: true },
  { to: "/about", label: "About" },
  { to: "/exercises", label: "Exercises" },
  { to: "/events", label: "Community Events" },
]

const loggedIn = [
  { to: "/profile", label: "Profile" },
  { to: "/exercises", label: "Exercises" },
  { to: "/events", label: "Community Events" },
  { to: "/calendar", label: "Calendar" },
]

const sizes = [
  { id: "default", label: "Default" },
  { id: "large", label: "Large" },
  { id: "largest", label: "Largest" },
]

const rates = [
  { id: 0.8, label: "Slower" },
  { id: 1, label: "Normal" },
  { id: 1.25, label: "Faster" },
]

export function AccessibilityControls() {
  const { prefs, setTextSize, setMoreDetail, setContrast, setRate } = usePreferences()
  const speech = useSpeech()

  return (
    <>
      <fieldset className="segment">
        <legend>Text size</legend>
        <div>
          {sizes.map((size) => (
            <button
              key={size.id}
              type="button"
              aria-pressed={prefs.textSize === size.id}
              onClick={() => setTextSize(size.id)}
            >
              {size.label}
            </button>
          ))}
        </div>
      </fieldset>
      <button
        className="text-toggle"
        type="button"
        aria-pressed={prefs.moreDetail}
        onClick={() => setMoreDetail(!prefs.moreDetail)}
      >
        More detail
      </button>
      <button
        className="text-toggle"
        type="button"
        aria-pressed={prefs.contrast}
        onClick={() => setContrast(!prefs.contrast)}
      >
        High contrast
      </button>
      <div className="speech-controls">
        {speech.unavailable ? (
          <p>Read-aloud is unavailable.</p>
        ) : (
          <>
            <button type="button" onClick={speech.play}>
              {speech.phase === "paused" ? "Resume" : "Play"}
            </button>
            <button type="button" onClick={speech.pause} disabled={speech.phase !== "playing"}>
              Pause
            </button>
            <button type="button" onClick={speech.stop} disabled={speech.phase === "idle"}>
              Stop
            </button>
            <fieldset className="segment">
              <legend>Speed</legend>
              <div>
                {rates.map((rate) => (
                  <button
                    key={rate.label}
                    type="button"
                    aria-pressed={prefs.rate === rate.id}
                    onClick={() => setRate(rate.id)}
                  >
                    {rate.label}
                  </button>
                ))}
              </div>
            </fieldset>
            {speech.cameraPage ? (
              <p className="speech-now">Reads the coaching steps and tips on this page.</p>
            ) : null}
            {speech.snippet ? <p className="speech-now">Reading: {speech.snippet}</p> : null}
          </>
        )}
      </div>
    </>
  )
}

export default function Header() {
  const { isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const links = isAuthenticated ? loggedIn : loggedOut
  const showA11yBar = !isAuthenticated || location.pathname === "/ai"

  return (
    <header className="site-header">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="header-bar">
        <Link className="logo" to="/">
          <span className="logo-art">
            <img src={logoMark} alt="" width="48" height="56" />
            <img className="logo-detail" src={logoDetail} alt="" width="8" height="9" />
          </span>
          <span className="logo-word">JointEffort</span>
        </Link>
        <div className="header-actions">
          <nav className={isAuthenticated ? "primary-nav" : "primary-nav is-guest"} aria-label="Primary">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          {isAuthenticated ? (
            <button className="pill" type="button" onClick={logout}>
              Log Out
            </button>
          ) : (
            <Link className="pill" to="/login">
              Register Now
            </Link>
          )}
        </div>
      </div>
      {showA11yBar ? (
        <div className="a11y-bar">
          <AccessibilityControls />
        </div>
      ) : null}
    </header>
  )
}
