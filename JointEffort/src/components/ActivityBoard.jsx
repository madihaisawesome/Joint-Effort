import { useEffect, useState } from "react"
import { getBuddies, postBuddy } from "../lib/api.js"

const emptyForm = {
  name: "",
  activity: "",
  area: "",
  time: "",
  note: "",
}

export default function ActivityBoard() {
  const [posts, setPosts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const data = await getBuddies()
      setPosts(data.posts || [])
      setStatus("")
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
      await postBuddy({
        name: form.name.trim(),
        activity: form.activity.trim(),
        area: form.area.trim(),
        time: form.time.trim(),
        note: form.note.trim(),
      })
      setForm(emptyForm)
      setStatus("Posted — thank you!")
      await load()
    } catch (error) {
      setStatus(error.message || "Post failed")
    }
  }

  return (
    <section className="activity-board" aria-labelledby="activity-board-heading">
      <div className="results-bar">
        <h2 id="activity-board-heading">Activity invite board</h2>
      </div>
      <p>
        Share a gentle meetup — walks, park yoga, stretching, tai chi, and more. Each field stays
        under 200 characters.
      </p>
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
      {loading ? <p>Loading invites…</p> : null}
      {!loading && !posts.length ? (
        <p>No activity invites yet — post a walk, park yoga, or stretch meetup.</p>
      ) : null}
      {posts.length ? (
        <ul className="activity-list">
          {posts.map((post) => (
            <li key={post.id}>
              <strong>{post.activity || "Gentle movement"}</strong>
              <span>
                {post.name} · {post.area} · {post.time}
              </span>
              <span>{post.note}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
