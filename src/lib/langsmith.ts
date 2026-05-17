import { Client, RunTree } from "langsmith";

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

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value !== undefined && value.trim() !== "");
}

function reportLangSmithError(action: string, error: unknown) {
  console.warn(`LangSmith ${action} failed: ${error instanceof Error ? error.message : "unknown error"}`);
}

function runInBackground(action: string, task: () => Promise<void>) {
  void task().catch((error) => reportLangSmithError(action, error));
}

function langSmithApiKey() {
  return firstNonEmpty(
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_API_KEY,
    process.env.LANGSMITH_API_KEY,
    process.env.LANGCHAIN_API_KEY,
  );
}

function langSmithApiUrl() {
  return firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_ENDPOINT, process.env.LANGSMITH_ENDPOINT);
}

function syncLangSmithRuntimeEnv() {
  const apiKey = langSmithApiKey();
  const apiUrl = langSmithApiUrl();
  const project = langSmithProject();
  const tracing = firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING, process.env.LANGSMITH_TRACING, process.env.LANGCHAIN_TRACING_V2);

  if (apiKey) {
    process.env.LANGSMITH_API_KEY = apiKey;
    process.env.LANGCHAIN_API_KEY = apiKey;
  }
  if (apiUrl) process.env.LANGSMITH_ENDPOINT = apiUrl;
  process.env.LANGSMITH_PROJECT = project;
  process.env.LANGCHAIN_PROJECT = project;
  if (tracing) {
    process.env.LANGSMITH_TRACING = tracing;
    process.env.LANGCHAIN_TRACING_V2 = tracing;
  }
}

export function isLangSmithConfigured() {
  syncLangSmithRuntimeEnv();
  return Boolean(langSmithApiKey());
}

export function isLangSmithTracingEnabled() {
  syncLangSmithRuntimeEnv();
  return (
    isLangSmithConfigured() &&
    truthy(firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_TRACING, process.env.LANGSMITH_TRACING, process.env.LANGCHAIN_TRACING_V2))
  );
}

export function langSmithProject() {
  return firstNonEmpty(
    process.env.ALCOHOL_LABEL_VERIFIER_LANGSMITH_PROJECT,
    process.env.LANGSMITH_PROJECT,
    process.env.LANGCHAIN_PROJECT,
  ) ?? "alcohol-label-verifier";
}

export async function withLangSmithTrace<T>(
  input: VisionTraceInput,
  run: () => Promise<T>,
  summarize: (value: T) => Record<string, unknown>,
): Promise<T> {
  syncLangSmithRuntimeEnv();
  if (!isLangSmithTracingEnabled()) return run();
  const apiKey = langSmithApiKey();
  if (!apiKey) return run();
  const client = new Client({
    apiKey,
    ...(langSmithApiUrl() ? { apiUrl: langSmithApiUrl() } : {}),
    blockOnRootRunFinalization: false,
    fetchImplementation: globalThis.fetch,
  });
  const runTree = new RunTree({
    name: "label-vision-extraction",
    run_type: "llm",
    project_name: langSmithProject(),
    client,
    tracingEnabled: true,
    tags: ["labelcheck", "vision", input.provider],
    metadata: {
      provider: input.provider,
      model: input.model,
      endpoint: input.endpoint,
    },
    inputs: input,
  });

  try {
    const value = await run();
    runInBackground("run update", () => runTree.postRun().then(() => runTree.end(summarize(value))).then(() => runTree.patchRun()));
    return value;
  } catch (error) {
    runInBackground("run error update", () =>
      runTree
        .postRun()
        .then(() => runTree.end(undefined, error instanceof Error ? error.message : "unknown model call error"))
        .then(() => runTree.patchRun()),
    );
    throw error;
  }
}

syncLangSmithRuntimeEnv();
