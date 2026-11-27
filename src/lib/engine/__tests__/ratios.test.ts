import { describe, expect, test } from "bun:test";
import { analyzeInput } from "../index";
import { sampleKeyNumbersInput, sampleStatementInput } from "../__fixtures__/sampleStatement";

const report = analyzeInput(sampleStatementInput);
const byYear = (year: number, id: string) =>
  report.ratios.find((ratio) => ratio.year === year && ratio.id === id)!;

const FY2025 = 2025;

describe("ratio engine — sample statement, FY2025 (hand-checked)", () => {
  test("profitability", () => {
    expect(byYear(FY2025, "gross_margin").value).toBeCloseTo(42.857142857, 6);
    expect(byYear(FY2025, "operating_margin").value).toBeCloseTo(22.857142857, 6);
    expect(byYear(FY2025, "ebitda_margin").value).toBeCloseTo(27.142857143, 6);
    expect(byYear(FY2025, "net_profit_margin").value).toBeCloseTo(10.75, 6);
    expect(byYear(FY2025, "roe").value).toBeCloseTo(19.933774834, 6);
    expect(byYear(FY2025, "roa").value).toBeCloseTo(12.594142259, 6);
    expect(byYear(FY2025, "roce").value).toBeCloseTo(36.363636364, 6);
  });

  test("liquidity", () => {
    expect(byYear(FY2025, "current_ratio").value).toBeCloseTo(1.894736842, 6);
    expect(byYear(FY2025, "quick_ratio").value).toBeCloseTo(1.263157895, 6);
    expect(byYear(FY2025, "cash_ratio").value).toBeCloseTo(0.5, 6);
    expect(byYear(FY2025, "working_capital").value).toBe(340);
    expect(byYear(FY2025, "working_capital").unit).toBe("currency");
  });

  test("solvency", () => {
    expect(byYear(FY2025, "debt_to_equity").value).toBeCloseTo(0.555555556, 6);
    expect(byYear(FY2025, "net_debt_to_ebitda").value).toBeCloseTo(0.684210526, 6);
    expect(byYear(FY2025, "interest_coverage").value).toBeCloseTo(7.111111111, 6);
    expect(byYear(FY2025, "total_debt_ratio").value).toBeCloseTo(35.714285714, 6);
  });

  test("efficiency", () => {
    expect(byYear(FY2025, "inventory_turnover").value).toBeCloseTo(3.555555556, 6);
    expect(byYear(FY2025, "dio").value).toBeCloseTo(102.65625, 6);
    expect(byYear(FY2025, "receivables_turnover").value).toBeCloseTo(6.511627907, 6);
    expect(byYear(FY2025, "dso").value).toBeCloseTo(56.053571429, 6);
    expect(byYear(FY2025, "payables_turnover").value).toBeCloseTo(4.324324324, 6);
    expect(byYear(FY2025, "dpo").value).toBeCloseTo(84.40625, 6);
    expect(byYear(FY2025, "asset_turnover").value).toBeCloseTo(1.171548117, 6);
    expect(byYear(FY2025, "cash_conversion_cycle").value).toBeCloseTo(74.303571429, 6);
  });

  test("growth", () => {
    expect(byYear(FY2025, "revenue_growth").value).toBeCloseTo(16.666666667, 6);
    expect(byYear(FY2025, "pat_growth").value).toBeCloseTo(31.901840491, 6);
    expect(byYear(FY2025, "eps_growth").value).toBeCloseTo(31.901840491, 6);
  });

  test("per-share", () => {
    expect(byYear(FY2025, "eps").value).toBeCloseTo(30.1, 9);
    expect(byYear(FY2025, "book_value_per_share").value).toBeCloseTo(162, 9);
    expect(byYear(FY2025, "pe_ratio").value).toBeCloseTo(8.305647841, 6);
  });

  test("every ratio computes for a complete statement", () => {
    const nonOk = report.ratios.filter(
      (ratio) => ratio.status !== "ok" && ratio.status !== "not_applicable",
    );
    expect(nonOk.map((ratio) => `${ratio.id}@${ratio.year}:${ratio.status}`)).toEqual([]);
    // the only not_applicable results are the first-year growth ratios
    const notApplicable = report.ratios.filter((ratio) => ratio.status === "not_applicable");
    expect(notApplicable.map((ratio) => ratio.id)).toEqual([
      "revenue_growth",
      "pat_growth",
      "eps_growth",
    ]);
    expect(notApplicable.every((ratio) => ratio.year === 2023)).toBe(true);
  });

  test("each result carries formula, inputs, unit and status", () => {
    const ratio = byYear(FY2025, "current_ratio");
    expect(ratio.formula).toBe("Current assets ÷ Current liabilities");
    expect(ratio.inputs).toEqual({ currentAssets: 720, currentLiabilities: 380 });
    expect(ratio.unit).toBe("times");
    expect(ratio.unitLabel).toBe("×");
    expect(ratio.category).toBe("liquidity");
    expect(ratio.year).toBe(FY2025);
  });

  test("balance-sheet ratios average opening and closing, and say so", () => {
    const roe = byYear(FY2025, "roe");
    expect(roe.basis).toBe("average");
    expect(roe.inputs.equityUsed).toBe(755);
    const first = byYear(2023, "roe");
    expect(first.basis).toBe("closing");
    expect(first.value).toBeCloseTo((77 / 600) * 100, 9);
  });

  test("first year of the statement has no growth ratios", () => {
    for (const id of ["revenue_growth", "pat_growth", "eps_growth"]) {
      const ratio = byYear(2023, id);
      expect(ratio.status).toBe("not_applicable");
      expect(ratio.value).toBeNull();
      expect(ratio.reason).toBe("no prior year in the statement");
    }
  });

  test("plain-English key-numbers input gives identical results", () => {
    const aliased = analyzeInput(sampleKeyNumbersInput);
    const key = (list: typeof report.ratios) =>
      list.map((ratio) => `${ratio.id}@${ratio.year}=${ratio.value?.toFixed(9) ?? ratio.status}`);
    expect(key(aliased.ratios)).toEqual(key(report.ratios));
  });
});
