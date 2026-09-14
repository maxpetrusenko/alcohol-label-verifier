export function visionProvider() {
  return process.env.VISION_PROVIDER === "openai" ? "openai" : "gemini";
}

export function fallbackVisionProvider() {
  return visionProvider() === "gemini" ? "openai" : "gemini";
}

function hasProviderKey(provider: "gemini" | "openai") {
  return provider === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_MAX || process.env.GEMINI_API_KEY_TURKEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

export function hasConfiguredVisionProvider() {
  return hasProviderKey(visionProvider());
}

export function hasConfiguredFallbackVisionProvider() {
  return hasProviderKey(fallbackVisionProvider());
}

export function visionMode(mode: "guidance" | "rules") {
  if (!hasConfiguredVisionProvider()) return "text-only-demo";
  return mode === "guidance" ? "vision+guidance" : "vision+rules";
}

export function visionModel() {
  return visionProvider() === "gemini" ? process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite" : process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini";
}

export function fallbackVisionModel() {
  return fallbackVisionProvider() === "gemini" ? process.env.GEMINI_VISION_MODEL || "gemini-3.1-flash-lite" : process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini";
}

export function visionEndpoint() {
  return visionProvider() === "gemini" ? "generateContent" : process.env.OPENAI_VISION_ENDPOINT || "responses";
}

export function fallbackVisionEndpoint() {
  return fallbackVisionProvider() === "gemini" ? "generateContent" : process.env.OPENAI_VISION_ENDPOINT || "responses";
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
