import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  buildTemplateCsv,
  parseStatementCsv,
  statementFromGrid,
  TEMPLATE_FILENAME,
} from "~/lib/engine/csv";
import { sampleStatementInput } from "~/lib/engine/__fixtures__/sampleStatement";
import { analyzeInput } from "~/lib/engine";
import type {
  AnalysisReport,
  RatioCategory,
  RatioResult,
  RatioStatus,
  RiskScoreResult,
  Section,
  Unit,
} from "~/lib/engine";

export const Route = createFileRoute("/analyze")({
  component: AnalyzePage,
});

/* --------------------------------- config --------------------------------- */

const CATEGORIES: { id: RatioCategory; label: string; blurb: string }[] = [
  {
    id: "profitability",
    label: "Profitability",
    blurb: "How much profit the business earns from its revenue, equity and assets.",
  },
  {
    id: "liquidity",
    label: "Liquidity",
    blurb: "Whether it can meet the obligations falling due in the next twelve months.",
  },
  {
    id: "solvency",
    label: "Solvency",
    blurb: "How much debt it carries, and how comfortably it services it.",
  },
  {
    id: "efficiency",
    label: "Efficiency",
    blurb: "How hard the working capital and assets work through the year.",
  },
  {
    id: "growth",
    label: "Growth",
    blurb: "Year-over-year change in revenue, profit and earnings per share.",
  },
  {
    id: "perShare",
    label: "Per share",
    blurb: "Figures per equity share — needs shares outstanding, and a price for P/E.",
  },
];

const UNITS: { id: Unit; label: string }[] = [
  { id: "crore", label: "₹ crore" },
  { id: "lakh", label: "₹ lakh" },
  { id: "absolute", label: "₹ absolute" },
];

/** The "key numbers" form: the fields that drive most of the ratio set. */
const KEY_ROWS: { section: Section | "market"; item: string; label: string }[] = [
  { section: "pnl", item: "revenue", label: "Revenue from operations" },
  { section: "pnl", item: "cogs", label: "Cost of goods sold" },
  { section: "pnl", item: "operatingExpenses", label: "Operating expenses" },
  { section: "pnl", item: "depreciationAndAmortisation", label: "Depreciation & amortisation" },
  { section: "pnl", item: "interestExpense", label: "Finance cost (interest)" },
  { section: "pnl", item: "taxExpense", label: "Income tax" },
  { section: "pnl", item: "netProfit", label: "Profit after tax" },
  { section: "balanceSheet", item: "cashAndEquivalents", label: "Cash & equivalents" },
  { section: "balanceSheet", item: "inventory", label: "Inventories" },
  { section: "balanceSheet", item: "tradeReceivables", label: "Trade receivables" },
  { section: "balanceSheet", item: "tradePayables", label: "Trade payables" },
  { section: "balanceSheet", item: "currentAssets", label: "Total current assets" },
  { section: "balanceSheet", item: "currentLiabilities", label: "Total current liabilities" },
  { section: "balanceSheet", item: "shortTermBorrowings", label: "Short-term borrowings" },
  { section: "balanceSheet", item: "longTermBorrowings", label: "Long-term borrowings" },
  { section: "balanceSheet", item: "totalEquity", label: "Shareholders' funds" },
  { section: "balanceSheet", item: "totalAssets", label: "Total assets" },
  { section: "market", item: "pricePerShare", label: "Share price (₹, absolute)" },
  { section: "market", item: "sharesOutstanding", label: "Shares outstanding (count)" },
];

const KEY_GROUPS: { section: Section | "market"; label: string }[] = [
  { section: "pnl", label: "Profit & loss" },
  { section: "balanceSheet", label: "Balance sheet" },
  { section: "market", label: "Market data (optional)" },
];

/* -------------------------------- formatting ------------------------------- */

function formatValue(ratio: RatioResult): string {
  if (ratio.value === null) return "—";
  const value = ratio.value;
  switch (ratio.unit) {
    case "percent":
      return `${value.toFixed(2)}%`;
    case "times":
      return `${value.toFixed(2)}×`;
    case "days":
      return `${value.toFixed(1)} days`;
    case "ratio":
      return value.toFixed(2);
    case "currency":
      return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    case "perShare":
      return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
    default:
      return String(value);
  }
}

