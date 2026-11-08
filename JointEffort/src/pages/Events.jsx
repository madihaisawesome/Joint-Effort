import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import EventMap from "../components/EventMap.jsx"
import { events as demoEvents } from "../data/events.js"
import { useAuth } from "../context/Auth.jsx"
import { usePlace } from "../context/Place.jsx"
import { getBuddies, getPrograms } from "../lib/api.js"
import { useJoinedInvites } from "../lib/joinedInvites.js"
import { addDays, formatWhen, todayISO } from "../lib/dates.js"
import { formatKm, kmBetween, searchPlaces } from "../lib/geo.js"
import { usePageTitle } from "../lib/title.js"
import iconSearch from "../assets/icon-search.svg"
import iconLocate from "../assets/icon-locate.svg"
import iconCalendar from "../assets/icon-calendar.svg"
import iconSliders from "../assets/icon-sliders.svg"
import iconAccess from "../assets/icon-access.svg"
import iconPin from "../assets/icon-pin.svg"
import iconArrowLight from "../assets/icon-arrow-light.svg"
import iconArrowDark from "../assets/icon-arrow-dark.svg"
import photoWalk from "../assets/image.png"
import photoPaint from "../assets/image2.png"
import photoGather from "../assets/image3.png"
import photoOval from "../assets/event-1.png"
import photoPark from "../assets/event-3.png"

const programPhotos = [photoWalk, photoPaint, photoGather, photoOval, photoPark]

function programToEvent(program, index) {
  return {
    id: program.id,
    name: program.name,
    place: program.address || "Calgary",
    area: program.type || "Verified program",
    lat: program.lat,
    lng: program.lng,
    date: todayISO(),
    start: "09:00",
    end: "17:00",
    kind: "recreation",
    image: programPhotos[index % programPhotos.length],
    summary: program.hours || "Verified Calgary program listing.",
    summaryLong: [program.hours, program.phone ? `Phone ${program.phone}` : "", program.link || ""]
      .filter(Boolean)
      .join(" "),
    access: program.link ? `Website: ${program.link}` : "",
    accessTags: [],
    source: "program",
    link: program.link || "",
  }
}

function interestLabel(count) {
  const n = Number(count) || 0
  if (n <= 0) return "Open invite"
  if (n === 1) return "1 person interested"
  return `${n} people interested`
}

function buddyToEvent(post, index) {
  const count = Number(post.interestCount) || 0
  return {
    id: `invite-${post.id}`,
    buddyId: post.id,
    name: post.activity || "Gentle meetup",
    place: post.area || "Calgary",
    area: "Activity invite",
    lat: post.lat,
    lng: post.lng,
    date: todayISO(),
    start: "10:00",
    end: "11:00",
    kind: "activity",
    image: programPhotos[index % programPhotos.length],
    summary: `${post.time || "Flexible timing"} · Hosted by ${post.name || "a neighbour"}`,
    summaryLong: post.note || "",
    access: interestLabel(count),
    accessTags: [],
    source: "buddy",
    link: "/activity",
    whenLabel: post.time || "See Activity Board",
    interestCount: count,
  }
}

