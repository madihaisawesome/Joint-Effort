# Joint Effort

Minimal on-device pose coach skeleton (Node/Express + static frontend).

Pose video never leaves the browser. The server only stores session progress and walking-buddy posts in memory.

## Setup

```bash
cd backend
npm install
npm start
```

Server: http://localhost:3000

## Pose model (needed for stage b+)

Download the MediaPipe lite pose model:

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
| arm_raise | `targetAngle` (90), `tolerance` (15), `holdSeconds` (2) |
| sit_to_stand | `seatedAngle` (90), `targetAngle` (165 standing), `tolerance` (15), `reps` (3) |
| balance_hold | `holdSeconds` (5), `maxHipMovement` (0.04), `tolerance` (15 for hip level) |
