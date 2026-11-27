# FinLens risk score (engine v1)

A deterministic 0–100 score where **higher is safer**. It is built only from ratio bands — no
model, no weights learned from data, no black box. Every point is traceable to a ratio value
from `docs/ratios.md` and a band below.

Source: `src/lib/engine/riskScore.ts`. Tests: `src/lib/engine/__tests__/riskScore.test.ts`.

## Structure

Four pillars, 25 points each:

| Pillar | Max points | Metrics (weight inside the pillar) |
| --- | --- | --- |
| Liquidity | 25 | current ratio (0.5), quick ratio (0.5) |
| Leverage | 25 | debt-to-equity (0.5), interest coverage (0.3), net debt / EBITDA (0.2) |
| Profitability | 25 | net profit margin (0.4), ROE (0.3), ROCE (0.3) |
| Growth and stability | 25 | revenue growth (0.5), PAT growth (0.5) |

Each metric is scored 0–100 against its band table. A pillar's points are the weighted average
of its metrics, scaled to 25. The total score is the sum of the pillar points, so a company with
top-band metrics on every pillar scores 100.

The score is computed for the **latest year** in the statement. The per-pillar and per-metric
breakdown is returned alongside the total so any number can be checked by hand.

## Missing metrics

A metric whose ratio is not `ok` (missing input, zero/negative denominator, or not applicable)
is **excluded**, and its pillar is rescaled over the metrics that remain. A pillar with no
scorable metric contributes nothing; the remaining pillars still add to 100. If nothing at all
can be scored, the score is `null` with status `missing_input` — never 0, which would read as
"maximum risk".

## Bands

Bands are evaluated top-down; the first band a value satisfies applies. A value outside every
band scores 0.

### Liquidity

| Current ratio | Points | | Quick ratio | Points |
| --- | --- | --- | --- | --- |
| ≥ 2.0 | 100 | | ≥ 1.5 | 100 |
| ≥ 1.5 | 80 | | ≥ 1.0 | 80 |
| ≥ 1.2 | 60 | | ≥ 0.7 | 60 |
| ≥ 1.0 | 40 | | ≥ 0.5 | 40 |
| ≥ 0.8 | 20 | | ≥ 0.3 | 20 |
| below 0.8 | 0 | | below 0.3 | 0 |

### Leverage

| Debt-to-equity | Points | | Interest coverage | Points | | Net debt / EBITDA | Points |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ≤ 0.25 | 100 | | ≥ 8 | 100 | | ≤ 0 | 100 |
| ≤ 0.5 | 85 | | ≥ 5 | 85 | | ≤ 1 | 85 |
| ≤ 1.0 | 65 | | ≥ 3 | 65 | | ≤ 2 | 65 |
| ≤ 1.5 | 45 | | ≥ 2 | 45 | | ≤ 3 | 40 |
| ≤ 2.0 | 25 | | ≥ 1.5 | 25 | | ≤ 4 | 20 |
| ≤ 3.0 | 10 | | ≥ 1 | 10 | | ≤ 5 | 5 |
| above 3.0 | 0 | | below 1 | 0 | | above 5 | 0 |

A negative net debt / EBITDA (net cash) scores 100. Debt-to-equity is never negative here: a
zero or negative equity denominator is reported as `negative_denominator` and the metric is
excluded.

### Profitability

| Net profit margin | Points | | ROE | Points | | ROCE | Points |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ≥ 15% | 100 | | ≥ 20% | 100 | | ≥ 20% | 100 |
| ≥ 10% | 80 | | ≥ 15% | 80 | | ≥ 15% | 80 |
| ≥ 5% | 60 | | ≥ 10% | 60 | | ≥ 10% | 60 |
| ≥ 2% | 40 | | ≥ 5% | 40 | | ≥ 5% | 40 |
| ≥ 0% | 20 | | ≥ 0% | 20 | | ≥ 0% | 20 |
| below 0% | 0 | | below 0% | 0 | | below 0% | 0 |

### Growth and stability

| Revenue growth (YoY) | Points | | PAT growth (YoY) | Points |
| --- | --- | --- | --- | --- |
| ≥ 20% | 100 | | ≥ 20% | 100 |
| ≥ 10% | 80 | | ≥ 10% | 80 |
| ≥ 5% | 60 | | ≥ 5% | 60 |
| ≥ 0% | 40 | | ≥ 0% | 40 |
| ≥ −5% | 20 | | ≥ −5% | 20 |
| below −5% | 0 | | below −5% | 0 |

## Worked check (sample fixture, FY2025)

| Pillar | Metric values | Metric points | Pillar points |
| --- | --- | --- | --- |
| Liquidity | current ratio 1.89, quick ratio 1.26 | 80, 80 | 20.00 |
| Leverage | D/E 0.56, interest cover 7.11, net debt/EBITDA 0.68 | 65, 85, 85 | 18.75 |
| Profitability | net margin 10.75%, ROE 19.93%, ROCE 36.36% | 80, 80, 100 | 21.50 |
| Growth | revenue +16.67%, PAT +31.90% | 80, 100 | 22.50 |
| **Total** | | | **82.75** |

Leverage, for example: 0.5 × 65 + 0.3 × 85 + 0.2 × 85 = 75 points out of 100, × 25/100 = 18.75.

## Display

The score is returned at full precision and rounded to the nearest integer for display. The
band tables above are the only thing that moves the score; changing them changes every score in
the product, so a change needs a version bump and a note here.
