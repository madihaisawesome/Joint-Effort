export const exercises = [
  {
    id: "camera-session",
    name: "Camera session",
    summary: "A camera session that watches your pose on this device and shows shoulder and knee angles.",
    summaryLong:
      "Video stays in the browser and is not saved. The coach draws a skeleton over the camera picture and reads shoulder and knee angles. It does not count repetitions, score form, or speak. If it cannot see you clearly, it says to step back.",
    setup:
      "Put your full body in the frame. Keep the phone or laptop steady, and use enough light to see yourself clearly.",
    setupLong:
      "Set the phone or laptop where it will not wobble. Step back until your whole body is in the picture, from head to feet. Turn on a light or face a window so you are easy to see.",
    safety: "Stop if something hurts. This is not medical advice.",
  },
]

export function getExercise(id) {
  return exercises.find((exercise) => exercise.id === id) || null
}
