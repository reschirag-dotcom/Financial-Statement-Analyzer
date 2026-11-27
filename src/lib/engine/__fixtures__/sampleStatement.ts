/**
 * Hand-checked sample statement, used by the engine tests and as the shape of
 * the published CSV template. All amounts in ₹ crore.
 *
 * Every ratio's expected value in the tests is computed by hand from these
 * figures — see docs/ratios.md for the definitions.
 */
import type { StatementInput } from "../types";

export const sampleStatementInput: StatementInput = {
  company: "Bharat Precision Components Ltd (sample, not a real company)",
  unit: "crore",
  years: [2023, 2024, 2025],
  pnl: {
    revenue: [1000, 1200, 1400],
    cogs: [600, 700, 800],
    operatingExpenses: [200, 240, 280],
    depreciationAndAmortisation: [50, 55, 60],
    interestExpense: [40, 42, 45],
    taxExpense: [33, 48.9, 64.5],
    netProfit: [77, 114.1, 150.5],
  },
  balanceSheet: {
    cashAndEquivalents: [120, 150, 190],
    inventory: [180, 210, 240],
    tradeReceivables: [160, 200, 230],
    tradePayables: [140, 170, 200],
    otherCurrentAssets: [40, 50, 60],
    currentAssets: [500, 610, 720],
    currentLiabilities: [300, 340, 380],
    shortTermBorrowings: [100, 110, 120],
    longTermBorrowings: [300, 320, 330],
    totalEquity: [600, 700, 810],
    totalAssets: [1000, 1130, 1260],
  },
  cashFlow: {
    depreciationAndAmortisation: [50, 55, 60],
    operatingCashFlow: [130, 175, 220],
    investingCashFlow: [-70, -85, -95],
    financingCashFlow: [-40, -60, -85],
  },
  market: {
    pricePerShare: 250,
    sharesOutstanding: 50_000_000,
  },
};

/** The same statement with plain-English line item names (the "key numbers" form). */
export const sampleKeyNumbersInput: StatementInput = {
  company: "Bharat Precision Components Ltd (key-numbers form)",
  unit: "crore",
  years: [2023, 2024, 2025],
  pnl: {
    "Total Revenue": [1000, 1200, 1400],
    "Cost of Goods Sold": [600, 700, 800],
    "Operating Expenses": [200, 240, 280],
    "Depreciation & Amortisation": [50, 55, 60],
    "Finance Cost": [40, 42, 45],
    "Income Tax": [33, 48.9, 64.5],
    PAT: [77, 114.1, 150.5],
  },
  balanceSheet: {
    "Cash & Cash Equivalents": [120, 150, 190],
    Inventories: [180, 210, 240],
    Debtors: [160, 200, 230],
    Creditors: [140, 170, 200],
    "Other Current Assets": [40, 50, 60],
    "Total Current Assets": [500, 610, 720],
    "Total Current Liabilities": [300, 340, 380],
    "Short-term Borrowings": [100, 110, 120],
    "Long-term Borrowings": [300, 320, 330],
    "Shareholders' Funds": [600, 700, 810],
    "Total Assets": [1000, 1130, 1260],
  },
  market: { pricePerShare: 250, sharesOutstanding: 50_000_000 },
};
