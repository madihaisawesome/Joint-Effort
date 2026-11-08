import {
  PoseLandmarker,
  FilesetResolver,
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

// Body only. MediaPipe's full POSE_CONNECTIONS also wires the face,
// which reads as a scribble of green lines around the head.
const BONES = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 32],
];

const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const DRAW_SMOOTH = 0.62;

const video = document.getElementById("webcam");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const guidanceEl = document.getElementById("guidance");
const stopBtn = document.getElementById("stop-camera");

const angleEls = {
  leftShoulder: document.getElementById("angle-l-shoulder"),
  rightShoulder: document.getElementById("angle-r-shoulder"),
  leftKnee: document.getElementById("angle-l-knee"),
  rightKnee: document.getElementById("angle-r-knee"),
};

/** @type {PoseLandmarker | null} */
let poseLandmarker = null;
/** @type {MediaStream | null} */
let stream = null;
/** @type {{ x: number, y: number, visibility: number }[] | null} */
let drawPoints = null;
let rafId = 0;
let lastVideoTime = -1;
let modelLoaded = false;
let cameraRunning = false;
let poseDetected = false;

function setStatus() {
  const parts = [
    `Model: ${modelLoaded ? "loaded" : "loading"}`,
    `Camera: ${cameraRunning ? "running" : "off"}`,
    `Pose: ${poseDetected ? "detected" : "searching"}`,
  ];
  statusEl.textContent = parts.join(" · ");
  statusEl.className = `status-line ${modelLoaded && cameraRunning ? "ok" : ""}`;
}

function setGuidance(message) {
  if (!message) {
    guidanceEl.hidden = true;
    guidanceEl.textContent = "";
    return;
  }
  guidanceEl.hidden = false;
  guidanceEl.textContent = message;
}

function clearAngles() {
  for (const el of Object.values(angleEls)) {
    el.textContent = "—";
  }
}

function setAnglesBlankReason(reason) {
  for (const el of Object.values(angleEls)) {
    el.textContent = reason;
  }
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
  if (avgVis < VISIBILITY_MIN) {
    return { ok: false, reason: "step back" };
  }

  const lowCount = key.filter((lm) => landmarkVisibility(lm) < VISIBILITY_MIN)
    .length;
  if (lowCount >= 3) {
    return { ok: false, reason: "step back" };
  }

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

function pointVisibility(lm) {
  return lm?.visibility ?? landmarkVisibility(lm);
}

function smoothForDraw(landmarks) {
  if (!drawPoints || drawPoints.length !== landmarks.length) {
    drawPoints = landmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      visibility: landmarkVisibility(lm),
    }));
    return drawPoints;
  }

  for (let i = 0; i < landmarks.length; i++) {
    const next = landmarks[i];
    const prev = drawPoints[i];
    if (!next) continue;
    const visibility = landmarkVisibility(next);
    if (!prev || visibility < 0.2 || prev.visibility < 0.2) {
      drawPoints[i] = { x: next.x, y: next.y, visibility };
      continue;
    }
    prev.x += (next.x - prev.x) * DRAW_SMOOTH;
    prev.y += (next.y - prev.y) * DRAW_SMOOTH;
    prev.visibility = visibility;
  }
  return drawPoints;
}

function toPixel(point) {
  return {
    x: point.x * canvas.width,
    y: point.y * canvas.height,
  };
}

function strokeSegment(a, b, minVisibility) {
  if (!a || !b) return false;
  const visibility = Math.min(pointVisibility(a), pointVisibility(b));
  if (visibility < minVisibility) return false;
  const start = toPixel(a);
  const end = toPixel(b);
  ctx.save();
  ctx.globalAlpha *= 0.28 + 0.72 * Math.min(1, visibility);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
  return true;
}

function neckPoint(points) {
  const nose = points[0];
  const left = points[LM.LEFT_SHOULDER];
  const right = points[LM.RIGHT_SHOULDER];
  if (!nose || !left || !right || pointVisibility(nose) <= 0.35) return null;
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
    visibility: Math.min(
      pointVisibility(left),
      pointVisibility(right),
      pointVisibility(nose)
    ),
  };
}

