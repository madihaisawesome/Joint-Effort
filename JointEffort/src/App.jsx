import { BrowserRouter, Link, Route, Routes } from "react-router-dom"
import Layout from "./components/Layout.jsx"
import RequireAuth from "./components/RequireAuth.jsx"
import { AuthRoot } from "./context/Auth.jsx"
import { CurriculumProvider } from "./context/Curriculum.jsx"
import { PlaceProvider } from "./context/Place.jsx"
import { PreferencesProvider } from "./context/Preferences.jsx"
import { SpeechProvider } from "./context/Speech.jsx"
import { WorkoutsProvider } from "./context/Workouts.jsx"
import About from "./pages/About.jsx"
import Ai from "./pages/Ai.jsx"
import Calendar from "./pages/Calendar.jsx"
import Events from "./pages/Events.jsx"
import ExerciseDetail from "./pages/ExerciseDetail.jsx"
import Exercises from "./pages/Exercises.jsx"
import Home from "./pages/Home.jsx"
import Login from "./pages/Login.jsx"
import Profile from "./pages/Profile.jsx"

function Missing() {
  return (
    <section className="page-narrow">
      <h1>Page not found</h1>
      <p>That address is not part of JointEffort.</p>
      <Link to="/">Back to the homepage</Link>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthRoot>
          <CurriculumProvider>
            <PlaceProvider>
              <WorkoutsProvider>
                <SpeechProvider>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path="about" element={<About />} />
                      <Route path="events" element={<Events />} />
                      <Route path="exercises" element={<Exercises />} />
                      <Route path="exercises/:id" element={<ExerciseDetail />} />
                      <Route path="login" element={<Login />} />
                      <Route
                        path="profile"
                        element={
                          <RequireAuth reason="profile">
                            <Profile />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="calendar"
                        element={
                          <RequireAuth reason="calendar">
                            <Calendar />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="ai"
                        element={
                          <RequireAuth reason="camera">
                            <Ai />
                          </RequireAuth>
                        }
                      />
                      <Route path="*" element={<Missing />} />
                    </Route>
                  </Routes>
                </SpeechProvider>
              </WorkoutsProvider>
            </PlaceProvider>
          </CurriculumProvider>
        </AuthRoot>
      </PreferencesProvider>
    </BrowserRouter>
  )
}
