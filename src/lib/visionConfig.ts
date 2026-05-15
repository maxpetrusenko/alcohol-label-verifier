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
  return visionProvider() === "gemini" ? process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite" : process.env.OPENAI_VISION_MODEL || "gpt-4.1-nano";
}

export function visionEndpoint() {
  return visionProvider() === "gemini" ? "generateContent" : process.env.OPENAI_VISION_ENDPOINT || "chat_completions";
}
