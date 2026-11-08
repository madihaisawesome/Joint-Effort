/**
 * Server-side exercise evaluation from numeric pose metrics only.
 * Video/landmarks stay on-device; the client sends angles / hip points.
 */

function within(value, target, tolerance) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value - target) <= tolerance
  );
}

function avg(a, b) {
  if (typeof a !== "number" || typeof b !== "number") return null;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (a + b) / 2;
}

function pointDistance(a, b) {
  if (!a || !b) return Infinity;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function hipLevelDegrees(leftHip, rightHip) {
  if (!leftHip || !rightHip) return null;
  const dx = rightHip.x - leftHip.x;
  const dy = rightHip.y - leftHip.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 0;
  // 0° = perfectly level hips
  return (Math.abs(Math.atan2(dy, dx)) * 180) / Math.PI;
}

function freshExerciseState(exercise) {
  switch (exercise) {
    case "arm_raise":
      return { phase: "seek_raise", reps: 0, inRangeSince: null };
    case "sit_to_stand":
      return {
        phase: "seek_seated",
        reps: 0,
        peak: null,
        trough: null,
        hipHigh: null,
        hipLow: null,
      };
    case "balance_hold":
      return { inRangeSince: null, hipOrigin: null, reps: 0 };
    default:
      return {};
  }
}

/**
 * @param {object} step curriculum step
 * @param {object} metrics client metrics
 * @param {object} state mutable per-session exercise state
 * @param {number} nowMs
 */
function sideHint(value, target, tol, sideLabel) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `Show your ${sideLabel} side clearly`;
  }
  if (value < target - tol) return `lift your ${sideLabel} arm a little higher`;
  if (value > target + tol) return `lower your ${sideLabel} arm a little`;
  return null;
}

function bestKnee(left, right) {
  const leftOk = typeof left === "number" && Number.isFinite(left);
  const rightOk = typeof right === "number" && Number.isFinite(right);
  if (leftOk && rightOk) return (left + right) / 2;
  if (leftOk) return left;
  if (rightOk) return right;
  return null;
}

function kneeHint(value, seatedMax, standingMin, goal) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Keep your knees in view";
  }
  if (goal === "stand") {
    if (value < standingMin) return "straighten your knees more to stand tall";
    return null;
  }
  // sit / squat bottom
  if (value > seatedMax) return "bend your knees more to sit or squat down";
  return null;
}

function evaluateStep(step, metrics, state, nowMs) {
  if (!metrics || metrics.usable === false) {
    resetTransientHold(step.exercise, state);
    return {
      passed: false,
      inRange: false,
      feedback:
        "Center yourself so your torso and joints stay in view — a little closer is fine",
      progress: progressSnapshot(step, state),
    };
  }

  switch (step.exercise) {
    case "arm_raise":
      return evaluateArmRaise(step, metrics, state, nowMs);
    case "sit_to_stand":
      return evaluateSitToStand(step, metrics, state);
    case "balance_hold":
      return evaluateBalanceHold(step, metrics, state, nowMs);
    default:
      return {
        passed: false,
        inRange: false,
        feedback: `Unknown exercise type: ${step.exercise}`,
        progress: progressSnapshot(step, state),
      };
  }
}

function resetTransientHold(exercise, state) {
  if (exercise === "arm_raise") {
    state.inRangeSince = null;
    // Keep completed reps; restart current rep toward raise
    if (state.phase === "seek_lower") state.phase = "seek_raise";
  }
  if (exercise === "balance_hold") {
    state.inRangeSince = null;
    state.hipOrigin = null;
  }
}

