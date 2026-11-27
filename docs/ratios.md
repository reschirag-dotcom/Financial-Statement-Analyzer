# FinLens ratio definitions (engine v1)

Every number FinLens reports is a deterministic function of the uploaded statement. This
document defines each ratio, the exact inputs it uses, and what the engine returns when an
input is missing or unusable — so a chartered accountant can audit the output line by line.

Source: `src/lib/engine/ratios.ts`. Tests: `src/lib/engine/__tests__/`. Sample statement used
in the tests: `src/lib/engine/__fixtures__/sampleStatement.ts` (a fictional company).

## Rules that apply to every ratio

**Result shape.** Each ratio returns

```
{ id, label, category, year, value, unit, unitLabel, formula, inputs, status, reason?, basis? }
```

`inputs` echoes the exact figures used (raw statement values, or the derived figure the formula
names), so the value can be recomputed by hand. `formula` is the published formula in words.

**Status values.**

| status | meaning |
| --- | --- |
| `ok` | `value` is a number |
| `missing_input` | a required input is absent (`null`); `value` is `null`, `reason` names the input |
| `negative_denominator` | the denominator is zero or negative; `value` is `null`, `reason` names the input |
| `not_applicable` | the ratio does not exist for this year (first year of a statement has no prior year) |

**Missing is never zero.** A blank cell, a `null`, a non-numeric or a non-finite value is
treated as *not provided*. The engine never substitutes 0, and a ratio that needs it returns
`missing_input` — the other ratios in the report still compute.

**Units.** Amounts are in the statement's own unit (`crore`, `lakh` or `absolute`). Ratios are
dimensionless, so the unit cancels; percentages are ×100 (a value of `42.86` means 42.86%).
Money results (`working_capital`) are returned in the statement's unit and say so in
`unitLabel`. Per-share results are converted to absolute rupees per share, because share counts
are absolute numbers (₹1 crore = ₹10,000,000; ₹1 lakh = ₹100,000).

**No rounding.** Values are returned at full double precision; rounding happens only when a
report is displayed.

**Balance-sheet averages.** Ratios that divide by a balance-sheet figure (ROE, ROA, inventory
and receivables and payables turnover, DIO/DSO/DPO, asset turnover) divide by the **average of
the opening and closing balance** when the previous year's balance is available. When it is not
(the first year of the statement), they divide by the closing balance alone and report
`basis: "closing"` instead of `basis: "average"`. Both the opening and closing figures appear in
`inputs`.

**Derived inputs.** Where a statement does not give a line item directly, the engine derives it
only from published rules:

- `operatingProfit` = revenue − COGS − operating expenses (used when no `operatingProfit` line is given)
- `ebit` = the `ebit` line item if given, else `operatingProfit`
- `ebitda` = the `ebitda` line item if given, else `ebit` + D&A
- D&A = the P&L depreciation line, else the cash-flow depreciation line
- `totalDebt` = the `totalDebt` line item if given, else short-term borrowings + long-term borrowings
  (both must be present; one alone is treated as missing)

**Line item names.** The template uses Indian Schedule III / Ind AS naming; plain-English
"key numbers" names (`Total Revenue`, `Cost of Goods Sold`, `PAT`, `Debtors`, `Creditors`,
`Shareholders' Funds`, …) are mapped to the same canonical keys. Matching ignores case, spaces
and punctuation. Unrecognised line items are ignored, never guessed at.

**Growth on a non-positive base.** Growth is `(current − prior) ÷ prior × 100`. If the prior
year's value is zero or negative, the percentage is not meaningful and the result is
`negative_denominator`.

## Profitability

| Ratio | Formula | Inputs |
| --- | --- | --- |
| Gross margin | (Revenue − COGS) ÷ Revenue × 100 | revenue, cogs |
| Operating margin | Operating profit ÷ Revenue × 100 | operating profit (derived if absent), revenue |
| EBITDA margin | EBITDA ÷ Revenue × 100 | ebitda (derived if absent), revenue |
| Net profit margin | Net profit ÷ Revenue × 100 | netProfit, revenue |
| ROE | Net profit ÷ Average equity × 100 | netProfit, equity opening/closing |
| ROA | Net profit ÷ Average total assets × 100 | netProfit, assets opening/closing |
| ROCE | EBIT ÷ (Total assets − Current liabilities) × 100 | ebit, totalAssets, currentLiabilities |

