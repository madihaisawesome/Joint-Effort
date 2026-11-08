import { Link, useParams, useSearchParams } from "react-router-dom"
import { getExercise } from "../data/exercises.js"
import { useAuth } from "../context/Auth.jsx"
import { usePageTitle } from "../lib/title.js"

export default function ExerciseDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const exercise = getExercise(id)
  usePageTitle(exercise?.name || "Exercise")

  if (!exercise) {
    return (
      <section className="page-narrow">
        <h1>Exercise not found</h1>
        <p>That session is not in the list.</p>
        <Link to="/exercises">Back to exercises</Link>
      </section>
    )
  }

  const workout = params.get("workout")
  const back = workout
    ? `/calendar?done=1&workout=${encodeURIComponent(workout)}`
    : `/exercises/${exercise.id}`
  const aiPath = `/ai?exercise=${encodeURIComponent(exercise.id)}&returnTo=${encodeURIComponent(back)}`
  const cameraHref = isAuthenticated
    ? aiPath
    : `/login?returnTo=${encodeURIComponent(aiPath)}&reason=camera`

  return (
    <article className="page-narrow">
      <h1>{exercise.name}</h1>
      <p>{exercise.summary}</p>
      <p className="more-detail">{exercise.summaryLong}</p>
      <h2>Set the camera</h2>
      <p>{exercise.setup}</p>
      <p className="more-detail">{exercise.setupLong}</p>
      <p>{exercise.safety}</p>
      <p>
        The next page will ask for the camera. This site does not save video. You will see a
        skeleton and shoulder and knee angles. If the camera cannot see you clearly, it says to
        step back.
      </p>
      <div className="button-row">
        <Link className="pill pill-dark" to={cameraHref}>
          Open camera coach
        </Link>
        <Link to="/exercises">Back to exercises</Link>
      </div>
    </article>
  )
}
