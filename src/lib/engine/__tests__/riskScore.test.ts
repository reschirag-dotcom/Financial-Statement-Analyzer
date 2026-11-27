import { describe, expect, test } from "bun:test";
import { analyzeInput } from "../index";
import { sampleStatementInput } from "../__fixtures__/sampleStatement";
import type { StatementInput } from "../types";

describe("risk score", () => {
  test("sample statement, latest year: 82.75 / 100", () => {
    const report = analyzeInput(sampleStatementInput);
    expect(report.riskScore.year).toBe(2025);
    expect(report.riskScore.status).toBe("ok");
    expect(report.riskScore.score).toBeCloseTo(82.75, 6);
  });

  test("four pillars of 25 points each", () => {
    const report = analyzeInput(sampleStatementInput);
    expect(report.riskScore.pillars.map((pillar) => pillar.id)).toEqual([
      "liquidity",
      "leverage",
      "profitability",
      "growth",
    ]);
    expect(report.riskScore.pillars.map((pillar) => pillar.maxPoints)).toEqual([25, 25, 25, 25]);
    const liquidity = report.riskScore.pillars[0];
    expect(liquidity.points).toBeCloseTo(20, 6); // current ratio 1.89 → 80, quick ratio 1.26 → 80
    expect(report.riskScore.pillars[1].points).toBeCloseTo(18.75, 6);
    expect(report.riskScore.pillars[2].points).toBeCloseTo(21.5, 6);
    expect(report.riskScore.pillars[3].points).toBeCloseTo(22.5, 6);
  });

  test("every metric shows its value, points and weight", () => {
    const report = analyzeInput(sampleStatementInput);
    const current = report.riskScore.pillars[0].metrics.find((m) => m.id === "current_ratio")!;
    expect(current.value).toBeCloseTo(1.894736842, 6);
    expect(current.points).toBe(80);
    expect(current.weight).toBe(0.5);
    expect(current.status).toBe("ok");
  });

  test("a metric with no ratio is excluded and its pillar rescaled", () => {
    const input: StatementInput = {
      ...sampleStatementInput,
      pnl: { ...sampleStatementInput.pnl },
    };
    delete input.pnl!.revenue;
    const report = analyzeInput(input);
    const growth = report.riskScore.pillars[3];
    const revenueGrowth = growth.metrics.find((m) => m.id === "revenue_growth")!;
    expect(revenueGrowth.status).toBe("missing_input");
    expect(revenueGrowth.points).toBeNull();
    // only PAT growth is left, and it scores 100
    expect(growth.points).toBeCloseTo(25, 6);
    // revenue also feeds derived EBIT, so margin and coverage metrics drop out too
    expect(
      report.riskScore.pillars[1].metrics.find((m) => m.id === "interest_coverage")!.points,
    ).toBeNull();
    expect(report.riskScore.score).toBeCloseTo(81.25, 6);
    expect(report.riskScore.score).toBeCloseTo(
      report.riskScore.pillars.reduce((sum, pillar) => sum + (pillar.points ?? 0), 0),
      6,
    );
  });

  test("one missing metric does not sink the pillar that still has another", () => {
    const input: StatementInput = {
      ...sampleStatementInput,
      balanceSheet: { ...sampleStatementInput.balanceSheet },
    };
    delete input.balanceSheet!.inventory;
    const report = analyzeInput(input);
    const liquidity = report.riskScore.pillars[0];
    expect(liquidity.metrics.find((m) => m.id === "quick_ratio")!.points).toBeNull();
    expect(liquidity.metrics.find((m) => m.id === "current_ratio")!.points).toBe(80);
    expect(liquidity.points).toBeCloseTo(20, 6);
    expect(report.riskScore.score).toBeCloseTo(82.75, 6);
  });

  test("a statement with nothing scorable returns a null score, not zero", () => {
    const report = analyzeInput({
      company: "Empty Ltd",
      unit: "crore",
      years: [2025],
    });
    expect(report.riskScore.score).toBeNull();
    expect(report.riskScore.status).toBe("missing_input");
    expect(report.riskScore.pillars.every((pillar) => pillar.points === null)).toBe(true);
  });

  test("score is deterministic — same input, same output", () => {
    const first = analyzeInput(sampleStatementInput).riskScore.score;
    const second = analyzeInput(sampleStatementInput).riskScore.score;
    expect(first).toBe(second);
  });
});
