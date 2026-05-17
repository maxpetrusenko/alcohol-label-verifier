import { NextResponse } from "next/server";
import { braintrustProject, isBraintrustConfigured, isBraintrustTracingEnabled } from "../../../lib/braintrust";
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
    braintrust: {
      configured: isBraintrustConfigured(),
      tracingEnabled: isBraintrustTracingEnabled(),
      project: braintrustProject(),
    },
  });
}
