import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { events } from "../data/events.js"
import { useCurriculum } from "../context/Curriculum.jsx"
import { usePlace } from "../context/Place.jsx"
import { useWorkouts } from "../context/Workouts.jsx"
import {
  formatClock,
  formatLongDate,
  formatMonthYear,
  formatRange,
  monthCells,
  monthNames,
  parseISODate,
  todayISO,
  toISODate,
  weekCells,
  weekdays,
} from "../lib/dates.js"
import { usePageTitle } from "../lib/title.js"
import iconCalendar from "../assets/icon-calendar.svg"
import iconHeart from "../assets/icon-heart.svg"
import iconBell from "../assets/icon-bell.svg"
import iconPin from "../assets/icon-pin-sage.svg"
import iconLeft from "../assets/icon-chevron-left.svg"
import iconRight from "../assets/icon-chevron-right.svg"
import iconDot from "../assets/icon-dot.svg"
import iconArrow from "../assets/icon-arrow-light.svg"

function countLabel(items) {
  const workouts = items.filter((item) => item.type === "workout").length
  const community = items.length - workouts
  const parts = []
  if (workouts) parts.push(`${workouts} workout${workouts === 1 ? "" : "s"}`)
  if (community) parts.push(`${community} event${community === 1 ? "" : "s"}`)
  return parts.join(", ")
}

