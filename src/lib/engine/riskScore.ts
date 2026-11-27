/**
 * Deterministic 0–100 risk score (higher = safer).
 *
 * Four pillars of 25 points each — liquidity, leverage, profitability, growth —
 * each scored from published ratio bands (docs/risk-score.md). No model, no
 * black box: every point is traceable to a band and a ratio value.
 *
 * A metric whose ratio is missing (status !== "ok") is excluded and the pillar
 * is rescaled over the metrics that remain. A pillar with no scorable metric
 * contributes nothing, and the remaining pillars are rescaled to 100.
 */
import { ratiosById } from "./ratios";
import type {
  RatioResult,
  RiskMetric,
  RiskPillar,
  RiskScoreResult,
  Statement,
} from "./types";

interface Threshold {
  min: number;
  points: number;
}

interface UpperThreshold {
  max: number;
  points: number;
}

interface MetricSpec {
  ratioId: string;
  label: string;
  weight: number;
  /** Score a ratio value against published bands. */
  score: (value: number) => number;
}

interface PillarSpec {
  id: RiskPillar["id"];
  label: string;
  metrics: MetricSpec[];
}

/** Higher is better: first band whose `min` the value reaches wins. */
function atLeast(bands: Threshold[]): (value: number) => number {
  return (value) => bands.find((band) => value >= band.min)?.points ?? 0;
}

/** Lower is better: first band whose `max` the value stays under wins. */
function atMost(bands: UpperThreshold[]): (value: number) => number {
  return (value) => bands.find((band) => value <= band.max)?.points ?? 0;
}

export const RISK_PILLARS: PillarSpec[] = [
  {
    id: "liquidity",
    label: "Liquidity",
    metrics: [
      {
        ratioId: "current_ratio",
        label: "Current ratio",
        weight: 0.5,
        score: atLeast([
          { min: 2, points: 100 },
          { min: 1.5, points: 80 },
          { min: 1.2, points: 60 },
          { min: 1, points: 40 },
          { min: 0.8, points: 20 },
        ]),
      },
      {
        ratioId: "quick_ratio",
        label: "Quick ratio",
        weight: 0.5,
        score: atLeast([
          { min: 1.5, points: 100 },
          { min: 1, points: 80 },
          { min: 0.7, points: 60 },
          { min: 0.5, points: 40 },
          { min: 0.3, points: 20 },
        ]),
      },
    ],
  },
  {
    id: "leverage",
    label: "Leverage",
    metrics: [
      {
        ratioId: "debt_to_equity",
        label: "Debt-to-equity",
        weight: 0.5,
        score: atMost([
          { max: 0.25, points: 100 },
          { max: 0.5, points: 85 },
          { max: 1, points: 65 },
          { max: 1.5, points: 45 },
          { max: 2, points: 25 },
          { max: 3, points: 10 },
        ]),
      },
      {
        ratioId: "interest_coverage",
        label: "Interest coverage",
        weight: 0.3,
        score: atLeast([
          { min: 8, points: 100 },
          { min: 5, points: 85 },
          { min: 3, points: 65 },
          { min: 2, points: 45 },
          { min: 1.5, points: 25 },
          { min: 1, points: 10 },
        ]),
      },
      {
        ratioId: "net_debt_to_ebitda",
        label: "Net debt / EBITDA",
        weight: 0.2,
        score: atMost([
          { max: 0, points: 100 },
          { max: 1, points: 85 },
          { max: 2, points: 65 },
          { max: 3, points: 40 },
          { max: 4, points: 20 },
          { max: 5, points: 5 },
        ]),
      },
    ],
  },
  {
    id: "profitability",
    label: "Profitability",
    metrics: [
      {
        ratioId: "net_profit_margin",
        label: "Net profit margin",
        weight: 0.4,
        score: atLeast([
          { min: 15, points: 100 },
          { min: 10, points: 80 },
          { min: 5, points: 60 },
          { min: 2, points: 40 },
          { min: 0, points: 20 },
        ]),
      },
      {
        ratioId: "roe",
        label: "Return on equity",
        weight: 0.3,
        score: atLeast([
          { min: 20, points: 100 },
          { min: 15, points: 80 },
          { min: 10, points: 60 },
          { min: 5, points: 40 },
          { min: 0, points: 20 },
        ]),
      },
      {
        ratioId: "roce",
        label: "Return on capital employed",
        weight: 0.3,
        score: atLeast([
          { min: 20, points: 100 },
          { min: 15, points: 80 },
          { min: 10, points: 60 },
          { min: 5, points: 40 },
          { min: 0, points: 20 },
        ]),
      },
    ],
  },
  {
    id: "growth",
    label: "Growth and stability",
    metrics: [
      {
        ratioId: "revenue_growth",
        label: "Revenue growth (YoY)",
        weight: 0.5,
        score: atLeast([
          { min: 20, points: 100 },
          { min: 10, points: 80 },
          { min: 5, points: 60 },
          { min: 0, points: 40 },
          { min: -5, points: 20 },
        ]),
      },
      {
        ratioId: "pat_growth",
        label: "PAT growth (YoY)",
        weight: 0.5,
        score: atLeast([
          { min: 20, points: 100 },
          { min: 10, points: 80 },
          { min: 5, points: 60 },
          { min: 0, points: 40 },
          { min: -5, points: 20 },
        ]),
      },
    ],
  },
];

const MAX_POINTS_PER_PILLAR = 25;

function scorePillar(
  spec: PillarSpec,
  byId: Map<string, RatioResult>,
): RiskPillar {
  const metrics: RiskMetric[] = spec.metrics.map((metric) => {
    const ratio = byId.get(metric.ratioId);
    const available = ratio !== undefined && ratio.status === "ok" && ratio.value !== null;
    return {
      id: metric.ratioId,
      label: metric.label,
      value: available ? (ratio.value as number) : null,
      status: ratio?.status ?? "missing_input",
      points: available ? metric.score(ratio.value as number) : null,
      weight: metric.weight,
    };
  });

  const scorable = metrics.filter((metric) => metric.points !== null);
  if (scorable.length === 0) {
    return { id: spec.id, label: spec.label, maxPoints: MAX_POINTS_PER_PILLAR, points: null, metrics };
  }
  const weightSum = scorable.reduce(
    (total, metric) => total + spec.metrics.find((m) => m.ratioId === metric.id)!.weight,
    0,
  );
  const earned = scorable.reduce(
    (total, metric) => total + metric.points! * spec.metrics.find((m) => m.ratioId === metric.id)!.weight,
    0,
  );
  return {
    id: spec.id,
    label: spec.label,
    maxPoints: MAX_POINTS_PER_PILLAR,
    points: (earned / weightSum) * (MAX_POINTS_PER_PILLAR / 100),
    metrics,
  };
}

/**
 * Score the statement's latest year. `ratios` must come from `computeRatios`
 * for the same statement.
 */
export function computeRiskScore(statement: Statement, ratios: RatioResult[]): RiskScoreResult {
  const year = statement.years[statement.years.length - 1];
  const byId = ratiosById(ratios, year);
  const pillars = RISK_PILLARS.map((spec) => scorePillar(spec, byId));
  const scored = pillars.filter((pillar) => pillar.points !== null);

  if (scored.length === 0) {
    return {
      year,
      score: null,
      status: "missing_input",
      reason: "no ratio could be scored for this year",
      pillars,
    };
  }

  const total = scored.reduce((sum, pillar) => sum + (pillar.points as number), 0);
  return { year, score: total, status: "ok", pillars };
}