function armRaiseFeedback(left, right, target, tol) {
  const leftHint = sideHint(left, target, tol, "left");
  const rightHint = sideHint(right, target, tol, "right");
  const leftOk = within(left, target, tol);
  const rightOk = within(right, target, tol);

  if (!leftOk && !rightOk) {
    if (
      typeof left === "number" &&
      typeof right === "number" &&
      left < target - tol &&
      right < target - tol
    ) {
      return "Both arms are low — lift them out to shoulder height";
    }
    if (
      typeof left === "number" &&
      typeof right === "number" &&
      left > target + tol &&
      right > target + tol
    ) {
      return "Both arms are high — lower them to shoulder height";
    }
    const parts = [leftHint, rightHint].filter(Boolean);
    if (parts.length) {
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(". ");
    }
    return "Raise both arms out to the sides to shoulder height";
  }

  if (!leftOk && leftHint) {
    return `Right arm looks good — ${leftHint}`;
  }
  if (!rightOk && rightHint) {
    return `Left arm looks good — ${rightHint}`;
  }
  return "Raise both arms out to the sides to shoulder height";
}

function armsLowered(left, right, target, tol) {
  const lowThreshold = target - tol - 10;
  const leftLow = typeof left === "number" && left < lowThreshold;
  const rightLow = typeof right === "number" && right < lowThreshold;
  return leftLow && rightLow;
}

function evaluateArmRaise(step, metrics, state, nowMs) {
  const target = step.targetAngle;
  const tol = step.tolerance;
  const needReps = step.reps || 1;
  const minHold = step.minHoldSeconds || 0.35;
  const left = metrics.leftShoulderAngle;
  const right = metrics.rightShoulderAngle;

  if (!state.phase) state.phase = "seek_raise";
  if (typeof state.reps !== "number") state.reps = 0;

  const leftOk = within(left, target, tol);
  const rightOk = within(right, target, tol);
  const inRange = leftOk && rightOk;
  const lowered = armsLowered(left, right, target, tol);

  if (state.phase === "seek_raise") {
    if (!inRange) {
      state.inRangeSince = null;
      return {
        passed: false,
        inRange: false,
        feedback: `Rep ${state.reps + 1}/${needReps}: ${armRaiseFeedback(left, right, target, tol)}`,
        progress: {
          reps: state.reps,
          targetReps: needReps,
          phase: state.phase,
          leftShoulderAngle: left ?? null,
          rightShoulderAngle: right ?? null,
        },
      };
    }

    if (state.inRangeSince == null) state.inRangeSince = nowMs;
    const heldSeconds = (nowMs - state.inRangeSince) / 1000;
    if (heldSeconds >= minHold) {
      state.phase = "seek_lower";
      state.inRangeSince = null;
    }

    return {
      passed: false,
      inRange: true,
      feedback:
        heldSeconds >= minHold
          ? `Rep ${state.reps + 1}/${needReps}: now lower your arms`
          : `Rep ${state.reps + 1}/${needReps}: good height — hold briefly`,
      progress: {
        reps: state.reps,
        targetReps: needReps,
        phase: state.phase,
        heldSeconds: Number(Math.min(heldSeconds, minHold).toFixed(2)),
        leftShoulderAngle: left,
        rightShoulderAngle: right,
      },
    };
  }

  // seek_lower
  if (lowered) {
    state.reps += 1;
    state.phase = "seek_raise";
    state.inRangeSince = null;
    const passed = state.reps >= needReps;
    return {
      passed,
      inRange: false,
      feedback: passed
        ? `Arm raise complete — ${needReps} reps done`
        : `Nice — ${state.reps}/${needReps} reps. Raise again`,
      progress: {
        reps: state.reps,
        targetReps: needReps,
        phase: state.phase,
        leftShoulderAngle: left ?? null,
        rightShoulderAngle: right ?? null,
      },
    };
  }

  if (inRange) {
    return {
      passed: false,
      inRange: true,
      feedback: `Rep ${state.reps + 1}/${needReps}: lower both arms to finish the rep`,
      progress: {
        reps: state.reps,
        targetReps: needReps,
        phase: state.phase,
        leftShoulderAngle: left,
        rightShoulderAngle: right,
      },
    };
  }

  return {
    passed: false,
    inRange: false,
    feedback: `Rep ${state.reps + 1}/${needReps}: keep lowering until arms are down`,
    progress: {
      reps: state.reps,
      targetReps: needReps,
      phase: state.phase,
      leftShoulderAngle: left ?? null,
      rightShoulderAngle: right ?? null,
    },
  };
}

