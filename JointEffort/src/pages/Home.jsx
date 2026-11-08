import { Link } from "react-router-dom"
import { useAuth } from "../context/Auth.jsx"
import { useCurriculum } from "../context/Curriculum.jsx"
import hero from "../assets/home-pagebanner2.jpg"
import portrait1 from "../assets/portrait-1.png"
import portrait2 from "../assets/portrait-2.png"
import portrait3 from "../assets/portrait-3.png"
import arrow from "../assets/arrow-right.svg"
import star from "../assets/star.svg"
import { usePageTitle } from "../lib/title.js"

export default function Home() {
  const { isAuthenticated } = useAuth()
  const { exercises } = useCurriculum()
  const primaryExercise = exercises[0]
  const cameraPath = primaryExercise
    ? `/exercises/${encodeURIComponent(primaryExercise.id)}`
    : "/exercises"
  usePageTitle("JointEffort")

  return (
    <>
      <section className="hero" style={{ "--hero": `url(${hero})` }}>
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-fade" aria-hidden="true" />
        <div className="hero-row">
          <div className="hero-copy">
            <h1>
              <span>A camera coach,</span>
              <span>and campus events</span>
            </h1>
            <div className="hero-actions">
              <Link className="pill pill-hero" to={cameraPath}>
                Open camera coach
                <img src={arrow} alt="" width="34" height="34" />
              </Link>
              {isAuthenticated ? (
                <Link className="text-link" to="/calendar">
                  Open calendar
                </Link>
              ) : null}
            </div>
          </div>
          <div className="trust">
            <div>
              <div className="portraits">
                <img src={portrait1} alt="" width="56" height="56" />
                <img src={portrait2} alt="" width="56" height="56" />
                <img src={portrait3} alt="" width="56" height="56" />
              </div>
              <p className="trust-line">
                <img src={star} alt="" width="26" height="26" />
                Near you
              </p>
            </div>
            <span className="trust-rule" aria-hidden="true" />
            <p className="trust-stat">
              <span>YYC</span>
            </p>
          </div>
        </div>
      </section>
      <section className="more-detail page-narrow">
        <h2>What you can do here</h2>
        <p>
          JointEffort helps you plan a workout, open the on-device camera coach, and find community
          events near the University of Calgary. The coach counts gentle reps and can offer tips —
          video stays on this device and is not saved.
        </p>
        <p>Stop if something hurts. This is not medical advice.</p>
        <div className="button-row">
          <Link className="pill pill-dark" to="/exercises">
            Browse exercises
          </Link>
          <Link className="pill" to="/activity">
            Activity invite board
          </Link>
        </div>
      </section>
    </>
  )
}
