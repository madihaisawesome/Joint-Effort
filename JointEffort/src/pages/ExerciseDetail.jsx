import { Link, useParams, useSearchParams } from "react-router-dom"
import { authConfigured, useAuth } from "../context/Auth.jsx"
import { useCurriculum } from "../context/Curriculum.jsx"
import { usePageTitle } from "../lib/title.js"

export default function ExerciseDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { isAuthenticated, login } = useAuth()
  const { getExercise, status } = useCurriculum()
  const exercise = getExercise(id)
  usePageTitle(exercise?.name || "Exercise")

  if (status === "loading") {
    return (
      <section className="page-narrow">
        <h1>Loading exercise</h1>
        <p>Fetching the coaching routine from the server…</p>
      </section>
    )
  }

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
  const needsAccount = authConfigured && !isAuthenticated

  return (
    <article className="page-narrow">
      <h1>{exercise.name}</h1>
      <p>{exercise.summary}</p>
      <p className="more-detail">{exercise.summaryLong}</p>
      {exercise.steps?.length ? (
        <>
          <h2>In this routine</h2>
          <ol className="exercise-steps">
            {exercise.steps.map((step) => (
              <li key={step.id}>
                <strong>{step.title}</strong> — {step.instruction}
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <h2>Set the camera</h2>
      <p>{exercise.setup}</p>
      <p className="more-detail">{exercise.setupLong}</p>
      <p>{exercise.safety}</p>
      <p>
        The next page asks for the camera. Video stays on this device. The coaching server only
        receives joint angles so it can count reps and offer tips.
      </p>
      <div className="button-row">
        {needsAccount ? (
          <button className="pill pill-dark" type="button" onClick={() => login(aiPath)}>
            Open camera coach
          </button>
        ) : (
          <Link className="pill pill-dark" to={aiPath}>
            Open camera coach
          </Link>
        )}
        <Link className="pill" to="/exercises">
          Back to exercises
        </Link>
      </div>
    </article>
  )
}
