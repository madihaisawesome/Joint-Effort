# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React + Vite and React Router, as set in the JointEffort build plan. Auth0 Universal Login for the account. Leaflet and OpenStreetMap for the community map. Preferences, saved location, and workouts stay in localStorage on this browser.

## Users

People who want larger type, plainer explanations, and read-aloud while they plan a workout, open an exercise, and find community events near a location they set. The camera coach itself is owned by a partner and is not part of this site.

## Product Purpose

JointEffort is the shell around a teammate’s camera coach. A person can browse exercises, keep a personal calendar of workouts, and browse community events near the University of Calgary. Success means those tasks work without an account until the calendar, a saved location, or the camera is needed, and the pages stay readable at larger type.

## Positioning

The site plans the workout and finds the nearby event. It does not run pose detection, count reps, score form, or store camera video. The partner’s page replaces the `/ai` placeholder.

## Operating Context

Homepage, the exercise list, and the map open without an account. The calendar, saving a location, and opening the camera use Auth0, then return to the page the person was trying to open. Workout plans and the saved location are tied to the Auth0 user id and do not follow the person to another computer. The map opens centered on the University of Calgary (2500 University Drive NW) so the demo still works if the browser blocks location permission.

## Capabilities and Constraints

- Community events are a fixed demo list. People browse them. They do not create, edit, RSVP, or post events.
- The calendar shows the person’s own workouts and those community events, labeled in text so they can be told apart. Workouts can be added, edited, started, marked done, and deleted. Community events open on the map.
- Until the partner defines the camera coach, the only exercise is a placeholder named Camera session. Pages must not name movements or promise rep counts, form scores, or spoken coaching.
- This is not a medical or rehab product. A short safety line stays: stop if something hurts; this is not medical advice.
- The `/ai` route receives `exercise` and `returnTo`. It is a placeholder. Read-aloud stops on that route.
- Demo event times are labels, not the venues’ live schedules.
- Open decision: the Figma colors are the default theme. A high-contrast switch is added on top unless that switch is dropped later.

## Brand Commitments

The name is JointEffort. The four desktop frames in Figma file TtKNvodcnbAM37G63XDpHX set the look: header, type, color, and spacing. Photographs stay until they are swapped. Care, enquiry, and family wording is replaced with the exercise coach and the community around campus. The Made in Framer badge is not part of the site. Auth0’s own screen stays Auth0’s.

## Evidence on Hand

- Figma frames: homepage logged out `4:359`, homepage logged in `14:1717`, community events `17:2373`, calendar `28:357`.
- Demo venues: UCalgary Active Living, Olympic Oval, Nose Hill Park, Confederation Park (14 Street and 24 Avenue NW), West Confederation Park (2020 Chicoutimi Drive NW).
- Accessibility notes on hand: Nose Hill has some pavement near parking, most trails uneven, washrooms not available. Confederation Park has pathways and seasonal washrooms.
- No testimonials, ratings, family counts, or medical outcomes are available. Do not invent them.

## Product Principles

- The frames decide the look. Behavior the frames cannot show still has to be reachable in words.
- Larger type and more explanation are separate choices.
- The map is never the only way to read an event.
- The camera coach’s claims wait until the partner defines them.
- An account is only for the personal calendar, the saved map location, and starting the camera.

## Accessibility & Inclusion

Text size at default, 150%, and 200%, using rem so the layout reflows. A sitewide more-detail switch reveals longer plain-language copy. Read-aloud uses the browser speech API, starts only when asked, and can pause and stop. High contrast is a second theme. Baseline includes a skip link, one h1, visible focus, labels on fields, status not by color alone, and targets at least 44px. Motion is reduced when the system asks for that. Page language is English.
