import { Link } from "react-router-dom"
import { exercises } from "../data/exercises.js"
import { usePageTitle } from "../lib/title.js"

export default function Exercises() {
  usePageTitle("Exercises")
  return (
    <section className="page-narrow">
      <h1>Exercises</h1>
      <p>Open a session, then start the camera coach when you are ready.</p>
      <ul className="exercise-list">
        {exercises.map((exercise) => (
          <li key={exercise.id}>
            <h2>
              <Link to={`/exercises/${exercise.id}`}>{exercise.name}</Link>
            </h2>
            <p>{exercise.summary}</p>
            <p className="more-detail">{exercise.summaryLong}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
