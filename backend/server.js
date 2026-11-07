const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  initDb,
  countPlacesBySource,
  upsertPlaces,
  queryPlaces,
  listCategories,
  listBuddies,
  insertBuddy,
  placesToGeoJson,
} = require("./db");
const { syncCalgaryFacilities } = require("./syncCalgary");
const {
  evaluateStep,
  freshExerciseState,
  parseMetrics,
} = require("./exercises");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const MAX_BUDDY_FIELD = 200;

const curriculum = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "curriculum.json"), "utf8")
);
const programs = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "programs.json"), "utf8")
);

/**
 * @typedef {{
 *   sessionId: string,
 *   currentStep: number,
 *   completed: string[],
 *   exerciseState: object
 * }} Session
 */
/** @type {Map<string, Session>} */
const sessions = new Map();

initDb();
seedProgramPlaces();

app.use(express.json({ limit: "32kb" }));

// Reject anything that looks like media payloads (defense in depth; pose stays on-device).
app.use((req, res, next) => {
  const body = req.body;
  if (body && typeof body === "object") {
    const banned = ["video", "image", "frame", "frames", "blob", "base64", "dataUrl"];
    for (const key of banned) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        return res.status(400).json({
          error: "Video and image data are not accepted. Pose checking stays on your device.",
        });
      }
    }
  }
  next();
});

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.use(express.static(path.join(__dirname, "..", "public")));

function jsonError(res, status, message) {
  return res.status(status).json({ error: message });
}

function getStep(index) {
  if (index < 0 || index >= curriculum.steps.length) return null;
  return curriculum.steps[index];
}

function sessionPayload(session, evaluation = null) {
  const done = session.currentStep >= curriculum.steps.length;
  const nextStep = done ? null : getStep(session.currentStep);
  return {
    session: {
      sessionId: session.sessionId,
      currentStep: session.currentStep,
      completed: session.completed,
    },
    nextStep,
    done,
    evaluation,
  };
}

function resetExerciseState(session) {
  const step = getStep(session.currentStep);
  session.exerciseState = step
    ? freshExerciseState(step.exercise)
    : {};
}

function seedProgramPlaces() {
  const now = new Date().toISOString();
  const places = (programs.programs || [])
    .filter(
      (p) =>
        typeof p.lat === "number" &&
        Number.isFinite(p.lat) &&
        typeof p.lng === "number" &&
        Number.isFinite(p.lng)
    )
    .map((p) => ({
      id: p.id || `program:${p.name}`,
      source: "program",
      name: p.name,
      category: p.type || "program",
      address: p.address || null,
      lat: p.lat,
      lng: p.lng,
      phone: null,
      website: p.link || null,
      extras: {
        hours: p.hours || null,
        placeholder: Boolean(programs.placeholder),
      },
      updated_at: now,
    }));

  if (places.length) upsertPlaces(places);
}

function parseSourceList(value) {
  if (!value || typeof value !== "string") return null;
  const allowed = new Set(["calgary", "program", "buddy"]);
  const list = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => allowed.has(s));
  return list.length ? list : null;
}

