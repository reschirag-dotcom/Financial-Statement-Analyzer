/**
 * The v1 ratio engine: 27 ratios across profitability, liquidity, solvency,
 * efficiency, growth and per-share, computed per financial year.
 *
 * Rules (published in docs/ratios.md):
 *  - a ratio whose inputs include a missing (null) value returns status
 *    "missing_input" and value null — it never silently becomes zero;
 *  - a ratio whose denominator is zero or negative returns status
 *    "negative_denominator" and value null;
 *  - growth ratios on the first year of a statement return "not_applicable";
 *  - balance-sheet ratios use the two-year average when the opening balance is
 *    available, otherwise the closing balance (reported via `basis`).
 *
 * No rounding is applied; format for display only.
 */
import { toAbsoluteRupees, valueAt } from "./statement";
import type {
  BalanceBasis,
  RatioCategory,
  RatioResult,
  RatioStatus,
  RatioUnit,
  Section,
  Statement,
} from "./types";

interface YearContext {
  statement: Statement;
  index: number;
  year: number;
}

interface Computed {
  value: number | null;
  inputs: Record<string, number | null>;
  status: RatioStatus;
  reason?: string;
  basis?: BalanceBasis;
}

interface RatioDef {
  id: string;
  label: string;
  category: RatioCategory;
  unit: RatioUnit;
  formula: string;
  compute: (ctx: YearContext) => Computed;
}

// ---------------------------------------------------------------- accessors

function v(ctx: YearContext, section: Section, item: string): number | null {
  return valueAt(ctx.statement, section, item, ctx.index);
}

function prevValue(ctx: YearContext, section: Section, item: string): number | null {
  if (ctx.index === 0) return null;
  return valueAt(ctx.statement, section, item, ctx.index - 1);
}

function difference(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a - b;
}

/** Operating profit: the line item if given, else revenue − COGS − operating expenses. */
function operatingProfitOf(ctx: YearContext): number | null {
  const direct = v(ctx, "pnl", "operatingProfit");
  if (direct !== null) return direct;
  const revenue = v(ctx, "pnl", "revenue");
  const cogs = v(ctx, "pnl", "cogs");
  const opex = v(ctx, "pnl", "operatingExpenses");
  if (revenue === null || cogs === null || opex === null) return null;
  return revenue - cogs - opex;
}

/** EBIT: the `ebit` line item if given, else operating profit. */
function ebitOf(ctx: YearContext): number | null {
  const direct = v(ctx, "pnl", "ebit");
  if (direct !== null) return direct;
  return operatingProfitOf(ctx);
}

/** D&A: from the P&L, falling back to the cash flow statement. */
function depreciationOf(ctx: YearContext): number | null {
  return v(ctx, "pnl", "depreciationAndAmortisation") ?? v(ctx, "cashFlow", "depreciationAndAmortisation");
}

/** EBITDA: the line item if given, else EBIT + D&A. */
function ebitdaOf(ctx: YearContext): number | null {
  const direct = v(ctx, "pnl", "ebitda");
  if (direct !== null) return direct;
  const ebit = ebitOf(ctx);
  const depreciation = depreciationOf(ctx);
  if (ebit === null || depreciation === null) return null;
  return ebit + depreciation;
}

/** Total debt: the line item if given, else short-term + long-term borrowings. */
function totalDebtOf(ctx: YearContext): number | null {
  const direct = v(ctx, "balanceSheet", "totalDebt");
  if (direct !== null) return direct;
  const shortTerm = v(ctx, "balanceSheet", "shortTermBorrowings");
  const longTerm = v(ctx, "balanceSheet", "longTermBorrowings");
  if (shortTerm === null || longTerm === null) return null;
  return shortTerm + longTerm;
}

interface Balance {
  opening: number | null;
  closing: number | null;
  used: number | null;
  basis: BalanceBasis | undefined;
}

/** Opening/closing balance, and the figure the ratio uses. */
function balance(ctx: YearContext, section: Section, item: string): Balance {
  const closing = v(ctx, section, item);
  const opening = prevValue(ctx, section, item);
  if (closing === null) return { opening, closing, used: null, basis: undefined };
  if (opening === null) return { opening, closing, used: closing, basis: "closing" };
  return { opening, closing, used: (opening + closing) / 2, basis: "average" };
}

