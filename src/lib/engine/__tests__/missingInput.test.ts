import { describe, expect, test } from "bun:test";
import { analyzeInput } from "../index";
import { createStatement } from "../statement";
import { sampleStatementInput } from "../__fixtures__/sampleStatement";
import type { PeriodValues, StatementInput } from "../types";

/** Deep-copy the sample fixture and drop line items / override series. */
function variant(
  mutate: (copy: { pnl: PeriodValues; balanceSheet: PeriodValues }) => void,
  market?: StatementInput["market"],
): StatementInput {
  const copy = {
    ...sampleStatementInput,
    pnl: { ...sampleStatementInput.pnl },
    balanceSheet: { ...sampleStatementInput.balanceSheet },
    cashFlow: { ...sampleStatementInput.cashFlow },
    market: market === undefined ? sampleStatementInput.market : market,
  };
  mutate(copy);
  return copy;
}

const get = (input: StatementInput, year: number, id: string) => {
  const report = analyzeInput(input);
  return report.ratios.find((ratio) => ratio.year === year && ratio.id === id)!;
};

describe("missing inputs never become zero", () => {
  test("a missing line item reports missing_input and the rest still computes", () => {
    const input = variant((copy) => {
      delete copy.pnl.cogs;
    });
    const report = analyzeInput(input);

    for (const id of ["gross_margin", "inventory_turnover", "dio", "payables_turnover", "dpo", "cash_conversion_cycle"]) {
      const ratio = report.ratios.find((r) => r.year === 2025 && r.id === id)!;
      expect(ratio.status).toBe("missing_input");
      expect(ratio.value).toBeNull();
      expect(ratio.reason).toBeDefined();
    }
    // unaffected ratios still compute
    expect(report.ratios.find((r) => r.year === 2025 && r.id === "net_profit_margin")!.status).toBe("ok");
    expect(report.ratios.find((r) => r.year === 2025 && r.id === "current_ratio")!.status).toBe("ok");
    expect(report.ratios.filter((r) => r.status === "ok").length).toBeGreaterThan(0);
  });

  test("a missing balance sheet item only blanks the ratios that need it", () => {
    const input = variant((copy) => {
      delete copy.balanceSheet.inventory;
    });
    const report = analyzeInput(input);
    expect(report.ratios.find((r) => r.year === 2025 && r.id === "quick_ratio")!.status).toBe("missing_input");
    expect(report.ratios.find((r) => r.year === 2025 && r.id === "inventory_turnover")!.status).toBe("missing_input");
    expect(report.ratios.find((r) => r.year === 2025 && r.id === "current_ratio")!.status).toBe("ok");
    expect(report.ratios.find((r) => r.year === 2025 && r.id === "roe")!.status).toBe("ok");
  });

  test("a null value inside a series is treated as missing, not as zero", () => {
    const input = variant((copy) => {
      copy.pnl.revenue = [1000, 1200, null];
    });
    const ratio = get(input, 2025, "net_profit_margin");
    expect(ratio.status).toBe("missing_input");
    expect(ratio.value).toBeNull();
  });

  test("per-share ratios need market inputs and say so", () => {
    const input = variant(() => {}, {});
    const eps = get(input, 2025, "eps");
    expect(eps.status).toBe("missing_input");
    expect(eps.value).toBeNull();
    expect(eps.reason).toContain("sharesOutstanding");
    const pe = get(input, 2025, "pe_ratio");
    expect(pe.status).toBe("missing_input");
    // ratios that do not need market data are unaffected
    expect(get(input, 2025, "roe").status).toBe("ok");
  });

  test("unknown line items are ignored, never silently mapped", () => {
    const statement = createStatement(
      variant((copy) => {
        copy.pnl["made up line"] = [1, 2, 3];
      }),
    );
    expect(statement.pnl["made up line"]).toBeUndefined();
    expect(statement.pnl.revenue).toEqual([1000, 1200, 1400]);
  });
});

describe("zero and negative denominators", () => {
  test("zero current liabilities", () => {
    const input = variant((copy) => {
      copy.balanceSheet.currentLiabilities = [300, 340, 0];
    });
    const ratio = get(input, 2025, "current_ratio");
    expect(ratio.status).toBe("negative_denominator");
    expect(ratio.value).toBeNull();
    expect(ratio.reason).toContain("currentLiabilities");
    // a difference, not a division: still computable
    expect(get(input, 2025, "working_capital").value).toBe(720);
  });

  test("zero equity", () => {
    const input = variant((copy) => {
      copy.balanceSheet.totalEquity = [600, 700, 0];
    });
    expect(get(input, 2025, "debt_to_equity").status).toBe("negative_denominator");
    expect(get(input, 2025, "debt_to_equity").value).toBeNull();
  });

  test("zero revenue", () => {
    const input = variant((copy) => {
      copy.pnl.revenue = [1000, 1200, 0];
    });
    expect(get(input, 2025, "gross_margin").status).toBe("negative_denominator");
    expect(get(input, 2025, "net_profit_margin").value).toBeNull();
  });

  test("zero interest expense", () => {
    const input = variant((copy) => {
      copy.pnl.interestExpense = [40, 42, 0];
    });
    expect(get(input, 2025, "interest_coverage").status).toBe("negative_denominator");
  });

  test("negative EBITDA", () => {
    const input = variant((copy) => {
      copy.pnl.operatingExpenses = [200, 240, 5000];
    });
    expect(get(input, 2025, "net_debt_to_ebitda").status).toBe("negative_denominator");
    expect(get(input, 2025, "ebitda_margin").status).toBe("ok");
    expect(get(input, 2025, "ebitda_margin").value).toBeLessThan(0);
  });

  test("negative prior-year revenue", () => {
    const input = variant((copy) => {
      copy.pnl.revenue = [1000, -1200, 1400];
    });
    expect(get(input, 2025, "revenue_growth").status).toBe("negative_denominator");
    expect(get(input, 2025, "revenue_growth").value).toBeNull();
    // the year before it has a positive base, so it still computes
    expect(get(input, 2024, "revenue_growth").status).toBe("ok");
    expect(get(input, 2024, "revenue_growth").value).toBeCloseTo(-220, 9);
  });

  test("negative prior-year PAT", () => {
    const input = variant((copy) => {
      copy.pnl.netProfit = [77, -10, 150.5];
    });
    expect(get(input, 2025, "pat_growth").status).toBe("negative_denominator");
  });

  test("loss-making EPS makes P/E not computable", () => {
    const input = variant((copy) => {
      copy.pnl.netProfit = [77, 114.1, -150.5];
    });
    expect(get(input, 2025, "eps").value).toBeCloseTo(-30.1, 9);
    expect(get(input, 2025, "pe_ratio").status).toBe("negative_denominator");
  });
});
