import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";

export type VisionTraceInput = {
  provider: "gemini" | "openai";
  model: string;
  endpoint: string;
  fileName: string;
  mimeType?: string;
  hasImage: boolean;
  hasFallbackText: boolean;
  fallbackTextLength: number;
};

type TraceEnvelope<T> = {
  value: T;
  summary: Record<string, unknown>;
};

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value !== undefined && value.trim() !== "");
}

export function langSmithApiKey() {
  return firstNonEmpty(
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY,
    process.env.LANGSMITH_API_KEY,
    process.env.LANGCHAIN_API_KEY,
  );
}

export function isLangSmithConfigured() {
  return Boolean(langSmithApiKey());
}

export function isLangSmithTracingEnabled() {
  return (
    isLangSmithConfigured() &&
    truthy(firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING, process.env.LANGSMITH_TRACING, process.env.LANGCHAIN_TRACING_V2))
  );
}

export function langSmithProject() {
  return firstNonEmpty(
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT ||
      undefined,
    process.env.LANGSMITH_PROJECT,
    process.env.LANGCHAIN_PROJECT,
  ) ?? "alcohol-label-verifier";
}

export async function withLangSmithTrace<T>(
  input: VisionTraceInput,
  run: () => Promise<T>,
  summarize: (value: T) => Record<string, unknown>,
): Promise<T> {
  if (!isLangSmithTracingEnabled()) return run();
  const apiKey = langSmithApiKey();
  if (!apiKey) return run();

  const traced = traceable(
    async (traceInput: VisionTraceInput): Promise<TraceEnvelope<T>> => {
      void traceInput;
      const value = await run();
      return {
        value,
        summary: summarize(value),
      };
    },
    {
      name: "label-vision-extraction",
      run_type: "chain",
      project_name: langSmithProject(),
      client: new Client({ apiKey }),
      tracingEnabled: true,
      tags: ["labelcheck", "vision", input.provider],
      metadata: {
        provider: input.provider,
        model: input.model,
        endpoint: input.endpoint,
      },
      processInputs: (traceInput) => traceInput,
      processOutputs: (output) => output.summary,
    },
  );

  const tracedResult = await traced(input);
  return tracedResult.value;
}
