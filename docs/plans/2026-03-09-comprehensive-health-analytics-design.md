# Comprehensive Health Analytics Design

This design upgrades two distinct report surfaces:
1. The photo recognition nutrition report becomes a single long-form report block instead of stacked white cards.
2. The homepage AI health area becomes a tabbed analytics surface with "今日健康洞察" and "本周健康周报" backed by aggregated daily/weekly data.

## Scope
- Keep the photo-recognition report focused on the meal itself.
- Move cross-day and cross-behavior analytics into homepage analytics.
- Use server-side deterministic aggregation for metrics and LLM only for interpretation/report generation.

## Backend
- Add `buildDailyHolisticInsightPrompt` and `buildWeeklyHealthReportPrompt` in `src/server/aiService.ts`.
- Add analytics aggregation helpers and routes in `server.ts`:
  - `GET /api/analytics/daily`
  - `GET /api/analytics/weekly`
- Aggregate from logs, habits, fasting, and profile before calling the text engine.

## Frontend
- Replace the current string-based homepage AI advice block with a structured report panel featuring two tabs.
- Introduce typed report response models in `src/types.ts`.
- Add client fetchers in `src/services/aiClient.ts`.
- Refactor `NutritionInsightCard` into a single continuous report layout with section dividers and no nested white tiles.

## UI Rules
- Use one continuous report card per surface.
- Use section dividers only, not floating inner cards.
- Use monospace for numeric values and metric tables.

## Error Handling
- Analytics routes must return fallback structured reports if AI fails.
- Frontend must render fallback sections instead of blank strings.

## Verification
- Type-check with `npm.cmd run lint`.
- Manually verify:
  - photo analysis still renders after image recognition
  - homepage tab switch loads daily/weekly report
  - weekly report still renders when there is sparse data
