import { useEffect, useRef, useState } from "react"
import StickDemo from "./StickDemo.jsx"
import { createSession, evaluateSession, skipSessionStep } from "../lib/api.js"

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
const MODEL_URL = "/models/pose_landmarker_lite.task"
const EVALUATE_EVERY_MS = 120
const ANGLE_SMOOTH = 0.28

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
}

const KEY_LANDMARKS = [11, 12, 13, 14, 23, 24, 25, 26, 27, 28]
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
]
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
const BLANK = { leftShoulder: "—", rightShoulder: "—", leftKnee: "—", rightKnee: "—" }
const STEP_BACK = {
  leftShoulder: "Step back",
  rightShoulder: "Step back",
  leftKnee: "Step back",
  rightKnee: "Step back",
}

function landmarkVisibility(point) {
  if (!point) return 0
  if (typeof point.visibility === "number") return point.visibility
  if (typeof point.presence === "number") return point.presence
  return 1
}

function angleAt(a, b, c) {
  if (!a || !b || !c) return null
  const bax = a.x - b.x
  const bay = a.y - b.y
  const bcx = c.x - b.x
  const bcy = c.y - b.y
  const magBA = Math.hypot(bax, bay)
  const magBC = Math.hypot(bcx, bcy)
  if (magBA < 1e-6 || magBC < 1e-6) return null
  const cos = Math.min(1, Math.max(-1, (bax * bcx + bay * bcy) / (magBA * magBC)))
  return (Math.acos(cos) * 180) / Math.PI
}

function formatAngle(deg) {
  if (deg == null || Number.isNaN(deg)) return "—"
  return `${Math.round(deg)}°`
}

function bodyIsVisible(landmarks) {
  const key = KEY_LANDMARKS.map((index) => landmarks[index]).filter(Boolean)
  if (key.length < KEY_LANDMARKS.length) return false
  const average = key.reduce((sum, point) => sum + landmarkVisibility(point), 0) / key.length
  if (average < 0.55) return false
  if (key.filter((point) => landmarkVisibility(point) < 0.55).length >= 3) return false
  const xs = key.map((point) => point.x)
  const ys = key.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const clipped = minX < 0.03 || maxX > 0.97 || minY < 0.03 || maxY > 0.97
  return !(maxY - minY > 0.92 || clipped)
}

function progressLabel(progress) {
  if (!progress) return ""
  if (typeof progress.reps === "number") {
    let text = `Reps ${progress.reps} / ${progress.targetReps}`
    if (typeof progress.heldSeconds === "number" && typeof progress.holdSeconds === "number" && progress.holdSeconds > 0) {
      text += ` · hold ${progress.heldSeconds.toFixed(1)}s / ${progress.holdSeconds}s`
    }
    return text
  }
  if (typeof progress.heldSeconds === "number" && typeof progress.holdSeconds === "number") {
    return `Hold ${progress.heldSeconds.toFixed(1)}s / ${progress.holdSeconds}s`
  }
  return ""
}

function speakCoach(text) {
  if (!text || !("speechSynthesis" in window)) return
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en"
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  } catch {
    // Speech is optional — coaching still works without it.
  }
}

