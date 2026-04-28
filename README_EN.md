# FitTrack-AI

[中文](./README.md)

FitTrack-AI is an AI-powered full-stack health tracking project built around a closed loop: log, understand, analyze, and adjust. It combines nutrition logging, exercise tracking, body metrics, intermittent fasting, habit tracking, and dual-engine AI analysis into one integrated product prototype.

This repository is positioned as a portfolio-grade project: not just a UI showcase, and not a toy app that calls an LLM once. It is a runnable AI health-management prototype that highlights multimodal understanding, structured outputs, mixed voice-log parsing, health analytics pipelines, and local persistence.

## Resume-ready Summary

> A full-stack AI health management project built with `React + Express + SQLite`, integrating image recognition, speech-to-text, structured log extraction, and daily/weekly health analytics. The main engineering focus is on dual-engine AI orchestration, mixed voice-log persistence, missing-unit recovery, and habit streak rule modeling.

## At a Glance

- Project type: `React + Express + SQLite` full-stack AI application
- Main scenarios: nutrition, exercise, body metrics, fasting, habit tracking, AI health analysis
- AI capabilities: image recognition, speech-to-text, structured extraction, daily/weekly analytics
- Engineering focus: dual-engine AI orchestration, mixed voice-log persistence, missing-unit recovery, streak-rule modeling
- Portfolio value: suitable for data analysis, algorithm engineering, and LLM application roles

## Why This Project Matters

If you are reviewing this repository from an interview or hiring perspective, these are the main signals:

1. It is a complete `React + Express + SQLite` full-stack project rather than a one-feature demo.
2. AI capabilities are embedded into actual product workflows instead of being isolated showcase calls.
3. The project includes a realistic multimodal pipeline: image recognition, speech-to-text, structured extraction, log persistence, and daily/weekly analytics.
4. It explicitly handles engineering edge cases such as unstable model outputs, missing unit conversions, route persistence, archived history retention, and streak calculation.
5. It is a strong portfolio project for data analysis, algorithm engineering, and LLM application roles because it demonstrates product sense, engineering execution, and AI integration together.

## Highlights

### 1. Dual-engine AI architecture

- A vision model handles food image understanding and descriptive recognition.
- A reasoning model handles structured JSON, nutrition estimation, health scoring, and analysis report generation.
- The system uses a two-stage pipeline instead of forcing a multimodal model to directly output complex structured data.

Why is this important? Because multimodal models are more likely to drift when they must both interpret images and return strict JSON at the same time. Splitting the flow into description first and structured reasoning second is a more reliable engineering trade-off.

### 2. Voice logging built for real workflows

- Users can describe both food and exercise in a single natural-language sentence.
- The backend performs STT first, then structured extraction, then manual review, and finally batch persistence.
- If a matched food is missing a food-specific unit, the system asks AI to estimate `grams_per_unit` and `calories_per_unit`, stores the unit, and retries the write.
- If that recovery still fails, the system degrades gracefully instead of failing the entire batch.

The real challenge here is not speech recognition itself. The challenge is how to safely connect ambiguous spoken language to a structured domain model and existing database workflow.

### 3. Habit tracking is treated as a business rule problem, not just a UI tab

- The discipline module is mounted as an independent route at `#/discipline`.
- `current_streak` follows a fault-tolerant rule:
  - if today is completed, count backward from today;
  - if today is not completed but yesterday is completed, count backward from yesterday;
  - otherwise return `0`.
- `max_streak` remains available even after a habit is archived.

Why does this matter? Because it shows the project is modeling behavior carefully rather than only rendering screens.

### 4. Data boundaries are designed with product realism

- `food_units` are tied to specific `food_id` values.
- `habit_logs` enforce `UNIQUE(habit_id, date)` for a single daily state.
- Archived habits disappear from active lists but still contribute to historical visualizations and analytics.
- SQLite runs in `WAL` mode, which is a practical choice for local Windows development.

## What You Will Find

### Nutrition and exercise logging

- Daily food and exercise records
- Food-specific unit conversion
- Photo-based nutrition prefill

### AI health analysis

- Structured outputs such as `health_score`, `alert_level`, and `analysis_report`
- Aggregated daily and weekly analysis
- Frontend rendering via components such as `NutritionInsightCard`

### Body metrics and fasting

- Body measurement and photo history
- Side-by-side body comparison
- Fasting status and progress tracking

### Habit tracking

- Daily task list
- Heatmap visualization
- 30-day trend chart
- Current streak and historical max streak

### Voice-first logging

- Server-side speech transcription
- Chinese natural-language mixed extraction
- Review-before-write workflow
- AI-assisted recovery for missing units

## Tech Stack

### Frontend

- `React 19`
- `Vite`
- `TypeScript`
- `Recharts`
- `Motion`

### Backend

- `Express`
- `better-sqlite3`
- `Node.js`
- Custom AI orchestration services

### AI / multimodal layer

- Vision models
- Reasoning models
- Server-side STT pipeline
- Structured extraction and fallback strategy

## Key Engineering Decisions

### 1. Structured AI pipeline

- A vision model handles image understanding and food description first.
- A reasoning model then produces structured JSON, nutrition estimates, scoring, and analysis.
- This reduces schema drift compared with forcing a multimodal model to do everything in one step.

### 2. Voice logs can safely persist