export default function Calendar() {
  const { exercises, getExercise } = useCurriculum()
  const { place } = usePlace()
  const { workouts, saveWorkout, markDone, removeWorkout } = useWorkouts()
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const [cursor, setCursor] = useState(() => parseISODate(today))
  const [selected, setSelected] = useState(today)
  const [view, setView] = useState("month")
  const [filter, setFilter] = useState("all")
  const [editing, setEditing] = useState(null)
  const [confirmId, setConfirmId] = useState("")
  const [live, setLive] = useState("")
  const dialogRef = useRef(null)
  usePageTitle("Calendar")

  useEffect(() => {
    const dialog = dialogRef.current
    if (!editing || !dialog) return undefined
    const onClose = () => setEditing(null)
    dialog.addEventListener("close", onClose)
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.removeEventListener("close", onClose)
      if (dialog.open) dialog.close()
    }
  }, [editing])

  useEffect(() => {
    const workoutId = params.get("workout")
    if (params.get("done") === "1" && workoutId) {
      markDone(workoutId)
      const next = new URLSearchParams(params)
      next.delete("done")
      next.delete("workout")
      setParams(next, { replace: true })
      setLive("Workout marked done.")
    }
  }, [markDone, params, setParams])

  const itemsByDate = useMemo(() => {
    const map = new Map()
    const add = (date, item) => {
      const list = map.get(date) || []
      list.push(item)
      map.set(date, list)
    }
    if (filter === "all") {
      events.forEach((event) => {
        add(event.date, {
          id: event.id,
          type: "event",
          name: event.name,
          time: formatRange(event.start, event.end),
          place: event.place,
          sort: event.start,
        })
      })
    }
    workouts.forEach((workout) => {
      if (filter === "reminders" && workout.status === "done") return
      const exercise = getExercise(workout.exerciseId)
      add(workout.date, {
        id: workout.id,
        type: "workout",
        name: exercise?.name || "Camera session",
        time: formatClock(workout.time),
        note: workout.note,
        status: workout.status,
        exerciseId: workout.exerciseId,
        sort: workout.time,
      })
    })
    map.forEach((list) => list.sort((a, b) => a.sort.localeCompare(b.sort)))
    return map
  }, [filter, workouts])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const cells = view === "week" ? weekCells(selected) : monthCells(year, month)
  const dayItems = itemsByDate.get(selected) || []

  function shift(direction) {
    if (view === "week") {
      const date = parseISODate(selected)
      date.setDate(date.getDate() + direction * 7)
      setSelected(toISODate(date))
      setCursor(date)
      return
    }
    const next = new Date(cursor)
    if (view === "year") next.setFullYear(next.getFullYear() + direction)
    else next.setMonth(next.getMonth() + direction)
    setCursor(next)
  }

  function chooseDay(date) {
    const iso = toISODate(date)
    setSelected(iso)
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1))
    const count = (itemsByDate.get(iso) || []).length
    setLive(
      `${formatLongDate(iso)}. ${count === 0 ? "Nothing is scheduled." : countLabel(itemsByDate.get(iso))}.`,
    )
  }

  function onSubmit(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    saveWorkout({
      id: editing.id,
      exerciseId: data.get("exercise"),
      date: data.get("date"),
      time: data.get("time"),
      note: data.get("note"),
      status: editing.status || "planned",
    })
    setSelected(data.get("date"))
    setEditing(null)
    setLive(editing.id ? "Workout updated." : "Workout added.")
  }

  const visibleItems = dayItems

  return (
    <section className="calendar-page">
      <p className="visually-hidden" aria-live="polite">
        {live}
      </p>
      <aside className="day-panel">
        <p className="day-kicker">Selected date</p>
        <p className="day-number">{parseISODate(selected).getDate()}</p>
        <p className="day-name">{formatLongDate(selected)}</p>
        <div className="side-nav">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            <img src={iconCalendar} alt="" width="24" height="24" />
            Calendar
          </button>
          <button
            type="button"
            aria-pressed={filter === "workouts"}
            onClick={() => setFilter("workouts")}
          >
            <img src={iconHeart} alt="" width="24" height="24" />
            My events
          </button>
          <button
            type="button"
            aria-pressed={filter === "reminders"}
            onClick={() => setFilter("reminders")}
          >
            <img src={iconBell} alt="" width="24" height="24" />
            Reminders
          </button>
        </div>
        <div className="agenda">
          <div className="agenda-head">
            <h2>
              {filter === "reminders"
                ? "Planned workouts"
                : selected === today
                  ? "Today"
                  : "This day"}
            </h2>
            <span>{visibleItems.length}</span>
          </div>
          {visibleItems.length === 0 ? (
            <p>Nothing is scheduled this day.</p>
          ) : (
            <ul>
              {visibleItems.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <p className="item-type">{item.type === "workout" ? "Workout" : "Community event"}</p>
                  <p className="item-time">{item.time}</p>
                  <p className="item-name">{item.name}</p>
                  {item.type === "workout" ? (
                    <>
                      <p>{item.status === "done" ? "Done" : "Planned"}</p>
                      {item.note ? <p>{item.note}</p> : null}
                      <div className="item-actions">
                        <Link to={`/exercises/${item.exerciseId}?workout=${item.id}`}>Start</Link>
                        {item.status !== "done" ? (
                          <button type="button" onClick={() => markDone(item.id)}>
                            Mark done
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: item.id,
                              exerciseId: item.exerciseId,
                              date: selected,
                              time: workouts.find((workout) => workout.id === item.id)?.time || "09:00",
                              note: item.note,
                              status: item.status,
                            })
                          }
                        >
                          Edit
                        </button>
                        {confirmId === item.id ? (
                          <>
                            <button type="button" onClick={() => { removeWorkout(item.id); setConfirmId("") }}>
                              Confirm delete
                            </button>
                            <button type="button" onClick={() => setConfirmId("")}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => setConfirmId(item.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p>{item.place}</p>
                      <Link to={`/events?event=${item.id}`}>Open on the map</Link>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          className="pill pill-dark day-add"
          type="button"
          onClick={() =>
            setEditing({
              id: "",
              exerciseId: exercises[0].id,
              date: selected,
              time: "09:00",
              note: "",
              status: "planned",
            })
          }
        >
          Add a workout
          <img src={iconArrow} alt="" width="20" height="20" />
        </button>
      </aside>

      <div className="month-panel">
        <div className="month-heading">
          <h1>{formatMonthYear(year, month)}</h1>
          <p>
            <img src={iconPin} alt="" width="22" height="22" />
            {place.shortLabel}
          </p>
        </div>
        <div className="month-tools">
          <div className="view-switch" role="radiogroup" aria-label="Calendar view">
            {[
              ["year", "Year"],
              ["month", "Month"],
              ["week", "Week"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="date-tools">
            <button type="button" onClick={() => shift(-1)}>
              <img src={iconLeft} alt="" width="24" height="24" />
              <span className="visually-hidden">Previous {view}</span>
            </button>
            <label>
              <span className="visually-hidden">Month</span>
              <select
                value={month}
                onChange={(event) => setCursor(new Date(year, Number(event.target.value), 1))}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="visually-hidden">Year</span>
              <select
                value={year}
                onChange={(event) => setCursor(new Date(Number(event.target.value), month, 1))}
              >
                {[year - 1, year, year + 1, year + 2].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => shift(1)}>
              <img src={iconRight} alt="" width="24" height="24" />
              <span className="visually-hidden">Next {view}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const now = parseISODate(today)
                setCursor(now)
                setSelected(today)
              }}
            >
              Today
            </button>
          </div>
        </div>

        {view === "year" ? (
          <div className="year-grid">
            {monthNames.map((name, index) => {
              const count = [...itemsByDate.entries()].reduce((sum, [iso, list]) => {
                const date = parseISODate(iso)
                return date.getFullYear() === year && date.getMonth() === index ? sum + list.length : sum
              }, 0)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setCursor(new Date(year, index, 1))
                    setView("month")
                  }}
                >
                  <span>{name}</span>
                  <span>{count === 0 ? "Nothing scheduled" : countLabel(
                    [...itemsByDate.entries()].flatMap(([iso, list]) => {
                      const date = parseISODate(iso)
                      return date.getFullYear() === year && date.getMonth() === index ? list : []
                    }),
                  )}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="month-grid">
            <div className="weekday-row">
              {weekdays.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className={view === "week" ? "day-grid week-grid" : "day-grid"}>
              {cells.map((date) => {
                const iso = toISODate(date)
                const items = itemsByDate.get(iso) || []
                const outside = date.getMonth() !== month && view === "month"
                return (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      "day-cell",
                      outside ? "is-outside" : "",
                      iso === selected ? "is-selected" : "",
                    ].filter(Boolean).join(" ")}
                    aria-pressed={iso === selected}
                    onClick={() => chooseDay(date)}
                  >
                    <span>{String(date.getDate()).padStart(2, "0")}</span>
                    {items.length ? (
                      <span className="day-count">
                        <img src={iconDot} alt="" width="8" height="8" />
                        {countLabel(items)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <p className="calendar-foot">
          <span>Select a date to see workouts and community events.</span>
          <span>
            <img src={iconDot} alt="" width="8" height="8" />
            Events available
          </span>
        </p>
      </div>

      {editing ? (
        <dialog className="workout-dialog" ref={dialogRef}>
          <form key={editing.id || "new"} onSubmit={onSubmit}>
            <h2>{editing.id ? "Edit workout" : "Add a workout"}</h2>
            <label>
              Exercise
              <select name="exercise" defaultValue={editing.exerciseId} required>
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input name="date" type="date" defaultValue={editing.date} required />
            </label>
            <label>
              Time
              <input name="time" type="time" defaultValue={editing.time} required />
            </label>
            <label>
              Note
              <input name="note" type="text" defaultValue={editing.note} />
            </label>
            <div className="button-row">
              <button className="pill pill-dark" type="submit">
                Save workout
              </button>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </section>
  )
}
