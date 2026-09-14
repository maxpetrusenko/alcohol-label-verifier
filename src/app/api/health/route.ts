import { NextResponse } from "next/server";
import { braintrustProject, isBraintrustConfigured, isBraintrustTracingEnabled } from "../../../lib/braintrust";
import {
  fallbackVisionEndpoint,
  fallbackVisionModel,
  fallbackVisionProvider,
  hasConfiguredFallbackVisionProvider,
  hasConfiguredVisionProvider,
  visionEndpoint,
  visionFallbackTimeoutMs,
  visionMode,
  visionModel,
  visionProvider,
  visionTimeoutMs,
} from "../../../lib/visionConfig";

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
      timeoutMs: visionTimeoutMs(),
      fallbackTimeoutMs: visionFallbackTimeoutMs(),
      fallback: {
        configured: hasConfiguredFallbackVisionProvider(),
        provider: fallbackVisionProvider(),
        model: fallbackVisionModel(),
        endpoint: fallbackVisionEndpoint(),
      },
    },
    braintrust: {
      configured: isBraintrustConfigured(),
      tracingEnabled: isBraintrustTracingEnabled(),
      project: braintrustProject(),
    },
  });
}
