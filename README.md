![FitTrack AI Logo](./docs/screenshots/FitTrack%20AI_logo.png)

# FitTrack-AI

FitTrack-AI is a `React + Express + SQLite` health tracking system built around a closed feedback loop: log, recognize, analyze, and adjust. It combines nutrition logging, exercise records, body metrics, intermittent fasting, self-discipline tracking, and dual-engine AI analysis in a single product.

## Screenshots

Product screenshots are stored under:

- `docs/screenshots/`

This folder contains the latest captured views for the major product modules, including dashboard, logs, fasting, body metrics, self-discipline, and analytics reports.

## Technical Highlights

1. Dual-engine AI architecture
   - A vision engine handles image understanding and food description.
   - A reasoning engine handles structured JSON, nutrition estimation, balanced diet analysis, and report generation.
   - The pipeline uses a two-step flow: image description first, structured reasoning second. This reduces failure rates when multimodal models are forced to output complex JSON directly.

2. Independent route boundaries
   - The self-discipline module is no longer only a tab-state view.
   - It is mounted as an independent hash route at `#/discipline`, so refreshes keep the user on the target page.
   - This keeps the current stack lightweight while preserving a clean migration path to `react-router-dom`.

3. Fault-tolerant streak algorithm
   - `GET /api/habits/today` returns `current_streak` for each habit.
   - The rule is:
     - if today is done, count backward from today
     - if today is not done but yesterday is done, count backward from yesterday
     - otherwise the streak is `0`
   - Historical APIs also return `max_streak`, which preserves the best historical streak even after a habit is archived.

4. Strong data boundaries
   - Archived habits do not appear in today’s active task list.
   - Archived habit history still contributes to heatmaps and streak statistics, so prior effort is never erased.

5. Food-specific unit conversion
   - Every custom unit is bound to a specific `food_id`.
   - Calculations strictly follow:
     - `amount * grams_per_unit`
     - `totalWeight`
     - `per_100g` nutrition conversion

## Core Capabilities

### 1. Food and exercise logging

- Daily food and exercise logging
- Food-specific unit conversion
- Photo-based calorie and macro prefill

### 2. AI nutrition analysis

- Structured outputs such as `health_score`, `alert_level`, and `analysis_report`
- Frontend presentation through `NutritionInsightCard`
- Mobile-first report-style rendering for food photo analysis

### 3. Body metrics and intermittent fasting

- Body measurement timeline with photos
- Side-by-side body comparison
- Fasting phase, status, and progress ring

### 4. Self-discipline module

- Today task list
- Heatmap visualization
- 30-day habit trend curve
- Current streak and max streak tracking

### 5. Daily and weekly health analytics

- `Daily Health Insight`
- `Weekly Health Report`
- Aggregated analysis across food logs, exercise records, and discipline signals

## Project Structure

### Frontend

- `src/App.tsx`
  - Main entry, route switching, dashboard aggregation, and product orchestration
- `src/components/`
  - Reusable UI such as `LogForm`, `NutritionInsightCard`, `HabitHeatmap`, and `HabitTrendCurve`
- `src/pages/`
  - Page-level views such as `SelfDisciplinePage` and `HealthReportPage`

### Backend

- `server.ts`
  - Express entry point
  - REST APIs, AI orchestration, health checks, static assets, and analytics endpoints
- `src/server/db.ts`
  - SQLite schema bootstrap and data access layer
- `src/server/aiService.ts`
  - Prompt templates, model normalization, structured parsing, and fallback handling
- `src/server/bodyMetricsService.ts`
  - Local image persistence and body-metrics CRUD
- `src/server/fastingService.ts`
  - Fasting state calculation and workflow logic

## Database Design

SQLite runs in `WAL` mode to support safer concurrent access on Windows.

Primary tables:

1. `users`
2. `foods`
3. `food_units`
4. `logs`
5. `body_metrics`
6. `fasting_logs`
7. `habits`
8. `habit_logs`

Key rules:

- `food_units` must always belong to a specific `food_id`
- `habit_logs` use `UNIQUE(habit_id, date)` to guarantee a single daily state per habit

## Environment Variables

Runtime configuration is server-side. The frontend does not hold provider secrets.

### Base variables

```env
PORT=3000
NODE_ENV=development
```

### Engine configuration

```env
GEMINI_API_KEY=
GEMINI_BASE_URL=

ZHIPU_API_KEY=
ZHIPU_BASE_URL=
ZHIPU_TEXT_MODEL=
ZHIPU_VISION_MODEL=

TONGYI_API_KEY=
TONGYI_BASE_URL=
TONGYI_TEXT_MODEL=
TONGYI_VISION_MODEL=

SILRA_API_KEY=
SILRA_BASE_URL=
SILRA_TEXT_MODEL=
SILRA_VISION_MODEL=
```

Notes:

1. Text and vision models are configured separately.
2. When using `Silra` as a compatibility gateway, the vision model must be a true image-capable model such as `qwen-vl-plus`, `glm-4.5v`, or `gemini-3.1-pro-preview`.
3. Pure text models such as `deepseek-v3` or `deepseek-chat` must not be assigned to the vision chain.

## Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the actual provider keys and model settings.

### 3. Start the development server

```bash
npm run dev
```

By default:

- Vite serves the frontend
- Express serves the API
- SQLite is stored at `db/fittrack.db`

## Key APIs

### AI

- `POST /api/ai/generate`
- `GET /api/health`
- `GET /api/ai/health-check`
- `GET /api/analytics/daily`
- `GET /api/analytics/weekly`

### Foods and logs

- `GET /api/foods/search`
- `POST /api/foods`
- `GET /api/logs/:date`
- `POST /api/logs/:type`
- `PUT /api/logs/:id`

### Body metrics

- `GET /api/body-metrics`
- `POST /api/body-metrics`
- `DELETE /api/body-metrics/:id`

### Fasting

- `GET /api/fasting/current`
- `POST /api/fasting/start`
- `POST /api/fasting/end`

### Discipline

- `GET /api/habits`
- `POST /api/habits`
- `PUT /api/habits/:id`
- `PATCH /api/habits/:id/archive`
- `GET /api/habits/today`
- `POST /api/habits/:id/check-in`
- `GET /api/habits/heatmap`
- `GET /api/habits/:id/history`

## Discipline Module Notes

### Today list

`GET /api/habits/today` returns:

- current date
- completed count
- total count
- per-habit status
- `current_streak`

### Heatmap

`GET /api/habits/heatmap?days=90` returns daily aggregated:

- `completed`
- `total`
- `rate`
- `level (0-4)`

Darker cells indicate stronger completion rates.

### Individual trend

`GET /api/habits/:id/history?days=30` returns:

- a continuous 30-day status series
- `max_streak`

Missing dates are backfilled as `pending` by the backend so the frontend trend line remains continuous.

## Verification

### Type check

```bash
npm run lint
```

Current lint command:

```bash
tsc --noEmit
```

### Suggested regression checks

1. Save text and vision model settings, then run `GET /api/health`
2. Upload a food image and verify:
   - image recognition succeeds
   - structured nutrition output is returned
   - the AI nutrition analysis card renders correctly
3. Complete a habit in the discipline page and verify:
   - completed count updates
   - `current_streak` updates
   - the completion animation triggers
   - heatmap and trend history remain consistent

## License

Before using this project in your own environment, verify the licensing and compliance requirements of the connected model providers, image data, and third-party dependencies.
