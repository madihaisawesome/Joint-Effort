# Joint Effort

Minimal on-device pose coach skeleton (Node/Express + static frontend).

Pose video never leaves the browser. The server only stores session progress and walking-buddy posts in memory.

## Setup

```bash
cd backend
npm install
copy .env.example .env
# put GEMINI_API_KEY in .env (optional — app works without it)
npm start
```

Pose coach: http://localhost:3000/  
Map: http://localhost:3000/map.html  
API viewer: http://localhost:3000/viewer.html

On first start the backend syncs Calgary recreation facilities from [Open Calgary](https://data.calgary.ca/resource/hxfu-6d96.json) into a local SQLite cache (`backend/data/joint-effort.sqlite`), then merges curated programs and walking-buddy pins.

## Gemini coaching (MLH / Best Use of Gemini API)

**Pose video never leaves the browser.** Gemini only receives numeric angles, reps/phase, and curriculum text, then returns short coaching tips and an end-of-routine summary.

1. Create a key at [Google AI Studio](https://aistudio.google.com/apikey)
2. Set `GEMINI_API_KEY` in `backend/.env`
3. Restart the server — `/api/health` shows `"gemini": { "configured": true }`

Tips are throttled (~every 4s, or when feedback changes / a step passes). Without a key, rule-based feedback still works.

Demo tip endpoint:

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/coach ^
  -H "Content-Type: application/json" ^
  -d "{\"stepId\":\"step-1-arm-raise\",\"metrics\":{\"usable\":true,\"leftShoulderAngle\":60,\"rightShoulderAngle\":90}}"
```

Auth0 (user accounts) is handled separately by a teammate and is not required for Gemini.

## Pose coach (camera)

The home page loads the MediaPipe lite pose model from `public/models/pose_landmarker_lite.task`, requests camera permission, draws a skeleton overlay, and shows shoulder/knee angles in a debug panel. Low-visibility / too-close poses show **step back** instead of noisy angles. **Stop camera** releases the MediaStream.

If the model file is missing, download it:

https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

Save it as:

```
public/models/pose_landmarker_lite.task
```

## Stage (a) — API smoke tests

With the server running, use the curl commands in the stage (a) handoff notes (or below).

### Health

```bash
curl http://localhost:3000/api/health
```

### Curriculum / programs

```bash
curl http://localhost:3000/api/curriculum
curl http://localhost:3000/api/programs
```

### Session + progress

```bash
curl -X POST http://localhost:3000/api/sessions
# copy sessionId, then:
curl http://localhost:3000/api/sessions/SESSION_ID
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/progress ^
  -H "Content-Type: application/json" ^
  -d "{\"stepId\":\"step-1-arm-raise\",\"passed\":true}"
```

### Session + evaluate (server-side exercise rules)

Send numeric metrics only (no video). The server tracks hold time / reps and advances the step when rules pass.

```bash
curl -X POST http://localhost:3000/api/sessions/SESSION_ID/evaluate ^
  -H "Content-Type: application/json" ^
  -d "{\"stepId\":\"step-1-arm-raise\",\"metrics\":{\"usable\":true,\"leftShoulderAngle\":90,\"rightShoulderAngle\":88}}"
```

Metrics by exercise:

| Exercise | Fields |
|----------|--------|
| arm_raise | `leftShoulderAngle`, `rightShoulderAngle`, `usable` |
| sit_to_stand | `leftKneeAngle`, `rightKneeAngle`, `usable` |
| balance_hold | `leftHip`/`rightHip` `{x,y}`, `usable` |

Set `usable: false` (e.g. on-device “step back”) so the server resets hold timers instead of counting bad frames.

### Buddies

```bash
curl http://localhost:3000/api/buddies
curl -X POST http://localhost:3000/api/buddies ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Alex\",\"area\":\"Beltline\",\"time\":\"Tue 10am\",\"note\":\"Slow pace walk\"}"
```

## Tunable thresholds (backend/data/curriculum.json)

| Step | Fields |
|------|--------|
| arm_raise | `targetAngle` (90), `tolerance` (15), `reps` (5), `minHoldSeconds` (0.4) |
| sit_to_stand | `seatedAngle` (90), `targetAngle` (165 standing), `tolerance` (15), `reps` (5) |
| balance_hold | `holdSeconds` (2 per hold), `reps` (5), `maxHipMovement` (0.04), `tolerance` (15) |
