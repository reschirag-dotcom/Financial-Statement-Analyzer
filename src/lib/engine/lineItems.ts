/**
 * Canonical line items and the aliases accepted for each.
 *
 * The template uses Indian Schedule III / Ind AS naming; the aliases let a
 * plain-English "key numbers" upload (revenue, COGS, operating expenses, …)
 * land on the same canonical keys. Matching is done on a normalised key:
 * lowercase, letters and digits only — so "Trade Receivables", "trade_receivables"
 * and "TradeReceivables" all resolve to `tradeReceivables`.
 */
import type { Section } from "./types";

export const CANONICAL_LINE_ITEMS: Record<Section, Record<string, string[]>> = {
  pnl: {
    revenue: [
      "revenue",
      "revenueFromOperations",
      "totalRevenue",
      "netRevenue",
      "sales",
      "netSales",
      "turnover",
      "grossRevenue",
    ],
    otherIncome: ["otherIncome", "otherIncomeNet"],
    cogs: [
      "cogs",
      "costOfGoodsSold",
      "costOfRevenue",
      "costOfMaterialsConsumed",
      "purchases",
      "directCosts",
      "costOfSales",
    ],
    operatingExpenses: [
      "operatingExpenses",
      "opex",
      "operatingCosts",
      "employeeBenefitExpense",
      "otherExpenses",
      "sgna",
    ],
    depreciationAndAmortisation: [
      "depreciationAndAmortisation",
      "depreciationAndAmortization",
      "depreciation",
      "depreciationAmortisation",
      "dna",
    ],
    interestExpense: [
      "interestExpense",
      "financeCost",
      "financeCosts",
      "interest",
      "borrowingCosts",
      "interestAndFinanceCharges",
    ],
    taxExpense: ["taxExpense", "incomeTax", "tax", "currentTax"],
    operatingProfit: [
      "operatingProfit",
      "operatingProfitBeforeDepreciation",
      "pbdit",
    ],
    ebit: ["ebit", "pbit", "profitBeforeInterestAndTax"],
    ebitda: ["ebitda"],
    netProfit: ["netProfit", "pat", "profitAfterTax", "netIncome", "profitForTheYear"],
  },
  balanceSheet: {
    cashAndEquivalents: [
      "cashAndEquivalents",
      "cashAndCashEquivalents",
      "cashCashEquivalents",
      "cash",
      "cashAndBankBalances",
    ],
    inventory: ["inventory", "inventories", "stockInTrade", "stock"],
    tradeReceivables: [
      "tradeReceivables",
      "receivables",
      "debtors",
      "accountsReceivable",
      "sundryDebtors",
    ],
    tradePayables: [
      "tradePayables",
      "payables",
      "creditors",
      "accountsPayable",
      "sundryCreditors",
    ],
    otherCurrentAssets: ["otherCurrentAssets", "otherAssets", "loansAndAdvances"],
    currentAssets: ["currentAssets", "totalCurrentAssets"],
    currentLiabilities: ["currentLiabilities", "totalCurrentLiabilities"],
    shortTermBorrowings: [
      "shortTermBorrowings",
      "shortTermDebt",
      "shortTermLoans",
      "currentBorrowings",
    ],
    longTermBorrowings: [
      "longTermBorrowings",
      "longTermDebt",
      "longTermLoans",
      "nonCurrentBorrowings",
    ],
    totalDebt: ["totalDebt", "debt", "borrowings", "totalBorrowings"],
    totalEquity: [
      "totalEquity",
      "equity",
      "shareholdersFunds",
      "totalShareholdersFunds",
      "netWorth",
    ],
    totalAssets: ["totalAssets", "assets"],
  },
  cashFlow: {
    depreciationAndAmortisation: [
      "depreciationAndAmortisation",
      "depreciationAndAmortization",
      "depreciation",
      "depreciationAmortisation",
      "dna",
    ],
    operatingCashFlow: [
      "operatingCashFlow",
      "cashFromOperations",
      "cfo",
      "netCashFromOperatingActivities",
    ],
    investingCashFlow: ["investingCashFlow", "cfi", "netCashFromInvestingActivities"],
    financingCashFlow: ["financingCashFlow", "cff", "netCashFromFinancingActivities"],
    capex: ["capex", "capitalExpenditure", "purchaseOfFixedAssets"],
  },
};

/** Lowercase, letters and digits only. */
export function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const LOOKUP: Record<Section, Map<string, string>> = {
  pnl: buildLookup("pnl"),
  balanceSheet: buildLookup("balanceSheet"),
  cashFlow: buildLookup("cashFlow"),
};

function buildLookup(section: Section): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(CANONICAL_LINE_ITEMS[section])) {
    map.set(normalizeKey(canonical), canonical);
    for (const alias of aliases) {
      const key = normalizeKey(alias);
      if (!map.has(key)) map.set(key, canonical);
    }
  }
  return map;
}

/** Canonical name for a line item in a section, or null if unrecognised. */
export function canonicalLineItem(section: Section, raw: string): string | null {
  return LOOKUP[section].get(normalizeKey(raw)) ?? null;
}

/** All canonical line item names for a section. */
export function canonicalLineItemNames(section: Section): string[] {
  return Object.keys(CANONICAL_LINE_ITEMS[section]);
}