export default function Events() {
  const { login } = useAuth()
  const { place, choose, save, saved, status, setStatus } = usePlace()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState("")
  const [searching, setSearching] = useState(false)
  const [when, setWhen] = useState("7")
  const [kind, setKind] = useState("all")
  const [access, setAccess] = useState("any")
  const [radius, setRadius] = useState("25")
  const [sort, setSort] = useState("soon")
  const [openId, setOpenId] = useState("")
  const [announce, setAnnounce] = useState("")
  const [liveEvents, setLiveEvents] = useState([])
  const [inviteEvents, setInviteEvents] = useState([])
  const [backendNote, setBackendNote] = useState("")
  const joinedInvites = useJoinedInvites()
  usePageTitle("Community events")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getPrograms()
        if (cancelled) return
        const mapped = (data.programs || []).map(programToEvent)
        setLiveEvents(mapped)
        setBackendNote(mapped.length ? `${mapped.length} verified programs from the Joint Effort API.` : "")
      } catch (error) {
        if (cancelled) return
        setLiveEvents([])
        setBackendNote(`Programs API offline — showing demo events only. ${error.message || ""}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getBuddies()
        if (cancelled) return
        const mapped = (data.posts || [])
          .filter(
            (post) =>
              typeof post.lat === "number" &&
              Number.isFinite(post.lat) &&
              typeof post.lng === "number" &&
              Number.isFinite(post.lng),
          )
          .map(buddyToEvent)
        setInviteEvents(mapped)
      } catch {
        if (cancelled) return
        setInviteEvents([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const catalog = useMemo(() => {
    const joined = new Set(joinedInvites)
    const withInterest = inviteEvents.map((event) => ({
      ...event,
      youInterested: joined.has(event.buddyId),
    }))
    const ids = new Set([...liveEvents, ...withInterest].map((event) => event.id))
    return [
      ...withInterest,
      ...liveEvents,
      ...demoEvents.filter((event) => !ids.has(event.id)),
    ]
  }, [inviteEvents, joinedInvites, liveEvents])

  const filtered = useMemo(() => {
    const today = todayISO()
    const limit = when === "any" ? null : addDays(today, when === "7" ? 6 : 29)
    const evergreen = (event) => event.source === "program" || event.source === "buddy"
    const rows = catalog
      .map((event) => ({ ...event, distance: kmBetween(place, event) }))
      .filter((event) => event.distance <= Number(radius))
      .filter((event) => (evergreen(event) ? true : limit ? event.date >= today && event.date <= limit : true))
      .filter((event) => (kind === "all" ? true : event.kind === kind))
      .filter((event) => (access === "any" ? true : event.accessTags.includes(access)))
    rows.sort((a, b) => {
      if (sort === "close") return a.distance - b.distance
      if (a.youInterested && !b.youInterested) return -1
      if (b.youInterested && !a.youInterested) return 1
      if (a.source === "buddy" && b.source !== "buddy") return -1
      if (b.source === "buddy" && a.source !== "buddy") return 1
      if (a.source === "program" && b.source !== "program") return -1
      if (b.source === "program" && a.source !== "program") return 1
      return `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)
    })
    return rows
  }, [access, catalog, kind, place, radius, sort, when])

  const requested = params.get("event")
  const selectedId = filtered.some((event) => event.id === requested)
    ? requested
    : filtered[0]?.id || ""

  function selectEvent(id, source) {
    const event = filtered.find((item) => item.id === id)
    if (!event) return
    const next = new URLSearchParams(params)
    next.set("event", id)
    setParams(next, { replace: true })
    setAnnounce(`${event.name}. Community event.`)
    if (source === "map") {
      window.requestAnimationFrame(() => {
        document.getElementById(`event-${id}`)?.focus()
      })
    }
  }

  async function onSearch(event) {
    event.preventDefault()
    setSearchError("")
    setResults([])
    const term = query.trim()
    if (!term) {
      setSearchError("Type a place name, then search.")
      return
    }
    setSearching(true)
    try {
      const found = await searchPlaces(term)
      if (!found.length) {
        setSearchError("No place matched that name. Try a street, park, or campus name.")
      }
      setResults(found)
    } catch {
      setSearchError("Place search is unavailable right now. The map is still on the current location.")
    } finally {
      setSearching(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("This browser cannot share a location. The map stays on the current place.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        choose({
          label: "Your current location",
          shortLabel: "Your location",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        setStatus(`Location permission was denied. The map stays on ${place.label}.`)
      },
    )
  }

  function onSave() {
    if (!save()) {
      login("/events")
    }
  }

  return (
    <section className="events-page">
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      <p className="visually-hidden" aria-live="polite">
        {status}
      </p>
      {backendNote ? <p className="form-note">{backendNote}</p> : null}
      <form className="filters" onSubmit={onSearch}>
        <div className="field location-field">
          <img src={iconSearch} alt="" width="24" height="24" />
          <label className="visually-hidden" htmlFor="place-search">
            Search for a place
          </label>
          <input
            id="place-search"
            value={query}
            placeholder={place.shortLabel}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="text-button" type="submit">
            {searching ? "Searching" : "Search"}
          </button>
          <button className="icon-button" type="button" onClick={useMyLocation}>
            <img src={iconLocate} alt="" width="24" height="24" />
            <span className="visually-hidden">Use my location</span>
          </button>
        </div>
        <label className="field">
          <img src={iconCalendar} alt="" width="24" height="24" />
          <span className="visually-hidden">When</span>
          <select value={when} onChange={(event) => setWhen(event.target.value)}>
            <option value="7">Next 7 days</option>
            <option value="30">Next 30 days</option>
            <option value="any">Any date</option>
          </select>
        </label>
        <label className="field">
          <img src={iconSliders} alt="" width="24" height="24" />
          <span className="visually-hidden">Activity</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="all">All activities</option>
            <option value="activity">Activity invites</option>
            <option value="park">Parks</option>
            <option value="recreation">Recreation centres</option>
          </select>
        </label>
        <label className="field">
          <img src={iconAccess} alt="" width="24" height="24" />
          <span className="visually-hidden">Accessibility</span>
          <select value={access} onChange={(event) => setAccess(event.target.value)}>
            <option value="any">Accessibility</option>
            <option value="paved">Paved or pathways</option>
            <option value="washrooms">Washrooms noted</option>
          </select>
        </label>
      </form>

      {searchError ? (
        <p className="form-note" role="alert">
          {searchError}
        </p>
      ) : null}
      {results.length ? (
        <ul className="place-results">
          {results.map((result) => (
            <li key={`${result.lat}-${result.lng}`}>
              <button
                type="button"
                onClick={() => {
                  choose(result)
                  setResults([])
                  setQuery("")
                }}
              >
                Use {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="events-layout">
        <div className="event-column">
          <div className="results-bar">
            <h1>
              {filtered.length === 0
                ? "No events in this area"
                : `${filtered.length} event${filtered.length === 1 ? "" : "s"} near ${place.shortLabel}`}
            </h1>
            <label>
              Within
              <select value={radius} onChange={(event) => setRadius(event.target.value)}>
                <option value="5">5 km</option>
                <option value="25">25 km</option>
                <option value="50">50 km</option>
              </select>
            </label>
            <label>
              Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="soon">Soonest first</option>
                <option value="close">Closest first</option>
              </select>
            </label>
          </div>
          <div className="event-scroll" tabIndex={0} aria-label="Community events">
          {filtered.length === 0 ? (
            <p>Change the distance or the filters. No extra events are added to fill the gap.</p>
          ) : (
            <ul className="event-list">
              {filtered.map((event, index) => {
                const selected = event.id === selectedId
                const open = openId === event.id
                return (
                  <li key={event.id}>
                    <article
                      className={[
                        "event-card",
                        selected ? "is-selected" : "",
                        event.youInterested ? "is-interested" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <button
                        id={`event-${event.id}`}
                        className="event-hit"
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectEvent(event.id, "list")}
                      >
                        <span className="event-photo">
                          <img src={event.image} alt="" />
                          <span className={`event-number${event.youInterested ? " is-interested" : ""}`}>
                            {index + 1}
                          </span>
                        </span>
                        <span className="event-copy">
                          <span className="event-name">{event.name}</span>
                          {event.youInterested ? (
                            <span className="event-interested-tag">You're interested</span>
                          ) : null}
                          <span className="event-meta">
                            <img src={iconCalendar} alt="" width="21" height="21" />
                            {event.whenLabel || formatWhen(event.date, event.start, event.end)}
                          </span>
                          <span className="event-meta event-place">
                            <img src={iconPin} alt="" width="21" height="21" />
                            {event.place} · {formatKm(event.distance)}
                          </span>
                        </span>
                      </button>
                      <div className="event-actions">
                        <button
                          className={selected ? "pill pill-dark" : "pill pill-mint"}
                          type="button"
                          aria-expanded={open}
                          onClick={() => {
                            selectEvent(event.id, "list")
                            setOpenId(open ? "" : event.id)
                          }}
                        >
                          Details
                          <img
                            src={selected ? iconArrowLight : iconArrowDark}
                            alt=""
                            width="20"
                            height="20"
                          />
                        </button>
                      </div>
                      <p className="more-detail event-inline">{event.summaryLong}</p>
                      <div className="event-more" hidden={!open}>
                        <p>{event.summary}</p>
                        <p className="more-detail">{event.summaryLong}</p>
                        {event.access ? <p>{event.access}</p> : null}
                        <p>{event.area}</p>
                        {event.source === "buddy" ? (
                          <p>
                            <Link className="text-link" to="/activity">
                              Open on Activity Board
                            </Link>
                          </p>
                        ) : null}
                        {event.link && event.source !== "buddy" ? (
                          <p>
                            <a href={event.link} target="_blank" rel="noopener noreferrer">
                              Open program website
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
          </div>
          <button className="pill" type="button" onClick={onSave}>
            {saved ? "Location saved" : "Save this location"}
          </button>
        </div>
        <div className="map-column">
          <p className="map-caption">
            Street map near {place.label} — mint pins are invites you marked interested.
          </p>
          <EventMap
            center={place}
            events={filtered}
            selectedId={selectedId}
            onSelect={selectEvent}
          />
        </div>
      </div>
    </section>
  )
}