// ------------------------------------------------------------ value helpers

/** numerator / denominator, with explicit status for missing or bad inputs. */
function ratioFromInputs(
  inputs: Record<string, number | null>,
  numeratorKey: string,
  denominatorKey: string,
  scale = 1,
): Computed {
  const numerator = inputs[numeratorKey] ?? null;
  const denominator = inputs[denominatorKey] ?? null;
  if (numerator === null) {
    return { value: null, inputs, status: "missing_input", reason: `input '${numeratorKey}' is not provided` };
  }
  if (denominator === null) {
    return { value: null, inputs, status: "missing_input", reason: `input '${denominatorKey}' is not provided` };
  }
  if (denominator <= 0) {
    return {
      value: null,
      inputs,
      status: "negative_denominator",
      reason: `input '${denominatorKey}' is zero or negative (${denominator})`,
    };
  }
  return { value: (numerator / denominator) * scale, inputs, status: "ok" };
}

/** a − b, with "missing_input" when either side is absent. */
function differenceFromInputs(
  inputs: Record<string, number | null>,
  minuendKey: string,
  subtrahendKey: string,
): Computed {
  const a = inputs[minuendKey] ?? null;
  const b = inputs[subtrahendKey] ?? null;
  if (a === null) {
    return { value: null, inputs, status: "missing_input", reason: `input '${minuendKey}' is not provided` };
  }
  if (b === null) {
    return { value: null, inputs, status: "missing_input", reason: `input '${subtrahendKey}' is not provided` };
  }
  return { value: a - b, inputs, status: "ok" };
}

/** Year-over-year percentage growth in a P&L line item. */
function growthOf(ctx: YearContext, item: string): Computed {
  const inputs = { current: v(ctx, "pnl", item), prior: prevValue(ctx, "pnl", item) };
  if (ctx.index === 0) {
    return {
      value: null,
      inputs,
      status: "not_applicable",
      reason: "no prior year in the statement",
    };
  }
  return growthFromInputs(inputs.current, inputs.prior, inputs);
}

/** Shared growth maths: (current − prior) ÷ prior × 100. */
function growthFromInputs(
  current: number | null,
  prior: number | null,
  inputs: Record<string, number | null>,
): Computed {
  if (current === null) {
    return { value: null, inputs, status: "missing_input", reason: "current year value is not provided" };
  }
  if (prior === null) {
    return { value: null, inputs, status: "missing_input", reason: "prior year value is not provided" };
  }
  if (prior <= 0) {
    return {
      value: null,
      inputs,
      status: "negative_denominator",
      reason: `prior year value is zero or negative (${prior})`,
    };
  }
  return { value: ((current - prior) / prior) * 100, inputs, status: "ok" };
}

function sharesOutstanding(ctx: YearContext): number | null {
  const shares = ctx.statement.market?.sharesOutstanding;
  return typeof shares === "number" && Number.isFinite(shares) ? shares : null;
}

function epsAt(ctx: YearContext): number | null {
  const netProfit = v(ctx, "pnl", "netProfit");
  const shares = sharesOutstanding(ctx);
  if (netProfit === null || shares === null || shares <= 0) return null;
  return toAbsoluteRupees(netProfit, ctx.statement.unit) / shares;
}

// --------------------------------------------------------------- components

function daysInventoryOutstanding(ctx: YearContext): Computed {
  const inv = balance(ctx, "balanceSheet", "inventory");
  const cogs = v(ctx, "pnl", "cogs");
  const computed = ratioFromInputs(
    { cogs, inventoryOpening: inv.opening, inventoryClosing: inv.closing, inventoryUsed: inv.used },
    "inventoryUsed",
    "cogs",
    365,
  );
  return inv.basis ? { ...computed, basis: inv.basis } : computed;
}

function daysSalesOutstanding(ctx: YearContext): Computed {
  const rec = balance(ctx, "balanceSheet", "tradeReceivables");
  const revenue = v(ctx, "pnl", "revenue");
  const computed = ratioFromInputs(
    { revenue, receivablesOpening: rec.opening, receivablesClosing: rec.closing, receivablesUsed: rec.used },
    "receivablesUsed",
    "revenue",
    365,
  );
  return rec.basis ? { ...computed, basis: rec.basis } : computed;
}

