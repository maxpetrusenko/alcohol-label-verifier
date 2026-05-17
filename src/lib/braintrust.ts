import { initLogger, type Logger } from "braintrust";
import type { VisionTraceInput } from "./trace-types";

let loggerCache: { key: string; logger: Logger<true> } | undefined;

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/iu.test(value ?? "");
}

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.find((value) => value !== undefined && value.trim() !== "");
}

function reportBraintrustError(action: string, error: unknown) {
  console.warn(`Braintrust ${action} failed: ${error instanceof Error ? error.message : "unknown error"}`);
}

function flushInBackground(logger: Logger<true> | undefined, span: ReturnType<Logger<true>["startSpan"]> | undefined) {
  if (!span) return;
  void span
    .flush()
    .then(() => logger?.flush())
    .catch((error) => reportBraintrustError("flush", error));
}

function braintrustApiKey() {
  return firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_API_KEY, process.env.BRAINTRUST_API_KEY);
}

export function braintrustProject() {
  return firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_PROJECT, process.env.BRAINTRUST_PROJECT) ?? "alcohol-label-verifier";
}

function braintrustAppUrl() {
  return firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_APP_URL, process.env.BRAINTRUST_APP_URL);
}

function syncBraintrustRuntimeEnv() {
  const apiKey = braintrustApiKey();
  const project = braintrustProject();
  const appUrl = braintrustAppUrl();
  const tracing = firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING, process.env.BRAINTRUST_TRACING);

  if (apiKey) process.env.BRAINTRUST_API_KEY = apiKey;
  process.env.BRAINTRUST_PROJECT = project;
  if (appUrl) process.env.BRAINTRUST_APP_URL = appUrl;
  if (tracing) process.env.BRAINTRUST_TRACING = tracing;
}

export function isBraintrustConfigured() {
  syncBraintrustRuntimeEnv();
  return Boolean(braintrustApiKey());
}

export function isBraintrustTracingEnabled() {
  syncBraintrustRuntimeEnv();
  return isBraintrustConfigured() && truthy(firstNonEmpty(process.env.ALCOHOL_LABEL_VERIFIER_BRAINTRUST_TRACING, process.env.BRAINTRUST_TRACING, "true"));
}

function braintrustLogger() {
  const apiKey = braintrustApiKey();
  if (!apiKey) return undefined;
  const cacheKey = [apiKey, braintrustProject(), braintrustAppUrl() ?? ""].join(":");
  if (loggerCache?.key === cacheKey) return loggerCache.logger;

  const logger = initLogger({
    projectName: braintrustProject(),
    apiKey,
    ...(braintrustAppUrl() ? { appUrl: braintrustAppUrl() } : {}),
    asyncFlush: true,
    setCurrent: false,
    fetch: globalThis.fetch,
    onFlushError: (error) => reportBraintrustError("flush", error),
    debugLogLevel: false,
  });
  loggerCache = { key: cacheKey, logger };
  return logger;
}

export async function withBraintrustTrace<T>(
  input: VisionTraceInput,
  run: () => Promise<T>,
  summarize: (value: T) => Record<string, unknown>,
): Promise<T> {
  syncBraintrustRuntimeEnv();
  if (!isBraintrustTracingEnabled()) return run();

  let logger;
  let span;
  try {
    logger = braintrustLogger();
    span = logger?.startSpan({
      name: "label-vision-extraction",
      type: "llm",
      event: {
        input,
        metadata: {
          provider: input.provider,
          model: input.model,
          endpoint: input.endpoint,
        },
      },
    });
  } catch (error) {
    reportBraintrustError("span creation", error);
  }

  try {
    const value = await run();
    if (span) {
      span.log({ output: summarize(value) });
      span.end();
      flushInBackground(logger, span);
    }
    return value;
  } catch (error) {
    if (span) {
      span.log({ error: error instanceof Error ? error.message : "unknown model call error" });
      span.end();
      flushInBackground(logger, span);
    }
    throw error;
  }
}

syncBraintrustRuntimeEnv();
