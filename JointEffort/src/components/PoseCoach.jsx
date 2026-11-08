import { useEffect, useRef, useState } from "react"

const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm"
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
const MODEL_URL = "/models/pose_landmarker_lite.task"

const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
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

export default function PoseCoach() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const sessionRef = useRef(null)
  const [status, setStatus] = useState("The pose model is loading.")
  const [guidance, setGuidance] = useState("")
  const [angles, setAngles] = useState(BLANK)
  const [modelReady, setModelReady] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)

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
          publishAngles(BLANK)
          setGuidance("")
          setStatus("The camera is on. Looking for a pose.")
        } else {
          drawSkeleton(smoothPoints(landmarks))
          if (!bodyIsVisible(landmarks)) {
            setGuidance("Step back so your whole body is in the frame.")
            publishAngles(STEP_BACK)
            setStatus("The camera is on. Step back so your whole body is in the frame.")
          } else {
            setGuidance("")
            publishAngles({
              leftShoulder: formatAngle(angleAt(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_SHOULDER], landmarks[13])),
              rightShoulder: formatAngle(angleAt(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_SHOULDER], landmarks[14])),
              leftKnee: formatAngle(angleAt(landmarks[LM.LEFT_HIP], landmarks[LM.LEFT_KNEE], landmarks[LM.LEFT_ANKLE])),
              rightKnee: formatAngle(angleAt(landmarks[LM.RIGHT_HIP], landmarks[LM.RIGHT_KNEE], landmarks[LM.RIGHT_ANKLE])),
            })
            setStatus("The camera is on. A pose is in view.")
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
      setGuidance("")
      setCameraOn(false)
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
        setStatus("The camera is on. Looking for a pose.")
        frame = requestAnimationFrame(predictFrame)
      } catch (error) {
        stopCamera(`The camera is blocked. ${error.message || "Allow the camera and try again."}`)
      }
    }

    sessionRef.current = { startCamera, stopCamera }

    async function createLandmarker(PoseLandmarker, FilesetResolver, delegate) {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL)
      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      })
    }

    async function init() {
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
        setStatus("The pose model is ready. The camera is starting.")
        await startCamera()
      } catch (error) {
        if (!cancelled) setStatus(`The pose model did not load. ${error.message || "Try again."}`)
      }
    }

    init()

    return () => {
      cancelled = true
      sessionRef.current = null
      stopCamera()
      landmarker?.close?.()
      landmarker = null
    }
  }, [])

  return (
    <div className="pose-coach" data-skip-speech>
      <p className="pose-status" role="status">{status}</p>
      {guidance ? <p className="pose-guidance">{guidance}</p> : null}
      <div className="pose-layout">
        <div className="pose-stage">
          <video ref={videoRef} playsInline autoPlay muted />
          <canvas ref={canvasRef} aria-hidden="true" />
        </div>
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
          <p>Angles update as you move. Step back replaces a number when the camera cannot see you clearly.</p>
        </aside>
      </div>
      <div className="button-row">
        <button
          className="pill pill-dark"
          type="button"
          disabled={!modelReady}
          onClick={() => (cameraOn ? sessionRef.current?.stopCamera() : sessionRef.current?.startCamera())}
        >
          {cameraOn ? "Stop camera" : "Start camera"}
        </button>
      </div>
    </div>
  )
}