function daysPayablesOutstanding(ctx: YearContext): Computed {
  const pay = balance(ctx, "balanceSheet", "tradePayables");
  const cogs = v(ctx, "pnl", "cogs");
  const computed = ratioFromInputs(
    { cogs, payablesOpening: pay.opening, payablesClosing: pay.closing, payablesUsed: pay.used },
    "payablesUsed",
    "cogs",
    365,
  );
  return pay.basis ? { ...computed, basis: pay.basis } : computed;
}

// ------------------------------------------------------------------ ratios

const REVENUE_MARGIN = (id: string, label: string, numeratorItem: string, formula: string): RatioDef => ({
  id,
  label,
  category: "profitability",
  unit: "percent",
  formula,
  compute: (ctx) => {
    const revenue = v(ctx, "pnl", "revenue");
    const numerator =
      numeratorItem === "grossProfit"
        ? difference(revenue, v(ctx, "pnl", "cogs"))
        : numeratorItem === "operatingProfit"
          ? operatingProfitOf(ctx)
          : numeratorItem === "ebitda"
            ? ebitdaOf(ctx)
            : v(ctx, "pnl", "netProfit");
    const key = numeratorItem === "grossProfit" ? "grossProfit" : numeratorItem;
    return ratioFromInputs({ revenue, [key]: numerator }, key, "revenue", 100);
  },
});