function sitThresholds(step) {
  const tol = typeof step.tolerance === "number" ? step.tolerance : 35;
  const standingTarget = typeof step.targetAngle === "number" ? step.targetAngle : 155;
  const seatedTarget = typeof step.seatedAngle === "number" ? step.seatedAngle : 100;
  return {
    // Soft absolute fallbacks — front cameras rarely see a true 90°/165°.
    seatedMax: seatedTarget + tol, // ~135°
    standingMin: Math.max(118, standingTarget - tol), // ~120°
    // Relative movement is what actually counts on a webcam.
    dropDegrees: typeof step.minBendDelta === "number" ? step.minBendDelta : 10,
    riseDegrees: typeof step.minRiseDelta === "number" ? step.minRiseDelta : 10,
    hipDrop: typeof step.minHipDrop === "number" ? step.minHipDrop : 0.035,
    hipRise: typeof step.minHipRise === "number" ? step.minHipRise : 0.035,
  };
}

function sitToStandFeedback(phase, knee, seatedMax, standingMin, reps, needReps) {
  if (phase === "seek_seated" || phase === "seek_sit") {
    const hint = kneeHint(knee, seatedMax, standingMin, "sit");
    if (phase === "seek_seated") {
      return hint
        ? `Start seated or in a squat — ${hint}`
        : "Sit or squat down to begin, then stand up";
    }
    if (hint) return `Rep ${reps + 1}/${needReps}: ${hint}`;
    return `Rep ${reps + 1}/${needReps}: sit or squat back down, then stand again`;
  }

  if (phase === "seek_stand") {
    const hint = kneeHint(knee, seatedMax, standingMin, "stand");
    if (hint) return `Rep ${reps + 1}/${needReps}: ${hint}`;
    return `Rep ${reps + 1}/${needReps}: stand up — that counts the rep`;
  }

  return "Follow the sit-to-stand movement at your own pace";
}

