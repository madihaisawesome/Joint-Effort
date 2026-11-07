import {
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

const KEY_LANDMARKS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

const VISIBILITY_MIN = 0.55;
const CLOSE_SPAN_Y = 0.92;
const EDGE_MARGIN = 0.03;
const ANGLE_SMOOTH = 0.28;
const EVALUATE_EVERY_MS = 120;

const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const guidanceEl = document.getElementById("guidance");
const stopBtn = document.getElementById("stop-camera");
const skipBtn = document.getElementById("skip-step");
const stepCard = document.getElementById("step-card");
const stepLabel = document.getElementById("step-label");
const stepTitle = document.getElementById("step-title");
const stepInstruction = document.getElementById("step-instruction");
const holdProgress = document.getElementById("hold-progress");

const angleEls = {
  leftShoulder: document.getElementById("angle-l-shoulder"),
  rightShoulder: document.getElementById("angle-r-shoulder"),
  leftKnee: document.getElementById("angle-l-knee"),
  rightKnee: document.getElementById("angle-r-knee"),
};

/** @type {PoseLandmarker | null} */
let poseLandmarker = null;
/** @type {DrawingUtils | null} */
let drawingUtils = null;
/** @type {MediaStream | null} */
let stream = null;
let rafId = 0;
let lastVideoTime = -1;
let modelLoaded = false;
let cameraRunning = false;
let poseDetected = false;

/** @type {{ sessionId: string, currentStep: number, completed: string[] } | null} */
let session = null;
/** @type {object | null} */
let nextStep = null;
let routineDone = false;
let evaluateInFlight = false;
let lastEvaluateAt = 0;
let skipping = false;

const smoothed = {
  leftShoulder: null,
  rightShoulder: null,
  leftKnee: null,
  rightKnee: null,
  leftHip: null,
  rightHip: null,
};

function setStatus() {
  const parts = [
    `Model: ${modelLoaded ? "loaded" : "loading"}`,
    `Camera: ${cameraRunning ? "running" : "off"}`,
    `Pose: ${poseDetected ? "detected" : "searching"}`,
  ];
  statusEl.textContent = parts.join(" · ");
  statusEl.className = `status-line ${modelLoaded && cameraRunning ? "ok" : ""}`;
}

function setGuidance(message, ok = false) {
  if (!message) {
    guidanceEl.hidden = true;
    guidanceEl.textContent = "";
    guidanceEl.classList.remove("ok");
    return;
  }
  guidanceEl.hidden = false;
  guidanceEl.textContent = message;
  guidanceEl.classList.toggle("ok", Boolean(ok));
}

function clearAngles() {
  for (const el of Object.values(angleEls)) el.textContent = "—";
}

function setAnglesBlankReason(reason) {
  for (const el of Object.values(angleEls)) el.textContent = reason;
}

function resetSmoothing() {
  for (const key of Object.keys(smoothed)) smoothed[key] = null;
}

function smoothAngle(key, value) {
  if (value == null || Number.isNaN(value)) return smoothed[key];
  if (smoothed[key] == null) {
    smoothed[key] = value;
  } else {
    smoothed[key] =
      smoothed[key] * (1 - ANGLE_SMOOTH) + value * ANGLE_SMOOTH;
  }
  return smoothed[key];
}

function smoothPoint(key, point) {
  if (!point) return smoothed[key];
  if (!smoothed[key]) {
    smoothed[key] = { x: point.x, y: point.y };
  } else {
    smoothed[key] = {
      x: smoothed[key].x * (1 - ANGLE_SMOOTH) + point.x * ANGLE_SMOOTH,
      y: smoothed[key].y * (1 - ANGLE_SMOOTH) + point.y * ANGLE_SMOOTH,
    };
  }
  return smoothed[key];
}

function landmarkVisibility(lm) {
  if (!lm) return 0;
  if (typeof lm.visibility === "number") return lm.visibility;
  if (typeof lm.presence === "number") return lm.presence;
  return 1;
}

function angleAt(a, b, c) {
  const bax = a.x - b.x;
  const bay = a.y - b.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const dot = bax * bcx + bay * bcy;
  const magBA = Math.hypot(bax, bay);
  const magBC = Math.hypot(bcx, bcy);
  if (magBA < 1e-6 || magBC < 1e-6) return null;
  const cos = Math.min(1, Math.max(-1, dot / (magBA * magBC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function formatAngle(deg) {
  if (deg == null || Number.isNaN(deg)) return "—";
  return `${deg.toFixed(0)}°`;
}

function assessVisibility(landmarks) {
  const key = KEY_LANDMARKS.map((i) => landmarks[i]).filter(Boolean);
  if (key.length < KEY_LANDMARKS.length) {
    return { ok: false, reason: "step back" };
  }

  const avgVis =
    key.reduce((sum, lm) => sum + landmarkVisibility(lm), 0) / key.length;
  if (avgVis < VISIBILITY_MIN) return { ok: false, reason: "step back" };

  const lowCount = key.filter((lm) => landmarkVisibility(lm) < VISIBILITY_MIN)
    .length;
  if (lowCount >= 3) return { ok: false, reason: "step back" };

  const xs = key.map((lm) => lm.x);
  const ys = key.map((lm) => lm.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = maxY - minY;
  const clipped =
    minX < EDGE_MARGIN ||
    maxX > 1 - EDGE_MARGIN ||
    minY < EDGE_MARGIN ||
    maxY > 1 - EDGE_MARGIN;

  if (spanY > CLOSE_SPAN_Y || clipped) {
    return { ok: false, reason: "step back" };
  }
  return { ok: true, reason: null };
}

function renderStep() {
  if (routineDone || !nextStep) {
    stepCard.classList.add("complete");
    stepLabel.textContent = "All done";
    stepTitle.textContent = "Routine complete";
    stepInstruction.textContent =
      "Nice work — you’ve finished every step in this session.";
    holdProgress.hidden = true;
    skipBtn.disabled = true;
    setGuidance("Routine complete", true);
    return;
  }

  stepCard.classList.remove("complete");
  const index = (session?.currentStep ?? 0) + 1;
  stepLabel.textContent = `Step ${index} · ${nextStep.exercise}`;
  stepTitle.textContent = nextStep.title;
  stepInstruction.textContent = nextStep.instruction;
  skipBtn.disabled = !session || !cameraRunning;
}

function applySessionPayload(data) {
  session = data.session;
  nextStep = data.nextStep;
  routineDone = Boolean(data.done) || !data.nextStep;
  renderStep();

  const evaluation = data.evaluation;
  if (!evaluation) return;

  if (evaluation.passed) {
    setGuidance(evaluation.feedback || "Step complete", true);
  } else if (evaluation.feedback) {
    const isStepBack = /step back/i.test(evaluation.feedback);
    setGuidance(evaluation.feedback, Boolean(evaluation.inRange) && !isStepBack);
  }

  const progress = evaluation.progress;
  if (progress && typeof progress.reps === "number" && !routineDone) {
    holdProgress.hidden = false;
    let text = `Reps ${progress.reps} / ${progress.targetReps}`;
    if (
      typeof progress.heldSeconds === "number" &&
      typeof progress.holdSeconds === "number" &&
      progress.holdSeconds > 0
    ) {
      text += ` · hold ${progress.heldSeconds.toFixed(1)}s / ${progress.holdSeconds}s`;
    }
    holdProgress.textContent = text;
  } else if (
    progress &&
    typeof progress.heldSeconds === "number" &&
    typeof progress.holdSeconds === "number" &&
    !routineDone
  ) {
    holdProgress.hidden = false;
    holdProgress.textContent = `Hold ${progress.heldSeconds.toFixed(1)}s / ${progress.holdSeconds}s`;
  } else if (!routineDone) {
    holdProgress.hidden = true;
  }
}

async function startSession() {
  const res = await fetch("/api/sessions", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not start session");
  applySessionPayload(data);
}

async function evaluateMetrics(metrics) {
  if (!session || !nextStep || routineDone || evaluateInFlight || skipping) {
    return;
  }
  const now = performance.now();
  if (now - lastEvaluateAt < EVALUATE_EVERY_MS) return;
  lastEvaluateAt = now;
  evaluateInFlight = true;

  try {
    const res = await fetch(`/api/sessions/${session.sessionId}/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stepId: nextStep.id,
        timestamp: Date.now(),
        metrics,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Evaluate failed");
    applySessionPayload(data);
  } catch (err) {
    console.error(err);
  } finally {
    evaluateInFlight = false;
  }
}

async function skipStep() {
  if (!session || !nextStep || routineDone || skipping) return;
  skipping = true;
  skipBtn.disabled = true;
  try {
    const res = await fetch(`/api/sessions/${session.sessionId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: nextStep.id, passed: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Skip failed");
    resetSmoothing();
    applySessionPayload(data);
    if (!routineDone) {
      setGuidance(`Skipped — next: ${nextStep.title}`);
    }
  } catch (err) {
    setGuidance(err.message || "Skip failed");
    skipBtn.disabled = false;
  } finally {
    skipping = false;
    if (!routineDone && cameraRunning) skipBtn.disabled = false;
  }
}

function resizeCanvas() {
  const w = video.videoWidth || video.clientWidth;
  const h = video.videoHeight || video.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function stopCamera() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }

  video.srcObject = null;
  cameraRunning = false;
  poseDetected = false;
  stopBtn.disabled = true;
  skipBtn.disabled = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  clearAngles();
  setGuidance(null);
  setStatus();
}

async function startCamera() {
  if (!poseLandmarker) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    statusEl.textContent = "Camera API not supported in this browser";
    statusEl.className = "status-line warn";
    return;
  }

  stopCamera();

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = stream;
    await video.play();
    cameraRunning = true;
    stopBtn.disabled = false;
    skipBtn.disabled = !session || routineDone;
    setStatus();
    lastVideoTime = -1;
    rafId = requestAnimationFrame(predictFrame);
  } catch (err) {
    cameraRunning = false;
    statusEl.textContent = `Camera blocked or unavailable — ${err.message || err}. Close other apps/tabs using the camera, then refresh.`;
    statusEl.className = "status-line warn";
  }
}

function predictFrame() {
  if (!cameraRunning || !poseLandmarker) return;

  resizeCanvas();

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = poseLandmarker.detectForVideo(video, performance.now());
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const landmarks = result.landmarks?.[0];
    if (!landmarks) {
      poseDetected = false;
      resetSmoothing();
      clearAngles();
      setStatus();
      evaluateMetrics({ usable: false });
    } else {
      poseDetected = true;
      setStatus();

      drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
        color: "#4ade80",
        lineWidth: 3,
      });
      drawingUtils.drawLandmarks(landmarks, {
        color: "#f8fafc",
        fillColor: "#22c55e",
        lineWidth: 1,
        radius: 3,
      });

      const visibility = assessVisibility(landmarks);
      if (!visibility.ok) {
        resetSmoothing();
        setGuidance(
          "Step back so your full body fits in the camera — we need clearer landmarks"
        );
        setAnglesBlankReason("step back");
        holdProgress.hidden = true;
        evaluateMetrics({ usable: false });
      } else {
        const ls = smoothAngle(
          "leftShoulder",
          angleAt(
            landmarks[LM.LEFT_HIP],
            landmarks[LM.LEFT_SHOULDER],
            landmarks[LM.LEFT_ELBOW]
          )
        );
        const rs = smoothAngle(
          "rightShoulder",
          angleAt(
            landmarks[LM.RIGHT_HIP],
            landmarks[LM.RIGHT_SHOULDER],
            landmarks[LM.RIGHT_ELBOW]
          )
        );
        const lk = smoothAngle(
          "leftKnee",
          angleAt(
            landmarks[LM.LEFT_HIP],
            landmarks[LM.LEFT_KNEE],
            landmarks[LM.LEFT_ANKLE]
          )
        );
        const rk = smoothAngle(
          "rightKnee",
          angleAt(
            landmarks[LM.RIGHT_HIP],
            landmarks[LM.RIGHT_KNEE],
            landmarks[LM.RIGHT_ANKLE]
          )
        );
        const leftHip = smoothPoint("leftHip", landmarks[LM.LEFT_HIP]);
        const rightHip = smoothPoint("rightHip", landmarks[LM.RIGHT_HIP]);

        angleEls.leftShoulder.textContent = formatAngle(ls);
        angleEls.rightShoulder.textContent = formatAngle(rs);
        angleEls.leftKnee.textContent = formatAngle(lk);
        angleEls.rightKnee.textContent = formatAngle(rk);

        evaluateMetrics({
          usable: true,
          leftShoulderAngle: ls,
          rightShoulderAngle: rs,
          leftKneeAngle: lk,
          rightKneeAngle: rk,
          leftHip,
          rightHip,
        });
      }
    }

    ctx.restore();
  }

  rafId = requestAnimationFrame(predictFrame);
}

async function init() {
  setStatus();
  drawingUtils = new DrawingUtils(ctx);
  skipBtn.addEventListener("click", skipStep);
  stopBtn.addEventListener("click", stopCamera);

  try {
    await startSession();
  } catch (err) {
    stepLabel.textContent = "Session error";
    stepTitle.textContent = "Could not start";
    stepInstruction.textContent = err.message || String(err);
  }

  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    modelLoaded = true;
    setStatus();
  } catch (err) {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
      );
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "/models/pose_landmarker_lite.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      modelLoaded = true;
      setStatus();
    } catch (cpuErr) {
      statusEl.textContent = `Model failed to load — ${cpuErr.message || cpuErr}`;
      statusEl.className = "status-line warn";
      return;
    }
  }

  await startCamera();
}

init();

window.addEventListener("beforeunload", () => {
  stopCamera();
});
