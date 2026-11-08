import photoWalk from "../assets/image.png"
import photoPaint from "../assets/image2.png"
import photoGather from "../assets/image3.png"
import photoOval from "../assets/event-1.png"
import photoPark from "../assets/event-3.png"
import { toISODate } from "../lib/dates.js"

function upcoming(weekday) {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const add = (weekday - start.getDay() + 7) % 7
  start.setDate(start.getDate() + add)
  return toISODate(start)
}

export const events = [
  {
    id: "active-living",
    name: "Active Living drop-in",
    place: "UCalgary Active Living",
    area: "On campus",
    lat: 51.0773,
    lng: -114.1289,
    date: upcoming(2),
    start: "10:00",
    end: "11:00",
    kind: "recreation",
    image: photoWalk,
    summary: "A drop-in session at the campus recreation centre.",
    summaryLong:
      "This demo session is at UCalgary Active Living, on campus. The time is a sample label, not the centre’s live schedule. You can read it here and on the calendar. You cannot post or change community events.",
    access: "",
    accessTags: [],
  },
  {
    id: "olympic-oval",
    name: "Olympic Oval session",
    place: "Olympic Oval",
    area: "On campus",
    lat: 51.0768,
    lng: -114.1357,
    date: upcoming(4),
    start: "14:00",
    end: "15:30",
    kind: "recreation",
    image: photoPaint,
    summary: "A demo session at the Olympic Oval on campus.",
    summaryLong:
      "This demo session is at the Olympic Oval, on campus. The time is a sample label, not the venue’s live schedule. Opening it on the map shows the same place as this card.",
    access: "",
    accessTags: [],
  },
  {
    id: "nose-hill",
    name: "Nose Hill walk meetup",
    place: "Nose Hill Park",
    area: "Southern entrances",
    lat: 51.1008,
    lng: -114.0946,
    date: upcoming(5),
    start: "11:00",
    end: "12:30",
    kind: "park",
    image: photoGather,
    summary: "A walk meetup at the southern side of Nose Hill Park.",
    summaryLong:
      "This demo meetup uses a southern entrance, which is the closer side of Nose Hill Park from campus. The time is a sample label, not a park program. Some pavement is near parking. Most trails are uneven. Washrooms are not available.",
    access:
      "Some pavement near parking. Most trails are uneven. Washrooms are not available.",
    accessTags: ["paved"],
  },
  {
    id: "confederation",
    name: "Confederation Park meetup",
    place: "Confederation Park",
    area: "14 Street and 24 Avenue NW",
    lat: 51.072,
    lng: -114.095,
    date: upcoming(6),
    start: "09:00",
    end: "10:00",
    kind: "park",
    image: photoOval,
    summary: "A meetup at Confederation Park, 14 Street and 24 Avenue NW.",
    summaryLong:
      "This demo meetup is at Confederation Park, at 14 Street and 24 Avenue NW. The time is a sample label. Pathways run through the park, and washrooms are seasonal.",
    access: "Pathways, and seasonal washrooms.",
    accessTags: ["washrooms", "paved"],
  },
  {
    id: "west-confederation",
    name: "West Confederation Park meetup",
    place: "West Confederation Park",
    area: "2020 Chicoutimi Drive NW",
    lat: 51.0935,
    lng: -114.1475,
    date: upcoming(0),
    start: "13:00",
    end: "14:00",
    kind: "park",
    image: photoPark,
    summary: "A meetup at West Confederation Park, 2020 Chicoutimi Drive NW.",
    summaryLong:
      "This demo meetup is at West Confederation Park, 2020 Chicoutimi Drive NW. The time is a sample label, not a live schedule.",
    access: "",
    accessTags: [],
  },
]

export function getEvent(id) {
  return events.find((event) => event.id === id) || null
}
