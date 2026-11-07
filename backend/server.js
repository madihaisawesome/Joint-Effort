const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

/** @type {Map<string, { sessionId: string, currentStep: number, completed: string[] }>} */
const sessions = new Map();
/** @type {{ id: string, name: string, area: string, time: string, note: string, createdAt: string }[]} */
const buddies = [];

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

function sessionPayload(session) {
  const done = session.currentStep >= curriculum.steps.length;
  return {
    session,
    nextStep: done ? null : getStep(session.currentStep),
    done,
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/curriculum", (_req, res) => {
  res.json(curriculum);
});

app.post("/api/sessions", (_req, res) => {
  const sessionId = crypto.randomUUID();
  const session = { sessionId, currentStep: 0, completed: [] };
  sessions.set(sessionId, session);
  res.status(201).json(sessionPayload(session));
});

app.get("/api/sessions/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return jsonError(res, 404, "Session not found");
  res.json(sessionPayload(session));
});

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
  }

  res.json(sessionPayload(session));
});

app.get("/api/programs", (_req, res) => {
  // Placeholder Calgary listings — verify before public use (see data/programs.json).
  res.json(programs);
});

app.get("/api/buddies", (_req, res) => {
  res.json({ posts: buddies });
});

app.post("/api/buddies", (req, res) => {
  const { name, area, time, note } = req.body || {};
  const fields = { name, area, time, note };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !value.trim()) {
      return jsonError(res, 400, `${key} must be a non-empty string`);
    }
    if (value.trim().length > MAX_BUDDY_FIELD) {
      return jsonError(res, 400, `${key} must be at most ${MAX_BUDDY_FIELD} characters`);
    }
  }

  const post = {
    id: crypto.randomUUID(),
    name: name.trim(),
    area: area.trim(),
    time: time.trim(),
    note: note.trim(),
    createdAt: new Date().toISOString(),
  };
  buddies.unshift(post);
  res.status(201).json(post);
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Joint Effort listening on http://localhost:${PORT}`);
});
