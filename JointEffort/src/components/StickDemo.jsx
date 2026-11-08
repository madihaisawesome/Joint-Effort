import { useEffect, useState } from "react"

/**
 * Stick-figure demos driven by real pose keyframes (not CSS rotate hacks),
 * so arm raise / sit-to-stand / balance match the coaching exercises.
 */

const POSES = {
  arm_raise: [
    // Arms down at sides
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [78, 128],
      rightHand: [122, 128],
      leftFoot: [82, 210],
      rightFoot: [118, 210],
      chair: false,
    },
    // Arms out to shoulder height (T-pose)
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [38, 78],
      rightHand: [162, 78],
      leftFoot: [82, 210],
      rightFoot: [118, 210],
      chair: false,
    },
    // Hold at shoulder height
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [38, 78],
      rightHand: [162, 78],
      leftFoot: [82, 210],
      rightFoot: [118, 210],
      chair: false,
    },
    // Arms down again
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [78, 128],
      rightHand: [122, 128],
      leftFoot: [82, 210],
      rightFoot: [118, 210],
      chair: false,
    },
  ],
  sit_to_stand: [
    // Seated on chair
    {
      head: [100, 78],
      neck: [100, 96],
      hip: [100, 148],
      leftHand: [72, 150],
      rightHand: [128, 150],
      leftFoot: [78, 210],
      rightFoot: [122, 210],
      leftKnee: [78, 178],
      rightKnee: [122, 178],
      chair: true,
    },
    // Rising
    {
      head: [100, 52],
      neck: [100, 70],
      hip: [100, 138],
      leftHand: [74, 132],
      rightHand: [126, 132],
      leftFoot: [80, 210],
      rightFoot: [120, 210],
      leftKnee: [84, 176],
      rightKnee: [116, 176],
      chair: true,
    },
    // Standing tall
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [78, 128],
      rightHand: [122, 128],
      leftFoot: [82, 210],
      rightFoot: [118, 210],
      leftKnee: [88, 172],
      rightKnee: [112, 172],
      chair: true,
    },
    // Sitting back down
    {
      head: [100, 78],
      neck: [100, 96],
      hip: [100, 148],
      leftHand: [72, 150],
      rightHand: [128, 150],
      leftFoot: [78, 210],
      rightFoot: [122, 210],
      leftKnee: [78, 178],
      rightKnee: [122, 178],
      chair: true,
    },
  ],
  balance_hold: [
    // Quiet standing — slight arm float for balance, then hold
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [70, 118],
      rightHand: [130, 118],
      leftFoot: [84, 210],
      rightFoot: [116, 210],
      chair: false,
    },
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [64, 110],
      rightHand: [136, 110],
      leftFoot: [84, 210],
      rightFoot: [116, 210],
      chair: false,
    },
    {
      head: [100, 40],
      neck: [100, 58],
      hip: [100, 132],
      leftHand: [64, 110],
      rightHand: [136, 110],
      leftFoot: [84, 210],
      rightFoot: [116, 210],
      chair: false,
    },
  ],
}

const HOLD_MS = {
  arm_raise: [700, 900, 500, 700],
  sit_to_stand: [1100, 700, 1100, 900],
  balance_hold: [600, 1600, 1600],
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixPose(from, to, t) {
  const keys = ["head", "neck", "hip", "leftHand", "rightHand", "leftFoot", "rightFoot", "leftKnee", "rightKnee"]
  const out = { chair: to.chair ?? from.chair }
  for (const key of keys) {
    const a = from[key]
    const b = to[key] || from[key]
    if (!a && !b) continue
    if (!a) {
      out[key] = b
      continue
    }
    if (!b) {
      out[key] = a
      continue
    }
    out[key] = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
  }
  return out
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function Limb({ a, b }) {
  if (!a || !b) return null
  return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
}

export default function StickDemo({ exercise, reducedMotion = false }) {
  const kind = ["arm_raise", "sit_to_stand", "balance_hold"].includes(exercise)
    ? exercise
    : "arm_raise"
  const frames = POSES[kind]
  const [pose, setPose] = useState(frames[0])
  const [caption, setCaption] = useState("")

  useEffect(() => {
    setPose(frames[0])
    if (reducedMotion) {
      setCaption(kind === "balance_hold" ? "Hold still" : "Demo pose")
      return undefined
    }

    let cancelled = false
    let frame = 0
    let raf = 0
    let start = performance.now()
    const holds = HOLD_MS[kind]

    // Caption describes the motion into the next pose.
    const captions = {
      arm_raise: ["Raise both arms to shoulder height", "Hold at shoulder height", "Lower both arms", "Rest at your sides"],
      sit_to_stand: ["Stand up from the chair", "Stand tall", "Sit back down", "Sit with feet flat"],
      balance_hold: ["Find a quiet stance", "Hold still — hips level", "Keep holding steady"],
    }

    function tick(now) {
      if (cancelled) return
      const duration = holds[frame] || 900
      const nextIndex = (frame + 1) % frames.length
      const t = Math.min(1, (now - start) / duration)
      const eased = easeInOut(t)
      setPose(mixPose(frames[frame], frames[nextIndex], eased))
      setCaption(captions[kind][frame] || "")
      if (t >= 1) {
        frame = nextIndex
        start = now
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [kind, reducedMotion, frames])

  const shoulder = [
    lerp(pose.neck[0], pose.hip[0], 0.22),
    lerp(pose.neck[1], pose.hip[1], 0.22),
  ]

  return (
    <figure className={`stick-demo is-${kind}${reducedMotion ? " is-still" : ""}`}>
      <svg viewBox="0 0 200 240" role="img" aria-label={`Stick figure demo: ${kind.replace(/_/g, " ")}`}>
        {pose.chair ? (
          <g className="stick-chair">
            <rect x="128" y="148" width="40" height="10" rx="2" />
            <rect x="132" y="158" width="8" height="48" rx="2" />
            <rect x="156" y="158" width="8" height="48" rx="2" />
            <rect x="128" y="148" width="10" height="36" rx="2" />
          </g>
        ) : null}
        <ellipse className="stick-floor" cx="100" cy="218" rx="56" ry="7" />
        <circle className="stick-head" cx={pose.head[0]} cy={pose.head[1]} r="16" />
        <Limb a={pose.neck} b={pose.hip} />
        <Limb a={shoulder} b={pose.leftHand} />
        <Limb a={shoulder} b={pose.rightHand} />
        {pose.leftKnee ? (
          <>
            <Limb a={pose.hip} b={pose.leftKnee} />
            <Limb a={pose.leftKnee} b={pose.leftFoot} />
            <Limb a={pose.hip} b={pose.rightKnee} />
            <Limb a={pose.rightKnee} b={pose.rightFoot} />
          </>
        ) : (
          <>
            <Limb a={pose.hip} b={pose.leftFoot} />
            <Limb a={pose.hip} b={pose.rightFoot} />
          </>
        )}
      </svg>
      {caption ? <p className="stick-caption">{caption}</p> : null}
    </figure>
  )
}
