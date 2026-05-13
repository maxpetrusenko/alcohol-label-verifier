import { NextResponse } from "next/server";
import { z } from "zod";
import { extractLabel } from "../../../lib/extraction";
import { extractionFromPlainText, verifyLabel } from "../../../lib/rules";
import type { ApplicationData } from "../../../lib/types";

export const runtime = "nodejs";

const applicationSchema = z.object({
  brandName: z.string().min(1),
  classType: z.string().min(1),
  alcoholContent: z.string().min(1),
  netContents: z.string().min(1),
  bottlerAddress: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  beverageKind: z.enum(["spirits", "wine", "beer", "other"]),
});

const labelSchema = z.object({
  labelId: z.string().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  dataUrl: z.string().optional(),
  text: z.string().optional(),
});

const requestSchema = z.object({
  application: applicationSchema,
  labels: z.array(labelSchema).min(1).max(25),
});

type VerifiedLabelInput = z.infer<typeof labelSchema>;

function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown extraction error";
  return message.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function verifyOneLabel(application: ApplicationData, label: VerifiedLabelInput, index: number, batchStarted: number) {
  const labelId = label.labelId ?? `${index + 1}-${label.fileName}`;

  try {
    const extraction = await extractLabel(label);
    const result = verifyLabel(application, extraction, label.fileName);
    return { ...result, labelId, elapsedMs: Date.now() - batchStarted };
  } catch (error) {
    const fallback = extractionFromPlainText(label.text ?? "");
    const result = verifyLabel(
      application,
      {
        ...fallback,
        confidence: 0,
        notes: [`Extraction failed for this label: ${cleanError(error)}`],
      },
      label.fileName,
    );
    return { ...result, labelId, elapsedMs: Date.now() - batchStarted };
  }
}

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const payload = requestSchema.parse(await request.json());
    const results = await Promise.all(
      payload.labels.map((label, index) => verifyOneLabel(payload.application, label, index, started)),
    );

    return NextResponse.json({
      results,
      meta: {
        count: results.length,
        elapsedMs: Date.now() - started,
        mode: process.env.OPENAI_API_KEY ? "vision+rules" : "text-only-demo",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verification error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
