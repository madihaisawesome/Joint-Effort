import { Link, useSearchParams } from "react-router-dom"
import PoseCoach from "../components/PoseCoach.jsx"
import { useCurriculum } from "../context/Curriculum.jsx"
import { safeReturn } from "../lib/geo.js"
import { usePageTitle } from "../lib/title.js"

export default function Ai() {
  const [params] = useSearchParams()
  const { getExercise, status } = useCurriculum()
  const exercise = getExercise(params.get("exercise"))
  const returnTo = safeReturn(params.get("returnTo"))
  usePageTitle(exercise ? exercise.name : "Camera coach")

  if (status === "loading") {
    return (
      <section className="page-narrow">
        <h1>Camera coach</h1>
        <p>Loading the coaching routine…</p>
      </section>
    )
  }

  if (!params.get("exercise")) {
    return (
      <section className="page-narrow">
        <h1>Camera coach</h1>
        <p>This page needs an exercise id. Open a session from the exercise list first.</p>
        <Link to="/exercises">Back to exercises</Link>
      </section>
    )
  }

  if (!exercise) {
    return (
      <section className="page-narrow">
        <h1>Camera coach</h1>
        <p>That exercise is not in the list.</p>
        <Link to={returnTo}>Back</Link>
      </section>
    )
  }

  return (
    <section className="camera-page">
      <h1>{exercise.name}</h1>
      <p>
        This page asks for the camera. Video stays on this device. Joint angles go to the coaching
        server for reps and tips — not the video itself.
      </p>
      <PoseCoach />
      <Link className="pill" to={returnTo}>
        Back
      </Link>
    </section>
  )
}
