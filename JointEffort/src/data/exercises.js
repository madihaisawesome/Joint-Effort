const SAFETY = "Stop if something hurts. This is not medical advice."

const SETUP =
  "Put your full body in the frame. Keep the phone or laptop steady, and use enough light to see yourself clearly."

const SETUP_LONG =
  "Set the phone or laptop where it will not wobble. Step back until your whole body is in the picture, from head to feet. Turn on a light or face a window so you are easy to see."

/** Fallback if the Express backend is offline. */
export const fallbackExercises = [
  {
    id: "camera-session",
    name: "Camera session",
    summary:
      "A camera session that watches your pose on this device and shows shoulder and knee angles.",
    summaryLong:
      "Video stays in the browser and is not saved. The coach draws a skeleton over the camera picture and reads shoulder and knee angles. Connect the backend for guided reps and Gemini tips.",
    setup: SETUP,
    setupLong: SETUP_LONG,
    safety: SAFETY,
    steps: [],
  },
]

export let exercises = fallbackExercises.slice()

export function getExercise(id) {
  return exercises.find((exercise) => exercise.id === id) || null
}

export function curriculumToExercises(curriculum) {
  if (!curriculum?.id || !Array.isArray(curriculum.steps)) return fallbackExercises.slice()
  const stepNames = curriculum.steps.map((step) => step.title).join(", ")
  return [
    {
      id: curriculum.id,
      name: curriculum.title || "Gentle routine",
      summary: `A ${curriculum.steps.length}-step gentle routine coached on this device with live form tips.`,
      summaryLong: `Steps: ${stepNames}. Video stays in the browser and is not saved. The server only receives joint angles — never video.`,
      setup: SETUP,
      setupLong: SETUP_LONG,
      safety: SAFETY,
      steps: curriculum.steps,
    },
  ]
}

export function setExercises(next) {
  exercises = Array.isArray(next) && next.length ? next : fallbackExercises.slice()
  return exercises
}