function drawSkeleton(points) {
  const shortSide = Math.min(canvas.width, canvas.height);
  const boneWidth = Math.max(7, shortSide * 0.016);
  const jointRadius = boneWidth * 0.62;
  const neck = neckPoint(points);
  const torso = [
    points[LM.LEFT_SHOULDER],
    points[LM.RIGHT_SHOULDER],
    points[LM.RIGHT_HIP],
    points[LM.LEFT_HIP],
  ];

  if (torso.every((point) => point && pointVisibility(point) > 0.4)) {
    ctx.beginPath();
    torso.forEach((point, index) => {
      const pixel = toPixel(point);
      if (index === 0) ctx.moveTo(pixel.x, pixel.y);
      else ctx.lineTo(pixel.x, pixel.y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(52, 211, 153, 0.16)";
    ctx.fill();
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const paintBones = () => {
    for (const [start, end] of BONES) {
      strokeSegment(points[start], points[end], 0.3);
    }
    if (neck) strokeSegment(neck, points[0], 0.3);
  };

  ctx.save();
  ctx.shadowColor = "rgba(74, 222, 128, 0.7)";
  ctx.shadowBlur = boneWidth * 1.35;
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = boneWidth;
  paintBones();
  ctx.restore();

  ctx.strokeStyle = "rgba(240, 253, 244, 0.92)";
  ctx.lineWidth = Math.max(2, boneWidth * 0.34);
  paintBones();

  for (const index of JOINTS) {
    const point = points[index];
    if (!point || pointVisibility(point) < 0.35) continue;
    const pixel = toPixel(point);
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * Math.min(1, pointVisibility(point));
    ctx.beginPath();
    ctx.fillStyle = "#059669";
    ctx.arc(pixel.x, pixel.y, jointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, jointRadius * 0.22);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = "#f8fafc";
    ctx.arc(pixel.x, pixel.y, jointRadius * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    for (const track of stream.getTracks()) {
      track.stop();
    }
    stream = null;
  }

  video.srcObject = null;
  cameraRunning = false;
  poseDetected = false;
  drawPoints = null;
  stopBtn.disabled = true;
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
    setStatus();
    lastVideoTime = -1;
    rafId = requestAnimationFrame(predictFrame);
  } catch (err) {
    cameraRunning = false;
    statusEl.textContent = `Camera blocked or unavailable — ${err.message || err}`;
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
      drawPoints = null;
      clearAngles();
      setGuidance(null);
      setStatus();
    } else {
      poseDetected = true;
      setStatus();
      drawSkeleton(smoothForDraw(landmarks));

      const visibility = assessVisibility(landmarks);
      if (!visibility.ok) {
        setGuidance("step back");
        setAnglesBlankReason("step back");
      } else {
        setGuidance(null);
        const ls = angleAt(
          landmarks[LM.LEFT_HIP],
          landmarks[LM.LEFT_SHOULDER],
          landmarks[LM.LEFT_ELBOW]
        );
        const rs = angleAt(
          landmarks[LM.RIGHT_HIP],
          landmarks[LM.RIGHT_SHOULDER],
          landmarks[LM.RIGHT_ELBOW]
        );
        const lk = angleAt(
          landmarks[LM.LEFT_HIP],
          landmarks[LM.LEFT_KNEE],
          landmarks[LM.LEFT_ANKLE]
        );
        const rk = angleAt(
          landmarks[LM.RIGHT_HIP],
          landmarks[LM.RIGHT_KNEE],
          landmarks[LM.RIGHT_ANKLE]
        );
        angleEls.leftShoulder.textContent = formatAngle(ls);
        angleEls.rightShoulder.textContent = formatAngle(rs);
        angleEls.leftKnee.textContent = formatAngle(lk);
        angleEls.rightKnee.textContent = formatAngle(rk);
      }
    }

    ctx.restore();
  }

  rafId = requestAnimationFrame(predictFrame);
}

async function init() {
  setStatus();

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
    // GPU may fail on some machines — retry CPU
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

  stopBtn.addEventListener("click", stopCamera);
  await startCamera();
}

init();

window.addEventListener("beforeunload", () => {
  stopCamera();
});
