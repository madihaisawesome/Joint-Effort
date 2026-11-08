import { usePageTitle } from "../lib/title.js"

export default function About() {
  usePageTitle("About")
  return (
    <article className="page-narrow">
      <h1>About JointEffort</h1>
      <p>
        JointEffort is a place to plan your own workout and find community events near the
        University of Calgary. An account is only for your personal calendar, your saved map
        location, and starting the camera.
      </p>
      <p className="more-detail">
        The calendar and the saved location stay in this browser. They do not follow you to
        another computer. Community events are a fixed demo list around campus. You can browse
        them. You cannot post, edit, or RSVP.
      </p>
      <p>Stop if something hurts. This is not medical advice.</p>
    </article>
  )
}
