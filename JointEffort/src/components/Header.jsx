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
  { to: "/events", label: "Events" },
  { to: "/activity", label: "Activity Board" },
]

const loggedIn = [
  { to: "/profile", label: "Profile" },
  { to: "/exercises", label: "Exercises" },
  { to: "/events", label: "Events" },
  { to: "/activity", label: "Activity Board" },
  { to: "/calendar", label: "Calendar" },
]

const sizes = [
  { id: "default", label: "A" },
  { id: "large", label: "A+" },
  { id: "largest", label: "A++" },
]

const rates = [
  { id: 0.8, label: "Slow" },
  { id: 1, label: "Normal" },
  { id: 1.25, label: "Fast" },
]

export function AccessibilityControls() {
  const { prefs, setTextSize, setMoreDetail, setContrast, setRate } = usePreferences()
  const speech = useSpeech()
  const reading = speech.phase === "playing" || speech.phase === "paused"

  return (
    <div className="a11y-groups">
      <section className="a11y-group" aria-labelledby="a11y-display-label">
        <h3 className="a11y-group-label" id="a11y-display-label">
          Display
        </h3>
        <div className="a11y-group-row">
          <fieldset className="segment">
            <legend className="visually-hidden">Text size</legend>
            <div role="group" aria-label="Text size">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  title={
                    size.id === "default" ? "Default text" : size.id === "large" ? "Large text" : "Largest text"
                  }
                  aria-label={
                    size.id === "default" ? "Default text" : size.id === "large" ? "Large text" : "Largest text"
                  }
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
        </div>
      </section>

      <section className="a11y-group" aria-labelledby="a11y-speech-label">
        <h3 className="a11y-group-label" id="a11y-speech-label">
          Read aloud
        </h3>
        {speech.unavailable ? (
          <p className="a11y-note">Read-aloud is unavailable in this browser.</p>
        ) : (
          <div className="a11y-group-row speech-controls">
            <button type="button" onClick={speech.play}>
              {speech.phase === "paused" ? "Resume" : "Play"}
            </button>
            <button type="button" onClick={speech.pause} disabled={speech.phase !== "playing"}>
              Pause
            </button>
            <button type="button" onClick={speech.stop} disabled={speech.phase === "idle"}>
              Stop
            </button>
            <fieldset className="segment speech-speed">
              <legend className="visually-hidden">Reading speed</legend>
              <div role="group" aria-label="Reading speed">
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
              <p className="a11y-note">On this page, the coach speaks the steps for you.</p>
            ) : null}
            {reading && speech.snippet ? (
              <p className="speech-now" aria-live="polite">
                Reading: {speech.snippet}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
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
        <div className="a11y-bar" aria-label="Accessibility controls">
          <AccessibilityControls />
        </div>
      ) : null}
    </header>
  )
}