export default function PoseCoach({ curriculumId = "" }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const sessionRef = useRef(null)
  const coachRef = useRef({
    sessionId: null,
    nextStep: null,
    done: false,
    evaluateInFlight: false,
    lastEvaluateAt: 0,
    skipping: false,
    epoch: 0,
    phase: "loading",
    lastStepId: "",
    lastSpokenFeedback: "",
    lastSpokenReps: -1,
    smoothed: {
      leftShoulder: null,
      rightShoulder: null,
      leftKnee: null,
      rightKnee: null,
      leftHip: null,
      rightHip: null,
    },
  })

  const [status, setStatus] = useState("Connecting to the coaching server…")
  const [guidance, setGuidance] = useState("")
  const [aiTip, setAiTip] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [stepLabel, setStepLabel] = useState("Starting…")
  const [stepTitle, setStepTitle] = useState("")
  const [stepInstruction, setStepInstruction] = useState("")
  const [exerciseType, setExerciseType] = useState("arm_raise")
  const [phase, setPhase] = useState("loading")
  const [angles, setAngles] = useState(BLANK)
  const [modelReady, setModelReady] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [canSkip, setCanSkip] = useState(false)
  const [reducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  function enterDemo(step, index) {
    const coach = coachRef.current
    coach.phase = "demo"
    coach.lastStepId = step.id
    coach.lastSpokenFeedback = ""
    coach.lastSpokenReps = -1
    setPhase("demo")
    setExerciseType(step.exercise || "arm_raise")
    setStepLabel(`Step ${index} · demo`)
    setStepTitle(step.title)
    setStepInstruction(step.instruction)
    setProgressText("")
    setGuidance("Watch the stick figure, then press I’m ready when you want to try.")
    setAiTip(false)
    setCanSkip(Boolean(coach.sessionId))
    speakCoach(
      `${step.title}. ${step.instruction} Watch the stick figure demo, then press I’m ready when you want to try.`,
    )
  }

  function applyPayload(data) {
    const coach = coachRef.current
    coach.sessionId = data.session?.sessionId || coach.sessionId
    coach.nextStep = data.nextStep || null
    coach.done = Boolean(data.done) || !data.nextStep

    if (coach.done) {
      coach.phase = "done"
      setPhase("done")
      const summary = data.summary || data.evaluation?.feedback || "Routine complete"
      setStepLabel("All done")
      setStepTitle("Routine complete")
      setStepInstruction("Nice work — you finished every step in this session.")
      setGuidance(summary)
      setAiTip(Boolean(data.evaluation?.aiEnhanced || data.summary))
      setProgressText("")
      setCanSkip(false)
      speakCoach(summary)
      return
    }

    const step = data.nextStep
    const index = (data.session?.currentStep ?? 0) + 1
    const stepChanged = step.id !== coach.lastStepId

    if (stepChanged || coach.phase === "loading") {
      enterDemo(step, index)
      return
    }

    setStepLabel(`Step ${index} · your turn`)
    setStepTitle(step.title)
    setStepInstruction(step.instruction)
    setExerciseType(step.exercise || "arm_raise")
    setCanSkip(Boolean(coach.sessionId))

    const evaluation = data.evaluation
    if (!evaluation) {
      setProgressText("")
      return
    }
    if (evaluation.feedback) {
      setGuidance(evaluation.feedback)
      setAiTip(Boolean(evaluation.aiEnhanced))
    }
    setProgressText(progressLabel(evaluation.progress))
    const reps = evaluation.progress?.reps
    if (
      coach.phase === "practice" &&
      typeof reps === "number" &&
      reps !== coach.lastSpokenReps &&
      evaluation.feedback &&
      !/step back/i.test(evaluation.feedback)
    ) {
      coach.lastSpokenReps = reps
      coach.lastSpokenFeedback = evaluation.feedback
      speakCoach(evaluation.feedback)
    }
  }

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    let cancelled = false
    let landmarker = null
    let stream = null
    let frame = 0
    let running = false
    let lastVideoTime = -1
    let drawPoints = null
    let shownAngles = BLANK
    const smooth = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.62
    // Fresh coach state each mount (React StrictMode remounts in dev).
    const coach = {
      sessionId: null,
      nextStep: null,
      done: false,
      evaluateInFlight: false,
      lastEvaluateAt: 0,
      skipping: false,
      epoch: 0,
      phase: "loading",
      lastStepId: "",
      lastSpokenFeedback: "",
      lastSpokenReps: -1,
      smoothed: {
        leftShoulder: null,
        rightShoulder: null,
        leftKnee: null,
        rightKnee: null,
        leftHip: null,
        rightHip: null,
      },
    }
    coachRef.current = coach

    function publishAngles(next) {
      if (
        shownAngles.leftShoulder === next.leftShoulder &&
        shownAngles.rightShoulder === next.rightShoulder &&
        shownAngles.leftKnee === next.leftKnee &&
        shownAngles.rightKnee === next.rightKnee
      ) {
        return
      }
      shownAngles = next
      setAngles(next)
    }

    function resetSmoothing() {
      for (const key of Object.keys(coach.smoothed)) coach.smoothed[key] = null
    }

    function smoothAngle(key, value) {
      if (value == null || Number.isNaN(value)) return coach.smoothed[key]
      if (coach.smoothed[key] == null) coach.smoothed[key] = value
      else coach.smoothed[key] = coach.smoothed[key] * (1 - ANGLE_SMOOTH) + value * ANGLE_SMOOTH
      return coach.smoothed[key]
    }

    function smoothPoint(key, point) {
      if (!point) return coach.smoothed[key]
      if (!coach.smoothed[key]) coach.smoothed[key] = { x: point.x, y: point.y }
      else {
        coach.smoothed[key] = {
          x: coach.smoothed[key].x * (1 - ANGLE_SMOOTH) + point.x * ANGLE_SMOOTH,
          y: coach.smoothed[key].y * (1 - ANGLE_SMOOTH) + point.y * ANGLE_SMOOTH,
        }
      }
      return coach.smoothed[key]
    }

    async function sendMetrics(metrics) {
      if (coach.phase !== "practice") return
      if (!coach.sessionId || !coach.nextStep || coach.done || coach.evaluateInFlight || coach.skipping) return
      const now = performance.now()
      if (now - coach.lastEvaluateAt < EVALUATE_EVERY_MS) return
      coach.lastEvaluateAt = now
      coach.evaluateInFlight = true
      const stepId = coach.nextStep.id
      const epoch = coach.epoch
      try {
        const data = await evaluateSession(coach.sessionId, {
          stepId,
          timestamp: Date.now(),
          metrics,
        })
        // Ignore stale evaluates that finished after a skip/remount.
        if (!cancelled && coach.sessionId && !coach.skipping && epoch === coach.epoch) {
          applyPayload(data)
        }
      } catch (error) {
        // Timeouts / mismatch after skip / network blips should not stop the camera loop.
        if (
          !cancelled &&
          error?.message &&
          !/timed out|abort|does not match current step/i.test(error.message)
        ) {
          console.error(error)
        }
      } finally {
        coach.evaluateInFlight = false
      }
    }

    function beginPractice() {
      if (!coach.nextStep || coach.done) return
      coach.phase = "practice"
      coach.lastSpokenFeedback = ""
      coach.lastSpokenReps = -1
      setPhase("practice")
      setStepLabel(`Your turn · ${coach.nextStep.exercise}`)
      setGuidance("I’m watching. Match the demo at your own pace.")
      setAiTip(false)
      setProgressText("")
      speakCoach(`Your turn. ${coach.nextStep.title}. I’m watching now.`)
      if (!running && landmarker) startCamera()
    }

    function resizeCanvas() {
      const width = video.videoWidth || video.clientWidth
      const height = video.videoHeight || video.clientHeight
      if (!width || !height) return
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
    }

    function smoothPoints(landmarks) {
      if (!drawPoints || drawPoints.length !== landmarks.length) {
        drawPoints = landmarks.map((point) => ({
          x: point.x,
          y: point.y,
          visibility: landmarkVisibility(point),
        }))
        return drawPoints
      }
      for (let index = 0; index < landmarks.length; index += 1) {
        const next = landmarks[index]
        const point = drawPoints[index]
        if (!next) continue
        const visibility = landmarkVisibility(next)
        if (!point || visibility < 0.2 || point.visibility < 0.2) {
          drawPoints[index] = { x: next.x, y: next.y, visibility }
          continue
        }
        point.x += (next.x - point.x) * smooth
        point.y += (next.y - point.y) * smooth
        point.visibility = visibility
      }
      return drawPoints
    }

    function toPixel(point) {
      return { x: point.x * canvas.width, y: point.y * canvas.height }
    }

    function strokeSegment(start, end) {
      if (!start || !end) return
      const visibility = Math.min(start.visibility ?? landmarkVisibility(start), end.visibility ?? landmarkVisibility(end))
      if (visibility < 0.3) return
      const a = toPixel(start)
      const b = toPixel(end)
      ctx.save()
      ctx.globalAlpha *= 0.28 + 0.72 * Math.min(1, visibility)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.restore()
    }

    function drawSkeleton(points) {
      const boneWidth = Math.max(7, Math.min(canvas.width, canvas.height) * 0.016)
      const jointRadius = boneWidth * 0.62
      const left = points[LM.LEFT_SHOULDER]
      const right = points[LM.RIGHT_SHOULDER]
      const nose = points[0]
      const neck =
        nose && left && right && landmarkVisibility(nose) > 0.35
          ? {
              x: (left.x + right.x) / 2,
              y: (left.y + right.y) / 2,
              visibility: Math.min(landmarkVisibility(left), landmarkVisibility(right), landmarkVisibility(nose)),
            }
          : null
      const torso = [left, right, points[LM.RIGHT_HIP], points[LM.LEFT_HIP]]
      if (torso.every((point) => point && landmarkVisibility(point) > 0.4)) {
        ctx.beginPath()
        torso.forEach((point, index) => {
          const pixel = toPixel(point)
          if (index === 0) ctx.moveTo(pixel.x, pixel.y)
          else ctx.lineTo(pixel.x, pixel.y)
        })
        ctx.closePath()
        ctx.fillStyle = "rgba(52, 211, 153, 0.16)"
        ctx.fill()
      }

      const paintBones = () => {
        for (const [start, end] of BONES) strokeSegment(points[start], points[end])
        if (neck) strokeSegment(neck, points[0])
      }
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.save()
      ctx.shadowColor = "rgba(74, 222, 128, 0.7)"
      ctx.shadowBlur = boneWidth * 1.35
      ctx.strokeStyle = "#34d399"
      ctx.lineWidth = boneWidth
      paintBones()
      ctx.restore()
      ctx.strokeStyle = "rgba(240, 253, 244, 0.92)"
      ctx.lineWidth = Math.max(2, boneWidth * 0.34)
      paintBones()

      for (const index of JOINTS) {
        const point = points[index]
        if (!point || landmarkVisibility(point) < 0.35) continue
        const pixel = toPixel(point)
        ctx.save()
        ctx.globalAlpha = 0.4 + 0.6 * Math.min(1, landmarkVisibility(point))
        ctx.beginPath()
        ctx.fillStyle = "#059669"
        ctx.arc(pixel.x, pixel.y, jointRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = Math.max(1.5, jointRadius * 0.22)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"
        ctx.stroke()
        ctx.beginPath()
        ctx.fillStyle = "#f8fafc"
        ctx.arc(pixel.x, pixel.y, jointRadius * 0.38, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    function predictFrame() {
      if (!running || !landmarker) return
      resizeCanvas()
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime
        const result = landmarker.detectForVideo(video, performance.now())
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const landmarks = result.landmarks?.[0]
        if (!landmarks) {
          drawPoints = null
          resetSmoothing()
          publishAngles(BLANK)
          setStatus("The camera is on. Looking for a pose.")
          sendMetrics({ usable: false })
        } else {
          drawSkeleton(smoothPoints(landmarks))
          if (!bodyIsVisible(landmarks)) {
            resetSmoothing()
            setGuidance("Step back so your whole body is in the frame.")
            setAiTip(false)
            publishAngles(STEP_BACK)
            setStatus("The camera is on. Step back so your whole body is in the frame.")
            setProgressText("")
            sendMetrics({ usable: false })
          } else {
            const leftShoulder = smoothAngle(
              "leftShoulder",
              angleAt(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_SHOULDER], landmarks[LM.LEFT_ELBOW]),
            )
            const rightShoulder = smoothAngle(
              "rightShoulder",
              angleAt(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_SHOULDER], landmarks[LM.RIGHT_ELBOW]),
            )
            const leftKnee = smoothAngle(
              "leftKnee",
              angleAt(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE]),
            )
            const rightKnee = smoothAngle(
              "rightKnee",
              angleAt(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE]),
            )
            const leftHip = smoothPoint("leftHip", landmarks[LM.LEFT_HIP])
            const rightHip = smoothPoint("rightHip", landmarks[LM.RIGHT_HIP])
            publishAngles({
              leftShoulder: formatAngle(leftShoulder),
              rightShoulder: formatAngle(rightShoulder),
              leftKnee: formatAngle(leftKnee),
              rightKnee: formatAngle(rightKnee),
            })
            setStatus("The camera is on. A pose is in view.")
            sendMetrics({
              usable: true,
              leftShoulderAngle: leftShoulder,
              rightShoulderAngle: rightShoulder,
              leftKneeAngle: leftKnee,
              rightKneeAngle: rightKnee,
              leftHip,
              rightHip,
            })
          }
        }
      }
      frame = requestAnimationFrame(predictFrame)
    }

    function stopCamera(message = "The camera is off. Video was not saved.") {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      running = false
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      video.srcObject = null
      drawPoints = null
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (cancelled) return
      publishAngles(BLANK)
      setCameraOn(false)
      setCanSkip(false)
      setStatus(message)
    }

    async function startCamera() {
      if (!landmarker || running) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("This browser cannot open the camera.")
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          stream = null
          return
        }
        video.srcObject = stream
        await video.play()
        running = true
        lastVideoTime = -1
        setCameraOn(true)
        setCanSkip(Boolean(coach.sessionId) && !coach.done)
        setStatus("The camera is on. Looking for a pose.")
        frame = requestAnimationFrame(predictFrame)
      } catch (error) {
        stopCamera(`The camera is blocked. ${error.message || "Allow the camera and try again."}`)
      }
    }

    async function skipStep() {
      if (!coach.sessionId || !coach.nextStep || coach.done || coach.skipping) return
      const stepId = coach.nextStep.id
      const skippedTitle = coach.nextStep.title
      coach.skipping = true
      coach.epoch += 1
      const epoch = coach.epoch
      setCanSkip(false)
      setProgressText("")
      setGuidance(`Skipping ${skippedTitle}…`)
      setAiTip(false)
      try {
        window.speechSynthesis?.cancel()
        const data = await skipSessionStep(coach.sessionId, stepId)
        resetSmoothing()
        if (!cancelled && epoch === coach.epoch) {
          applyPayload(data)
        }
      } catch (error) {
        if (!cancelled) setGuidance(error.message || "Skip failed")
      } finally {
        coach.skipping = false
        if (!cancelled && !coach.done) setCanSkip(Boolean(coach.sessionId))
      }
    }

    sessionRef.current = { startCamera, stopCamera, skipStep, beginPractice }

    async function createLandmarker(PoseLandmarker, FilesetResolver, delegate) {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL)
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      })
    }

    async function init() {
      // Let React StrictMode finish its first mount/cleanup before touching the camera.
      await new Promise((resolve) => setTimeout(resolve, 75))
      if (cancelled) return

      try {
        const payload = await createSession(curriculumId)
        if (cancelled) return
        applyPayload(payload)
        setStatus("Session ready. Loading the pose model…")
      } catch (error) {
        if (!cancelled) {
          setStatus(`Could not reach the coaching server. ${error.message || "Start the backend on port 3000."}`)
          setGuidance("Open a terminal in backend/ and run npm start, then refresh this page.")
        }
        return
      }

      try {
        const vision = await import(/* @vite-ignore */ VISION_URL)
        if (cancelled) return
        try {
          landmarker = await createLandmarker(vision.PoseLandmarker, vision.FilesetResolver, "GPU")
        } catch {
          landmarker = await createLandmarker(vision.PoseLandmarker, vision.FilesetResolver, "CPU")
        }
        if (cancelled) {
          landmarker?.close?.()
          landmarker = null
          return
        }
        setModelReady(true)
        setStatus("Demo ready. Watch the stick figure, then press I’m ready.")
      } catch (error) {
        if (!cancelled) {
          const message = error?.message || "Try again."
          if (/NotReadableError|Device in use|Could not start video/i.test(message)) {
            setStatus("Camera is busy in another tab. Close other camera pages, then press Start camera.")
          } else {
            setStatus(`The pose model did not load. ${message}`)
          }
        }
      }
    }

    init()

    return () => {
      cancelled = true
      sessionRef.current = null
      window.speechSynthesis?.cancel()
      stopCamera()
      landmarker?.close?.()
      landmarker = null
    }
  }, [curriculumId])

  return (
    <div className="pose-coach">
      <div className="pose-step-card">
        <p className="pose-step-label">{stepLabel}</p>
        <h2>{stepTitle}</h2>
        <p>{stepInstruction}</p>
        {progressText ? <p className="pose-progress">{progressText}</p> : null}
      </div>
      <p className="pose-status" role="status">
        {status}
      </p>
      {guidance ? (
        <p className={`pose-guidance${aiTip ? " has-ai" : ""}`}>
          {aiTip ? <span className="pose-ai-badge" aria-hidden="true">Gemini tip</span> : null}
          {guidance}
        </p>
      ) : null}

      {phase === "demo" || phase === "loading" ? (
        <div className="pose-demo-panel">
          <StickDemo exercise={exerciseType} reducedMotion={reducedMotion} />
          <div className="pose-demo-copy">
            <h3>Watch the demo</h3>
            <p>
              The stick figure shows the movement. Listen to the instruction, then press I’m ready
              when you want the camera to watch you.
            </p>
            <div className="button-row">
              <button
                className="pill pill-dark"
                type="button"
                disabled={!modelReady || phase !== "demo"}
                onClick={() => sessionRef.current?.beginPractice()}
              >
                I’m ready — watch me
              </button>
              <button className="pill" type="button" disabled={!canSkip} onClick={() => sessionRef.current?.skipStep()}>
                Skip this step
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "practice" ? (
        <div className="pose-practice-hint">
          <StickDemo exercise={exerciseType} reducedMotion={reducedMotion} />
          <p>Keep matching this demo. The camera is watching your form.</p>
        </div>
      ) : null}

      <div
        className={`pose-layout${phase === "demo" || phase === "loading" ? " is-preload" : ""}`}
        data-skip-speech
        aria-hidden={phase === "demo" || phase === "loading" ? true : undefined}
      >
        <div className="pose-stage">
          <video ref={videoRef} playsInline autoPlay muted />
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
        {phase === "practice" || phase === "done" ? (
          <aside className="pose-readout" aria-label="Joint angles">
            <h2>Joint angles</h2>
            <dl>
              <div>
                <dt>Left shoulder</dt>
                <dd>{angles.leftShoulder}</dd>
              </div>
              <div>
                <dt>Right shoulder</dt>
                <dd>{angles.rightShoulder}</dd>
              </div>
              <div>
                <dt>Left knee</dt>
                <dd>{angles.leftKnee}</dd>
              </div>
              <div>
                <dt>Right knee</dt>
                <dd>{angles.rightKnee}</dd>
              </div>
            </dl>
            <p>Angles stay on this device. Only numbers go to the coaching server.</p>
          </aside>
        ) : null}
      </div>

      {phase === "practice" || phase === "done" ? (
        <div className="button-row pose-actions" data-skip-speech>
          <button
            className="pill pill-dark"
            type="button"
            disabled={!modelReady}
            onClick={() => (cameraOn ? sessionRef.current?.stopCamera() : sessionRef.current?.startCamera())}
          >
            {cameraOn ? "Stop camera" : "Start camera"}
          </button>
          {phase === "practice" ? (
            <button className="pill" type="button" disabled={!canSkip} onClick={() => sessionRef.current?.skipStep()}>
              Skip step
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