function parseOptionalCoord(value, label) {
  if (value == null || value === "") return { ok: true, value: null };
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} must be a number` };
  }
  return { ok: true, value: n };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/curriculum", (_req, res) => {
  res.json(curriculum);
});

app.post("/api/sessions", (_req, res) => {
  const sessionId = crypto.randomUUID();
  const session = {
    sessionId,
    currentStep: 0,
    completed: [],
    exerciseState: {},
  };
  resetExerciseState(session);
  sessions.set(sessionId, session);
  res.status(201).json(sessionPayload(session));
});

app.get("/api/sessions/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return jsonError(res, 404, "Session not found");
  res.json(sessionPayload(session));
});

/**
 * Legacy client-asserted progress. Prefer POST /evaluate with metrics.
 */
app.post("/api/sessions/:id/progress", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return jsonError(res, 404, "Session not found");

  const { stepId, passed } = req.body || {};
  if (typeof stepId !== "string" || !stepId.trim()) {
    return jsonError(res, 400, "stepId must be a non-empty string");
  }
  if (typeof passed !== "boolean") {
    return jsonError(res, 400, "passed must be a boolean");
  }

  if (session.currentStep >= curriculum.steps.length) {
    return res.json(sessionPayload(session));
  }

  const expected = getStep(session.currentStep);
  if (!expected || expected.id !== stepId) {
    return jsonError(
      res,
      400,
      `stepId does not match current step (expected ${expected ? expected.id : "none"})`
    );
  }

  if (passed) {
    if (!session.completed.includes(stepId)) {
      session.completed.push(stepId);
    }
    session.currentStep += 1;
    resetExerciseState(session);
  }

  res.json(sessionPayload(session));
});

/**
 * Evaluate live pose metrics against the current curriculum step.
 * Body: { stepId, metrics: { usable, leftShoulderAngle, rightShoulderAngle,
 *   leftKneeAngle, rightKneeAngle, leftHip: {x,y}, rightHip: {x,y} }, timestamp? }
 * Advances the session when the exercise rules say passed.
 */
app.post("/api/sessions/:id/evaluate", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return jsonError(res, 404, "Session not found");

  if (session.currentStep >= curriculum.steps.length) {
    return res.json(
      sessionPayload(session, {
        passed: true,
        inRange: false,
        feedback: "Routine complete",
        progress: null,
      })
    );
  }

  const { stepId, metrics: rawMetrics, timestamp } = req.body || {};
  if (typeof stepId !== "string" || !stepId.trim()) {
    return jsonError(res, 400, "stepId must be a non-empty string");
  }

  const expected = getStep(session.currentStep);
  if (!expected || expected.id !== stepId) {
    return jsonError(
      res,
      400,
      `stepId does not match current step (expected ${expected ? expected.id : "none"})`
    );
  }

  const parsed = parseMetrics(rawMetrics);
  if (!parsed.ok) return jsonError(res, 400, parsed.error);

  const nowMs =
    typeof timestamp === "number" && Number.isFinite(timestamp)
      ? timestamp
      : Date.now();

  if (!session.exerciseState || typeof session.exerciseState !== "object") {
    resetExerciseState(session);
  }

  const evaluation = evaluateStep(
    expected,
    parsed.metrics,
    session.exerciseState,
    nowMs
  );

  if (evaluation.passed) {
    if (!session.completed.includes(stepId)) {
      session.completed.push(stepId);
    }
    session.currentStep += 1;
    resetExerciseState(session);
  }

  res.json(sessionPayload(session, evaluation));
});

app.get("/api/programs", (_req, res) => {
  // Placeholder Calgary listings — verify before public use (see data/programs.json).
  res.json(programs);
});

app.get("/api/buddies", (_req, res) => {
  res.json({ posts: listBuddies() });
});

app.post("/api/buddies", (req, res) => {
  const { name, area, time, note, lat, lng } = req.body || {};
  const fields = { name, area, time, note };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !value.trim()) {
      return jsonError(res, 400, `${key} must be a non-empty string`);
    }
    if (value.trim().length > MAX_BUDDY_FIELD) {
      return jsonError(res, 400, `${key} must be at most ${MAX_BUDDY_FIELD} characters`);
    }
  }

  const latParsed = parseOptionalCoord(lat, "lat");
  if (!latParsed.ok) return jsonError(res, 400, latParsed.error);
  const lngParsed = parseOptionalCoord(lng, "lng");
  if (!lngParsed.ok) return jsonError(res, 400, lngParsed.error);

  if (
    (latParsed.value == null) !== (lngParsed.value == null)
  ) {
    return jsonError(res, 400, "lat and lng must both be provided together");
  }

  if (latParsed.value != null) {
    if (latParsed.value < 50.7 || latParsed.value > 51.3) {
      return jsonError(res, 400, "lat looks outside the Calgary area");
    }
    if (lngParsed.value < -114.4 || lngParsed.value > -113.7) {
      return jsonError(res, 400, "lng looks outside the Calgary area");
    }
  }

  const post = {
    id: crypto.randomUUID(),
    name: name.trim(),
    area: area.trim(),
    time: time.trim(),
    note: note.trim(),
    lat: latParsed.value,
    lng: lngParsed.value,
    createdAt: new Date().toISOString(),
  };

  insertBuddy(post);
  res.status(201).json(post);
});

app.get("/api/map/places", (req, res) => {
  const sources = parseSourceList(req.query.source);
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const category =
    typeof req.query.category === "string" ? req.query.category : "";
  const amenity =
    typeof req.query.amenity === "string" ? req.query.amenity : "";

  const places = queryPlaces({ sources, q, category, amenity });
  res.json(placesToGeoJson(places));
});

app.get("/api/map/categories", (req, res) => {
  const sources = parseSourceList(req.query.source);
  res.json({ categories: listCategories(sources) });
});

app.post("/api/map/sync", async (_req, res) => {
  try {
    const result = await syncCalgaryFacilities();
    seedProgramPlaces();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(502).json({
      error: err.message || "Failed to sync Open Calgary data",
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function bootstrap() {
  try {
    if (countPlacesBySource("calgary") === 0) {
      console.log("No Calgary facilities cached — syncing from Open Calgary…");
      const result = await syncCalgaryFacilities();
      console.log(`Synced ${result.upserted} Calgary facilities`);
    } else {
      console.log(
        `Using cached Calgary facilities (${countPlacesBySource("calgary")} places)`
      );
    }
  } catch (err) {
    console.error("Initial Open Calgary sync failed:", err.message || err);
  }

  app.listen(PORT, () => {
    console.log(`Joint Effort listening on http://localhost:${PORT}`);
    console.log(`Map: http://localhost:${PORT}/map.html`);
  });
}

bootstrap();
