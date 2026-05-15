import { NextResponse } from "next/server";
import { isLangSmithConfigured, isLangSmithTracingEnabled, langSmithProject } from "../../../lib/langsmith";
import { hasConfiguredVisionProvider, visionEndpoint, visionMode, visionModel, visionProvider } from "../../../lib/visionConfig";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "alcohol-label-verifier",
    vision: {
      configured: hasConfiguredVisionProvider(),
      mode: visionMode("rules"),
      provider: visionProvider(),
      model: visionModel(),
      endpoint: visionEndpoint(),
      imageDetail: process.env.OPENAI_IMAGE_DETAIL || "low",
    },
    langsmith: {
      configured: isLangSmithConfigured(),
      tracingEnabled: isLangSmithTracingEnabled(),
      project: langSmithProject(),
    },
  });
}