const STATUS_LABELS: Record<RatioStatus, string> = {
  ok: "ok",
  missing_input: "missing input",
  not_applicable: "not applicable",
  negative_denominator: "bad denominator",
};

function statusClasses(status: RatioStatus): string {
  switch (status) {
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "missing_input":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "not_applicable":
      return "border-slate-200 bg-slate-100 text-slate-500";
    default:
      return "border-rose-200 bg-rose-50 text-rose-700";
  }
}

function riskBand(score: number): { label: string; className: string; bar: string } {
  if (score >= 80)
    return { label: "Low risk", className: "text-emerald-600", bar: "bg-emerald-500" };
  if (score >= 60)
    return { label: "Moderate risk", className: "text-lime-600", bar: "bg-lime-500" };
  if (score >= 40)
    return { label: "Elevated risk", className: "text-amber-600", bar: "bg-amber-500" };
  return { label: "High risk", className: "text-rose-600", bar: "bg-rose-500" };
}

/* ---------------------------------- page ---------------------------------- */

type Mode = "upload" | "manual";

function AnalyzePage() {
  const [mode, setMode] = useState<Mode>("upload");
  const [uploaded, setUploaded] = useState<{ report: AnalysisReport; warnings: string[] } | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("crore");
  const [manualCompany, setManualCompany] = useState("");
  const [manualYears, setManualYears] = useState<string[]>(["2023", "2024", "2025"]);
  const [manualValues, setManualValues] = useState<Record<string, string[]>>({});
  const [year, setYear] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const manualReport = useMemo<AnalysisReport | null>(() => {
    const years = manualYears
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 1900 && value < 2200);
    const filled = Object.values(manualValues).some((row) =>
      row.some((cell) => (cell ?? "").trim() !== ""),
    );
    if (!filled || years.length === 0) return null;

    const rows = KEY_ROWS.map((row) => ({
      section: row.section,
      item: row.item,
      values: years.map((_, index) => {
        const raw = (manualValues[`${row.section}.${row.item}`] ?? [])[index] ?? "";
        const trimmed = raw.trim().replace(/[₹,\s]/g, "");
        if (trimmed === "") return null;
        const value = Number(trimmed);
        return Number.isFinite(value) ? value : null;
      }),
    }));

    try {
      const parsed = statementFromGrid(
        { company: manualCompany.trim() || "Manual entry", unit, years },
        rows,
      );
      return analyzeInput(parsed.input);
    } catch {
      return null;
    }
  }, [manualValues, manualYears, manualCompany, unit]);

  const report = mode === "upload" ? (uploaded?.report ?? null) : manualReport;
  const warnings = mode === "upload" ? (uploaded?.warnings ?? []) : [];

  const activeYear = year !== null && report?.years.includes(year) ? year : (report?.years.at(-1) ?? null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadError(null);
    setUploaded(null);
    setYear(null);
    try {
      const text = await file.text();
      const { input, warnings: parseWarnings } = parseStatementCsv(text);
      setUploaded({ report: analyzeInput(input), warnings: parseWarnings });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  function loadSample() {
    setMode("upload");
    setUploadError(null);
    setFileName(null);
    setYear(null);
    setUploaded({ report: analyzeInput(sampleStatementInput), warnings: [] });
    if (fileInput.current) fileInput.current.value = "";
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = TEMPLATE_FILENAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setCell(key: string, index: number, value: string) {
    setManualValues((current) => {
      const row = [...(current[key] ?? [])];
      while (row.length < 3) row.push("");
      row[index] = value;
      return { ...current, [key]: row };
    });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <svg viewBox="0 0 24 24" className="h-[62%] w-[62%]" aria-hidden>
                <rect x="4" y="12" width="4" height="8" rx="1.5" fill="#34d399" />
                <rect x="10" y="8" width="4" height="12" rx="1.5" fill="#34d399" />
                <rect x="16" y="4" width="4" height="16" rx="1.5" fill="#10b981" />
              </svg>
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">FinLens</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
            >
              Home
            </Link>
            <Link
              to="/"
              hash="pricing"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:block"
            >
              Pricing
            </Link>
            <Link
              to="/"
              hash="waitlist"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Join the waitlist
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Analyzer · v1 ratio engine
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Upload a statement, or type the key numbers
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Every ratio below is computed deterministically from the figures you provide — no AI,
            no estimates. A figure you leave out is reported as a missing input, never as zero.
          </p>
        </div>

        {/* input panel */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {(
                [
                  { id: "upload" as Mode, label: "Upload CSV" },
                  { id: "manual" as Mode, label: "Type key numbers" },
                ]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setYear(null);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    mode === tab.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Download blank template (CSV)
              </button>
              <button
                type="button"
                onClick={loadSample}
                className="inline-flex h-10 items-center rounded-lg bg-emerald-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Load sample company
              </button>
            </div>
          </div>

          {mode === "upload" ? (
            <div className="mt-6">
              <label
                htmlFor="statement-file"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8 text-slate-400"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="mt-3 text-sm font-semibold text-slate-900">
                  {fileName ?? "Choose a CSV file on the FinLens template"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  One column per financial year, one row per line item. Blank cells stay missing.
                </span>
              </label>
              <input
                ref={fileInput}
                id="statement-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="sr-only"
              />
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Unit for hand-typed figures
                  <select
                    value={unit}
                    onChange={(event) => setUnit(event.target.value as Unit)}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
                  >
                    {UNITS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-xs text-slate-500">
                  The unit for an uploaded file comes from its <code># Unit:</code> comment line.
                </p>
              </div>
              {uploadError ? (
                <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {uploadError}
                </p>
              ) : null}
              {warnings.length > 0 ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">
                    {warnings.length} row{warnings.length === 1 ? "" : "s"} could not be read and
                    {warnings.length === 1 ? " was" : " were"} skipped:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                    {warnings.slice(0, 8).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Company name</span>
                  <input
                    value={manualCompany}
                    onChange={(event) => setManualCompany(event.target.value)}
                    placeholder="e.g. Bharat Precision Components Ltd"
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
                  />
                </label>
                <div className="text-sm">
                  <span className="font-medium text-slate-700">Financial years (oldest first)</span>
                  <div className="mt-1 flex items-center gap-2">
                    {manualYears.map((value, index) => (
                      <input
                        key={index}
                        value={value}
                        inputMode="numeric"
                        onChange={(event) => {
                          const next = [...manualYears];
                          next[index] = event.target.value;
                          setManualYears(next);
                        }}
                        className="h-10 w-full rounded-lg border border-slate-300 px-2 text-center text-sm text-slate-900 outline-none focus:border-emerald-500"
                        aria-label={`Year ${index + 1}`}
                      />
                    ))}
                    <select
                      value={unit}
                      onChange={(event) => setUnit(event.target.value as Unit)}
                      className="h-10 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800"
                      aria-label="Unit"
                    >
                      {UNITS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-6">
                {KEY_GROUPS.map((group) => (
                  <div key={group.section}>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                      {group.label}
                    </p>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                            <th className="w-2/5 py-1 font-medium">Line item</th>
                            {manualYears.map((value, index) => (
                              <th key={index} className="py-1 pl-2 font-medium">
                                FY{value || "—"}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {KEY_ROWS.filter((row) => row.section === group.section).map((row) => {
                            const key = `${row.section}.${row.item}`;
                            return (
                              <tr key={key} className="border-t border-slate-100">
                                <td className="py-1.5 pr-2 text-slate-700">{row.label}</td>
                                {manualYears.map((_, index) => (
                                  <td key={index} className="py-1 pl-2">
                                    <input
                                      value={(manualValues[key] ?? [])[index] ?? ""}
                                      onChange={(event) => setCell(key, index, event.target.value)}
                                      inputMode="decimal"
                                      placeholder="—"
                                      aria-label={`${row.label} FY${manualYears[index]}`}
                                      className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm text-slate-900 outline-none focus:border-emerald-500"
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* results */}
        {report && activeYear !== null ? (
          <ReportView report={report} year={activeYear} onYearChange={setYear} />
        ) : (
          <p className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
            {mode === "upload"
              ? "Upload a statement on the template, or load the sample company, to see the ratio report and risk score."
              : "Type any figures above — the report updates as you type."}
          </p>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            Ratio engine v1 — deterministic, no AI. Missing inputs are reported, never assumed to
            be zero.
          </p>
          <div className="flex gap-4">
            <a
              className="hover:text-slate-800"
              href="https://github.com/reschirag-dotcom/Financial-Statement-Analyzer/blob/main/docs/ratios.md"
            >
              Ratio definitions
            </a>
            <a
              className="hover:text-slate-800"
              href="https://github.com/reschirag-dotcom/Financial-Statement-Analyzer/blob/main/docs/risk-score.md"
            >
              Risk-score bands
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------- report ---------------------------------- */

function ReportView({
  report,
  year,
  onYearChange,
}: {
  report: AnalysisReport;
  year: number;
  onYearChange: (year: number) => void;
}) {
  const ratiosForYear = useMemo(
    () => report.ratios.filter((ratio) => ratio.year === year),
    [report, year],
  );

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{report.company}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Amounts in {UNITS.find((unit) => unit.id === report.unit)?.label ?? report.unit} ·
            FY{report.years[0]}–FY{report.years[report.years.length - 1]}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {report.years.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onYearChange(option)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                option === year ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              FY{option}
            </button>
          ))}
        </div>
      </div>

      <RiskCard risk={report.riskScore} />

      {CATEGORIES.map((category) => {
        const rows = ratiosForYear.filter((ratio) => ratio.category === category.id);
        if (rows.length === 0) return null;
        return <RatioGroup key={category.id} category={category} rows={rows} />;
      })}
    </section>
  );
}

function RiskCard({ risk }: { risk: RiskScoreResult }) {
  const score = risk.score;
  const band = score !== null ? riskBand(score) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Risk score · FY{risk.year}
          </p>
          {score !== null && band ? (
            <>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight text-slate-900">
                  {Math.round(score)}
                </span>
                <span className="text-lg font-semibold text-slate-400">/ 100</span>
                <span className={`ml-1 text-sm font-bold ${band.className}`}>{band.label}</span>
              </p>
              <div className="mt-3 h-2 w-64 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${Math.max(2, Math.round(score))}%` }} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Not enough inputs to score this year — {risk.reason ?? "no ratio could be scored"}.
            </p>
          )}
          <p className="mt-3 max-w-md text-xs leading-relaxed text-slate-500">
            0–100, higher is safer. Four pillars of 25 points each, scored from published bands.
            Pillars with no usable ratio are left out and the rest are rescaled.
          </p>
        </div>

        <div className="grid w-full max-w-md gap-2.5 sm:w-auto">
          {risk.pillars.map((pillar) => (
            <div key={pillar.id} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-xs font-semibold text-slate-600">
                {pillar.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-800"
                  style={{
                    width: `${Math.round(((pillar.points ?? 0) / pillar.maxPoints) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">
                {pillar.points === null ? "—" : `${pillar.points.toFixed(1)}/${pillar.maxPoints}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <details className="mt-5 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer text-xs font-semibold text-slate-600">
          How each metric scored
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {risk.pillars.map((pillar) => (
            <div key={pillar.id}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {pillar.label}
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {pillar.metrics.map((metric) => (
                  <li key={metric.id} className="flex justify-between gap-3">
                    <span>{metric.label}</span>
                    <span className="tabular-nums text-slate-500">
                      {metric.value === null
                        ? STATUS_LABELS[metric.status]
                        : `${metric.points} pts`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function RatioGroup({
  category,
  rows,
}: {
  category: { id: RatioCategory; label: string; blurb: string };
  rows: RatioResult[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-base font-bold text-slate-900">{category.label}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{category.blurb}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5 font-semibold sm:px-6">Ratio</th>
              <th className="px-3 py-2.5 text-right font-semibold">Value</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-5 py-2.5 font-semibold sm:px-6">Formula</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ratio) => (
              <tr key={ratio.id} className="border-t border-slate-100 align-top">
                <td className="px-5 py-3 font-medium text-slate-900 sm:px-6">
                  {ratio.label}
                  {ratio.basis === "average" ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                      uses two-year average balance
                    </span>
                  ) : ratio.basis === "closing" ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                      uses closing balance (no prior year)
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                  {formatValue(ratio)}
                  {ratio.value !== null && ratio.unit === "currency" ? (
                    <span className="block text-[11px] font-normal text-slate-400">
                      {ratio.unitLabel}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClasses(ratio.status)}`}
                    title={ratio.reason ?? undefined}
                  >
                    {STATUS_LABELS[ratio.status]}
                  </span>
                  {ratio.reason ? (
                    <span className="mt-1 block max-w-[220px] text-[11px] leading-snug text-slate-400">
                      {ratio.reason}
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-3 text-xs text-slate-500 sm:px-6">{ratio.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
