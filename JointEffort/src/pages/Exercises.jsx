import { useState } from "react"
import { Link } from "react-router-dom"
import StickDemo from "../components/StickDemo.jsx"
import { useCurriculum } from "../context/Curriculum.jsx"
import { usePageTitle } from "../lib/title.js"

function stepKinds(steps = []) {
  const seen = []
  for (const step of steps) {
    const label =
      step.exercise === "arm_raise"
        ? "Arm raise"
        : step.exercise === "sit_to_stand"
          ? "Sit to stand"
          : step.exercise === "balance_hold"
            ? "Balance"
            : step.title
    if (label && !seen.includes(label)) seen.push(label)
  }
  return seen
}

function demoExercises(steps = []) {
  const seen = []
  for (const step of steps) {
    if (!step?.exercise || seen.includes(step.exercise)) continue
    seen.push(step.exercise)
  }
  return seen.slice(0, 3)
}

export default function Exercises() {
  const { exercises, status, error } = useCurriculum()
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  usePageTitle("Exercises")
  return (
    <section className="exercises-page">
      <header className="exercises-hero">
        <h1>Exercises</h1>
        <p>Pick a routine. Each one opens the camera coach with a demo first, then watches your form.</p>
      </header>
      {status === "loading" ? <p className="form-note">Loading routines…</p> : null}
      {status === "offline" ? (
        <p className="form-note" role="status">
          Backend offline ({error}). Showing a local camera session until Express is running on port 3000.
        </p>
      ) : null}
      <ul className="exercise-grid">
        {exercises.map((exercise) => {
          const kinds = stepKinds(exercise.steps)
          const demos = demoExercises(exercise.steps)
          const count = exercise.steps?.length || 0
          return (
            <li key={exercise.id}>
              <article className="exercise-card">
                <div className="exercise-card-body">
                  <div className="exercise-card-top">
                    <p className="exercise-card-meta">
                      {count ? `${count} step${count === 1 ? "" : "s"}` : "Camera session"}
                    </p>
                    <h2>{exercise.name}</h2>
                    <p>{exercise.summary}</p>
                  </div>
                  {kinds.length ? (
                    <ul className="exercise-tags">
                      {kinds.map((kind) => (
                        <li key={kind}>{kind}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Link className="pill pill-dark exercise-card-cta" to={`/exercises/${exercise.id}`}>
                    Open routine
                  </Link>
                </div>
                {demos.length ? (
                  <div className="exercise-card-demos" aria-hidden="true">
                    {demos.map((kind) => (
                      <StickDemo key={kind} exercise={kind} reducedMotion={reducedMotion} compact />
                    ))}
                  </div>
                ) : null}
              </article>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
