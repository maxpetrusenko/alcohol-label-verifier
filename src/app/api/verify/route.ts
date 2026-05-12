import { NextResponse } from "next/server";
import { z } from "zod";
import { extractionFromPlainText, verifyLabel } from "@/lib/rules";
import type { LabelExtraction } from "@/lib/types";

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
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  dataUrl: z.string().optional(),
  text: z.string().optional(),
});

const requestSchema = z.object({
  application: applicationSchema,
  labels: z.array(labelSchema).min(1).max(25),
});

async function extractWithVision(label: z.infer<typeof labelSchema>): Promise<LabelExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !label.dataUrl) {
    return extractionFromPlainText(label.text ?? "");
  }

  const prompt = `You are a careful TTB alcohol-label compliance extraction assistant.
Extract only what is visible on the submitted label image. Return strict JSON with:
labelText, brandName, classType, alcoholContent, netContents, governmentWarning, bottlerAddress, countryOfOrigin, confidence (0-1), notes[].
Do not invent missing text. Preserve exact government warning capitalization and punctuation when legible.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: label.dataUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "label_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              labelText: { type: "string" },
              brandName: { type: "string" },
              classType: { type: "string" },
              alcoholContent: { type: "string" },
              netContents: { type: "string" },
              governmentWarning: { type: "string" },
              bottlerAddress: { type: "string" },
              countryOfOrigin: { type: "string" },
              confidence: { type: "number" },
              notes: { type: "array", items: { type: "string" } },
            },
            required: [
              "labelText",
              "brandName",
              "classType",
              "alcoholContent",
              "netContents",
              "governmentWarning",
              "bottlerAddress",
              "countryOfOrigin",
              "confidence",
              "notes",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      ...extractionFromPlainText(label.text ?? ""),
      notes: [`Vision extraction failed: ${response.status} ${message.slice(0, 160)}`],
    };
  }

  const data = (await response.json()) as { output_text?: string };
  const parsed = JSON.parse(data.output_text ?? "{}") as LabelExtraction;
  const textFallback = label.text ? extractionFromPlainText(label.text) : undefined;

  return {
    labelText: parsed.labelText || textFallback?.labelText || "",
    brandName: parsed.brandName || textFallback?.brandName,
    classType: parsed.classType || textFallback?.classType,
    alcoholContent: parsed.alcoholContent || textFallback?.alcoholContent,
    netContents: parsed.netContents || textFallback?.netContents,
    governmentWarning: parsed.governmentWarning || textFallback?.governmentWarning,
    bottlerAddress: parsed.bottlerAddress || undefined,
    countryOfOrigin: parsed.countryOfOrigin || undefined,
    confidence: parsed.confidence ?? 0.5,
    notes: parsed.notes?.length ? parsed.notes : ["Vision model returned structured fields."],
  };
}

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const payload = requestSchema.parse(await request.json());
    const results = await Promise.all(
      payload.labels.map(async (label) => {
        const extraction = await extractWithVision(label);
        const result = verifyLabel(payload.application, extraction, label.fileName);
        return { ...result, elapsedMs: Date.now() - started };
      }),
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
