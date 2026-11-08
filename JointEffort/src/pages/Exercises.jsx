import { Link } from "react-router-dom"
import { useCurriculum } from "../context/Curriculum.jsx"
import { usePageTitle } from "../lib/title.js"

export default function Exercises() {
  const { exercises, status, error } = useCurriculum()
  usePageTitle("Exercises")
  return (
    <section className="page-narrow">
      <h1>Exercises</h1>
      <p>Open a session, then start the camera coach when you are ready.</p>
      {status === "loading" ? <p className="form-note">Loading the coaching routine…</p> : null}
      {status === "offline" ? (
        <p className="form-note" role="status">
          Backend offline ({error}). Showing a local camera session until Express is running on port 3000.
        </p>
      ) : null}
      <ul className="exercise-list">
        {exercises.map((exercise) => (
          <li key={exercise.id}>
            <h2>
              <Link to={`/exercises/${exercise.id}`}>{exercise.name}</Link>
            </h2>
            <p>{exercise.summary}</p>
            <p className="more-detail">{exercise.summaryLong}</p>
            {exercise.steps?.length ? (
              <ol className="exercise-steps">
                {exercise.steps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.title}</strong> — {step.instruction}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
