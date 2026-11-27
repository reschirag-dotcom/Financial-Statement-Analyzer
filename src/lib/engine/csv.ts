/**
 * CSV template — parse and generate.
 *
 * Template shape (one column per financial year, one row per line item):
 *
 *   # Company: Example Ltd        <- optional metadata comments
 *   # Unit: crore
 *   Section,Line item,FY2023,FY2024,FY2025
 *   P&L,Revenue,1000,1200,1400
 *   ...
 *
 * A blank cell (or "-", "NA", "n/a", "nil") means "not provided" and stays
 * `null` — it never becomes 0. Amounts are in the unit named by the `# Unit:`
 * comment (crore by default). Market rows are optional and feed EPS, book value
 * per share and P/E.
 */
import { canonicalLineItem, CANONICAL_LINE_ITEMS, normalizeKey } from "./lineItems";
import type { PeriodValues, Section, StatementInput, Unit } from "./types";

export type MarketField = "pricePerShare" | "sharesOutstanding";

export interface GridRow {
  section: Section | "market";
  item: string;
  values: (number | null)[];
}

export interface StatementMeta {
  company: string;
  unit: Unit;
  years: number[];
}

export interface CsvParseResult {
  input: StatementInput;
  warnings: string[];
}

const SECTION_ALIASES: Record<string, Section | "market"> = {
  pnl: "pnl",
  pl: "pnl",
  profitandloss: "pnl",
  profitandlossaccount: "pnl",
  profitloss: "pnl",
  incomestatement: "pnl",
  statementofprofitandloss: "pnl",
  balancesheet: "balanceSheet",
  bs: "balanceSheet",
  assetsandliabilities: "balanceSheet",
  statementofassetsandliabilities: "balanceSheet",
  cashflow: "cashFlow",
  cf: "cashFlow",
  cashflowstatement: "cashFlow",
  statementofcashflows: "cashFlow",
  market: "market",
  marketdata: "market",
  share: "market",
  shares: "market",
};

const MARKET_FIELDS: Record<string, MarketField> = {
  pricepershare: "pricePerShare",
  shareprice: "pricePerShare",
  marketprice: "pricePerShare",
  price: "pricePerShare",
  marketpricepershare: "pricePerShare",
  sharesoutstanding: "sharesOutstanding",
  shares: "sharesOutstanding",
  numberofshares: "sharesOutstanding",
  sharesissued: "sharesOutstanding",
  equityshares: "sharesOutstanding",
};

const UNIT_ALIASES: Record<string, Unit> = {
  crore: "crore",
  cr: "crore",
  crores: "crore",
  inrcrore: "crore",
  lakh: "lakh",
  lakhs: "lakh",
  lac: "lakh",
  lacs: "lakh",
  inrlakh: "lakh",
  absolute: "absolute",
  rupees: "absolute",
  rupee: "absolute",
  inr: "absolute",
  absoluteinr: "absolute",
  units: "absolute",
};

/** Human labels used in the downloadable template (all resolve back to the canonical key). */
const TEMPLATE_LABELS: Record<Section, Record<string, string>> = {
  pnl: {
    revenue: "Revenue from operations",
    otherIncome: "Other income",
    cogs: "Cost of goods sold",
    operatingExpenses: "Operating expenses",
    depreciationAndAmortisation: "Depreciation and amortisation",
    interestExpense: "Finance cost",
    taxExpense: "Income tax",
    operatingProfit: "Operating profit",
    ebit: "EBIT",
    ebitda: "EBITDA",
    netProfit: "Profit after tax",
  },
  balanceSheet: {
    cashAndEquivalents: "Cash and cash equivalents",
    inventory: "Inventories",
    tradeReceivables: "Trade receivables",
    tradePayables: "Trade payables",
    otherCurrentAssets: "Other current assets",
    currentAssets: "Total current assets",
    currentLiabilities: "Total current liabilities",
    shortTermBorrowings: "Short-term borrowings",
    longTermBorrowings: "Long-term borrowings",
    totalDebt: "Total debt",
    totalEquity: "Shareholders' funds",
    totalAssets: "Total assets",
  },
  cashFlow: {
    depreciationAndAmortisation: "Depreciation and amortisation",
    operatingCashFlow: "Net cash from operating activities",
    investingCashFlow: "Net cash from investing activities",
    financingCashFlow: "Net cash from financing activities",
    capex: "Capital expenditure",
  },
};

const SECTION_HEADINGS: Record<Section, string> = {
  pnl: "P&L",
  balanceSheet: "Balance sheet",
  cashFlow: "Cash flow",
};

/* --------------------------------- parsing -------------------------------- */

/** Split CSV text into rows, honouring quoted fields and escaped quotes. */
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const NULL_TOKENS = new Set(["", "-", "--", "na", "n/a", "nil", "null", "none", "nan"]);

