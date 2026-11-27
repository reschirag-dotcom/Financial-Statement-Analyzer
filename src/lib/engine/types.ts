/**
 * FinLens analyzer engine — types.
 *
 * Pure TypeScript: no I/O, no network, no AI. Every number here is a
 * deterministic function of the input `Statement`.
 */

/** Units the statement is expressed in. Amounts are in the statement's own unit. */
export type Unit = "crore" | "lakh" | "absolute";

export type Section = "pnl" | "balanceSheet" | "cashFlow";

/** One value per financial year, oldest first. `null` means "not provided". */
export type PeriodValues = Record<string, (number | null)[]>;

export interface MarketData {
  /** Price per share, in absolute rupees (not crores/lakhs). */
  pricePerShare?: number | null;
  /** Number of shares outstanding, an absolute count. */
  sharesOutstanding?: number | null;
}

export interface Statement {
  company: string;
  currency: "INR";
  unit: Unit;
  /** Financial years, oldest first. Must be non-empty. */
  years: number[];
  pnl: PeriodValues;
  balanceSheet: PeriodValues;
  cashFlow: PeriodValues;
  market?: MarketData;
}

/** Shape accepted by `createStatement` — line item names may be aliases. */
export interface StatementInput {
  company: string;
  currency?: "INR";
  unit: Unit;
  years: number[];
  pnl?: PeriodValues;
  balanceSheet?: PeriodValues;
  cashFlow?: PeriodValues;
  market?: MarketData;
}

export type RatioCategory =
  | "profitability"
  | "liquidity"
  | "solvency"
  | "efficiency"
  | "growth"
  | "perShare";

export type RatioUnit = "percent" | "times" | "days" | "ratio" | "currency" | "perShare";

export type RatioStatus =
  | "ok"
  | "not_applicable"
  | "missing_input"
  | "negative_denominator";

/** How a balance-sheet-based ratio treated the opening balance. */
export type BalanceBasis = "average" | "closing";

export interface RatioResult {
  id: string;
  label: string;
  category: RatioCategory;
  year: number;
  value: number | null;
  unit: RatioUnit;
  unitLabel: string;
  formula: string;
  /** Every input used, as raw statement figures (or derived averages). */
  inputs: Record<string, number | null>;
  status: RatioStatus;
  /** Present when status is not "ok": why the value is absent. */
  reason?: string;
  /** Present on ratios that use a balance-sheet average. */
  basis?: BalanceBasis;
}

export interface RiskMetric {
  id: string;
  label: string;
  value: number | null;
  status: RatioStatus;
  /** 0–100 points for this metric, or null when it could not be scored. */
  points: number | null;
  weight: number;
}

export interface RiskPillar {
  id: "liquidity" | "leverage" | "profitability" | "growth";
  label: string;
  /** Maximum points this pillar can contribute (25 each). */
  maxPoints: number;
  /** Points earned, or null when no metric in the pillar could be scored. */
  points: number | null;
  metrics: RiskMetric[];
}

export interface RiskScoreResult {
  year: number;
  /** 0–100, higher = safer. Null when nothing could be scored. */
  score: number | null;
  status: "ok" | "missing_input";
  reason?: string;
  pillars: RiskPillar[];
}

export interface AnalysisReport {
  company: string;
  currency: "INR";
  unit: Unit;
  years: number[];
  ratios: RatioResult[];
  riskScore: RiskScoreResult;
}
