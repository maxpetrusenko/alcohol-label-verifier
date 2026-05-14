import { NextResponse } from "next/server";

export function GET() {
  const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

  return NextResponse.json({
    ok: true,
    service: "alcohol-label-verifier",
    vision: {
      configured: hasOpenAiKey,
      mode: hasOpenAiKey ? "vision+rules" : "text-only-demo",
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    },
  });
}
