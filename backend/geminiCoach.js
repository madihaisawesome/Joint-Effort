/**
 * Gemini coaching tips from numeric pose metrics only (never video).
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL = "gemini-3.8-flash";
let genAI = null;

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !String(key).trim()) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(String(key).trim());
  return genAI;
}

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim());
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label || "Gemini"} timeout`)), ms);
    }),
  ]);
}

async function generateText(prompt, timeoutMs = 2500) {
  const client = getClient();
  if (!client) return null;

  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      temperature: 0.4,
      // gemini-3.8-flash uses thinking tokens that count toward this budget
      maxOutputTokens: 1024,
    },
  });

  const result = await withTimeout(
    model.generateContent(prompt),
    timeoutMs,
    "Gemini"
  );
  try {
    const text = result?.response?.text?.()?.trim();
    return text || null;
  } catch (err) {
    console.error("Gemini empty response:", err.message || err);
    return null;
  }
}

function safeMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") return {};
  const out = { usable: metrics.usable !== false };
  for (const key of [
    "leftShoulderAngle",
    "rightShoulderAngle",
    "leftKneeAngle",
    "rightKneeAngle",
  ]) {
    if (typeof metrics[key] === "number" && Number.isFinite(metrics[key])) {
      out[key] = Number(metrics[key].toFixed(1));
    }
  }
  for (const key of ["leftHip", "rightHip"]) {
    const p = metrics[key];
    if (p && typeof p.x === "number" && typeof p.y === "number") {
      out[key] = { x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) };
    }
  }
  return out;
}

/**
 * Short coaching tip. Falls back to evaluation.feedback on failure.
 */
async function coachTip({ step, evaluation, metrics }) {
  const fallback = evaluation?.feedback || "Keep going — you’ve got this.";
  if (!isConfigured()) {
    return { text: fallback, aiEnhanced: false };
  }

  const prompt = `Gentle coach for older adults. 1 short sentence. Kind, specific. No medical advice. No AI talk.
Exercise: ${step?.title || step?.exercise} (${step?.exercise}). Instruction: ${step?.instruction || ""}
Rule feedback: ${evaluation?.feedback || ""}
Progress: ${JSON.stringify(evaluation?.progress || {})}
Metrics: ${JSON.stringify(safeMetrics(metrics))}
Reply with coaching text only.`;

  try {
    // Keep evaluate path snappy — tips are optional enrichment.
    const text = await generateText(prompt, 2500);
    if (!text) return { text: fallback, aiEnhanced: false };
    return { text: text.replace(/^["']|["']$/g, "").trim(), aiEnhanced: true };
  } catch (err) {
    console.error("Gemini coachTip failed:", err.message || err);
    return { text: fallback, aiEnhanced: false };
  }
}

/**
 * End-of-routine summary from completed step titles + last notes.
 */
async function sessionSummary({ completedSteps, notes }) {
  const fallback =
    "Routine complete — nice work staying consistent through each gentle movement.";
  if (!isConfigured()) {
    return { text: fallback, aiEnhanced: false };
  }

  const prompt = `Gentle coach for older adults. 2 short sentences celebrating finishing. No medical advice. No AI talk.
Completed: ${(completedSteps || []).join(", ")}
Notes: ${(notes || []).slice(-3).join(" | ")}
Reply with summary text only.`;

  try {
    const text = await generateText(prompt, 5000);
    if (!text) return { text: fallback, aiEnhanced: false };
    return { text: text.replace(/^["']|["']$/g, "").trim(), aiEnhanced: true };
  } catch (err) {
    console.error("Gemini sessionSummary failed:", err.message || err);
    return { text: fallback, aiEnhanced: false };
  }
}

module.exports = {
  MODEL,
  isConfigured,
  coachTip,
  sessionSummary,
};