Notes.

- ROE uses total equity (shareholders' funds), not equity share capital.
- Capital employed for ROCE is `total assets − current liabilities`. Because Schedule III current
  liabilities include short-term borrowings, short-term debt is excluded from capital employed.
  The figure is echoed as `capitalEmployed` in `inputs`.
- A zero or negative denominator (e.g. negative net worth) gives `negative_denominator`; it is
  never reported as a very large percentage.

## Liquidity

| Ratio | Formula | Inputs |
| --- | --- | --- |
| Current ratio | Current assets ÷ Current liabilities | currentAssets, currentLiabilities |
| Quick ratio | (Current assets − Inventory) ÷ Current liabilities | currentAssets, inventory, currentLiabilities |
| Cash ratio | Cash and equivalents ÷ Current liabilities | cashAndEquivalents, currentLiabilities |
| Working capital | Current assets − Current liabilities | currentAssets, currentLiabilities |

Notes.

- The quick ratio subtracts inventory only; it does not attempt to strip out prepayments.
- Working capital is a subtraction, not a division, so zero current liabilities do not invalidate
  it — it still reports a value.

## Solvency

| Ratio | Formula | Inputs |
| --- | --- | --- |
| Debt-to-equity | Total debt ÷ Total equity | totalDebt (derived if absent), totalEquity |
| Net debt / EBITDA | (Total debt − Cash and equivalents) ÷ EBITDA | totalDebt, cashAndEquivalents, ebitda |
| Interest coverage | EBIT ÷ Interest expense | ebit, interestExpense |
| Total-debt ratio | Total debt ÷ Total assets × 100 | totalDebt, totalAssets |

Notes.

- Zero interest expense (a debt-free company) gives `negative_denominator`, not an infinite
  coverage. That is deliberate: coverage is undefined, and a report should say so.
- Net debt can be negative (net cash); the value is reported as computed.
- Negative EBITDA gives `negative_denominator` for net debt / EBITDA.

## Efficiency

| Ratio | Formula | Inputs |
| --- | --- | --- |
| Inventory turnover | COGS ÷ Average inventory | cogs, inventory opening/closing |
| DIO | Average inventory ÷ COGS × 365 | same |
| Receivables turnover | Revenue ÷ Average trade receivables | revenue, receivables opening/closing |
| DSO | Average trade receivables ÷ Revenue × 365 | same |
| Payables turnover | COGS ÷ Average trade payables | cogs, payables opening/closing |
| DPO | Average trade payables ÷ COGS × 365 | same |
| Asset turnover | Revenue ÷ Average total assets | revenue, assets opening/closing |
| Cash conversion cycle | DIO + DSO − DPO | dio, dso, dpo |

Notes.

- Days are computed on a 365-day year.
- The cash conversion cycle propagates the status of its worst component: if DIO, DSO or DPO is
  `missing_input` or `negative_denominator`, the cycle reports the same status and names the
  component in `reason`.

## Growth

| Ratio | Formula |
| --- | --- |
| Revenue growth (YoY) | (Revenue this year − Revenue last year) ÷ Revenue last year × 100 |
| PAT growth (YoY) | (Net profit this year − Net profit last year) ÷ Net profit last year × 100 |
| EPS growth (YoY) | (EPS this year − EPS last year) ÷ EPS last year × 100 |

Notes.

- The first year of a statement has no prior year, so these return `not_applicable`.
- A prior-year value of zero or below returns `negative_denominator` (see above).
- EPS growth needs `market.sharesOutstanding`; without it, EPS is missing and so is its growth.

## Per-share

| Ratio | Formula | Inputs |
| --- | --- | --- |
| EPS | Net profit (₹ absolute) ÷ Shares outstanding | netProfit, sharesOutstanding |
| Book value per share | Total equity (₹ absolute) ÷ Shares outstanding | totalEquity, sharesOutstanding |
| P/E | Price per share ÷ EPS | pricePerShare, eps |

Notes.

- `market.sharesOutstanding` is an absolute share count and `market.pricePerShare` is in absolute
  rupees; the statement's unit applies to the financial statement figures only.
- v1 uses the share count as given for every year — no weighted-average share adjustment.
- Without market inputs, EPS and book value per share return `missing_input` naming
  `sharesOutstanding`, and P/E returns `missing_input` naming `pricePerShare`.
- A zero or negative EPS (loss-making year) makes P/E meaningless and returns
  `negative_denominator`.

## Statement shape

```
Statement {
  company: string
  currency: "INR"                       // v1
  unit: "crore" | "lakh" | "absolute"
  years: number[]                       // ordered, oldest first
  pnl:          { lineItem -> (number | null)[] }
  balanceSheet: { lineItem -> (number | null)[] }
  cashFlow:     { lineItem -> (number | null)[] }
  market?: { pricePerShare?, sharesOutstanding? }
}
```

One value per year, oldest first. Missing values are `null`. A statement with no years, or an
unknown unit, is rejected as an upload error rather than computed.

## Worked check (sample fixture, FY2025, ₹ crore)

Revenue 1400, COGS 800, operating expenses 280, D&A 60, interest 45, net profit 150.5; current
assets 720, inventory 240, cash 190, current liabilities 380, debt 450 (short 120 + long 330),
equity 810 (opening 700), total assets 1260 (opening 1130), receivables 230 (opening 200),
payables 200 (opening 170); price per share ₹250, 5,00,00,000 shares.

| Ratio | Hand calculation | Value |
| --- | --- | --- |
| Gross margin | (1400 − 800) ÷ 1400 | 42.86% |
| Operating margin | (1400 − 800 − 280) ÷ 1400 | 22.86% |
| EBITDA margin | 380 ÷ 1400 | 27.14% |
| Net profit margin | 150.5 ÷ 1400 | 10.75% |
| ROE | 150.5 ÷ 755 | 19.93% |
| ROA | 150.5 ÷ 1195 | 12.59% |
| ROCE | 320 ÷ (1260 − 380) | 36.36% |
| Current ratio | 720 ÷ 380 | 1.89× |
| Quick ratio | 480 ÷ 380 | 1.26× |
| Cash ratio | 190 ÷ 380 | 0.50× |
| Working capital | 720 − 380 | ₹340 crore |
| Debt-to-equity | 450 ÷ 810 | 0.56× |
| Net debt / EBITDA | 260 ÷ 380 | 0.68× |
| Interest coverage | 320 ÷ 45 | 7.11× |
| Total-debt ratio | 450 ÷ 1260 | 35.71% |
| Inventory turnover | 800 ÷ 225 | 3.56× |
| DIO | 225 ÷ 800 × 365 | 102.7 days |
| Receivables turnover | 1400 ÷ 215 | 6.51× |
| DSO | 215 ÷ 1400 × 365 | 56.1 days |
| Payables turnover | 800 ÷ 185 | 4.32× |
| DPO | 185 ÷ 800 × 365 | 84.4 days |
| Asset turnover | 1400 ÷ 1195 | 1.17× |
| Cash conversion cycle | 102.66 + 56.05 − 84.41 | 74.3 days |
| Revenue growth | (1400 − 1200) ÷ 1200 | 16.67% |
| PAT growth | (150.5 − 114.1) ÷ 114.1 | 31.90% |
| EPS | ₹1,505,000,000 ÷ 5,00,00,000 | ₹30.10 |
| Book value per share | ₹8,100,000,000 ÷ 5,00,00,000 | ₹162.00 |
| P/E | 250 ÷ 30.10 | 8.31× |

These are the assertions in `src/lib/engine/__tests__/ratios.test.ts`.

## Not in v1

- PDF annual-report ingestion (unreliable extraction would produce wrong numbers).
- Any AI-written commentary — v1's calculation path contains no model.
- Weighted-average share counts, segment data, consolidated vs standalone handling.
- US GAAP taxonomy (v1 is Ind AS / Schedule III).
