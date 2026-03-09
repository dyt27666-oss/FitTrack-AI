# VISION_ENGINE_SPEC

## Purpose

The vision engine is not treated as an isolated calorie estimator. It is part of a broader health analytics pipeline that combines meal recognition, behavior completion, and activity records to produce metabolic guidance instead of single-point calorie commentary.

## System Boundary

1. Vision stage identifies food candidates, portion estimate, and macro approximation.
2. Deterministic aggregation stage computes daily and weekly nutrition, exercise, and discipline metrics in Express/SQLite.
3. Text analytics stage synthesizes a structured report from aggregated facts.

The model is not trusted for arithmetic. Energy totals, completion rate, streaks, and weekly averages are computed server-side before inference.

## Daily Insight Logic

Inputs:
- current-day food logs
- current-day exercise logs
- current-day habit completion states
- current streak values per habit
- profile context such as goal and target calories

Outputs:
- same-day health narrative
- remaining-day action guidance
- cross-domain interpretation of diet, activity, and discipline execution

## Weekly Report Logic

Inputs:
- 7-day food trend aggregates
- 7-day discipline completion series
- habit-level max streaks
- caloric intake/output averages

Outputs:
- weekly status tag
- high-risk lapse window
- next-week threshold adjustment guidance

## Covariance-Based Behavior Interpretation

The higher-order signal is not calories alone. The useful signal comes from co-movement between behavior domains:

1. When high-calorie intake repeatedly coincides with low discipline completion, the system treats this as a regulation instability pattern rather than an isolated meal issue.
2. When low activity and low protein intake co-occur on the same days, the system flags recovery and muscle-retention risk.
3. When streak continuity drops before intake quality worsens, the system interprets this as an early-warning behavioral lead indicator.

This is why the reporting layer is framed as metabolic guidance rather than simple calorie counting. The system is looking for repeated joint movement across variables:
- energy intake
- activity output
- habit completion rate
- streak continuity

## Fallback Strategy

If inference fails:
1. deterministic metrics are still returned
2. a structured fallback report is generated
3. the UI must remain render-safe and section-complete

## UI Contract

Daily and weekly reports are rendered as continuous report surfaces:
- no nested white subcards
- section separation by thin dividers only
- metrics displayed in monospace to improve scanability

## Engineering Constraint

Do not let the LLM invent totals. Numeric fields must be sourced from deterministic aggregation and passed through as fixed context. The LLM only interprets, prioritizes, and converts facts into action-oriented health guidance.
