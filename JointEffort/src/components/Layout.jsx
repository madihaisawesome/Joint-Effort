import { Outlet } from "react-router-dom"
import Header from "./Header.jsx"

export default function Layout() {
  return (
    <>
      <Header />
      <main id="main">
        <Outlet />
      </main>
    </>
  )
}
