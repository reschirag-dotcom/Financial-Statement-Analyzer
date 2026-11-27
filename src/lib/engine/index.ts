/**
 * FinLens analyzer engine v1 — public entry point.
 *
 * Pure, deterministic and synchronous: `analyze(statement)` returns every ratio
 * for every year plus the 0–100 risk score for the latest year. No AI, no I/O.
 */
import { computeRatios } from "./ratios";
import { computeRiskScore } from "./riskScore";
import { createStatement } from "./statement";
import type { AnalysisReport, RatioResult, Statement, StatementInput } from "./types";

export * from "./types";
export { createStatement, toAbsoluteRupees, valueAt, UNIT_TO_ABSOLUTE } from "./statement";
export { canonicalLineItem, canonicalLineItemNames, CANONICAL_LINE_ITEMS } from "./lineItems";
export { computeRatios, ratiosById, RATIOS, unitLabelFor } from "./ratios";
export { computeRiskScore, RISK_PILLARS } from "./riskScore";

/** Every ratio for every year, plus the risk score for the latest year. */
export function analyze(statement: Statement): AnalysisReport {
  const ratios = computeRatios(statement);
  return {
    company: statement.company,
    currency: statement.currency,
    unit: statement.unit,
    years: [...statement.years],
    ratios,
    riskScore: computeRiskScore(statement, ratios),
  };
}

/** Convenience: normalise an upload-shaped input, then analyse it. */
export function analyzeInput(input: StatementInput): AnalysisReport {
  return analyze(createStatement(input));
}

/** Ratios of one category for one year, in definition order. */
export function ratiosFor(
  report: AnalysisReport,
  year: number,
  category?: RatioResult["category"],
): RatioResult[] {
  return report.ratios.filter(
    (ratio) => ratio.year === year && (category === undefined || ratio.category === category),
  );
}