export const RATIOS: RatioDef[] = [
  // -------------------------------------------------------- profitability
  REVENUE_MARGIN(
    "gross_margin",
    "Gross margin",
    "grossProfit",
    "(Revenue − COGS) ÷ Revenue × 100",
  ),
  REVENUE_MARGIN(
    "operating_margin",
    "Operating margin",
    "operatingProfit",
    "Operating profit ÷ Revenue × 100",
  ),
  REVENUE_MARGIN("ebitda_margin", "EBITDA margin", "ebitda", "EBITDA ÷ Revenue × 100"),
  REVENUE_MARGIN("net_profit_margin", "Net profit margin", "netProfit", "Net profit ÷ Revenue × 100"),
  {
    id: "roe",
    label: "Return on equity (ROE)",
    category: "profitability",
    unit: "percent",
    formula: "Net profit ÷ Average equity × 100",
    compute: (ctx) => {
      const equity = balance(ctx, "balanceSheet", "totalEquity");
      const computed = ratioFromInputs(
        {
          netProfit: v(ctx, "pnl", "netProfit"),
          equityOpening: equity.opening,
          equityClosing: equity.closing,
          equityUsed: equity.used,
        },
        "netProfit",
        "equityUsed",
        100,
      );
      return equity.basis ? { ...computed, basis: equity.basis } : computed;
    },
  },
  {
    id: "roa",
    label: "Return on assets (ROA)",
    category: "profitability",
    unit: "percent",
    formula: "Net profit ÷ Average total assets × 100",
    compute: (ctx) => {
      const assets = balance(ctx, "balanceSheet", "totalAssets");
      const computed = ratioFromInputs(
        {
          netProfit: v(ctx, "pnl", "netProfit"),
          assetsOpening: assets.opening,
          assetsClosing: assets.closing,
          assetsUsed: assets.used,
        },
        "netProfit",
        "assetsUsed",
        100,
      );
      return assets.basis ? { ...computed, basis: assets.basis } : computed;
    },
  },
  {
    id: "roce",
    label: "Return on capital employed (ROCE)",
    category: "profitability",
    unit: "percent",
    formula: "EBIT ÷ (Total assets − Current liabilities) × 100",
    compute: (ctx) => {
      const totalAssets = v(ctx, "balanceSheet", "totalAssets");
      const currentLiabilities = v(ctx, "balanceSheet", "currentLiabilities");
      return ratioFromInputs(
        {
          ebit: ebitOf(ctx),
          totalAssets,
          currentLiabilities,
          capitalEmployed: difference(totalAssets, currentLiabilities),
        },
        "ebit",
        "capitalEmployed",
        100,
      );
    },
  },

  // ------------------------------------------------------------ liquidity
  {
    id: "current_ratio",
    label: "Current ratio",
    category: "liquidity",
    unit: "times",
    formula: "Current assets ÷ Current liabilities",
    compute: (ctx) =>
      ratioFromInputs(
        {
          currentAssets: v(ctx, "balanceSheet", "currentAssets"),
          currentLiabilities: v(ctx, "balanceSheet", "currentLiabilities"),
        },
        "currentAssets",
        "currentLiabilities",
      ),
  },
  {
    id: "quick_ratio",
    label: "Quick ratio",
    category: "liquidity",
    unit: "times",
    formula: "(Current assets − Inventory) ÷ Current liabilities",
    compute: (ctx) => {
      const currentAssets = v(ctx, "balanceSheet", "currentAssets");
      const inventory = v(ctx, "balanceSheet", "inventory");
      return ratioFromInputs(
        {
          currentAssets,
          inventory,
          quickAssets: difference(currentAssets, inventory),
          currentLiabilities: v(ctx, "balanceSheet", "currentLiabilities"),
        },
        "quickAssets",
        "currentLiabilities",
      );
    },
  },
  {
    id: "cash_ratio",
    label: "Cash ratio",
    category: "liquidity",
    unit: "times",
    formula: "Cash and equivalents ÷ Current liabilities",
    compute: (ctx) =>
      ratioFromInputs(
        {
          cashAndEquivalents: v(ctx, "balanceSheet", "cashAndEquivalents"),
          currentLiabilities: v(ctx, "balanceSheet", "currentLiabilities"),
        },
        "cashAndEquivalents",
        "currentLiabilities",
      ),
  },
  {
    id: "working_capital",
    label: "Working capital",
    category: "liquidity",
    unit: "currency",
    formula: "Current assets − Current liabilities",
    compute: (ctx) =>
      differenceFromInputs(
        {
          currentAssets: v(ctx, "balanceSheet", "currentAssets"),
          currentLiabilities: v(ctx, "balanceSheet", "currentLiabilities"),
        },
        "currentAssets",
        "currentLiabilities",
      ),
  },

  // ------------------------------------------------------------- solvency
  {
    id: "debt_to_equity",
    label: "Debt-to-equity",
    category: "solvency",
    unit: "times",
    formula: "Total debt ÷ Total equity",
    compute: (ctx) =>
      ratioFromInputs(
        { totalDebt: totalDebtOf(ctx), totalEquity: v(ctx, "balanceSheet", "totalEquity") },
        "totalDebt",
        "totalEquity",
      ),
  },
  {
    id: "net_debt_to_ebitda",
    label: "Net debt / EBITDA",
    category: "solvency",
    unit: "times",
    formula: "(Total debt − Cash and equivalents) ÷ EBITDA",
    compute: (ctx) => {
      const totalDebt = totalDebtOf(ctx);
      const cash = v(ctx, "balanceSheet", "cashAndEquivalents");
      return ratioFromInputs(
        { totalDebt, cashAndEquivalents: cash, netDebt: difference(totalDebt, cash), ebitda: ebitdaOf(ctx) },
        "netDebt",
        "ebitda",
      );
    },
  },
  {
    id: "interest_coverage",
    label: "Interest coverage",
    category: "solvency",
    unit: "times",
    formula: "EBIT ÷ Interest expense",
    compute: (ctx) =>
      ratioFromInputs(
        { ebit: ebitOf(ctx), interestExpense: v(ctx, "pnl", "interestExpense") },
        "ebit",
        "interestExpense",
      ),
  },
  {
    id: "total_debt_ratio",
    label: "Total-debt ratio",
    category: "solvency",
    unit: "percent",
    formula: "Total debt ÷ Total assets × 100",
    compute: (ctx) =>
      ratioFromInputs(
        { totalDebt: totalDebtOf(ctx), totalAssets: v(ctx, "balanceSheet", "totalAssets") },
        "totalDebt",
        "totalAssets",
        100,
      ),
  },

  // ----------------------------------------------------------- efficiency
  {
    id: "inventory_turnover",
    label: "Inventory turnover",
    category: "efficiency",
    unit: "times",
    formula: "COGS ÷ Average inventory",
    compute: (ctx) => {
      const inv = balance(ctx, "balanceSheet", "inventory");
      const computed = ratioFromInputs(
        { cogs: v(ctx, "pnl", "cogs"), inventoryOpening: inv.opening, inventoryClosing: inv.closing, inventoryUsed: inv.used },
        "cogs",
        "inventoryUsed",
      );
      return inv.basis ? { ...computed, basis: inv.basis } : computed;
    },
  },
  {
    id: "dio",
    label: "Days inventory outstanding (DIO)",
    category: "efficiency",
    unit: "days",
    formula: "Average inventory ÷ COGS × 365",
    compute: daysInventoryOutstanding,
  },
  {
    id: "receivables_turnover",
    label: "Receivables turnover",
    category: "efficiency",
    unit: "times",
    formula: "Revenue ÷ Average trade receivables",
    compute: (ctx) => {
      const rec = balance(ctx, "balanceSheet", "tradeReceivables");
      const computed = ratioFromInputs(
        { revenue: v(ctx, "pnl", "revenue"), receivablesOpening: rec.opening, receivablesClosing: rec.closing, receivablesUsed: rec.used },
        "revenue",
        "receivablesUsed",
      );
      return rec.basis ? { ...computed, basis: rec.basis } : computed;
    },
  },
  {
    id: "dso",
    label: "Days sales outstanding (DSO)",
    category: "efficiency",
    unit: "days",
    formula: "Average trade receivables ÷ Revenue × 365",
    compute: daysSalesOutstanding,
  },
  {
    id: "payables_turnover",
    label: "Payables turnover",
    category: "efficiency",
    unit: "times",
    formula: "COGS ÷ Average trade payables",
    compute: (ctx) => {
      const pay = balance(ctx, "balanceSheet", "tradePayables");
      const computed = ratioFromInputs(
        { cogs: v(ctx, "pnl", "cogs"), payablesOpening: pay.opening, payablesClosing: pay.closing, payablesUsed: pay.used },
        "cogs",
        "payablesUsed",
      );
      return pay.basis ? { ...computed, basis: pay.basis } : computed;
    },
  },
  {
    id: "dpo",
    label: "Days payables outstanding (DPO)",
    category: "efficiency",
    unit: "days",
    formula: "Average trade payables ÷ COGS × 365",
    compute: daysPayablesOutstanding,
  },
  {
    id: "asset_turnover",
    label: "Asset turnover",
    category: "efficiency",
    unit: "times",
    formula: "Revenue ÷ Average total assets",
    compute: (ctx) => {
      const assets = balance(ctx, "balanceSheet", "totalAssets");
      const computed = ratioFromInputs(
        { revenue: v(ctx, "pnl", "revenue"), assetsOpening: assets.opening, assetsClosing: assets.closing, assetsUsed: assets.used },
        "revenue",
        "assetsUsed",
      );
      return assets.basis ? { ...computed, basis: assets.basis } : computed;
    },
  },
  {
    id: "cash_conversion_cycle",
    label: "Cash conversion cycle",
    category: "efficiency",
    unit: "days",
    formula: "DIO + DSO − DPO",
    compute: (ctx) => {
      const dio = daysInventoryOutstanding(ctx);
      const dso = daysSalesOutstanding(ctx);
      const dpo = daysPayablesOutstanding(ctx);
      const inputs = { dio: dio.value, dso: dso.value, dpo: dpo.value };
      const failed = [
        { name: "DIO", result: dio },
        { name: "DSO", result: dso },
        { name: "DPO", result: dpo },
      ].find((part) => part.result.status !== "ok");
      if (failed) {
        return {
          value: null,
          inputs,
          status: failed.result.status,
          reason: `${failed.name} unavailable: ${failed.result.reason ?? failed.result.status}`,
        };
      }
      return {
        value: (dio.value as number) + (dso.value as number) - (dpo.value as number),
        inputs,
        status: "ok",
      };
    },
  },

  // --------------------------------------------------------------- growth
  {
    id: "revenue_growth",
    label: "Revenue growth (YoY)",
    category: "growth",
    unit: "percent",
    formula: "(Revenue this year − Revenue last year) ÷ Revenue last year × 100",
    compute: (ctx) => growthOf(ctx, "revenue"),
  },
  {
    id: "pat_growth",
    label: "PAT growth (YoY)",
    category: "growth",
    unit: "percent",
    formula: "(Net profit this year − Net profit last year) ÷ Net profit last year × 100",
    compute: (ctx) => growthOf(ctx, "netProfit"),
  },
  {
    id: "eps_growth",
    label: "EPS growth (YoY)",
    category: "growth",
    unit: "percent",
    formula: "(EPS this year − EPS last year) ÷ EPS last year × 100",
    compute: (ctx) => {
      const current = epsAt(ctx);
      const prior = ctx.index === 0 ? null : epsAt({ ...ctx, index: ctx.index - 1 });
      const inputs = { epsCurrent: current, epsPrior: prior };
      if (ctx.index === 0) {
        return { value: null, inputs, status: "not_applicable", reason: "no prior year in the statement" };
      }
      return growthFromInputs(current, prior, inputs);
    },
  },

  // ------------------------------------------------------------ per-share
  {
    id: "eps",
    label: "Earnings per share",
    category: "perShare",
    unit: "perShare",
    formula: "Net profit (₹ absolute) ÷ Shares outstanding",
    compute: (ctx) => {
      const netProfit = v(ctx, "pnl", "netProfit");
      const shares = sharesOutstanding(ctx);
      return ratioFromInputs(
        {
          netProfit,
          netProfitAbsolute: netProfit === null ? null : toAbsoluteRupees(netProfit, ctx.statement.unit),
          sharesOutstanding: shares,
        },
        "netProfitAbsolute",
        "sharesOutstanding",
      );
    },
  },
  {
    id: "book_value_per_share",
    label: "Book value per share",
    category: "perShare",
    unit: "perShare",
    formula: "Total equity (₹ absolute) ÷ Shares outstanding",
    compute: (ctx) => {
      const equity = v(ctx, "balanceSheet", "totalEquity");
      const shares = sharesOutstanding(ctx);
      return ratioFromInputs(
        {
          totalEquity: equity,
          totalEquityAbsolute: equity === null ? null : toAbsoluteRupees(equity, ctx.statement.unit),
          sharesOutstanding: shares,
        },
        "totalEquityAbsolute",
        "sharesOutstanding",
      );
    },
  },
  {
    id: "pe_ratio",
    label: "Price / earnings",
    category: "perShare",
    unit: "times",
    formula: "Price per share ÷ EPS",
    compute: (ctx) => {
      const price = ctx.statement.market?.pricePerShare ?? null;
      return ratioFromInputs(
        { pricePerShare: price, eps: epsAt(ctx) },
        "pricePerShare",
        "eps",
      );
    },
  },
];

