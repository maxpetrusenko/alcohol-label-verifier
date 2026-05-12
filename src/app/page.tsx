"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BottleWine,
  CheckCircle2,
  ClipboardList,
  FileImage,
  Loader2,
  ScanLine,
  UploadCloud,
  XCircle,
} from "lucide-react";
import type { ApplicationData, VerificationResult, CheckStatus } from "@/lib/types";

const demoText = `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Bottled by Old Tom Distillery, Frankfort, KY
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

const initialApplication: ApplicationData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerAddress: "Old Tom Distillery, Frankfort, KY",
  countryOfOrigin: "",
  beverageKind: "spirits",
};

type LabelInput = {
  fileName: string;
  mimeType?: string;
  dataUrl?: string;
  text?: string;
};

function statusStyles(status: CheckStatus) {
  switch (status) {
    case "pass":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "needs_review":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "fail":
      return "border-rose-200 bg-rose-50 text-rose-800";
  }
}

function decisionIcon(decision: VerificationResult["decision"]) {
  if (decision === "approved") return <BadgeCheck className="h-5 w-5 text-emerald-600" />;
  if (decision === "needs_review") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  return <XCircle className="h-5 w-5 text-rose-600" />;
}

export default function Home() {
  const [application, setApplication] = useState<ApplicationData>(initialApplication);
  const [labels, setLabels] = useState<LabelInput[]>([{ fileName: "demo-label.txt", text: demoText }]);
  const [ocrText, setOcrText] = useState(demoText);
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completed = useMemo(() => results.length > 0 && !isVerifying, [results, isVerifying]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = await Promise.all(
      [...files].map(
        (file) =>
          new Promise<LabelInput>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ fileName: file.name, mimeType: file.type, dataUrl: String(reader.result), text: ocrText });
            reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
            reader.readAsDataURL(file);
          }),
      ),
    );
    setLabels(next);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    setResults([]);

    const payloadLabels = labels.length ? labels.map((label) => ({ ...label, text: label.text || ocrText })) : [{ fileName: "pasted-text", text: ocrText }];

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application, labels: payloadLabels }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f2ea] text-slate-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
        <header className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 text-white shadow-2xl shadow-slate-300">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-cyan-100">
                <ScanLine className="h-4 w-4" /> TTB-style label review prototype
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
                  LabelCheck Agent for alcohol compliance queues.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-300">
                  Upload one label or a batch, compare it against application data, and get an agent-readable decision with exact mismatch evidence in seconds.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["≤5 sec target", "Batch-first", "Human override"].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                    <CheckCircle2 className="mb-3 h-5 w-5 text-cyan-300" /> {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <div className="mb-4 flex items-center gap-3">
                <BottleWine className="h-6 w-6 text-cyan-300" />
                <div>
                  <p className="font-medium">Core checks</p>
                  <p className="text-sm text-slate-300">Brand, class/type, ABV, net contents, warning statement</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-slate-200">
                {[
                  "Vision extraction when OPENAI_API_KEY is configured",
                  "Text-only demo fallback for blocked networks",
                  "Normalization handles Stone’s Throw vs STONE'S THROW",
                  "Hard fail for missing or non-exact government warning",
                ].map((line) => (
                  <div key={line} className="flex gap-3 rounded-2xl bg-slate-950/40 p-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" /> {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <form onSubmit={verify} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-slate-500" />
              <h2 className="text-xl font-semibold">Application record</h2>
            </div>
            <div className="grid gap-4">
              {([
                ["brandName", "Brand name"],
                ["classType", "Class / type"],
                ["alcoholContent", "Alcohol content"],
                ["netContents", "Net contents"],
                ["bottlerAddress", "Bottler / producer"],
                ["countryOfOrigin", "Country of origin"],
              ] as const).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm font-medium text-slate-700">
                  {label}
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none ring-cyan-300 transition focus:ring-2"
                    value={application[key] ?? ""}
                    onChange={(event) => setApplication((current) => ({ ...current, [key]: event.target.value }))}
                  />
                </label>
              ))}
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Beverage type
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-950 outline-none ring-cyan-300 transition focus:ring-2"
                  value={application.beverageKind}
                  onChange={(event) => setApplication((current) => ({ ...current, beverageKind: event.target.value as ApplicationData["beverageKind"] }))}
                >
                  <option value="spirits">Distilled spirits</option>
                  <option value="wine">Wine</option>
                  <option value="beer">Beer</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </section>

          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <UploadCloud className="h-5 w-5 text-slate-500" />
              <h2 className="text-xl font-semibold">Labels / OCR text</h2>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-cyan-400 hover:bg-cyan-50">
              <FileImage className="mb-3 h-8 w-8 text-slate-500" />
              <span className="font-medium">Drop in labels or click to upload batch</span>
              <span className="text-sm text-slate-500">PNG/JPG/WebP. Text fallback below keeps the demo usable without API keys.</span>
              <input className="hidden" type="file" accept="image/*" multiple onChange={(event) => onFiles(event.target.files)} />
            </label>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <span key={label.fileName} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  {label.fileName}
                </span>
              ))}
            </div>
            <label className="space-y-1 text-sm font-medium text-slate-700">
              OCR / label text fallback
              <textarea
                className="min-h-48 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-950 outline-none ring-cyan-300 transition focus:ring-2"
                value={ocrText}
                onChange={(event) => setOcrText(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={isVerifying}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanLine className="h-5 w-5" />}
              {isVerifying ? "Checking label evidence..." : "Run verification agent"}
            </button>
            {error ? <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
          </section>
        </form>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Review results</h2>
              <p className="text-slate-600">Evidence is separated from the final recommendation so an agent can override with judgment.</p>
            </div>
            {completed ? <span className="rounded-full bg-white px-3 py-1 text-sm text-slate-600">{results.length} reviewed</span> : null}
          </div>

          <div className="grid gap-4">
            {results.map((result) => (
              <article key={result.fileName} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {decisionIcon(result.decision)}
                    <div>
                      <h3 className="font-semibold">{result.fileName}</h3>
                      <p className="text-sm text-slate-500">{result.summary}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    {result.decision.replace("_", " ")} · {result.score}%
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {result.checks.map((check) => (
                    <div key={check.id} className={`rounded-2xl border p-4 ${statusStyles(check.status)}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-semibold">{check.label}</p>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs uppercase">{check.status.replace("_", " ")}</span>
                      </div>
                      <p className="text-sm opacity-90">{check.rationale}</p>
                      <dl className="mt-3 space-y-1 text-xs opacity-80">
                        <div><dt className="font-semibold">Expected</dt><dd>{check.expected || "—"}</dd></div>
                        <div><dt className="font-semibold">Observed</dt><dd>{check.observed || "—"}</dd></div>
                      </dl>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!results.length && !isVerifying ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                Run the demo label or upload a batch to see pass/warn/fail evidence cards.
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
