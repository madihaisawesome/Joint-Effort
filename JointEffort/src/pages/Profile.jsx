import { Link, NavLink } from "react-router-dom"
import { AccessibilityControls } from "../components/Header.jsx"
import { useAuth } from "../context/Auth.jsx"
import { usePageTitle } from "../lib/title.js"
import portrait from "../assets/profile/portrait.png"
import connection1 from "../assets/profile/connection-1.png"
import connection2 from "../assets/profile/connection-2.png"
import connection3 from "../assets/profile/connection-3.png"
import connection4 from "../assets/profile/connection-4.png"
import connection5 from "../assets/profile/connection-5.png"
import chevronLeft from "../assets/profile/chevron-left.svg"
import iconUser from "../assets/profile/icon-user.svg"
import iconActivity from "../assets/profile/icon-activity.svg"
import iconCalendar from "../assets/profile/icon-calendar.svg"
import iconAccess from "../assets/profile/icon-access.svg"

const connections = [
  { name: "Joan T.", note: "Walk buddy", photo: connection1 },
  { name: "Robert K.", note: "Art class", photo: connection2 },
  { name: "Susan M.", note: "Tea group", photo: connection3 },
  { name: "David P.", note: "Riverside walk", photo: connection4 },
  { name: "Edna R.", note: "Book club", photo: connection5 },
]

export default function Profile() {
  const { logout } = useAuth()
  usePageTitle("Profile")

  return (
    <div className="profile-page">
      <aside className="profile-side">
        <Link className="profile-back" to="/">
          <img src={chevronLeft} alt="" width="20" height="20" />
          Back
        </Link>
        <div className="profile-identity">
          <img className="profile-portrait" src={portrait} alt="" width="180" height="180" />
          <h1>Margaret W.</h1>
          <p className="profile-role">Community Member</p>
          <p className="profile-since">Member since 2022</p>
        </div>
        <nav className="profile-menu" aria-label="Profile">
          <NavLink to="/profile" end>
            <img src={iconUser} alt="" width="24" height="24" />
            Profile
          </NavLink>
          <NavLink to="/exercises">
            <img src={iconActivity} alt="" width="24" height="24" />
            Exercises
          </NavLink>
          <NavLink to="/calendar">
            <img src={iconCalendar} alt="" width="24" height="24" />
            Calendar
          </NavLink>
          <a href="#accessibility">
            <img src={iconAccess} alt="" width="24" height="24" />
            Accessibility
          </a>
        </nav>
        <button className="profile-logout" type="button" onClick={logout}>
          Log Out
        </button>
      </aside>
      <div className="profile-main">
        <section className="profile-events" aria-labelledby="upcoming-heading">
          <div className="profile-section-head">
            <h2 id="upcoming-heading">Upcoming events</h2>
            <Link className="profile-view-all" to="/events">
              View all
            </Link>
          </div>
          <ul>
            <li className="profile-event is-attending">
              <p className="profile-date">
                <span>10</span>
                <span>NOV</span>
              </p>
              <div>
                <p className="profile-event-title">Gentle riverside walk</p>
                <p className="profile-event-time">10:00–11:00 am · Richmond Riverside</p>
              </div>
              <p className="profile-badge">Attending</p>
            </li>
            <li className="profile-event">
              <p className="profile-date">
                <span>13</span>
                <span>NOV</span>
              </p>
              <div>
                <p className="profile-event-title">Tea, cake & good company</p>
                <p className="profile-event-time">11:00 am–12:30 pm · Richmond Library</p>
              </div>
              <p className="profile-badge is-outline">Register</p>
            </li>
          </ul>
        </section>
        <section className="profile-connections" aria-labelledby="connections-heading">
          <h2 id="connections-heading">Connects most with…</h2>
          <ul>
            {connections.map((person) => (
              <li key={person.name}>
                <img src={person.photo} alt="" width="80" height="80" />
                <p>{person.name}</p>
                <p>{person.note}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="profile-access" id="accessibility" aria-labelledby="access-heading">
          <h2 id="access-heading">Accessibility</h2>
          <AccessibilityControls />
        </section>
      </div>
    </div>
  )
}