function evaluateSitToStand(step, metrics, state) {
  const {
    seatedMax,
    standingMin,
    dropDegrees,
    riseDegrees,
    hipDrop,
    hipRise,
  } = sitThresholds(step);
  const needReps = step.reps || 1;
  const left = metrics.leftKneeAngle;
  const right = metrics.rightKneeAngle;
  // Prefer the more bent knee so shallow camera angles still register a squat.
  const kneeCandidates = [left, right].filter(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
  const knee =
    kneeCandidates.length === 0
      ? null
      : kneeCandidates.length === 1
        ? kneeCandidates[0]
        : Math.min(left, right);
  const hipY = avg(
    metrics.leftHip && typeof metrics.leftHip.y === "number"
      ? metrics.leftHip.y
      : null,
    metrics.rightHip && typeof metrics.rightHip.y === "number"
      ? metrics.rightHip.y
      : null
  );

  if (typeof knee !== "number") {
    return {
      passed: false,
      inRange: false,
      feedback:
        "We can’t see your knees clearly — step back so your legs are in the frame",
      progress: {
        reps: state.reps || 0,
        targetReps: needReps,
        phase: state.phase,
      },
    };
  }

  if (!state.phase) state.phase = "seek_seated";
  if (typeof state.reps !== "number") state.reps = 0;
  if (typeof state.peak !== "number") state.peak = knee;
  if (typeof state.trough !== "number") state.trough = knee;
  if (typeof hipY === "number") {
    if (typeof state.hipHigh !== "number") state.hipHigh = hipY;
    if (typeof state.hipLow !== "number") state.hipLow = hipY;
    // MediaPipe y grows downward: sit = higher y, stand = lower y.
    state.hipHigh = Math.max(state.hipHigh, hipY);
    state.hipLow = Math.min(state.hipLow, hipY);
  }

  state.peak = Math.max(state.peak, knee);
  state.trough = Math.min(state.trough, knee);

  const kneeDropped = state.peak - knee >= dropDegrees;
  const kneeRisen = knee - state.trough >= riseDegrees;
  const hipSat =
    typeof hipY === "number" &&
    typeof state.hipLow === "number" &&
    hipY - state.hipLow >= hipDrop;
  const hipStood =
    typeof hipY === "number" &&
    typeof state.hipHigh === "number" &&
    state.hipHigh - hipY >= hipRise;

  const seated = knee <= seatedMax || kneeDropped || hipSat;
  const standing = knee >= standingMin || kneeRisen || hipStood;

  // Count on standing up (sit → stand = 1 rep), then require a sit before the next.
  if (state.phase === "seek_seated" && seated) {
    state.phase = "seek_stand";
    state.trough = knee;
    state.peak = knee;
    if (typeof hipY === "number") {
      state.hipHigh = hipY;
      state.hipLow = hipY;
    }
  } else if (state.phase === "seek_stand" && standing) {
    state.reps += 1;
    state.phase = "seek_sit";
    state.trough = knee;
    state.peak = knee;
    if (typeof hipY === "number") {
      state.hipHigh = hipY;
      state.hipLow = hipY;
    }
  } else if (state.phase === "seek_sit" && seated) {
    state.phase = "seek_stand";
    state.trough = knee;
    state.peak = knee;
    if (typeof hipY === "number") {
      state.hipHigh = hipY;
      state.hipLow = hipY;
    }
  }

  const passed = state.reps >= needReps;
  const feedback = passed
    ? `Sit-to-stand complete — ${needReps} reps done`
    : sitToStandFeedback(
        state.phase,
        knee,
        seatedMax,
        standingMin,
        state.reps,
        needReps
      );

  return {
    passed,
    inRange: seated || standing,
    feedback,
    progress: {
      reps: state.reps,
      targetReps: needReps,
      phase: state.phase,
      kneeAngle: Number(knee.toFixed(1)),
      leftKneeAngle: left ?? null,
      rightKneeAngle: right ?? null,
      seatedMax,
      standingMin,
    },
  };
}

function balanceFeedback(leftHip, rightHip, level, levelTol, leftMove, rightMove, maxMove) {
  if (!leftHip || !rightHip) {
    return "Stand facing the camera with both hips visible";
  }

  if (typeof level === "number" && level > levelTol) {
    if (leftHip.y > rightHip.y + 0.01) {
      return "Your left hip is dropping — level your hips";
    }
    if (rightHip.y > leftHip.y + 0.01) {
      return "Your right hip is dropping — level your hips";
    }
    return "Level your hips — keep your pelvis steady";
  }

  if (leftMove > maxMove || rightMove > maxMove) {
    if (leftMove >= rightMove) {
      return "You’re swaying — plant your feet and steady your left side";
    }
    return "You’re swaying — plant your feet and steady your right side";
  }

  return "Stand tall with hips level and stay as still as you can";
}

function evaluateBalanceHold(step, metrics, state, nowMs) {
  const holdSeconds = step.holdSeconds;
  const needReps = step.reps || 1;
  const maxMove = step.maxHipMovement;
  const levelTol = step.tolerance;
  const leftHip = metrics.leftHip;
  const rightHip = metrics.rightHip;

  if (typeof state.reps !== "number") state.reps = 0;

  const level = hipLevelDegrees(leftHip, rightHip);
  const levelOk = typeof level === "number" && level <= levelTol;

  if (!leftHip || !rightHip || !levelOk) {
    state.inRangeSince = null;
    state.hipOrigin = null;
    return {
      passed: false,
      inRange: false,
      feedback: `Hold ${state.reps + 1}/${needReps}: ${balanceFeedback(leftHip, rightHip, level, levelTol, 0, 0, maxMove)}`,
      progress: {
        reps: state.reps,
        targetReps: needReps,
        holdSeconds,
        heldSeconds: 0,
        hipLevelDegrees: level == null ? null : Number(level.toFixed(1)),
      },
    };
  }

  if (!state.hipOrigin) {
    state.hipOrigin = {
      left: { x: leftHip.x, y: leftHip.y },
      right: { x: rightHip.x, y: rightHip.y },
    };
    state.inRangeSince = nowMs;
  }

  const leftMove = pointDistance(leftHip, state.hipOrigin.left);
  const rightMove = pointDistance(rightHip, state.hipOrigin.right);
  const movedTooMuch = leftMove > maxMove || rightMove > maxMove;

  if (movedTooMuch) {
    state.hipOrigin = {
      left: { x: leftHip.x, y: leftHip.y },
      right: { x: rightHip.x, y: rightHip.y },
    };
    state.inRangeSince = nowMs;
    return {
      passed: false,
      inRange: false,
      feedback: `Hold ${state.reps + 1}/${needReps}: ${balanceFeedback(
        leftHip,
        rightHip,
        level,
        levelTol,
        leftMove,
        rightMove,
        maxMove
      )}`,
      progress: {
        reps: state.reps,
        targetReps: needReps,
        holdSeconds,
        heldSeconds: 0,
        hipLevelDegrees: Number(level.toFixed(1)),
        leftHipMovement: Number(leftMove.toFixed(3)),
        rightHipMovement: Number(rightMove.toFixed(3)),
      },
    };
  }

  if (state.inRangeSince == null) state.inRangeSince = nowMs;
  const heldSeconds = (nowMs - state.inRangeSince) / 1000;

  if (heldSeconds >= holdSeconds) {
    state.reps += 1;
    state.inRangeSince = null;
    state.hipOrigin = null;
    const passed = state.reps >= needReps;
    return {
      passed,
      inRange: true,
      feedback: passed
        ? `Balance complete — ${needReps} steady holds done`
        : `Hold ${state.reps}/${needReps} done — settle and hold still again`,
      progress: {
        reps: state.reps,
        targetReps: needReps,
        holdSeconds,
        heldSeconds: holdSeconds,
        hipLevelDegrees: Number(level.toFixed(1)),
        leftHipMovement: Number(leftMove.toFixed(3)),
        rightHipMovement: Number(rightMove.toFixed(3)),
      },
    };
  }

  return {
    passed: false,
    inRange: true,
    feedback: `Hold ${state.reps + 1}/${needReps}: stay still ${heldSeconds.toFixed(1)}s / ${holdSeconds}s`,
    progress: {
      reps: state.reps,
      targetReps: needReps,
      holdSeconds,
      heldSeconds: Number(heldSeconds.toFixed(2)),
      hipLevelDegrees: Number(level.toFixed(1)),
      leftHipMovement: Number(leftMove.toFixed(3)),
      rightHipMovement: Number(rightMove.toFixed(3)),
    },
  };
}

function progressSnapshot(step, state) {
  if (step.reps) {
    return {
      reps: state.reps || 0,
      targetReps: step.reps,
      phase: state.phase || null,
      holdSeconds: step.holdSeconds || null,
      heldSeconds: 0,
    };
  }
  return {
    holdSeconds: step.holdSeconds || 0,
    heldSeconds: 0,
  };
}

function parseMetrics(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "metrics must be an object" };
  }

  const metrics = {
    usable: raw.usable !== false,
  };

  const angleKeys = [
    "leftShoulderAngle",
    "rightShoulderAngle",
    "leftKneeAngle",
    "rightKneeAngle",
  ];
  for (const key of angleKeys) {
    if (raw[key] == null || raw[key] === "") continue;
    const n = Number(raw[key]);
    if (!Number.isFinite(n)) {
      return { ok: false, error: `${key} must be a number` };
    }
    metrics[key] = n;
  }

  for (const key of ["leftHip", "rightHip"]) {
    if (raw[key] == null) continue;
    const p = raw[key];
    if (typeof p !== "object" || Array.isArray(p)) {
      return { ok: false, error: `${key} must be an object with x and y` };
    }
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false, error: `${key}.x and ${key}.y must be numbers` };
    }
    metrics[key] = { x, y };
  }

  if (typeof raw.usable === "boolean") metrics.usable = raw.usable;

  return { ok: true, metrics };
}

module.exports = {
  evaluateStep,
  freshExerciseState,
  parseMetrics,
};
