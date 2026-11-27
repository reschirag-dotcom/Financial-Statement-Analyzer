/**
 * Statement construction and value access.
 *
 * A `Statement` is normalised once on the way in: line item names are mapped to
 * canonical keys, non-finite numbers become `null`, and every series is padded
 * to the length of `years`. Missing stays `null` — never 0.
 */
import { canonicalLineItem } from "./lineItems";
import type { PeriodValues, Section, Statement, StatementInput, Unit } from "./types";

export const UNIT_TO_ABSOLUTE: Record<Unit, number> = {
  crore: 1e7,
  lakh: 1e5,
  absolute: 1,
};

/** Convert an amount in the statement's unit to absolute rupees. */
export function toAbsoluteRupees(amount: number, unit: Unit): number {
  return amount * UNIT_TO_ABSOLUTE[unit];
}

function normalizeSeries(values: (number | null)[], yearCount: number): (number | null)[] {
  const series: (number | null)[] = [];
  for (let i = 0; i < yearCount; i += 1) {
    const value = values[i];
    series.push(typeof value === "number" && Number.isFinite(value) ? value : null);
  }
  return series;
}

function normalizeForSection(
  section: Section,
  raw: PeriodValues | undefined,
  yearCount: number,
): PeriodValues {
  const out: PeriodValues = {};
  if (!raw) return out;
  for (const [name, values] of Object.entries(raw)) {
    const canonical = canonicalLineItem(section, name);
    if (!canonical) continue;
    out[canonical] = normalizeSeries(values, yearCount);
  }
  return out;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Build a normalised statement. Throws on structurally impossible input
 * (no years, unknown unit) — those are upload errors, not missing data.
 */
export function createStatement(input: StatementInput): Statement {
  if (!Array.isArray(input.years) || input.years.length === 0) {
    throw new Error("Statement must have at least one financial year.");
  }
  if (!(input.unit in UNIT_TO_ABSOLUTE)) {
    throw new Error(`Unsupported unit: ${String(input.unit)}`);
  }
  const yearCount = input.years.length;
  return {
    company: input.company,
    currency: "INR",
    unit: input.unit,
    years: [...input.years],
    pnl: normalizeForSection("pnl", input.pnl, yearCount),
    balanceSheet: normalizeForSection("balanceSheet", input.balanceSheet, yearCount),
    cashFlow: normalizeForSection("cashFlow", input.cashFlow, yearCount),
    market: {
      pricePerShare: finiteOrNull(input.market?.pricePerShare),
      sharesOutstanding: finiteOrNull(input.market?.sharesOutstanding),
    },
  };
}

/** Value of a line item for the year at `index`, or null if absent. */
export function valueAt(
  statement: Statement,
  section: Section,
  item: string,
  index: number,
): number | null {
  const series = statement[section][item];
  if (!series) return null;
  const value = series[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
