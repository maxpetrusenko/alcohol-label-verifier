import { z } from "zod";
import { VERIFY_REQUEST_LABEL_LIMIT } from "./labelPayload";

export const ACCEPTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"] as const;
export const MAX_LABEL_DATA_URL_LENGTH = 8 * 1024 * 1024;
export const MAX_LABEL_TEXT_LENGTH = 20_000;

const acceptedImageMimeTypes = new Set<string>(ACCEPTED_IMAGE_MIME_TYPES);
const textMimeTypes = new Set(["text/plain"]);

const beverageKindSchema = z.enum(["spirits", "wine", "beer", "other"]);

const applicationSchema = z.object({
  brandName: z.string().min(1),
  classType: z.string().min(1),
  alcoholContent: z.string().optional().default(""),
  netContents: z.string().min(1),
  bottlerAddress: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  beverageKind: beverageKindSchema,
  imported: z.boolean().optional(),
  agedYears: z.number().nonnegative().optional(),
  ruleProfile: z.string().optional(),
});

const labelInputBaseSchema = z.object({
  labelId: z.string().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().max(120).optional(),
  dataUrl: z.string().optional(),
  text: z.string().optional(),
  application: applicationSchema.optional(),
});

function parseImageDataUrl(dataUrl: string): { mimeType: string; base64: string } | undefined {
  const match = dataUrl.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/u);
  if (!match) return undefined;
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function validateLabelInput(label: z.infer<typeof labelInputBaseSchema>, context: z.RefinementCtx) {
  const text = label.text?.trim() ?? "";
  const dataUrl = label.dataUrl?.trim() ?? "";
  const mimeType = label.mimeType?.trim().toLowerCase();

  if (!text && !dataUrl) {
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: "Each label needs either image dataUrl evidence or text evidence.",
    });
  }

  if (label.text && label.text.length > MAX_LABEL_TEXT_LENGTH) {
    context.addIssue({
      code: "custom",
      path: ["text"],
      message: `Text evidence must be ${MAX_LABEL_TEXT_LENGTH} characters or fewer.`,
    });
  }

  if (!dataUrl) {
    if (mimeType && !textMimeTypes.has(mimeType)) {
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "Text-only labels must omit mimeType or use text/plain.",
      });
    }
    return;
  }

  if (dataUrl.length > MAX_LABEL_DATA_URL_LENGTH) {
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: `Image dataUrl must be ${MAX_LABEL_DATA_URL_LENGTH} characters or fewer.`,
    });
  }

  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: "Image dataUrl must be a base64 data URL.",
    });
    return;
  }

  if (!parsed.base64) {
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: "Image dataUrl must include base64 image data.",
    });
  }

  if (!acceptedImageMimeTypes.has(parsed.mimeType)) {
    context.addIssue({
      code: "custom",
      path: ["dataUrl"],
      message: `Unsupported image MIME type "${parsed.mimeType}". Accepted types: ${ACCEPTED_IMAGE_MIME_TYPES.join(", ")}.`,
    });
  }

  if (mimeType && mimeType !== parsed.mimeType) {
    context.addIssue({
      code: "custom",
      path: ["mimeType"],
      message: `mimeType must match dataUrl MIME type "${parsed.mimeType}".`,
    });
  }
}

const labelInputSchema = labelInputBaseSchema.superRefine(validateLabelInput);
const extractLabelInputSchema = labelInputBaseSchema.omit({ labelId: true }).superRefine(validateLabelInput);

const apiOptionsSchema = z.object({
  includeRawExtraction: z.boolean().optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
});

export const extractRequestSchema = z.object({
  labels: z.array(extractLabelInputSchema).min(1).max(10),
  options: apiOptionsSchema.optional(),
});

export const verifyRequestSchema = z.object({
  application: applicationSchema,
  labels: z.array(labelInputSchema).min(1).max(VERIFY_REQUEST_LABEL_LIMIT),
  options: apiOptionsSchema.optional(),
});

export const exportRequestSchema = z.object({
  batch: z.object({
    batchId: z.string().optional(),
    application: applicationSchema.partial().optional(),
    results: z.array(z.unknown()).min(1),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
  format: z.enum(["json", "csv"]).default("json"),
});

export type LabelInputPayload = z.infer<typeof labelInputSchema>;
export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    requestId: string;
    issues?: Array<{ path: Array<string | number>; message: string }>;
  };
};
