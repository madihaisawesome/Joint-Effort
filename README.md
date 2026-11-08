# Joint Effort

Accessible, privacy-first movement coach: **on-device pose** + **Gemini tips & voice** + campus **community / activity** tools.

Pose video never leaves the browser. The server only sees numeric joint metrics, session progress, and text.

## Quick start (demo)

You need **two terminals**.

### 1. Backend (API + Gemini TTS)

```bash
cd backend
npm install
copy .env.example .env
# put GEMINI_API_KEY=... in .env
npm start
```

Backend: http://localhost:3000  
Health: http://localhost:3000/api/health — expect `"gemini": { "configured": true }` and TTS configured.

### 2. Frontend (React site)

```bash
cd JointEffort
npm install
npm run dev
```

App: http://localhost:5173

## Judge demo path (2–3 minutes)

1. Open **Exercises**
2. Choose **Judge Demo** (first card — 2 reps each step)
3. Start the camera session → watch stick demo → **I’m ready**
4. Listen for form cues and **“Good. X more.”**
5. Finish the step → next exercise instructions should speak automatically
6. Optional: **Events** map / **Activity** board for the community angle

## AI usage (MLH disclosure)

**Full disclosure:** [AI_USAGE.md](./AI_USAGE.md)

**In the product:** Google Gemini for short coaching tips, natural TTS voice, and optional session summary. Camera video stays in the browser (MediaPipe). The API only receives numbers and text.

**While building:** Cursor (AI coding assistant) helped write/edit code and docs. The product design, pose rules, curriculum, a11y, and community features are original team work — not a reskin of ChatGPT or another AI app.

| Feature | What is sent | What you hear / see |
|---------|----------------|---------------------|
| Coaching tips | Angles, phase, reps (no video) | Short on-screen tips |
| Voice | Text only | Natural Gemini TTS (Aoede) for demos + live cues |
| Session summary | Completed steps + notes | End-of-routine summary |

Without `GEMINI_API_KEY`, rule-based feedback and browser speech still work.

## Project layout

```
JointEffort/     React + Vite UI (coach, exercises, map, activity, a11y)
backend/         Express API, curriculum, pose rules, Gemini coach + TTS
public/          Legacy static pages / pose assets (optional)
```

## Privacy

- Camera frames stay in the browser (MediaPipe).
- API payloads are metrics + text only.
- No workout video is uploaded or stored.

## Auth0 (optional)

Account features (calendar / saved place) use Auth0 when `JointEffort/.env` is filled from `.env.example`. The camera coach works without Auth0.

## Safety

Stop if something hurts. This is not medical advice.
