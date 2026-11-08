export function kmBetween(from, to) {
  const earth = 6371
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earth * Math.asin(Math.sqrt(a))
}

export function formatKm(km) {
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

export async function searchPlaces(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", query)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("limit", "5")
  const response = await fetch(url, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error("Place search failed")
  const data = await response.json()
  return data.map((item) => ({
    label: item.display_name,
    shortLabel: item.display_name.split(",")[0],
    lat: Number(item.lat),
    lng: Number(item.lon),
  }))
}

export function safeReturn(value) {
  if (typeof value !== "string") return "/"
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/"
  return value
}