/** Parse one amount cell. `null` means not provided; `NaN` means unreadable. */
export function parseAmount(raw: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (NULL_TOKENS.has(trimmed.toLowerCase())) return null;
  let text = trimmed.replace(/[₹$,\s]/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return negative ? -value : value;
}

function parseYear(raw: string): number | null {
  const match = (raw ?? "").match(/(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2200 ? year : null;
}

function resolveSection(raw: string): Section | "market" | null {
  return SECTION_ALIASES[normalizeKey(raw)] ?? null;
}

/**
 * Build a normalised `StatementInput` from grid rows. Unrecognised line items
 * are reported as warnings and dropped — they never become a silent zero.
 */
export function statementFromGrid(meta: StatementMeta, rows: GridRow[]): CsvParseResult {
  const warnings: string[] = [];
  const yearCount = meta.years.length;
  const sections: Record<Section, PeriodValues> = { pnl: {}, balanceSheet: {}, cashFlow: {} };
  const market: Record<MarketField, number | null> = { pricePerShare: null, sharesOutstanding: null };

  for (const row of rows) {
    const values: (number | null)[] = [];
    for (let i = 0; i < yearCount; i += 1) {
      const value = row.values[i];
      values.push(typeof value === "number" && Number.isFinite(value) ? value : null);
    }

    if (row.section === "market") {
      const field = MARKET_FIELDS[normalizeKey(row.item)];
      if (!field) {
        warnings.push(`Unrecognised market row "${row.item}" — ignored.`);
        continue;
      }
      const first = values.find((value) => value !== null);
      market[field] = first ?? null;
      continue;
    }

    const canonical = canonicalLineItem(row.section, row.item);
    if (!canonical) {
      warnings.push(
        `Unrecognised ${SECTION_HEADINGS[row.section]} line item "${row.item}" — ignored.`,
      );
      continue;
    }
    if (sections[row.section][canonical]) {
      warnings.push(
        `"${row.item}" appears more than once in ${SECTION_HEADINGS[row.section]} — the last row wins.`,
      );
    }
    sections[row.section][canonical] = values;
  }

  const input: StatementInput = {
    company: meta.company,
    unit: meta.unit,
    years: [...meta.years],
    pnl: sections.pnl,
    balanceSheet: sections.balanceSheet,
    cashFlow: sections.cashFlow,
    market,
  };
  return { input, warnings };
}

/**
 * Parse a template CSV. Throws only on structural problems (no header row, no
 * year columns) — those are upload errors, not missing data.
 */
export function parseStatementCsv(text: string): CsvParseResult {
  const rows = splitRows(text.replace(/^\uFEFF/, ""));
  const warnings: string[] = [];
  let company = "";
  let unit: Unit = "crore";

  const dataRows: string[][] = [];
  for (const row of rows) {
    const first = (row[0] ?? "").trim();
    if (row.every((cell) => (cell ?? "").trim() === "")) continue;
    if (first.startsWith("#")) {
      const comment = first.replace(/^#+/, "").trim();
      const match = comment.match(/^(company|unit)\s*:\s*(.+)$/i);
      if (match) {
        if (match[1].toLowerCase() === "company") company = match[2].trim();
        else {
          const parsed = UNIT_ALIASES[normalizeKey(match[2])];
          if (parsed) unit = parsed;
          else warnings.push(`Unrecognised unit "${match[2]}" — using crore.`);
        }
      }
      continue;
    }
    dataRows.push(row);
  }

  const header = dataRows.shift();
  if (!header) throw new Error("The file is empty — expected a header row naming the years.");

  const yearColumns: { index: number; year: number }[] = [];
  for (let i = 2; i < header.length; i += 1) {
    const year = parseYear(header[i]);
    if (year !== null) yearColumns.push({ index: i, year });
  }
  if (yearColumns.length === 0) {
    throw new Error(
      "No year columns found. The header row should be: Section, Line item, FY2023, FY2024, …",
    );
  }
  yearColumns.sort((a, b) => a.year - b.year);
  const years = yearColumns.map((column) => column.year);

  const gridRows: GridRow[] = [];
  for (const row of dataRows) {
    const rawSection = (row[0] ?? "").trim();
    const rawItem = (row[1] ?? "").trim();
    if (rawItem === "") continue;
    const section = resolveSection(rawSection);
    if (!section) {
      warnings.push(`Unknown section "${rawSection}" for "${rawItem}" — ignored.`);
      continue;
    }
    const values = yearColumns.map((column) => {
      const raw = row[column.index] ?? "";
      const value = parseAmount(raw);
      if (Number.isNaN(value)) {
        warnings.push(`"${rawItem}" ${column.year}: "${raw.trim()}" is not a number — treated as missing.`);
        return null;
      }
      return value;
    });
    gridRows.push({ section, item: rawItem, values });
  }

  if (gridRows.length === 0) {
    throw new Error("No line items found under the header row.");
  }

  const parsed = statementFromGrid({ company: company || "Uploaded statement", unit, years }, gridRows);
  return { input: parsed.input, warnings: [...warnings, ...parsed.warnings] };
}

/* -------------------------------- template -------------------------------- */

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The blank template CSV offered for download on /analyze. */
export function buildTemplateCsv(): string {
  const years = ["FY2023", "FY2024", "FY2025"];
  const lines: string[] = [
    "# FinLens statement template — one column per financial year, one row per line item.",
    "# Company: Your company name",
    "# Unit: crore",
    "# Amounts are in the unit above. Leave a cell blank when the figure is not in the statement —",
    "# blank is reported as a missing input, never as zero. Rename the year columns to your own years.",
    "# The Market rows are optional: they enable EPS, book value per share and P/E.",
    ["Section", "Line item", ...years].map(csvCell).join(","),
  ];

  for (const section of ["pnl", "balanceSheet", "cashFlow"] as Section[]) {
    for (const item of Object.keys(CANONICAL_LINE_ITEMS[section])) {
      const label = TEMPLATE_LABELS[section][item] ?? item;
      lines.push([SECTION_HEADINGS[section], label, "", "", ""].map(csvCell).join(","));
    }
  }
  lines.push(["Market", "Price per share", "", "", ""].map(csvCell).join(","));
  lines.push(["Market", "Shares outstanding", "", "", ""].map(csvCell).join(","));

  return `${lines.join("\n")}\n`;
}

export const TEMPLATE_FILENAME = "finlens-statement-template.csv";
