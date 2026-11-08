# AI usage disclosure (MLH)

JointEffort uses AI in two ways: **inside the product** and **while building**. Neither is a reskin of an existing chatbot or coaching app. Original work is the product design, pose coaching pipeline, curriculum, accessibility shell, and Calgary community features.

## 1. AI in the shipped product

| Use | Provider / model | What we send | What we do *not* send |
|-----|------------------|--------------|------------------------|
| Short coaching tips | Google Gemini (text) | Numeric joint metrics, step id, phase/reps, rule-based feedback | Camera frames, video, audio, photos |
| Spoken cues & demos | Google Gemini TTS (e.g. Aoede) | Short plain text only | Video or pose landmarks |
| End-of-session summary | Google Gemini (text) | Completed steps + coach notes (text) | Video |

**Without a Gemini API key**, the app still runs: MediaPipe pose, our own form/rep rules, stick demos, and browser speech synthesis.

MediaPipe Pose Landmarker runs **on-device in the browser**. That is computer vision, not a generative “AI coach” API. Video never leaves the device.

## 2. AI while building (development)

We used **Cursor** (AI coding assistant) to help write and edit code, debug, and draft docs faster. Humans chose the product scope, UX, accessibility requirements, curriculum, and architecture. All shipped behavior was reviewed and tested by the team.

We did **not** wrap or reskin ChatGPT, Gemini Chat, Claude, or another consumer AI product as our submission.

## 3. What is original work

- Product concept: privacy-first movement coach + accessible UI + local community/activity board
- Custom exercise curriculum and step machine (`backend/data/curriculum.json`, session API)
- On-device pose evaluation rules (angles, ROM windows, rep counting) in our backend/frontend
- Stick-figure demos, live form cues, and speech priority/caching for coaching UX
- Calgary map/programs integration, Activity Board (interest, map pins, owned invites)
- Accessibility controls (type size, contrast, more-detail, read-aloud)

## 4. What is third-party (not claimed as our invention)

- Google Gemini API (tips + TTS)
- MediaPipe Pose Landmarker
- React, Vite, Express, SQLite, Leaflet / OpenStreetMap
- Auth0 (optional accounts)
- Open Calgary facility data (when synced)
- Cursor as a development tool

## 5. How to verify during judging

1. `GET /api/health` — shows whether Gemini text + TTS are configured.
2. Run **Judge Demo** with the key set — tips/voice use Gemini; camera stays local.
3. Remove or unset `GEMINI_API_KEY` and restart — coach still works with rule-based text + browser voice.
4. Network tab during a session — payloads are JSON metrics/text, not video uploads.

## One-line pitch for judges

> We built an original on-device pose coach and campus activity product; Gemini is only for short tips and natural voice, and we used Cursor to help write code — disclosed here.
