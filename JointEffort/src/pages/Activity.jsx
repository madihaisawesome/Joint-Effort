import ActivityBoard from "../components/ActivityBoard.jsx"
import { usePageTitle } from "../lib/title.js"

export default function Activity() {
  usePageTitle("Activity board")
  return (
    <section className="activity-page">
      <header className="activity-hero">
        <h1>Activity board</h1>
        <p>
          Share or join a gentle meetup near you — walks, park yoga, stretching, tai chi, and more.
        </p>
      </header>
      <ActivityBoard />
    </section>
  )
}
