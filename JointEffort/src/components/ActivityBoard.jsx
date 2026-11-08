import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  deleteBuddy,
  getBuddies,
  joinBuddyInterest,
  postBuddy,
  updateBuddy,
} from "../lib/api.js"
import { useJoinedInvites, writeJoinedInvites } from "../lib/joinedInvites.js"
import {
  forgetOwnedInvite,
  rememberOwnedInvite,
  useOwnedInvites,
} from "../lib/ownedInvites.js"

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

function interestLabel(count) {
  const n = Number(count) || 0
  if (n <= 0) return "Be the first to join"
  if (n === 1) return "1 person interested"
  return `${n} people interested`
}

export default function ActivityBoard() {
  const [posts, setPosts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState("")
  const [editingId, setEditingId] = useState("")
  const [busyId, setBusyId] = useState("")
  const joined = useJoinedInvites()
  const owned = useOwnedInvites()
  const [joiningId, setJoiningId] = useState("")

  const myPosts = useMemo(() => {
    const ownedSet = new Set(owned)
    return posts.filter((post) => ownedSet.has(post.id))
  }, [owned, posts])

  async function load() {
    try {
      const data = await getBuddies()
      const next = data.posts || []
      setPosts(next)
      setSelectedId((current) => (current && next.some((post) => post.id === current) ? current : ""))
      setEditingId((current) => (current && next.some((post) => post.id === current) ? current : ""))
    } catch (error) {
      setStatus(error.message || "Could not load activity invites.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(post) {
    setEditingId(post.id)
    setSelectedId(post.id)
    setForm({
      name: post.name || "",
      activity: post.activity || "",
      area: post.area || "",
      time: post.time || "",
      note: post.note || "",
    })
    setStatus(`Editing “${post.activity || "invite"}”.`)
    window.requestAnimationFrame(() => {
      document.getElementById("activity-board-heading")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }

  function cancelEdit() {
    setEditingId("")
    setForm(emptyForm)
    setStatus("")
  }

  async function onSubmit(event) {
    event.preventDefault()
    const payload = {
      name: form.name.trim(),
      activity: form.activity.trim(),
      area: form.area.trim(),
      time: form.time.trim(),
      note: form.note.trim(),
    }
    setStatus(editingId ? "Saving…" : "Posting…")
    try {
      if (editingId) {
        const updated = await updateBuddy(editingId, payload)
        setPosts((current) =>
          current.map((item) => (item.id === editingId ? { ...item, ...updated } : item)),
        )
        setForm(emptyForm)
        setEditingId("")
        setSelectedId(updated.id)
        setStatus("Invite updated.")
      } else {
        const created = await postBuddy(payload)
        if (created?.id) rememberOwnedInvite(created.id)
        setForm(emptyForm)
        setStatus("Posted — find it under Your invites.")
        await load()
        if (created?.id) setSelectedId(created.id)
      }
    } catch (error) {
      setStatus(error.message || (editingId ? "Update failed" : "Post failed"))
    }
  }

  async function onDelete(post) {
    if (!post?.id || busyId) return
    const ok = window.confirm(`Delete “${post.activity || "this invite"}”? This cannot be undone.`)
    if (!ok) return
    setBusyId(post.id)
    try {
      await deleteBuddy(post.id)
      forgetOwnedInvite(post.id)
      writeJoinedInvites(joined.filter((id) => id !== post.id))
      setPosts((current) => current.filter((item) => item.id !== post.id))
      if (editingId === post.id) cancelEdit()
      if (selectedId === post.id) setSelectedId("")
      setStatus("Invite deleted.")
    } catch (error) {
      setStatus(error.message || "Could not delete invite.")
    } finally {
      setBusyId("")
    }
  }

  async function onToggleInterest(post) {
    if (!post?.id || joiningId) return
    const leaving = joined.includes(post.id)
    setJoiningId(post.id)
    try {
      const updated = await joinBuddyInterest(post.id, leaving ? "leave" : "join")
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                interestCount:
                  updated.interestCount ??
                  Math.max(0, (Number(item.interestCount) || 0) + (leaving ? -1 : 1)),
              }
            : item,
        ),
      )
      writeJoinedInvites(
        leaving ? joined.filter((id) => id !== post.id) : [...joined, post.id],
      )
      setStatus(
        leaving
          ? `Removed interest in ${post.activity || "this meetup"}.`
          : `You're interested in ${post.activity || "this meetup"}.`,
      )
    } catch (error) {
      setStatus(error.message || "Could not update interest.")
    } finally {
      setJoiningId("")
    }
  }

  function renderPost(post, { mine = false } = {}) {
    const open = post.id === selectedId
    const alreadyJoined = joined.includes(post.id)
    const count = Number(post.interestCount) || 0
    const hasPin = typeof post.lat === "number" && typeof post.lng === "number"
    const detailId = mine ? `activity-mine-${post.id}` : `activity-detail-${post.id}`

    return (
      <li key={`${mine ? "mine" : "feed"}-${post.id}`} className={open ? "is-expanded" : undefined}>
        <button
          type="button"
          className={open ? "activity-hit is-selected" : "activity-hit"}
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setSelectedId(open ? "" : post.id)}
        >
          <span className="activity-hit-title">{post.activity || "Gentle movement"}</span>
          <span className="activity-hit-meta">
            {post.time} · {post.area}
          </span>
          <span className="activity-hit-interest">{interestLabel(count)}</span>
          <span className="activity-hit-action">{open ? "Hide details" : "View details"}</span>
        </button>
        <div id={detailId} className="activity-detail" hidden={!open}>
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
            <div className="span-2">
              <dt>Interest</dt>
              <dd>{interestLabel(count)}</dd>
            </div>
            {hasPin ? (
              <div className="span-2">
                <dt>On the map</dt>
                <dd>
                  <Link className="text-link" to={`/events?event=invite-${post.id}`}>
                    View pin near {post.area}
                  </Link>
                </dd>
              </div>
            ) : null}
            <div className="span-2">
              <dt>Details</dt>
              <dd>{post.note}</dd>
            </div>
          </dl>
          {mine ? (
            <div className="activity-manage-row">
              <button
                type="button"
                className="pill pill-dark"
                disabled={busyId === post.id}
                onClick={() => startEdit(post)}
              >
                Edit
              </button>
              <button
                type="button"
                className="pill"
                disabled={busyId === post.id}
                onClick={() => onDelete(post)}
              >
                {busyId === post.id ? "Deleting…" : "Delete"}
              </button>
              <p className="activity-join-note" role="status">
                {interestLabel(count)} on this invite.
              </p>
            </div>
          ) : (
            <div className="activity-join-row">
              <button
                type="button"
                className={alreadyJoined ? "pill pill-mint" : "pill pill-dark"}
                disabled={joiningId === post.id}
                aria-pressed={alreadyJoined}
                onClick={() => onToggleInterest(post)}
              >
                {joiningId === post.id
                  ? alreadyJoined
                    ? "Updating…"
                    : "Joining…"
                  : alreadyJoined
                    ? "Not interested"
                    : "I'm interested"}
              </button>
              <p className="activity-join-note" role="status">
                {alreadyJoined
                  ? "You're counted — tap again to leave."
                  : "One tap records interest. No account needed."}
              </p>
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="activity-layout">
      <section className="activity-feed" aria-labelledby="activity-feed-heading">
        <h2 id="activity-feed-heading">Open invites</h2>
        <p className="activity-feed-hint">
          Select an invite for details. Pins with a location also show on the{" "}
          <Link className="text-link" to="/events">
            Events map
          </Link>
          .
        </p>
        {loading ? <p className="activity-feed-empty">Loading invites…</p> : null}
        {!loading && !posts.length ? (
          <p className="activity-feed-empty">
            No invites yet. Use the form to post a walk, park yoga, or stretch meetup.
          </p>
        ) : null}
        {posts.length ? <ul className="activity-list">{posts.map((post) => renderPost(post))}</ul> : null}
      </section>

      <div className="activity-side">
        <section className="activity-mine" aria-labelledby="activity-mine-heading">
          <h2 id="activity-mine-heading">Your invites</h2>
          <p>
            Posts from this browser live here — edit, delete, and watch interest grow.
          </p>
          {!loading && !myPosts.length ? (
            <p className="activity-feed-empty">You haven&apos;t posted an invite yet.</p>
          ) : null}
          {myPosts.length ? (
            <ul className="activity-list activity-mine-list">
              {myPosts.map((post) => renderPost(post, { mine: true }))}
            </ul>
          ) : null}
        </section>

        <section className="activity-compose" aria-labelledby="activity-board-heading">
          <h2 id="activity-board-heading">{editingId ? "Edit invite" : "Post an invite"}</h2>
          <p>
            {editingId
              ? "Update the fields, then save. Interest stays the same."
              : "Each field stays under 200 characters."}
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
            <div className="activity-form-actions">
              <button className="pill pill-dark" type="submit">
                {editingId ? "Save changes" : "Post activity invite"}
              </button>
              {editingId ? (
                <button className="pill" type="button" onClick={cancelEdit}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {status ? (
            <p className="form-note" role="status">
              {status}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
