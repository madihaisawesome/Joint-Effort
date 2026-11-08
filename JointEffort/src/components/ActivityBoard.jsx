import { useEffect, useState } from "react"
import { getBuddies, postBuddy } from "../lib/api.js"

const emptyForm = {
  name: "",
  activity: "",
  area: "",
  time: "",
  note: "",
}

function formatPostedAt(value) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function ActivityBoard() {
  const [posts, setPosts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState("")

  async function load() {
    try {
      const data = await getBuddies()
      const next = data.posts || []
      setPosts(next)
      setStatus("")
      setSelectedId((current) => (current && next.some((post) => post.id === current) ? current : ""))
    } catch (error) {
      setStatus(error.message || "Could not load activity invites.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onSubmit(event) {
    event.preventDefault()
    setStatus("Posting…")
    try {
      const created = await postBuddy({
        name: form.name.trim(),
        activity: form.activity.trim(),
        area: form.area.trim(),
        time: form.time.trim(),
        note: form.note.trim(),
      })
      setForm(emptyForm)
      setStatus("Posted — thank you!")
      await load()
      if (created?.id) setSelectedId(created.id)
    } catch (error) {
      setStatus(error.message || "Post failed")
    }
  }

  return (
    <div className="activity-layout">
      <section className="activity-feed" aria-labelledby="activity-feed-heading">
        <h2 id="activity-feed-heading">Open invites</h2>
        <p className="activity-feed-hint">Select an invite to expand its details.</p>
        {loading ? <p className="activity-feed-empty">Loading invites…</p> : null}
        {!loading && !posts.length ? (
          <p className="activity-feed-empty">
            No invites yet. Use the form to post a walk, park yoga, or stretch meetup.
          </p>
        ) : null}
        {posts.length ? (
          <ul className="activity-list">
            {posts.map((post) => {
              const open = post.id === selectedId
              return (
                <li key={post.id} className={open ? "is-expanded" : undefined}>
                  <button
                    type="button"
                    className={open ? "activity-hit is-selected" : "activity-hit"}
                    aria-expanded={open}
                    aria-controls={`activity-detail-${post.id}`}
                    onClick={() => setSelectedId(open ? "" : post.id)}
                  >
                    <span className="activity-hit-title">{post.activity || "Gentle movement"}</span>
                    <span className="activity-hit-meta">
                      {post.time} · {post.area}
                    </span>
                    <span className="activity-hit-action">{open ? "Hide details" : "View details"}</span>
                  </button>
                  <div
                    id={`activity-detail-${post.id}`}
                    className="activity-detail"
                    hidden={!open}
                  >
                    <dl className="activity-detail-grid">
                      <div>
                        <dt>When</dt>
                        <dd>{post.time}</dd>
                      </div>
                      <div>
                        <dt>Place / area</dt>
                        <dd>{post.area}</dd>
                      </div>
                      <div>
                        <dt>Host</dt>
                        <dd>{post.name}</dd>
                      </div>
                      <div>
                        <dt>Posted</dt>
                        <dd>{formatPostedAt(post.createdAt) || "Just now"}</dd>
                      </div>
                      {typeof post.lat === "number" && typeof post.lng === "number" ? (
                        <div className="span-2">
                          <dt>Map pin</dt>
                          <dd>
                            {post.lat.toFixed(5)}, {post.lng.toFixed(5)}
                          </dd>
                        </div>
                      ) : null}
                      <div className="span-2">
                        <dt>Details</dt>
                        <dd>{post.note}</dd>
                      </div>
                    </dl>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <section className="activity-compose" aria-labelledby="activity-board-heading">
        <h2 id="activity-board-heading">Post an invite</h2>
        <p>Each field stays under 200 characters.</p>
        <form className="activity-form" onSubmit={onSubmit}>
          <label>
            Name
            <input
              name="name"
              required
              maxLength={200}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Activity
            <input
              name="activity"
              required
              maxLength={200}
              list="activity-suggestions"
              placeholder="e.g. Yoga in the park"
              value={form.activity}
              onChange={(event) => setForm({ ...form, activity: event.target.value })}
            />
            <datalist id="activity-suggestions">
              <option value="Walking" />
              <option value="Yoga in the park" />
              <option value="Chair yoga" />
              <option value="Stretching" />
              <option value="Tai chi" />
              <option value="Gentle strength" />
            </datalist>
          </label>
          <label>
            Place / area
            <input
              name="area"
              required
              maxLength={200}
              placeholder="e.g. Prince's Island Park"
              value={form.area}
              onChange={(event) => setForm({ ...form, area: event.target.value })}
            />
          </label>
          <label>
            When
            <input
              name="time"
              required
              maxLength={200}
              placeholder="e.g. Every Thursday 10am"
              value={form.time}
              onChange={(event) => setForm({ ...form, time: event.target.value })}
            />
          </label>
          <label className="span-2">
            Details
            <input
              name="note"
              required
              maxLength={200}
              placeholder="Beginners welcome — bring a mat"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </label>
          <button className="pill pill-dark" type="submit">
            Post activity invite
          </button>
        </form>
        {status ? (
          <p className="form-note" role="status">
            {status}
          </p>
        ) : null}
      </section>
    </div>
  )
}
