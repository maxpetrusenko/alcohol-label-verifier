import { z } from "zod";
import { VERIFY_REQUEST_LABEL_LIMIT } from "./labelPayload";

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

const labelInputSchema = z.object({
  labelId: z.string().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  dataUrl: z.string().optional(),
  text: z.string().optional(),
  application: applicationSchema.optional(),
});

const apiOptionsSchema = z.object({
  includeRawExtraction: z.boolean().optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
});

export const extractRequestSchema = z.object({
  labels: z.array(labelInputSchema.omit({ labelId: true })).min(1).max(10),
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
