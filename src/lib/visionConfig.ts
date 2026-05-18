export function visionProvider() {
  return process.env.VISION_PROVIDER === "openai" ? "openai" : "gemini";
}

export function hasConfiguredVisionProvider() {
  return visionProvider() === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_MAX || process.env.GEMINI_API_KEY_TURKEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

export function visionMode(mode: "guidance" | "rules") {
  if (!hasConfiguredVisionProvider()) return "text-only-demo";
  return mode === "guidance" ? "vision+guidance" : "vision+rules";
}

export function visionModel() {
  return visionProvider() === "gemini" ? process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite" : process.env.OPENAI_VISION_MODEL || "gpt-4.1-nano";
}

export function visionEndpoint() {
  return visionProvider() === "gemini" ? "generateContent" : process.env.OPENAI_VISION_ENDPOINT || "chat_completions";
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function visionTimeoutMs() {
  return parsePositiveInt(process.env.VISION_TIMEOUT_MS, 12000);
}

export function visionFallbackTimeoutMs() {
  return parsePositiveInt(process.env.VISION_FALLBACK_TIMEOUT_MS, 6000);
}
