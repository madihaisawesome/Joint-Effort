import { useEffect, useRef } from "react"
import L from "leaflet"
import iconPlus from "../assets/icon-plus.svg"
import iconMinus from "../assets/icon-minus.svg"
import iconLocate from "../assets/icon-locate.svg"
import { formatWhen } from "../lib/dates.js"

function pinIcon(number, selected, interested) {
  const classes = ["je-pin"]
  if (interested) classes.push("is-interested")
  if (selected) classes.push("is-selected")
  return L.divIcon({
    className: "je-marker",
    html: `<span class="${classes.join(" ")}">${number}</span>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
  })
}

export default function EventMap({ center, events, selectedId, onSelect }) {
  const nodeRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const map = L.map(nodeRef.current, {
      zoomControl: false,
      zoomAnimation: !reduce,
      fadeAnimation: !reduce,
      attributionControl: true,
    }).setView([center.lat, center.lng], 13)
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], mapRef.current.getZoom())
  }, [center.lat, center.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return undefined
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()
    events.forEach((event, index) => {
      const interested = Boolean(event.youInterested)
      const label = interested
        ? `${event.name}, pin ${index + 1}, you're interested`
        : `${event.name}, pin ${index + 1}`
      const marker = L.marker([event.lat, event.lng], {
        icon: pinIcon(index + 1, event.id === selectedId, interested),
        keyboard: true,
        title: label,
      })
      marker.on("click", () => onSelectRef.current(event.id, "map"))
      marker.on("add", () => {
        const element = marker.getElement()
        if (!element) return
        element.setAttribute("aria-label", label)
      })
      marker.addTo(map)
      markersRef.current.set(event.id, marker)
    })
    return undefined
  }, [events, selectedId])

  useEffect(() => {
    const event = events.find((item) => item.id === selectedId)
    if (event) mapRef.current?.panTo([event.lat, event.lng])
  }, [events, selectedId])

  const selected = events.find((event) => event.id === selectedId)
  const selectedIndex = events.findIndex((event) => event.id === selectedId)

  return (
    <div className="map-panel" data-skip-speech>
      <div ref={nodeRef} className="map-canvas" role="region" aria-label="Street map" />
      <p className="map-chip">{center.shortLabel || center.label}</p>
      <div className="map-zoom">
        <button type="button" onClick={() => mapRef.current?.zoomIn()}>
          <img src={iconPlus} alt="" width="24" height="24" />
          <span className="visually-hidden">Zoom in</span>
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomOut()}>
          <img src={iconMinus} alt="" width="24" height="24" />
          <span className="visually-hidden">Zoom out</span>
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.setView([center.lat, center.lng], 13)}
        >
          <img src={iconLocate} alt="" width="24" height="24" />
          <span className="visually-hidden">Center map on {center.label}</span>
        </button>
      </div>
      {selected ? (
        <article className="map-preview">
          <img src={selected.image} alt="" width="112" height="104" />
          <div>
            <p className="map-kicker">
              {selected.source === "buddy"
                ? selected.youInterested
                  ? "Your interest"
                  : "Activity invite"
                : `Event ${selectedIndex + 1}`}
            </p>
            <p className="map-title">{selected.name}</p>
            <p>
              {selected.whenLabel || formatWhen(selected.date, selected.start, selected.end)}
            </p>
            {selected.youInterested ? <p className="map-interested">You're interested</p> : null}
            {selected.access ? <p>{selected.access}</p> : null}
          </div>
          <button type="button" className="pill pill-dark" onClick={() => onSelect(selected.id, "map")}>
            {selected.source === "buddy" ? "View invite" : "View event"}
          </button>
        </article>
      ) : null}
    </div>
  )
}
