/**
 * Gemini text-to-speech — warm AI voices for coach / read-aloud.
 * Tries current TTS models, then falls back so the app still speaks.
 */

const DEFAULT_VOICE = "Aoede"; // breezy, natural
const STYLE =
  "Warm, calm, and encouraging. Speak clearly and gently for older adults. Natural pacing, not robotic.";

const MODELS = [
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
];

const VOICES = new Set([
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Fenrir",
  "Leda",
  "Orus",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Despina",
  "Erinome",
  "Algenib",
  "Rasalgethi",
  "Laomedeia",
  "Achernar",
  "Alnilam",
  "Schedar",
  "Gacrux",
  "Pulcherrima",
  "Achird",
  "Zubenelgenubi",
  "Vindemiatrix",
  "Sadachbia",
  "Sadaltager",
  "Sulafat",
]);

const cache = new Map();
const CACHE_LIMIT = 40;
let workingModel = null;

function isConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && String(process.env.GEMINI_API_KEY).trim());
}

function apiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function normalizeVoice(voice) {
  const name = String(voice || DEFAULT_VOICE).trim();
  if (VOICES.has(name)) return name;
  const match = [...VOICES].find((item) => item.toLowerCase() === name.toLowerCase());
  return match || DEFAULT_VOICE;
}

function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const blockAlign = (channels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);
  return buffer;
}

function parseSampleRate(mimeType) {
  const match = String(mimeType || "").match(/rate=(\d+)/i);
  return match ? Number(match[1]) : 24000;
}

function toPlayableAudio(rawBase64, mimeType) {
  const raw = Buffer.from(rawBase64, "base64");
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("wav") || raw.slice(0, 4).toString("ascii") === "RIFF") {
    return {
      audio: raw.toString("base64"),
      mimeType: "audio/wav",
    };
  }
  const rate = parseSampleRate(mimeType);
  const wav = pcmToWav(raw, rate);
  return {
    audio: wav.toString("base64"),
    mimeType: "audio/wav",
  };
}

function extractInlineAudio(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        data: inline.data,
        mimeType: inline.mimeType || inline.mime_type || "audio/L16;codec=pcm;rate=24000",
      };
    }
  }
  return null;
}

function extractInteractionAudio(payload) {
  if (payload?.output_audio?.data) {
    return {
      data: payload.output_audio.data,
      mimeType: payload.output_audio.mime_type || payload.output_audio.mimeType || "audio/wav",
    };
  }
  const steps = payload?.steps || [];
  for (const step of steps) {
    const content = step.content || [];
    for (const item of content) {
      if (item?.data && (item.type === "audio" || item.mime_type || item.mimeType)) {
        return {
          data: item.data,
          mimeType: item.mime_type || item.mimeType || "audio/wav",
        };
      }
    }
  }
  return null;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.error?.message || data?.message || `TTS HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function synthesizeGenerateContent(model, text, voice) {
  const key = apiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const payload = await postJson(url, {
    contents: [
      {
        parts: [
          {
            text: `Speak this verbatim in a warm, calm, encouraging coach voice for older adults. Do not add extra words:\n\n${text}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });
  const audio = extractInlineAudio(payload);
  if (!audio) throw new Error("No audio in generateContent response");
  return audio;
}

async function synthesizeInteractions(model, text, voice) {
  const key = apiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(key)}`;
  const payload = await postJson(url, {
    model,
    input: [
      {
        type: "user_input",
        content: [
          {
            type: "text",
            text,
            annotations: [{ type: "speech_metadata", style: STYLE }],
          },
        ],
      },
    ],
    response_format: { type: "audio" },
    generation_config: {
      speech_config: [{ voice }],
    },
  });
  const audio = extractInteractionAudio(payload);
  if (!audio) throw new Error("No audio in interactions response");
  return audio;
}

async function synthesizeWithModel(model, text, voice) {
  // Newer TTS models prefer Interactions; older preview models use generateContent.
  if (/3\.8.*tts|flash-lite-tts|flash-tts$/i.test(model) && !/preview/i.test(model)) {
    try {
      return await synthesizeInteractions(model, text, voice);
    } catch (err) {
      console.warn(`TTS interactions ${model} failed:`, err.message || err);
    }
  }
  return synthesizeGenerateContent(model, text, voice);
}

/**
 * @param {{ text: string, voice?: string }} input
 * @returns {Promise<{ audio: string, mimeType: string, voice: string, model: string, cached: boolean } | null>}
 */
async function synthesize({ text, voice } = {}) {
  if (!isConfigured()) return null;
  const cleaned = String(text || "").trim();
  if (!cleaned) return null;
  if (cleaned.length > 1200) {
    throw new Error("Text too long for speech");
  }

  const chosenVoice = normalizeVoice(voice);
  const cacheKey = `${chosenVoice}::${cleaned}`;
  const hit = cache.get(cacheKey);
  if (hit) {
    return { ...hit, cached: true };
  }

  const models = workingModel
    ? [workingModel, ...MODELS.filter((model) => model !== workingModel)]
    : MODELS;

  let lastError = null;
  for (const model of models) {
    try {
      const raw = await synthesizeWithModel(model, cleaned, chosenVoice);
      const playable = toPlayableAudio(raw.data, raw.mimeType);
      workingModel = model;
      const result = {
        ...playable,
        voice: chosenVoice,
        model,
        cached: false,
      };
      cache.set(cacheKey, result);
      if (cache.size > CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
      }
      return result;
    } catch (err) {
      lastError = err;
      console.warn(`Gemini TTS model ${model} failed:`, err.message || err);
    }
  }

  throw lastError || new Error("Gemini TTS unavailable");
}

module.exports = {
  DEFAULT_VOICE,
  VOICES: [...VOICES],
  isConfigured,
  synthesize,
  MODEL_CANDIDATES: MODELS,
};