- The backend separates STT, structured extraction, manual review, and batch persistence into distinct stages.
- If a matched food is missing a unit, AI estimates it and retries the write.
- If recovery still fails, the system degrades gracefully instead of failing the whole batch.

### 3. Business rules are modeled explicitly

- The discipline module uses an independent route to preserve state on refresh.
- `current_streak` is fault-tolerant, and `max_streak` remains available after archive.
- Archived habits leave the active list but still contribute to historical analytics.

### 4. Local data boundaries are clean

- `food_units` are tied to specific `food_id` values.
- `habit_logs` enforce `UNIQUE(habit_id, date)` for a single daily state.
- SQLite runs in `WAL` mode, which is a practical fit for local Windows development.

## Project Structure

```text
FitTrack-AI
├─ src/
│  ├─ components/        # Reusable UI components
│  ├─ pages/             # Page-level views
│  └─ server/            # Services, database layer, AI orchestration
├─ docs/screenshots/     # Project screenshots
├─ db/                   # SQLite database files
├─ public/               # Static assets
└─ server.ts             # Express entry point
```

Important files:

- `server.ts`: backend entry point for APIs, static assets, health checks, and AI workflows
- `src/server/db.ts`: SQLite schema bootstrap and data access logic
- `src/server/aiService.ts`: prompts, model orchestration, structured parsing, and fallbacks
- `src/server/voiceService.ts`: Chinese transcript extraction and rule-based parsing
- `src/server/voiceTranscriptionService.ts`: STT provider/model orchestration and fallback chain
- `src/App.tsx`: frontend entry and product workflow orchestration

## AI Workflows

### Image flow

1. A user uploads a food image.
2. The vision model generates a description and candidate details.
3. The reasoning model converts that description into structured nutrition data and health analysis.
4. The frontend renders the result and analysis cards.

### Voice flow

1. `/api/voice/transcribe` converts audio into text.
2. `/api/voice/extract` converts text into structured candidates.
3. The user reviews the extracted result.
4. `/api/voice/commit` batch-persists it.
5. If units are missing, the system attempts auto-recovery and retries.

## Screenshots

| Module | Preview |
| --- | --- |
| Dashboard | [dashboard.png](./docs/screenshots/dashboard.png) |
| Logs | [logs.png](./docs/screenshots/logs.png) |
| Daily analytics | [analytics-daily.png](./docs/screenshots/analytics-daily.png) |
| Weekly analytics | [analytics-weekly.png](./docs/screenshots/analytics-weekly.png) |
| Body metrics | [body-metrics.png](./docs/screenshots/body-metrics.png) |
| Body comparison | [body-comparison.png](./docs/screenshots/body-comparison.png) |
| Fasting | [fasting.png](./docs/screenshots/fasting.png) |
| Discipline | [discipline.png](./docs/screenshots/discipline.png) |
| Photo recognition | [photo-identify-1.png](./docs/screenshots/photo-identify-1.png), [photo-identify-2.png](./docs/screenshots/photo-identify-2.png) |

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the model provider settings.

```env
PORT=3000
NODE_ENV=development

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
VOICE_ASR_PROVIDER=
VOICE_ASR_MODELS=
```

### 3. Run the project

```bash
npm run dev
```

By default:

- Vite serves the frontend
- Express serves the API
- SQLite is stored at `db/fittrack.db`

## Main APIs

### AI and analytics

- `POST /api/ai/generate`
- `GET /api/health`
- `GET /api/ai/health-check`
- `GET /api/analytics/daily`
- `GET /api/analytics/weekly`

### Voice logging

- `POST /api/voice/transcribe`
- `POST /api/voice/extract`
- `POST /api/voice/commit`

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

## The Real Engineering Challenge

The most valuable part of this project is not any isolated feature. It is the combination of these questions:

1. How do you connect image recognition, speech transcription, and reasoning outputs to one stable data model?
2. How do you make model outputs structured enough for production workflows while still handling failure paths gracefully?
3. How do you keep business rules and persistence boundaries clean in a lightweight local SQLite setup?
4. How do you move health analysis from “the model can say something” to “the product can actually use it”?

These are productization questions, not just model-demo questions.

## Verification

### Type check

```bash
npm run lint
```

The current `lint` script runs:

```bash
tsc --noEmit
```

### Suggested regression checks

1. Configure both text and vision models, then call `GET /api/health`.
2. Upload a food image and verify recognition, structured nutrition output, and analysis rendering.
3. Run one complete voice logging flow and verify transcription, extraction, review, and commit.
4. Complete a habit check-in and verify `current_streak`, heatmap, and trend chart updates.

## Roadmap

- [ ] Add stronger model-provider switching and observability
- [ ] Gradually migrate from hash-based routing to a fuller routing system
- [ ] Add more systematic automated testing
- [ ] Improve trend explanation and anomaly detection
- [ ] Support richer user profiling and personalized recommendations

## Good Use Cases for This Repository

This repository works well as:

1. A full-stack portfolio project that demonstrates end-to-end delivery.
2. An LLM application project for interviews focused on multimodal workflows and structured output engineering.
3. A foundation for future extensions such as RAG, agent workflows, health recommendation systems, or user modeling.

## License

No explicit open-source license file is currently present in the repository.

If you plan to position this as a long-term public open-source project, adding a `LICENSE` file would make the usage boundary much clearer.
