export function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseISODate(iso) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(iso, amount) {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + amount)
  return toISODate(date)
}

export function todayISO() {
  return toISODate(new Date())
}

export function formatClock(hhmm) {
  const [hourValue, minute] = hhmm.split(":").map(Number)
  const suffix = hourValue >= 12 ? "pm" : "am"
  const hour = hourValue % 12 || 12
  const minutes = String(minute).padStart(2, "0")
  return `${hour}:${minutes} ${suffix}`
}

export function formatRange(start, end) {
  const startText = formatClock(start)
  const endText = formatClock(end)
  const startSuffix = startText.slice(-2)
  const endSuffix = endText.slice(-2)
  if (startSuffix === endSuffix) {
    return `${startText.slice(0, -3)}–${endText}`
  }
  return `${startText}–${endText}`
}

export function formatDayLabel(iso) {
  return parseISODate(iso).toLocaleDateString("en-CA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function formatWhen(iso, start, end) {
  return `${formatDayLabel(iso)} · ${formatRange(start, end)}`
}

export function formatLongDate(iso) {
  return parseISODate(iso).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    year: "numeric",
  })
}

export function formatMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
  })
}

export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function monthCells(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export function weekCells(iso) {
  const selected = parseISODate(iso)
  const start = new Date(selected)
  start.setDate(selected.getDate() - selected.getDay())
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}
