import { NextResponse } from "next/server";
import { z } from "zod";
import { buildExtractionGuidance, extractLabel } from "@/lib/extraction";

export const runtime = "nodejs";

const labelSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  dataUrl: z.string().optional(),
  text: z.string().optional(),
});

const requestSchema = z.object({
  labels: z.array(labelSchema).min(1).max(10),
});

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const payload = requestSchema.parse(await request.json());
    const results = await Promise.all(
      payload.labels.map(async (label) => {
        const extraction = await extractLabel(label);
        return {
          fileName: label.fileName,
          extraction,
          guidance: buildExtractionGuidance(extraction),
        };
      }),
    );

    return NextResponse.json({
      results,
      meta: {
        count: results.length,
        elapsedMs: Date.now() - started,
        mode: process.env.OPENAI_API_KEY ? "vision+guidance" : "text-only-demo",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown extraction error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
