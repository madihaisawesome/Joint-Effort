# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite and React Router for the JointEffort site. Express + SQLite backend for curriculum sessions, Calgary map places, programs, and activity invites. MediaPipe Pose Landmarker runs on-device in the browser. Gemini provides short coaching tips and natural TTS voice. Auth0 Universal Login is optional for account features. Leaflet and OpenStreetMap power the community map. Preferences, saved location, and workouts stay in localStorage on this browser.

## Users

People who want gentle, guided movement with larger type, plain-language coaching, and read-aloud — especially older adults and anyone who prefers a calm, accessible coach. They can plan a session, follow camera-guided reps, and find community activity near campus.

## Product Purpose

**JointEffort** is an accessible movement companion: browse routines, get an on-device camera coach with live form cues and Gemini voice, and discover nearby programs or buddy invites. Success means a person can complete a short routine with clear spoken guidance, without video ever leaving their device.

## Positioning

Privacy-first coaching (pose stays in the browser) plus Gemini for tips and speech, wrapped in a readable campus community shell. This is not a medical or rehab product.

## Operating Context

Homepage, exercises, map, and activity board open without an account. Calendar, saving a location, and some camera entry paths can use Auth0 when configured. The map defaults near the University of Calgary so demos work if location permission is blocked.

## Capabilities and Constraints

- Camera coach: stick-figure demo → “I’m ready” → live pose evaluation, spoken form cues (“too high / too low”), and “Good. X more” after each rep.
- Routines live in `backend/data/curriculum.json` (includes a short **Judge Demo** routine).
- Gemini receives only numeric metrics and text — never video frames.
- Community events and Calgary facilities are browsable; activity invites can be posted to the board.
- Safety line: stop if something hurts; this is not medical advice.
- Demo event times are labels, not live venue schedules.

## Brand Commitments

The name is JointEffort. Keep the established green/mint visual language, readable type, and calm coaching tone. Do not invent medical outcomes or testimonials.

## Product Principles

- Video stays on-device; the server only sees numbers and text.
- Larger type and more explanation are first-class, not afterthoughts.
- The map is never the only way to understand an event or place.
- Coaching language stays kind, short, and specific.
- An account is only for personal calendar / saved location when Auth0 is configured.

## Accessibility & Inclusion

Text size at default, 150%, and 200%, using rem so the layout reflows. A sitewide more-detail switch reveals longer plain-language copy. Read-aloud and coach speech use Gemini TTS when configured, with browser speech as fallback. High contrast is a second theme. Baseline includes a skip link, one h1, visible focus, labels on fields, status not by color alone, and targets at least 44px. Motion is reduced when the system asks for that. Page language is English.

## Pitch (one line)

On-device pose coaching with Gemini voice and tips — private, accessible, and tied to community activity around campus.