// ------------------------------------------------------------------ output

const UNIT_LABELS: Record<RatioUnit, string> = {
  percent: "%",
  times: "×",
  days: "days",
  ratio: "ratio",
  currency: "₹ (statement unit)",
  perShare: "₹ per share",
};

export function unitLabelFor(unit: RatioUnit, statementUnit: Statement["unit"]): string {
  if (unit === "currency") return `₹ ${statementUnit}`;
  return UNIT_LABELS[unit];
}

/** Compute every ratio for every year of the statement. */
export function computeRatios(statement: Statement): RatioResult[] {
  const results: RatioResult[] = [];
  statement.years.forEach((year, index) => {
    const ctx: YearContext = { statement, index, year };
    for (const def of RATIOS) {
      const computed = def.compute(ctx);
      const result: RatioResult = {
        id: def.id,
        label: def.label,
        category: def.category,
        year,
        value: computed.value,
        unit: def.unit,
        unitLabel: unitLabelFor(def.unit, statement.unit),
        formula: def.formula,
        inputs: computed.inputs,
        status: computed.status,
      };
      if (computed.reason !== undefined) result.reason = computed.reason;
      if (computed.basis !== undefined) result.basis = computed.basis;
      results.push(result);
    }
  });
  return results;
}

/** Ratios for one year, keyed by ratio id. */
export function ratiosById(results: RatioResult[], year: number): Map<string, RatioResult> {
  const map = new Map<string, RatioResult>();
  for (const result of results) {
    if (result.year === year) map.set(result.id, result);
  }
  return map;
}
